import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, HealthCheckJobData } from '@pulsestack/shared';

export function createHealthCheckQueue(connection: IORedis): Queue<HealthCheckJobData> {
  return new Queue<HealthCheckJobData>(QUEUE_NAMES.HEALTH_CHECK, {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: {
        age: 86400,
      },
    },
  });
}

export async function scheduleHealthCheck(
  queue: Queue<HealthCheckJobData>,
  monitor: {
    id: string;
    orgId: string;
    url: string;
    method: 'GET' | 'HEAD';
    timeout: number;
    expectedStatus: number;
    intervalSeconds: number;
    headers?: Record<string, string>;
  }
): Promise<void> {
  await removeHealthCheck(queue, monitor.id);

  await queue.add(
    'ping',
    {
      monitorId: monitor.id,
      orgId: monitor.orgId,
      url: monitor.url,
      method: monitor.method,
      timeout: monitor.timeout,
      expectedStatus: monitor.expectedStatus,
      headers: monitor.headers,
    },
    {
      jobId: `monitor:${monitor.id}`,
      repeat: {
        every: Math.max(10, monitor.intervalSeconds) * 1000,
      },
    }
  );
}

export async function removeHealthCheck(
  queue: Queue<HealthCheckJobData>,
  monitorId: string
): Promise<void> {
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id === `monitor:${monitorId}` || job.key.includes(monitorId)) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
}
