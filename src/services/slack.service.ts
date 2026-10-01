import { serverConfig } from '../config';
import { signAuthToken, verifyAuthToken } from '../utils/jwt';

const db: any = require('../db/models');

const slackApi = 'https://slack.com/api';
const SLACK_TIMEOUT_MS = 8000;

/**
 * Slack is an optional, non-critical notification path.
 *
 * Delivery goes through an incoming webhook: the user picks the destination channel on
 * the authorize screen, so no channel has to be configured by hand on the server.
 *
 * sendRateLimitAlert never throws: a Slack outage, a revoked webhook or a missing
 * connection must never fail an email job. Only the OAuth helpers throw, because
 * there a request is waiting and the error belongs in the HTTP response.
 */
export type SlackDeliveryResult = {
  delivered: boolean;
  reason?: string;
};

const markConnectionInvalid = async (userId: number, reason: string) => {
  try {
    await db.SlackConnection.update(
      { status: 'invalid', lastError: reason, lastErrorAt: new Date() },
      { where: { userId } },
    );
  } catch (error: any) {
    console.error('Failed to mark Slack connection invalid', { userId, message: error?.message || 'unknown error' });
  }
};

const recordConnectionError = async (userId: number, reason: string) => {
  try {
    await db.SlackConnection.update(
      { lastError: reason, lastErrorAt: new Date() },
      { where: { userId } },
    );
  } catch (error: any) {
    console.error('Failed to record Slack error', { userId, message: error?.message || 'unknown error' });
  }
};

const postJson = async (url: string, body: any) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const getSlackConnectUrl = (userId: number, email: string) => {
  if (!serverConfig.SLACK_CLIENT_ID || !serverConfig.SLACK_REDIRECT_URI) {
    throw new Error(
      'Slack is not configured on this server. Set SLACK_CLIENT_ID and SLACK_REDIRECT_URI'
    );
  }

  const state = signAuthToken({ userId, email });

  const params = new URLSearchParams({
    client_id: serverConfig.SLACK_CLIENT_ID,
    redirect_uri: serverConfig.SLACK_REDIRECT_URI,
    state,

    // User selects the destination channel during OAuth.
    scope: 'incoming-webhook',
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

export const completeSlackOAuth = async (code: string, state: string) => {
  if (!serverConfig.SLACK_CLIENT_ID || !serverConfig.SLACK_CLIENT_SECRET) {
    throw new Error('Slack is not configured on this server. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET');
  }

  let identity: any;
  try {
    identity = verifyAuthToken(state);
  } catch {
    throw new Error('Slack OAuth state is invalid or expired. Start the connect flow again');
  }

  let result: any;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  try {
    const response = await fetch(`${slackApi}/oauth.v2.access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: serverConfig.SLACK_CLIENT_ID,
        client_secret: serverConfig.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: serverConfig.SLACK_REDIRECT_URI || '',
      }),
      signal: controller.signal,
    });
    result = await response.json();
  } catch (error: any) {
    throw new Error(`Could not reach Slack to exchange the code: ${error?.message || 'network error'}`);
  } finally {
    clearTimeout(timer);
  }

  if (!result?.ok) {
    throw new Error(`Slack OAuth failed: ${result?.error || 'unknown error'}`);
  }

  // Everything the alert path needs comes straight out of the OAuth response: the
  // webhook to POST to, and the channel the user picked on the authorize screen.
  const webhookUrl = result.incoming_webhook?.url || null;
  const channelId = result.incoming_webhook?.channel_id || null;
  const channelName = result.incoming_webhook?.channel || null;
  const teamId = result.team?.id || null;

  // Nothing partial is persisted: with no webhook there is no delivery target, so a
  // failed OAuth can never leave a half-connected row behind.
  if (!webhookUrl) {
    throw new Error('Slack did not return an incoming webhook. Re-authorize the app and pick a channel');
  }

  await db.SlackConnection.upsert({
    userId: Number(identity.userId),
    teamId,
    channelId,
    webhookUrl,
    connectedAt: new Date(),
    // Reconnecting clears a previous failure, so alerts resume with no redeploy.
    status: 'active',
    lastError: null,
    lastErrorAt: null,
  });

  return {
    userId: Number(identity.userId),
    teamId,
    channelId,
    channel: channelName,
  };
};

export const getSlackStatus = async (userId: number) => {
  const connection = await db.SlackConnection.findOne({ where: { userId } });
  if (!connection) {
    return { connected: false, status: 'not_connected' };
  }

  return {
    connected: connection.status === 'active' && Boolean(connection.webhookUrl),
    status: connection.status,
    teamId: connection.teamId,
    channelId: connection.channelId,
    connectedAt: connection.connectedAt,
    lastError: connection.lastError,
    lastErrorAt: connection.lastErrorAt,
  };
};

export const disconnectSlack = async (userId: number) => {
  const removed = await db.SlackConnection.destroy({ where: { userId } });
  return removed > 0;
};

/**
 * Posts a rate-limit alert to the user's Slack.
 *
 * Returns a result instead of throwing, so the worker can log the reason and carry on
 * rescheduling the email either way.
 */
export const sendRateLimitAlert = async (
  userId: number,
  senderId: number,
  hourlyLimit: number,
  rescheduledCount: number,
): Promise<SlackDeliveryResult> => {
  let connection: any;
  try {
    connection = await db.SlackConnection.findOne({ where: { userId } });
  } catch (error: any) {
    return { delivered: false, reason: `slack_lookup_failed: ${error?.message || 'unknown error'}` };
  }

  // User has not connected Slack: not an error, there is simply nothing to notify.
  if (!connection) {
    console.log('Slack not connected; skipping rate-limit alert', { userId, senderId });
    return { delivered: false, reason: 'not_connected' };
  }

  if (connection.status !== 'active') {
    console.log('Slack connection is marked invalid; skipping alert', { userId, senderId, lastError: connection.lastError });
    return { delivered: false, reason: 'connection_invalid' };
  }

  // An active row with no webhook cannot deliver anything: ask for a reconnect.
  if (!connection.webhookUrl) {
    const reason = 'missing_webhook';
    await markConnectionInvalid(userId, reason);
    console.error('Slack connection has no webhook URL', { userId, senderId });
    return { delivered: false, reason };
  }

  const text = [
    ':warning: *Email rate limit reached*',
    `Sender: \`${senderId}\``,
    `Hourly limit: *${hourlyLimit}*`,
    `Emails rescheduled into the next window: *${rescheduledCount}*`,
  ].join('\n');

  try {
    const response = await postJson(connection.webhookUrl, { text });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const reason = `webhook_${response.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`;
      // A revoked or deleted webhook returns 403/404/410: needs re-authorizing.
      if ([403, 404, 410].includes(response.status)) {
        await markConnectionInvalid(userId, reason);
      } else {
        await recordConnectionError(userId, reason);
      }
      console.error('Slack webhook delivery failed', { userId, senderId, reason });
      return { delivered: false, reason };
    }
    return { delivered: true };
  } catch (error: any) {
    // Slack unreachable / timed out: log it, the email still reschedules.
    const reason = `webhook_network_error: ${error?.message || 'unknown error'}`;
    await recordConnectionError(userId, reason);
    console.error('Slack webhook unreachable', { userId, senderId, reason });
    return { delivered: false, reason };
  }
};
