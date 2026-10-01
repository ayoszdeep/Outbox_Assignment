import { serverConfig } from '../config';
import { signAuthToken, verifyAuthToken } from '../utils/jwt';

const db: any = require('../db/models');

const slackApi = 'https://slack.com/api';
const SLACK_TIMEOUT_MS = 8000;

/**
 * Slack is an optional, non-critical notification path.
 *
 * sendRateLimitAlert never throws: a Slack outage, a revoked token or a missing
 * connection must never fail an email job. Only the OAuth helpers throw, because
 * there a request is waiting and the error belongs in the HTTP response.
 */
export type SlackDeliveryResult = {
  delivered: boolean;
  reason?: string;
};

// Slack errors meaning the stored credential is no longer usable. The connection is
// marked invalid so the dashboard can prompt a reconnect.
const TOKEN_ERRORS = new Set([
  'invalid_auth',
  'not_authed',
  'token_revoked',
  'token_expired',
  'account_inactive',
  'invalid_token',
]);

// Slack errors meaning the credential is fine but the target channel is unreachable.
const CHANNEL_ERRORS = new Set([
  'channel_not_found',
  'not_in_channel',
  'is_archived',
  'channel_is_archived',
]);

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

const postJson = async (url: string, body: any, headers: Record<string, string> = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const getSlackConnectUrl = (userId: number, email: string) => {
  if (!serverConfig.SLACK_CLIENT_ID || !serverConfig.SLACK_REDIRECT_URI) {
    throw new Error('Slack is not configured on this server. Set SLACK_CLIENT_ID and SLACK_REDIRECT_URI');
  }

  const state = signAuthToken({ userId, email });
  const params = new URLSearchParams({
    client_id: serverConfig.SLACK_CLIENT_ID,
    redirect_uri: serverConfig.SLACK_REDIRECT_URI,
    state,
    // incoming-webhook makes the channel self-configuring: the user picks it during
    // authorize, so no SLACK_CHANNEL_ID has to be hand-set for the demo to work.
    scope: 'incoming-webhook',
    user_scope: 'chat:write',
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

  // Prefer the incoming webhook (channel chosen during authorize); otherwise fall back
  // to a user token posting into an explicitly configured channel.
  const webhookUrl = result.incoming_webhook?.url || null;
  const accessToken = result.authed_user?.access_token || result.access_token || null;
  const channelId = result.incoming_webhook?.channel_id || serverConfig.SLACK_CHANNEL_ID || null;

  // Nothing partial is persisted: without a usable delivery target no record is created,
  // so a failed OAuth can never leave a half-connected row behind.
  if (!webhookUrl && !accessToken) {
    throw new Error('Slack did not return a usable token or webhook. Re-authorize the app');
  }
  if (!webhookUrl && !channelId) {
    throw new Error('Slack returned no webhook channel. Grant the incoming-webhook scope or set SLACK_CHANNEL_ID');
  }

  await db.SlackConnection.upsert({
    userId: Number(identity.userId),
    teamId: result.team?.id || null,
    channelId,
    accessToken,
    webhookUrl,
    connectedAt: new Date(),
    // Reconnecting clears a previous failure, so alerts resume with no redeploy.
    status: 'active',
    lastError: null,
    lastErrorAt: null,
  });

  return {
    userId: Number(identity.userId),
    teamId: result.team?.id || null,
    channel: result.incoming_webhook?.channel || null,
    via: webhookUrl ? 'webhook' : 'user_token',
  };
};

export const getSlackStatus = async (userId: number) => {
  const connection = await db.SlackConnection.findOne({ where: { userId } });
  if (!connection) {
    return { connected: false, status: 'not_connected' };
  }

  return {
    connected: connection.status === 'active' && Boolean(connection.accessToken || connection.webhookUrl),
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

  const text = [
    ':warning: *Email rate limit reached*',
    `Sender: \`${senderId}\``,
    `Hourly limit: *${hourlyLimit}*`,
    `Emails rescheduled into the next window: *${rescheduledCount}*`,
  ].join('\n');

  // Webhook delivery path.
  if (connection.webhookUrl) {
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
  }

  // User-token delivery path.
  if (!connection.channelId) {
    const reason = 'missing_channel';
    await recordConnectionError(userId, reason);
    console.error('Slack connection has no channel configured', { userId, senderId });
    return { delivered: false, reason };
  }

  try {
    const response = await postJson(
      `${slackApi}/chat.postMessage`,
      { channel: connection.channelId, text },
      { Authorization: `Bearer ${connection.accessToken}` },
    );
    const result: any = await response.json();

    if (!result?.ok) {
      const reason = String(result?.error || 'unknown error');
      if (TOKEN_ERRORS.has(reason)) {
        // Token rejected: mark invalid so the dashboard can prompt a reconnect.
        await markConnectionInvalid(userId, reason);
        console.error('Slack token rejected; connection marked invalid', { userId, senderId, reason });
      } else if (CHANNEL_ERRORS.has(reason)) {
        // Channel unreachable: keep the token, surface the problem.
        await recordConnectionError(userId, reason);
        console.error('Slack channel unreachable', { userId, senderId, reason });
      } else {
        await recordConnectionError(userId, reason);
        console.error('Slack message failed', { userId, senderId, reason });
      }
      return { delivered: false, reason };
    }

    return { delivered: true };
  } catch (error: any) {
    const reason = `network_error: ${error?.message || 'unknown error'}`;
    await recordConnectionError(userId, reason);
    console.error('Slack unreachable', { userId, senderId, reason });
    return { delivered: false, reason };
  }
};
