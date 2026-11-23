import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { MonitorController } from '../../src/controllers/monitor.controller';
import { MonitorService } from '../../src/services/monitor.service';
import { TokenService } from '../../src/services/token.service';
import { createMonitorRoutes } from '../../src/routes/monitor.routes';
import { createAuthMiddleware } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/error-handler';
import { NotFoundError } from '@pulsestack/shared';

describe('Monitor Routes (Integration)', () => {
  let app: Express;
  let mockMonitorService: any;
  let mockTokenService: any;

  const validToken = 'valid-jwt-token';
  const ownerUser = {
    userId: 'user-owner-1',
    orgId: 'org-tenant-1',
    email: 'owner@tenant1.com',
    role: 'owner',
  };

  const memberUser = {
    userId: 'user-member-1',
    orgId: 'org-tenant-1',
    email: 'member@tenant1.com',
    role: 'member',
  };

  beforeEach(() => {
    mockTokenService = {
      verifyAccessToken: vi.fn().mockImplementation((token: string) => {
        if (token === validToken) return ownerUser;
        if (token === 'member-token') return memberUser;
        throw new Error('Invalid token');
      }),
    };

    mockMonitorService = {
      listMonitors: vi.fn(),
      createMonitor: vi.fn(),
      getMonitorById: vi.fn(),
      updateMonitor: vi.fn(),
      deleteMonitor: vi.fn(),
      getMonitorResults: vi.fn(),
      getMonitorStats: vi.fn(),
      pauseMonitor: vi.fn(),
      resumeMonitor: vi.fn(),
    };

    const monitorController = new MonitorController(mockMonitorService as unknown as MonitorService);
    const authMiddleware = createAuthMiddleware(mockTokenService as unknown as TokenService);
    const tenantScopeMiddleware = (req: any, _res: any, next: any) => {
      req.scope = { orgId: req.user.orgId };
      next();
    };

    app = express();
    app.use(express.json());
    app.use('/api/monitors', createMonitorRoutes(monitorController, authMiddleware, tenantScopeMiddleware));
    app.use(errorHandler);
  });

  describe('GET /api/monitors', () => {
    it('should return 401 Unauthorized when Authorization header is missing', async () => {
      const res = await request(app).get('/api/monitors');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with list of monitors when authenticated', async () => {
      const mockList = [
        { id: 'mon-1', name: 'API Check', url: 'https://api.test.com', status: 'up' },
        { id: 'mon-2', name: 'Web Check', url: 'https://web.test.com', status: 'degraded' },
      ];
      mockMonitorService.listMonitors.mockResolvedValue({ items: mockList, meta: { total: 2 } });

      const res = await request(app)
        .get('/api/monitors')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(mockMonitorService.listMonitors).toHaveBeenCalled();
    });
  });

  describe('POST /api/monitors', () => {
    it('should return 400 Bad Request when validation fails', async () => {
      const res = await request(app)
        .post('/api/monitors')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: '', // Invalid empty name
          url: 'not-a-valid-url',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 Forbidden when user is a viewer/member without admin permissions', async () => {
      const res = await request(app)
        .post('/api/monitors')
        .set('Authorization', 'Bearer member-token')
        .send({
          name: 'Valid Name',
          url: 'https://example.com/health',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(mockMonitorService.createMonitor).not.toHaveBeenCalled();
    });

    it('should return 201 and create monitor when valid and owner/admin', async () => {
      const created = {
        id: 'mon-new-123',
        orgId: ownerUser.orgId,
        name: 'Billing API',
        url: 'https://billing.example.com/health',
        status: 'unknown',
        intervalSeconds: 60,
      };
      mockMonitorService.createMonitor.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/monitors')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Billing API',
          url: 'https://billing.example.com/health',
          method: 'GET',
          intervalSeconds: 60,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('mon-new-123');
      expect(mockMonitorService.createMonitor).toHaveBeenCalled();
    });
  });

  describe('GET /api/monitors/:id', () => {
    it('should return 200 with monitor details', async () => {
      const monitor = { id: 'mon-1', name: 'API Check', url: 'https://api.test.com' };
      mockMonitorService.getMonitorById.mockResolvedValue(monitor);

      const res = await request(app)
        .get('/api/monitors/mon-1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('mon-1');
    });

    it('should return 404 when monitor is not found', async () => {
      mockMonitorService.getMonitorById.mockRejectedValue(new NotFoundError('Monitor not found'));

      const res = await request(app)
        .get('/api/monitors/mon-nonexistent')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/monitors/:id/pause and /resume', () => {
    it('should pause monitor and return 200', async () => {
      mockMonitorService.pauseMonitor.mockResolvedValue({ id: 'mon-1', isActive: false });

      const res = await request(app)
        .post('/api/monitors/mon-1/pause')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(mockMonitorService.pauseMonitor).toHaveBeenCalledWith(expect.anything(), 'mon-1');
    });

    it('should resume monitor and return 200', async () => {
      mockMonitorService.resumeMonitor.mockResolvedValue({ id: 'mon-1', isActive: true });

      const res = await request(app)
        .post('/api/monitors/mon-1/resume')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
      expect(mockMonitorService.resumeMonitor).toHaveBeenCalledWith(expect.anything(), 'mon-1');
    });
  });

  describe('DELETE /api/monitors/:id', () => {
    it('should delete monitor and return 200', async () => {
      mockMonitorService.deleteMonitor.mockResolvedValue({ id: 'mon-1' });

      const res = await request(app)
        .delete('/api/monitors/mon-1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMonitorService.deleteMonitor).toHaveBeenCalledWith(expect.anything(), 'mon-1');
    });
  });

  describe('GET /api/monitors/:id/stats and /results', () => {
    it('should return calculated telemetry stats', async () => {
      mockMonitorService.getMonitorStats.mockResolvedValue({
        uptimePercentage: 99.8,
        avgLatencyMs: 45,
        p95LatencyMs: 80,
        p99LatencyMs: 120,
        totalChecks: 500,
      });

      const res = await request(app)
        .get('/api/monitors/mon-1/stats')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.uptimePercentage).toBe(99.8);
      expect(res.body.data.avgLatencyMs).toBe(45);
    });

    it('should return paginated check results', async () => {
      mockMonitorService.getMonitorResults.mockResolvedValue({
        items: [
          { id: 'res-1', latencyMs: 40, status: 'up' },
          { id: 'res-2', latencyMs: 50, status: 'up' },
        ],
        meta: { page: 1, limit: 10, total: 2 },
      });

      const res = await request(app)
        .get('/api/monitors/mon-1/results?limit=10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });
});
