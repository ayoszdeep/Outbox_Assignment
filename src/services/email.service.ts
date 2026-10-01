import { serverConfig } from '../config';

const db: any = require('../db/models');
import { emailSchedulerQueue } from '../queues/mailer.queues';
import { indexEmail } from './email-search.service';

const allowedStatuses = new Set(['scheduled', 'processing', 'sent', 'failed']);

export const listEmails = async (userId: number, status?: string, page = 1, limit = 20) => {
  const where: any = { userId };
  if (status && allowedStatuses.has(status)) where.status = status;

  const offset = (page - 1) * limit;
  const result = await db.Email.findAndCountAll({
    where,
    attributes: ['id', 'recipient', 'subject', 'body', 'senderId', 'scheduledAt', 'sentAt', 'status', 'attempts', 'errorMessage', 'bullJobId'],
    order: [['id', 'DESC']],
    offset,
    limit,
  });

  return {
    rows: result.rows,
    count: result.count,
    page,
    limit,
    totalPages: Math.ceil(result.count / limit),
  };
};

export const scheduleSingleEmail = async (userId: number, data: any) => {
  const recipient = String(data?.recipient || '').trim();
  const subject = String(data?.subject || '').trim();
  const body = String(data?.body || '').trim();
  const senderId = Number(data?.senderId);
  const scheduledAt = new Date(data?.scheduledAt || Date.now());
  // Defaults come from config, never hardcoded, so limits stay env-driven.
  const delayMs = Number(data?.delayMs || serverConfig.MIN_DELAY_MS || 2000);
  const hourlyLimit = Number(data?.hourlyLimit || serverConfig.MAX_EMAILS_PER_HOUR || 100);

  if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) throw new Error('Valid recipient is required');
  if (!subject) throw new Error('subject is required');
  if (!body) throw new Error('body is required');
  if (!senderId || !Number.isInteger(senderId)) throw new Error('senderId is required');
  if (Number.isNaN(scheduledAt.getTime())) throw new Error('Invalid scheduledAt');

  const sender = await db.Sender.findOne({ where: { id: senderId, userId } });
  if (!sender) throw new Error('Sender not found');

  const campaign = await db.Campaign.create({ userId, senderId, subject, body, startTime: scheduledAt, delayMs, hourlyLimit });
  const email = await db.Email.create({ userId, campaignId: campaign.id, senderId, recipient, subject, body, sequenceNumber: 1, scheduledAt, status: 'scheduled', attempts: 0 });
  const job = await emailSchedulerQueue.add('email-job', { emailId: email.id }, {
    jobId: `email-${email.id}`,
    delay: Math.max(0, scheduledAt.getTime() - Date.now()),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
  });
  await email.update({ bullJobId: job.id });
  await indexEmail(email);

  return { campaignId: campaign.id, emailId: email.id, jobId: job.id };
};
