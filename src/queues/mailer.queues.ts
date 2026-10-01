import { Queue } from 'bullmq';
import { getRedisConnObject } from '../config/redis.config';

export const EMAIL_SCHEDULER_QUEUE = 'email-scheduler';

export const emailSchedulerQueue = new Queue(EMAIL_SCHEDULER_QUEUE, {
    connection: getRedisConnObject(),
});
