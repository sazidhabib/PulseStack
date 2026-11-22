import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { MonitorController } from '../../src/controllers/monitor.controller';
import { MonitorService } from '../../src/services/monitor.service';
import { WebhookController } from '../../src/controllers/webhook.controller';
import { WebhookService } from '../../src/services/webhook.service';
import { createMonitorRoutes } from '../../src/routes/monitor.routes';
import { createWebhookRoutes } from '../../src/routes/webhook.routes';
import { errorHandler } from '../../src/middleware/error-handler';
import { UserPayload } from '@pulsestack/shared';

describe('Tenant Isolation & Role-Based Access Control', () => {
  let app: Express;
  let tenantAStore: Map<string, any>;
  let tenantBStore: Map<string, any>;

  // Simulate two separate tenants
  const tenantA: UserPayload = {
    userId: 'user-tenant-a',
    email: 'alice@tenant-a.com',
    role: 'owner',
    orgId: 'org-tenant-a',
  };

  const tenantB: UserPayload = {
    userId: 'user-tenant-b',
    email: 'bob@tenant-b.com',
    role: 'admin',
    orgId: 'org-tenant-b',
  };

  const viewerA: UserPayload = {
    userId: 'viewer-tenant-a',
    email: 'viewer@tenant-a.com',
    role: 'viewer',
    orgId: 'org-tenant-a',
  };

  let currentUser: UserPayload;

  beforeEach(() => {
    tenantAStore = new Map();
    tenantBStore = new Map();

    const monitorService = new MonitorService();
    const monitorController = new MonitorController(monitorService);

    const webhookService = new WebhookService();
    const webhookController = new WebhookController(webhookService);

    // Mock auth middleware that attaches the active user
    const mockAuthMiddleware = (req: any, _res: any, next: any) => {
      req.user = currentUser;
      next();
    };

    // Scoped middleware that dynamically binds to that tenant's isolated store
    const mockTenantScopeMiddleware = (req: any, _res: any, next: any) => {
      const store = req.user.orgId === 'org-tenant-a' ? tenantAStore : tenantBStore;

      req.scope = {
        monitors: {
          findAll: vi.fn().mockImplementation(() => Promise.resolve(Array.from(store.values()))),
          count: vi.fn().mockImplementation(() => Promise.resolve(store.size)),
          findById: vi.fn().mockImplementation((id: string) => Promise.resolve(store.get(id) ?? null)),
          create: vi.fn().mockImplementation((data: any) => {
            const id = `mon-${Math.random().toString(36).substring(7)}`;
            const created = { id, orgId: req.user.orgId, ...data };
            store.set(id, created);
            return Promise.resolve(created);
          }),
          update: vi.fn().mockImplementation((id: string, data: any) => {
            const existing = store.get(id);
            if (!existing) return Promise.resolve(null);
            const updated = { ...existing, ...data };
            store.set(id, updated);
            return Promise.resolve(updated);
          }),
          delete: vi.fn().mockImplementation((id: string) => {
            const existing = store.get(id);
            if (!existing) return Promise.resolve(null);
            store.delete(id);
            return Promise.resolve(existing);
          }),
        },
        healthChecks: {
          findByMonitor: vi.fn().mockResolvedValue([]),
          countByMonitor: vi.fn().mockResolvedValue(0),
          getStats: vi.fn().mockResolvedValue({
            totalChecks: 0,
            uptimePercentage: 100,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
          }),
        },
        webhooks: {
          findAll: vi.fn().mockResolvedValue([]),
          findById: vi.fn().mockResolvedValue(null),
        },
      };
      next();
    };

    app = express();
    app.use(express.json());
    app.use(
      '/api/monitors',
      createMonitorRoutes(monitorController, mockAuthMiddleware, mockTenantScopeMiddleware)
    );
    app.use(
      '/api/webhooks',
      createWebhookRoutes(webhookController, mockAuthMiddleware, mockTenantScopeMiddleware)
    );
    app.use(errorHandler);
  });

  describe('Strict Tenant Isolation', () => {
    it('Tenant B cannot see, access, or update Tenant A monitors', async () => {
      // 1. Tenant A creates a monitor
      currentUser = tenantA;
      const createRes = await request(app).post('/api/monitors').send({
        name: 'Tenant A Secret API',
        url: 'https://secret.tenant-a.com/health',
      });

      expect(createRes.status).toBe(201);
      const monitorAId = createRes.body.data.id;

      // 2. Tenant A lists monitors -> sees it
      const listResA = await request(app).get('/api/monitors');
      expect(listResA.status).toBe(200);
      expect(listResA.body.data.length).toBe(1);
      expect(listResA.body.data[0].id).toBe(monitorAId);

      // 3. Switch to Tenant B -> list monitors -> sees 0 monitors!
      currentUser = tenantB;
      const listResB = await request(app).get('/api/monitors');
      expect(listResB.status).toBe(200);
      expect(listResB.body.data.length).toBe(0);

      // 4. Tenant B attempts to read Tenant A's monitor directly -> 404 NOT FOUND
      const getDetailResB = await request(app).get(`/api/monitors/${monitorAId}`);
      expect(getDetailResB.status).toBe(404);
      expect(getDetailResB.body.success).toBe(false);

      // 5. Tenant B attempts to delete Tenant A's monitor -> 404 NOT FOUND
      const deleteResB = await request(app).delete(`/api/monitors/${monitorAId}`);
      expect(deleteResB.status).toBe(404);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('Viewer role cannot create a monitor (403 Forbidden)', async () => {
      currentUser = viewerA;

      const res = await request(app).post('/api/monitors').send({
        name: 'Viewer unauthorized attempt',
        url: 'https://example.com',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Viewer role cannot delete a monitor (403 Forbidden)', async () => {
      currentUser = viewerA;

      const res = await request(app).delete('/api/monitors/some-monitor-id');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Owner and Admin can create monitors', async () => {
      currentUser = tenantA; // owner
      const resOwner = await request(app).post('/api/monitors').send({
        name: 'Owner monitor',
        url: 'https://owner.com',
      });
      expect(resOwner.status).toBe(201);

      currentUser = tenantB; // admin
      const resAdmin = await request(app).post('/api/monitors').send({
        name: 'Admin monitor',
        url: 'https://admin.com',
      });
      expect(resAdmin.status).toBe(201);
    });
  });
});
