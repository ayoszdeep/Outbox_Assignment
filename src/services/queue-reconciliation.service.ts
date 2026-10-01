import { emailSchedulerQueue } from '../queues/mailer.queues';

const db: any = require('../db/models');

export const reconcileScheduledEmails = async () => {
  const emails = await db.Email.findAll({
    where: { status: 'scheduled' },
    attributes: ['id', 'scheduledAt', 'bullJobId'],
    order: [['id', 'ASC']],
  });

  let repaired = 0;
  for (const email of emails) {
    const existingJob = email.bullJobId ? await emailSchedulerQueue.getJob(email.bullJobId) : null;
    if (existingJob) continue;

    const job = await emailSchedulerQueue.add('email-job', { emailId: email.id }, {
      jobId: `email-${email.id}`,
      delay: Math.max(0, new Date(email.scheduledAt).getTime() - Date.now()),
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
    });
    await email.update({ bullJobId: job.id });
    repaired += 1;
  }

  return repaired;
};
