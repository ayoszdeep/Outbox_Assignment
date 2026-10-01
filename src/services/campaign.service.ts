import { emailSchedulerQueue } from '../queues/mailer.queues';
import { indexEmail } from './email-search.service';
const db: any = require('../db/models');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseCsvEmails = (file: Express.Multer.File | undefined) => {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new Error('CSV file is required');
  }

  const text = file.buffer.toString('utf8');
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (rows.length < 2) {
    throw new Error('CSV file must contain at least one email row');
  }

  const emails = rows.slice(1).map((row) => row.replace(/^"|"$/g, '').trim());

  const unique = Array.from(new Set(emails.filter(Boolean)));
  const valid = unique.filter((email) => emailRegex.test(email));

  return valid;
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
  const delayMs = Number(data?.delayMs);
  const hourlyLimit = Number(data?.hourlyLimit);

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
