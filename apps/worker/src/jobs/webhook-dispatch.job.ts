import { Job } from 'bullmq';
import { DbClient, webhookDeliveries } from '@pulsestack/db';
import { WebhookDispatchJobData } from '@pulsestack/shared';
import { signWebhookPayload } from '../utils/webhook-signer';

export function createWebhookDispatchProcessor(db: DbClient) {
  return async (job: Job<WebhookDispatchJobData>) => {
    const { webhookId, orgId, url, secret, event, payload } = job.data;
    const signature = signWebhookPayload(payload, secret);
    const attemptCount = job.attemptsMade + 1;

    let responseStatus: number | null = null;
    let isSuccess = false;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PulseStack-Signature': signature,
          'X-PulseStack-Event': event,
          'User-Agent': 'PulseStack-Webhook-Worker/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      responseStatus = response.status;
      isSuccess = response.ok;

      // Log delivery attempt
      await db.insert(webhookDeliveries).values({
        webhookId,
        orgId,
        event,
        payload,
        responseStatus,
        success: isSuccess,
        attemptCount,
        deliveredAt: new Date(),
      });

      if (!response.ok) {
        throw new Error(`Webhook target responded with HTTP ${response.status}`);
      }

      return { success: true, statusCode: responseStatus };
    } catch (err: any) {
      // If not already logged as non-2xx response
      if (!isSuccess && responseStatus === null) {
        await db.insert(webhookDeliveries).values({
          webhookId,
          orgId,
          event,
          payload,
          responseStatus: null,
          success: false,
          attemptCount,
          deliveredAt: new Date(),
        });
      }

      console.warn(
        `[Webhook Worker] Delivery attempt ${attemptCount} failed for webhook ${webhookId}: ${err.message}`
      );
      throw err; // BullMQ will handle backoff retry
    }
  };
}
