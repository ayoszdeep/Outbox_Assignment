import { Job, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { EMAIL_SCHEDULER_QUEUE, emailSchedulerQueue } from '../queues/mailer.queues';
import { getRedisConnObject } from '../config/redis.config';
import { getSenderTransporter } from '../services/sender.service';
import { serverConfig } from '../config';
import { sendRateLimitAlert } from '../services/slack.service';
import { updateIndexedEmail } from '../services/email-search.service';
import { randomUUID } from 'crypto';

const db: any = require('../db/models');

const redis = getRedisConnObject();

const getHourWindow = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}`;
};

const getNextHour = (date = new Date()) => {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
};

/**
 * Reserves one slot in the current hour window for this sender.
 *
 * The INCR/EXPIRE/rollback runs as a single Lua script so it stays correct across
 * multiple workers and instances. If the reservation would exceed the limit the
 * counter is rolled straight back, so the window can still fill to exactly the
 * limit and an over-limit attempt never permanently consumes quota.
 *
 * Returns the reserved count, or -1 when the sender is already at its limit.
 */
const RESERVE_RATE_SLOT_LUA = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
  if count > tonumber(ARGV[1]) then
    redis.call('DECR', KEYS[1])
    return -1
  end
  return count
`;

const getRateKey = (senderId: number) => `rate:${senderId}:${getHourWindow()}`;

const reserveRateSlot = async (senderId: number, hourlyLimit: number) => {
  const key = getRateKey(senderId);
  const count = Number(await redis.eval(RESERVE_RATE_SLOT_LUA, 1, key, String(hourlyLimit), '3600'));
  return { allowed: count !== -1, count, key };
};

/**
 * Hands a reservation back when the email did not actually go out (throttled or
 * the SMTP send failed). Without this the hourly quota would be consumed by
 * attempts that never delivered anything.
 */
const releaseRateSlot = async (senderId: number, key: string) => {
  try {
    const count = Number(await redis.get(key));
    if (count > 0) await redis.decr(key);
  } catch (error: any) {
    console.error('Failed to release rate slot', { senderId, key, message: error?.message || 'unknown error' });
  }
};

const tryAcquireSenderSlot = async (senderId: number) => {
  const key = `throttle:sender:${senderId}:lock`;
  const token = randomUUID();
  const minDelay = serverConfig.MIN_DELAY_MS || 2000;
  // Only a crash guard: the lock is released as soon as the send finishes. It has to
  // outlive a slow SMTP handshake, but must never become the retry interval.
  const lockTtl = Math.max(minDelay * 2, 30000);

  if ((await redis.set(key, token, 'PX', lockTtl, 'NX')) !== 'OK') {
    // Retry one min-delay later (plus jitter so a burst does not re-collide),
    // NOT after the lock's TTL - that would stall the sender for the whole TTL.
    return { retryAfterMs: minDelay + Math.floor(Math.random() * minDelay) };
  }

  return { release: async () => {
    await redis.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`,
      1,
      key,
      token,
    );
  } };
};

/**
 * Allocates the next free send slot for a sender, across every campaign it owns.
 *
 * `sequenceNumber` is numbered per campaign, so two campaigns both start at 1 and would
 * otherwise be handed the identical reschedule time for the same sender. This keeps one
 * Redis cursor per sender and hands out strictly increasing slots at least `gapMs` apart,
 * so two emails for one sender can never land on the same millisecond.
 *
 * `earliestMs` still carries the campaign's own spacing, so a campaign cannot be
 * reordered: its slot n+1 is always requested later than its slot n.
 *
 * Slot timestamps are formatted with %.0f because Lua would otherwise render a
 * millisecond epoch in scientific notation and lose precision.
 */
const ALLOCATE_SENDER_SLOT_LUA = `
  local earliest = tonumber(ARGV[1])
  local gap = tonumber(ARGV[2])
  local cursor = tonumber(redis.call('GET', KEYS[1]) or '0')
  local slot = earliest
  if cursor + gap > slot then slot = cursor + gap end
  local slotStr = string.format('%.0f', slot)
  redis.call('SET', KEYS[1], slotStr, 'PX', tonumber(ARGV[3]))
  return slotStr
`;

const allocateSenderSlot = async (senderId: number, earliestMs: number, gapMs: number) => {
  const key = `schedule:sender:${senderId}:cursor`;
  // Outlive the furthest slot handed out, then expire so an idle sender starts clean.
  const ttlMs = Math.max(earliestMs - Date.now(), 0) + 2 * 60 * 60 * 1000;

  try {
    const slot = await redis.eval(
      ALLOCATE_SENDER_SLOT_LUA,
      1,
      key,
      String(Math.round(earliestMs)),
      String(Math.round(gapMs)),
      String(Math.round(ttlMs)),
    );
    return Number(slot);
  } catch (error: any) {
    // Ordering is best-effort: fall back to the requested time rather than lose the email.
    console.error('Sender slot allocation failed; using requested time', { senderId, message: error?.message || 'unknown error' });
    return earliestMs;
  }
};

const addDelayedReplacement = async (emailId: number, delay: number, suffix: string) => emailSchedulerQueue.add(
  'email-job',
  { emailId },
  {
    jobId: `email-${emailId}-${suffix}-${Date.now()}`,
    delay: Math.max(0, delay),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
  },
);

/**
 * Sends at most one Slack alert per sender per hour window.
 *
 * Slack is a non-critical path: this never rethrows, so a Slack failure can never stop
 * the caller from rescheduling the email. Transient failures give the per-hour claim
 * back so a later job in the same window can retry the alert; "not connected" and
 * "invalid credential" keep the claim, because retrying those would just add noise.
 */
const RETRYABLE_ALERT_REASONS = (reason?: string) => Boolean(
  reason && reason !== 'not_connected' && reason !== 'connection_invalid',
);

const sendSingleSlackAlert = async (userId: number, senderId: number, hourlyLimit: number, rescheduledCount: number) => {
  const alertKey = `alert:${senderId}:${getHourWindow()}`;

  try {
    const claimed = await redis.set(alertKey, '1', 'EX', 3600, 'NX');
    if (claimed !== 'OK') return;
  } catch (error: any) {
    console.error('Could not claim Slack alert slot; skipping alert', { senderId, message: error?.message || 'unknown error' });
    return;
  }

  try {
    const result = await sendRateLimitAlert(userId, senderId, hourlyLimit, rescheduledCount);

    if (result.delivered) {
      console.log('Slack rate-limit alert delivered', { userId, senderId, hourlyLimit });
      return;
    }

    console.log('Slack rate-limit alert not delivered', { userId, senderId, reason: result.reason });
    if (RETRYABLE_ALERT_REASONS(result.reason)) {
      await redis.del(alertKey);
    }
  } catch (error: any) {
    // Defensive: sendRateLimitAlert is contracted not to throw, but the email path
    // must survive even if that contract is ever broken.
    console.error('Slack rate-limit alert threw unexpectedly', { userId, senderId, message: error?.message || 'unknown error' });
    try {
      await redis.del(alertKey);
    } catch {
      /* ignore - alert bookkeeping must not break the email job */
    }
  }
};

export const setupScheduledEmailWorker = () => {
  console.log('Worker started');
  console.log('Waiting for jobs...');

  const scheduledEmailProcessor = new Worker<{ emailId: number }>(
    EMAIL_SCHEDULER_QUEUE,
    async (job: Job<{ emailId: number }>) => {
      const emailId = Number(job.data?.emailId);

      if (!emailId) {
        throw new Error('Missing emailId');
      }

      const email = await db.Email.findByPk(emailId);
      if (!email) {
        throw new Error(`Email ${emailId} not found`);
      }

      console.log(`Processing job: ${job.id}`);
      console.log(`Email ID: ${emailId}`);

      if (email.status === 'sent') {
        console.log(`Email ${emailId} already sent; skipping duplicate job`);
        return { emailId, sent: false, skipped: true };
      }

      const [claimed] = await db.Email.update({
        status: 'processing',
        attempts: (email.attempts || 0) + 1,
      }, {
        where: { id: emailId, status: 'scheduled' },
      });

      if (claimed !== 1) {
        console.log(`Email ${emailId} was already claimed; skipping duplicate job`);
        return { emailId, sent: false, skipped: true };
      }

      const sender = await db.Sender.findByPk(email.senderId);
      if (!sender) {
        await db.Email.update({ status: 'failed', errorMessage: `Sender ${email.senderId} not found` }, { where: { id: emailId } });
        throw new Error(`Sender ${email.senderId} not found`);
      }

      const campaign = await db.Campaign.findByPk(email.campaignId);
      const hourlyLimit = Math.min(
        Number(campaign?.hourlyLimit || serverConfig.MAX_EMAILS_PER_HOUR || 100),
        Number(sender.hourlyLimit || serverConfig.MAX_EMAILS_PER_HOUR || 100),
        serverConfig.MAX_EMAILS_PER_HOUR || 100,
      );
      const rate = hourlyLimit > 0
        ? await reserveRateSlot(email.senderId, hourlyLimit)
        : { allowed: true, count: 0, key: getRateKey(email.senderId) };

      if (!rate.allowed) {
        const minDelay = serverConfig.MIN_DELAY_MS || 2000;
        const nextHour = getNextHour();
        // Keep this campaign's own spacing as the earliest acceptable time, then let the
        // per-sender cursor push it to a slot no other campaign is already holding.
        const campaignOffset = Math.max(campaign?.delayMs || 0, minDelay) * Math.max(0, Number(email.sequenceNumber || 1) - 1);
        const slotMs = await allocateSenderSlot(email.senderId, nextHour.getTime() + campaignOffset, minDelay);
        const scheduledAt = new Date(slotMs);
        await db.Email.update({ status: 'scheduled', attempts: email.attempts || 0, scheduledAt }, { where: { id: emailId, status: 'processing' } });
        await updateIndexedEmail(emailId);
        const pendingForSender = await db.Email.count({ where: { senderId: email.senderId, status: 'scheduled' } });
        await sendSingleSlackAlert(email.userId, email.senderId, hourlyLimit, pendingForSender);
        const rescheduledJob = await addDelayedReplacement(emailId, slotMs - Date.now(), `rate-${getHourWindow(scheduledAt)}`);
        await db.Email.update({ bullJobId: rescheduledJob.id }, { where: { id: emailId } });
        console.log(`Email ${emailId} rate limited; rescheduled for ${scheduledAt.toISOString()}`);
        return { emailId, sent: false, rescheduled: true };
      }

      console.log(`Sender ID: ${sender.id}`);
      console.log(`Sender email: ${sender.email}`);
      console.log('SMTP connection / sending started');

      const transporter = getSenderTransporter(sender);
      const senderSlot = await tryAcquireSenderSlot(email.senderId);

      if (senderSlot.retryAfterMs) {
        // The email is not going out on this pass, so give the hourly slot back.
        if (rate.allowed && hourlyLimit > 0) await releaseRateSlot(email.senderId, rate.key);
        // Take a cursor slot rather than a flat retry: concurrent bounces for one sender
        // then queue up in arrival order, spaced MIN_DELAY_MS apart, instead of colliding.
        const slotMs = await allocateSenderSlot(
          email.senderId,
          Date.now() + senderSlot.retryAfterMs,
          serverConfig.MIN_DELAY_MS || 2000,
        );
        const scheduledAt = new Date(slotMs);
        await db.Email.update({ status: 'scheduled', attempts: email.attempts || 0, scheduledAt }, { where: { id: emailId, status: 'processing' } });
        await updateIndexedEmail(emailId);
        const replacement = await addDelayedReplacement(emailId, slotMs - Date.now(), 'throttle');
        await db.Email.update({ bullJobId: replacement.id }, { where: { id: emailId } });
        console.log(`Email ${emailId} throttled; rescheduled for ${scheduledAt.toISOString()}`);
        return { emailId, sent: false, rescheduled: true };
      }

      try {
        const info = await transporter.sendMail({
          from: `"${sender.name}" <${sender.email}>`,
          to: email.recipient,
          subject: email.subject,
          html: email.body,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`Ethereal preview: ${previewUrl}`);
        }

        await db.Email.update({
          status: 'sent',
          sentAt: new Date(),
        }, {
          where: { id: emailId, status: 'processing' },
        });
        await updateIndexedEmail(emailId);
      } catch (error: any) {
        // Nothing was delivered, so the hourly quota must not be consumed.
        if (rate.allowed && hourlyLimit > 0) await releaseRateSlot(email.senderId, rate.key);
        const finalAttempt = (job.attemptsMade + 1) >= 3;
        await db.Email.update({
          status: finalAttempt ? 'failed' : 'scheduled',
          errorMessage: error?.message || 'SMTP send failed',
        }, {
          where: { id: emailId, status: 'processing' },
        });
        await updateIndexedEmail(emailId);
        throw error;
      } finally {
        await new Promise((resolve) => setTimeout(resolve, serverConfig.MIN_DELAY_MS || 2000));
        await senderSlot.release!();
      }

      return { emailId, sent: true };
    },
    {
      connection: getRedisConnObject(),
      concurrency: serverConfig.WORKER_CONCURRENCY || 1,
    }
  );

  scheduledEmailProcessor.on('failed', (job, err) => {
    console.error('Scheduled email processing failed', { jobId: job?.id, err: err.message });
  });

  scheduledEmailProcessor.on('completed', (job) => {
    console.log('Scheduled email processed successfully', { jobId: job.id });
  });
};
