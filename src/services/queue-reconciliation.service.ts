import { Op } from 'sequelize';
import { emailSchedulerQueue } from '../queues/mailer.queues';
import logger from '../config/logger.config';

const db: any = require('../db/models');

/**
 * How long an email may sit in `processing` before a restart treats it as abandoned.
 *
 * A live worker only holds that status for the length of one SMTP send plus the min-delay
 * cooldown, so a generous window means we can never steal a job from a worker that is
 * still running.
 */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

const requeue = async (email: any) => {
  const job = await emailSchedulerQueue.add('email-job', { emailId: email.id }, {
    jobId: `email-${email.id}`,
    delay: Math.max(0, new Date(email.scheduledAt).getTime() - Date.now()),
    ...JOB_OPTIONS,
  });

  await email.update({ bullJobId: job.id });
};

/**
 * Re-attaches the database to the queue on boot, which is what makes scheduling survive a
 * restart of the API, the worker, or Redis itself.
 *
 * Nothing is re-sent: BullMQ keeps its delayed set in Redis, so an email that still has a
 * live job is left completely alone, and only rows with no job behind them are repaired.
 * Combined with the worker's conditional `scheduled -> processing` claim, a duplicate job
 * for an email that already went out is a no-op.
 */
export const reconcileScheduledEmails = async () => {
  let repaired = 0;

  // 1. Future (or overdue) emails whose delayed job is gone - e.g. a wiped Redis volume.
  const scheduled = await db.Email.findAll({
    where: { status: 'scheduled' },
    attributes: ['id', 'scheduledAt', 'bullJobId'],
    order: [['id', 'ASC']],
  });

  for (const email of scheduled) {
    const existingJob = email.bullJobId ? await emailSchedulerQueue.getJob(email.bullJobId) : null;
    if (existingJob) continue;

    await requeue(email);
    repaired += 1;
  }

  // 2. Emails a worker was killed in the middle of. Without this they would stay
  //    'processing' forever: the claim update can never match them again, so every
  //    redelivered job would skip them as already-claimed.
  const abandoned = await db.Email.findAll({
    where: {
      status: 'processing',
      updatedAt: { [Op.lt]: new Date(Date.now() - STALE_PROCESSING_MS) },
    },
    attributes: ['id', 'scheduledAt', 'bullJobId', 'updatedAt'],
    order: [['id', 'ASC']],
  });

  for (const email of abandoned) {
    const existingJob = email.bullJobId ? await emailSchedulerQueue.getJob(email.bullJobId) : null;
    if (existingJob) continue;

    logger.warn(`Email ${email.id} was left in processing by a stopped worker; rescheduling it`);
    await email.update({ status: 'scheduled' });
    await requeue(email);
    repaired += 1;
  }

  return repaired;
};
