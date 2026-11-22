import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, WebhookDispatchJobData } from '@pulsestack/shared';

export function createWebhookQueue(connection: IORedis): Queue<WebhookDispatchJobData> {
  return new Queue<WebhookDispatchJobData>(QUEUE_NAMES.WEBHOOK_DISPATCH, {
    connection,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 10000, // 10s initial delay (10s, 20s, 40s, 80s)
      },
      removeOnComplete: {
        age: 3600, // keep completed jobs for 1 hour
        count: 1000,
      },
      removeOnFail: {
        age: 86400 * 7, // keep failed jobs for 7 days
      },
    },
  });
}
