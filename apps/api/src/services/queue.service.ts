import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, HealthCheckJobData } from '@pulsestack/shared';
import { env } from '../config/env';

export class QueueService {
  private healthCheckQueue: Queue<HealthCheckJobData> | null = null;
  private redisConnection: IORedis | null = null;

  constructor() {
    // Lazily connect so tests or offline startup don't fail immediately
    if (process.env.NODE_ENV !== 'test') {
      this.init();
    }
  }

  private init() {
    if (!this.redisConnection) {
      this.redisConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      this.healthCheckQueue = new Queue<HealthCheckJobData>(QUEUE_NAMES.HEALTH_CHECK, {
        connection: this.redisConnection,
      });
    }
  }

  async scheduleMonitor(monitor: {
    id: string;
    orgId: string;
    url: string;
    method: 'GET' | 'HEAD';
    timeout: number;
    expectedStatus: number;
    intervalSeconds: number;
    headers?: Record<string, string>;
  }): Promise<void> {
    if (!this.healthCheckQueue) return;

    await this.removeMonitor(monitor.id);

    await this.healthCheckQueue.add(
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

  async removeMonitor(monitorId: string): Promise<void> {
    if (!this.healthCheckQueue) return;

    try {
      const repeatableJobs = await this.healthCheckQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === `monitor:${monitorId}` || job.key.includes(monitorId)) {
          await this.healthCheckQueue.removeRepeatableByKey(job.key);
        }
      }
    } catch (err: any) {
      console.warn(`[QueueService] Error removing repeatable job for monitor ${monitorId}:`, err.message);
    }
  }

  async close(): Promise<void> {
    if (this.healthCheckQueue) {
      await this.healthCheckQueue.close();
      this.healthCheckQueue = null;
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }
  }
}
