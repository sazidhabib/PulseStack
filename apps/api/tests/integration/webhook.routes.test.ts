import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { WebhookController } from '../../src/controllers/webhook.controller';
import { WebhookService } from '../../src/services/webhook.service';
import { TokenService } from '../../src/services/token.service';
import { createWebhookRoutes } from '../../src/routes/webhook.routes';
import { createAuthMiddleware } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/error-handler';
import { NotFoundError } from '@pulsestack/shared';

describe('Webhook Routes (Integration)', () => {
  let app: Express;
  let mockWebhookService: any;
  let mockTokenService: any;

  const validToken = 'valid-jwt-token';
  const ownerUser = {
    userId: 'user-owner-1',
    orgId: 'org-tenant-1',
    email: 'owner@tenant1.com',
    role: 'owner',
  };

  beforeEach(() => {
    mockTokenService = {
      verifyAccessToken: vi.fn().mockImplementation((token: string) => {
        if (token === validToken) return ownerUser;
        throw new Error('Invalid token');
      }),
    };

    mockWebhookService = {
      listWebhooks: vi.fn(),
      createWebhook: vi.fn(),
      getWebhookById: vi.fn(),
      updateWebhook: vi.fn(),
      deleteWebhook: vi.fn(),
      getDeliveries: vi.fn(),
      sendTestDelivery: vi.fn(),
    };

    const webhookController = new WebhookController(mockWebhookService as unknown as WebhookService);
    const authMiddleware = createAuthMiddleware(mockTokenService as unknown as TokenService);
    const tenantScopeMiddleware = (req: any, _res: any, next: any) => {
      req.scope = { orgId: req.user.orgId };
      next();
    };

    app = express();
    app.use(express.json());
    app.use('/api/webhooks', createWebhookRoutes(webhookController, authMiddleware, tenantScopeMiddleware));
    app.use(errorHandler);
  });

  describe('GET /api/webhooks', () => {
    it('should return list of webhooks for the tenant', async () => {
      mockWebhookService.listWebhooks.mockResolvedValue([
        { id: 'wh-1', url: 'https://hooks.slack.com/1', events: ['monitor.down'] },
      ]);

      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(mockWebhookService.listWebhooks).toHaveBeenCalled();
    });
  });

  describe('POST /api/webhooks', () => {
    it('should validate inputs and return 400 when URL is invalid', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          url: 'ftp://invalid-protocol.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create webhook when payload is valid', async () => {
      const created = {
        id: 'wh-new-1',
        orgId: ownerUser.orgId,
        url: 'https://hooks.slack.com/services/test',
        events: ['monitor.down', 'monitor.up'],
        isActive: true,
      };
      mockWebhookService.createWebhook.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          url: 'https://hooks.slack.com/services/test',
          events: ['monitor.down', 'monitor.up'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('wh-new-1');
      expect(mockWebhookService.createWebhook).toHaveBeenCalled();
    });
  });

  describe('POST /api/webhooks/:id/test', () => {
    it('should trigger a test webhook dispatch', async () => {
      mockWebhookService.sendTestDelivery.mockResolvedValue({
        dispatched: true,
        webhookId: 'wh-1',
        event: 'test.ping',
      });

      const res = await request(app)
        .post('/api/webhooks/wh-1/test')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dispatched).toBe(true);
      expect(mockWebhookService.sendTestDelivery).toHaveBeenCalled();
    });
  });

  describe('GET /api/webhooks/:id/deliveries', () => {
    it('should return paginated delivery audit logs', async () => {
      mockWebhookService.getDeliveries.mockResolvedValue([
        { id: 'del-1', statusCode: 200, durationMs: 140, attempt: 1 },
      ]);

      const res = await request(app)
        .get('/api/webhooks/wh-1/deliveries?limit=10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].statusCode).toBe(200);
    });
  });

  describe('DELETE /api/webhooks/:id', () => {
    it('should delete webhook', async () => {
      mockWebhookService.deleteWebhook.mockResolvedValue({ id: 'wh-1' });

      const res = await request(app)
        .delete('/api/webhooks/wh-1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockWebhookService.deleteWebhook).toHaveBeenCalled();
    });
  });
});
