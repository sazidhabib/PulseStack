import crypto from 'crypto';
import { TenantScope } from '@pulsestack/db';
import {
  CreateWebhookInput,
  UpdateWebhookInput,
  NotFoundError,
} from '@pulsestack/shared';

export class WebhookService {
  async listWebhooks(scope: TenantScope) {
    return scope.webhooks.findAll();
  }

  async getWebhookById(scope: TenantScope, id: string) {
    const webhook = await scope.webhooks.findById(id);
    if (!webhook) {
      throw new NotFoundError(`Webhook with ID ${id} not found`);
    }
    return webhook;
  }

  async createWebhook(scope: TenantScope, data: CreateWebhookInput) {
    const secret = data.secret || crypto.randomBytes(24).toString('hex');

    return scope.webhooks.create({
      url: data.url,
      secret,
      events: data.events,
      isActive: data.isActive,
    });
  }

  async updateWebhook(scope: TenantScope, id: string, data: UpdateWebhookInput) {
    await this.getWebhookById(scope, id);
    const updated = await scope.webhooks.update(id, data);
    return updated!;
  }

  async deleteWebhook(scope: TenantScope, id: string) {
    await this.getWebhookById(scope, id);
    const deleted = await scope.webhooks.delete(id);
    return deleted!;
  }

  async getDeliveries(scope: TenantScope, webhookId: string, limit = 50) {
    await this.getWebhookById(scope, webhookId);
    return scope.webhooks.getDeliveries(webhookId, limit);
  }

  async sendTestDelivery(scope: TenantScope, webhookId: string) {
    const webhook = await this.getWebhookById(scope, webhookId);

    const testPayload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      message: 'This is a test notification from PulseStack Health Monitoring',
      webhookId: webhook.id,
    };

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex');

    let responseStatus: number | null = null;
    let success = false;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PulseStack-Signature': signature,
          'X-PulseStack-Event': 'test.ping',
          'User-Agent': 'PulseStack-Webhook-Dispatcher/1.0',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      responseStatus = res.status;
      success = res.ok;
    } catch (err: any) {
      responseStatus = null;
      success = false;
    }

    const delivery = await scope.webhooks.logDelivery({
      webhookId: webhook.id,
      event: 'test.ping',
      payload: testPayload,
      responseStatus,
      success,
      attemptCount: 1,
    });

    return {
      success,
      responseStatus,
      deliveryId: delivery.id,
    };
  }
}
