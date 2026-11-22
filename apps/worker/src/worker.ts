import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { getDb, closeDb } from '@pulsestack/db';
import { QUEUE_NAMES } from '@pulsestack/shared';
import { env } from './config/env';
import { createWebhookQueue } from './queues/webhook.queue';
import { createHealthCheckProcessor } from './jobs/health-check.job';
import { createWebhookDispatchProcessor } from './jobs/webhook-dispatch.job';

console.log(`[Worker] Initializing PulseStack background workers in ${env.NODE_ENV} mode...`);

const db = getDb();

const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

const redisPublisher = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// Create queues
const webhookQueue = createWebhookQueue(redisConnection);

// Create job processors
const healthCheckProcessor = createHealthCheckProcessor(db, redisPublisher, webhookQueue);
const webhookDispatchProcessor = createWebhookDispatchProcessor(db);

// Initialize Workers
const healthCheckWorker = new Worker(
  QUEUE_NAMES.HEALTH_CHECK,
  healthCheckProcessor,
  {
    connection: redisConnection,
    concurrency: env.CONCURRENCY,
  }
);

const webhookWorker = new Worker(
  QUEUE_NAMES.WEBHOOK_DISPATCH,
  webhookDispatchProcessor,
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Health check events
healthCheckWorker.on('completed', (job) => {
  console.log(`[HealthCheck Worker] Job ${job.id} for monitor ${job.data.monitorId} completed`);
});

healthCheckWorker.on('failed', (job, err) => {
  console.error(`[HealthCheck Worker] Job ${job?.id} failed:`, err.message);
});

// Webhook events
webhookWorker.on('completed', (job) => {
  console.log(`[Webhook Worker] Delivery job ${job.id} dispatched successfully`);
});

webhookWorker.on('failed', (job, err) => {
  console.warn(`[Webhook Worker] Delivery job ${job?.id} attempt failed:`, err.message);
});

// Startup check
Promise.all([redisConnection.connect(), redisPublisher.connect()])
  .then(() => {
    console.log('[Worker] Connected to Redis successfully. Workers listening for jobs.');
  })
  .catch((err) => {
    console.warn('[Worker] Redis initial connection deferred or failed:', err.message);
  });

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n[Worker] Shutting down workers gracefully...');
  await healthCheckWorker.close();
  await webhookWorker.close();
  await webhookQueue.close();
  await redisConnection.quit();
  await redisPublisher.quit();
  await closeDb();
  console.log('[Worker] All workers and connections stopped cleanly.');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { healthCheckWorker, webhookWorker, webhookQueue };
