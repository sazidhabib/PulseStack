import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from '../../src/services/webhook.service';
import { NotFoundError } from '@pulsestack/shared';

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let mockScope: any;

  beforeEach(() => {
    webhookService = new WebhookService();
    mockScope = {
      webhooks: {
        findAll: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getDeliveries: vi.fn(),
        logDelivery: vi.fn(),
      },
    };
  });

  describe('createWebhook', () => {
    it('should auto-generate a 48-char hex secret if none is provided', async () => {
      mockScope.webhooks.create.mockImplementation((data: any) =>
        Promise.resolve({ id: 'wh-1', ...data })
      );

      const result = await webhookService.createWebhook(mockScope, {
        url: 'https://hooks.slack.com/services/test',
        events: ['monitor.down'],
        isActive: true,
      });

      expect(result.id).toBe('wh-1');
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBe(48); // 24 bytes hex
      expect(mockScope.webhooks.create).toHaveBeenCalled();
    });

    it('should preserve user-provided secret if supplied', async () => {
      mockScope.webhooks.create.mockImplementation((data: any) =>
        Promise.resolve({ id: 'wh-2', ...data })
      );

      const customSecret = 'my-custom-super-secure-secret-key-123';
      const result = await webhookService.createWebhook(mockScope, {
        url: 'https://api.mycorp.com/webhook',
        secret: customSecret,
        events: ['monitor.down', 'monitor.up'],
        isActive: true,
      });

      expect(result.secret).toBe(customSecret);
    });
  });

  describe('getWebhookById', () => {
    it('should throw NotFoundError if webhook is missing', async () => {
      mockScope.webhooks.findById.mockResolvedValue(null);

      await expect(webhookService.getWebhookById(mockScope, 'wh-missing')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('sendTestDelivery', () => {
    it('should sign test payload with HMAC-SHA256 and log delivery attempt', async () => {
      const fakeWebhook = {
        id: 'wh-test-1',
        url: 'https://example.com/test-hook',
        secret: 'test-secret-12345678',
        events: ['monitor.down'],
      };

      mockScope.webhooks.findById.mockResolvedValue(fakeWebhook);
      mockScope.webhooks.logDelivery.mockResolvedValue({ id: 'del-1' });

      // Mock global fetch
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      const result = await webhookService.sendTestDelivery(mockScope, 'wh-test-1');

      expect(result.success).toBe(true);
      expect(result.responseStatus).toBe(200);
      expect(result.deliveryId).toBe('del-1');
      expect(fetchSpy).toHaveBeenCalled();
      expect(mockScope.webhooks.logDelivery).toHaveBeenCalled();

      fetchSpy.mockRestore();
    });
  });
});
