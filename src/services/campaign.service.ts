import { emailSchedulerQueue } from '../queues/mailer.queues';
import { indexEmail } from './email-search.service';
import { serverConfig } from '../config';
const db: any = require('../db/models');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pulls every email address out of an uploaded CSV / text lead list.
 *
 * Deliberately tolerant, because lead lists are not written by us: a file may or may not
 * have a header row, may have one column or several (`name,email,company`), may be comma,
 * semicolon or tab separated, and often arrives with a UTF-8 BOM. Rather than assume a
 * layout, every cell is tested and only the ones that look like an address are kept, so a
 * header is ignored without also throwing away a file that has no header at all.
 *
 * Duplicates are collapsed, so one campaign can never mail the same person twice.
 */
export const parseLeadEmails = (text: string) => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const emails: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    for (const cell of line.split(/[,;\t]/)) {
      const candidate = cell.trim().replace(/^["']|["']$/g, '');
      if (emailRegex.test(candidate)) emails.push(candidate.toLowerCase());
    }
  }

  return Array.from(new Set(emails));
};

const parseCsvEmails = (file: Express.Multer.File | undefined) => {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new Error('CSV file is required');
  }

  return parseLeadEmails(file.buffer.toString('utf8'));
};

const getDateFromInput = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid startTime');
  }
  return parsed;
};

export const scheduleCampaign = async (userId: number, data: any, file?: Express.Multer.File) => {
  const subject = String(data?.subject || '').trim();
  const body = String(data?.body || '').trim();
  const senderId = Number(data?.senderId);
  const startTime = data?.startTime ? getDateFromInput(data.startTime) : null;
  // Pacing is optional on the request: when it is left out the configured defaults apply
  // instead of the request being rejected, and nothing is hardcoded here.
  const delayMs = data?.delayMs === undefined || data?.delayMs === null || data?.delayMs === ''
    ? Number(serverConfig.MIN_DELAY_MS)
    : Number(data.delayMs);
  const hourlyLimit = data?.hourlyLimit === undefined || data?.hourlyLimit === null || data?.hourlyLimit === ''
    ? Number(serverConfig.MAX_EMAILS_PER_HOUR)
    : Number(data.hourlyLimit);

  if (!subject) throw new Error('subject is required');
  if (!body) throw new Error('body is required');
  if (!senderId || Number.isNaN(senderId)) throw new Error('senderId is required');
  if (!startTime) throw new Error('startTime is required');
  if (!Number.isFinite(delayMs) || delayMs <= 0) throw new Error('delayMs must be greater than 0');
  if (!Number.isFinite(hourlyLimit) || hourlyLimit <= 0) throw new Error('hourlyLimit must be greater than 0');

  const sender = await db.Sender.findOne({ where: { id: senderId, userId } });
  if (!sender) {
    throw new Error('Sender not found for this user');
  }

  const recipients = parseCsvEmails(file);
  if (!recipients.length) {
    throw new Error('No valid email addresses found in CSV');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const campaign = await db.Campaign.create({
      userId,
      senderId,
      subject,
      body,
      startTime,
      delayMs,
      hourlyLimit,
    }, { transaction });

    const emailRecords = recipients.map((recipient: string, index: number) => ({
      userId,
      campaignId: campaign.id,
      senderId,
      recipient,
      subject,
      body,
      sequenceNumber: index + 1,
      scheduledAt: new Date(startTime.getTime() + (index * delayMs)),
      status: 'scheduled',
      attempts: 0,
    }));

    const createdEmails = await db.Email.bulkCreate(emailRecords, { transaction });

    for (const email of createdEmails) {
      const jobId = `email-${email.id}`;
      const delay = Math.max(0, new Date(email.scheduledAt).getTime() - Date.now());

      const job = await emailSchedulerQueue.add(
        'email-job',
        { emailId: email.id },
        {
          jobId,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
        }
      );

      await db.Email.update({ bullJobId: job.id }, {
        where: { id: email.id },
        transaction,
      });
    }

    await transaction.commit();
    await Promise.all(createdEmails.map((email: any) => indexEmail(email)));

    return {
      campaignId: campaign.id,
      leadCount: recipients.length,
      emailCount: createdEmails.length,
      jobsCreated: createdEmails.length,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
