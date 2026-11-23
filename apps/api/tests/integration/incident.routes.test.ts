import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { IncidentController } from '../../src/controllers/incident.controller';
import { IncidentService } from '../../src/services/incident.service';
import { TokenService } from '../../src/services/token.service';
import { createIncidentRoutes } from '../../src/routes/incident.routes';
import { createAuthMiddleware } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/error-handler';
import { NotFoundError } from '@pulsestack/shared';

describe('Incident Routes (Integration)', () => {
  let app: Express;
  let mockIncidentService: any;
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

    mockIncidentService = {
      listIncidents: vi.fn(),
      getIncidentById: vi.fn(),
    };

    const incidentController = new IncidentController(mockIncidentService as unknown as IncidentService);
    const authMiddleware = createAuthMiddleware(mockTokenService as unknown as TokenService);
    const tenantScopeMiddleware = (req: any, _res: any, next: any) => {
      req.scope = { orgId: req.user.orgId };
      next();
    };

    app = express();
    app.use(express.json());
    app.use('/api/incidents', createIncidentRoutes(incidentController, authMiddleware, tenantScopeMiddleware));
    app.use(errorHandler);
  });

  describe('GET /api/incidents', () => {
    it('should return 401 when token is missing', async () => {
      const res = await request(app).get('/api/incidents');
      expect(res.status).toBe(401);
    });

    it('should return list of incidents for tenant', async () => {
      const mockIncidents = [
        { id: 'inc-1', type: 'down', cause: 'HTTP 500', startedAt: new Date().toISOString() },
        { id: 'inc-2', type: 'degraded', cause: 'Timeout', startedAt: new Date().toISOString() },
      ];
      mockIncidentService.listIncidents.mockResolvedValue({ items: mockIncidents, meta: { total: 2 } });

      const res = await request(app)
        .get('/api/incidents?status=open')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(mockIncidentService.listIncidents).toHaveBeenCalled();
    });
  });

  describe('GET /api/incidents/:id', () => {
    it('should return incident detail', async () => {
      const incident = { id: 'inc-1', type: 'down', cause: 'HTTP 500' };
      mockIncidentService.getIncidentById.mockResolvedValue(incident);

      const res = await request(app)
        .get('/api/incidents/inc-1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('inc-1');
      expect(mockIncidentService.getIncidentById).toHaveBeenCalled();
    });

    it('should return 404 when incident does not exist', async () => {
      mockIncidentService.getIncidentById.mockRejectedValue(new NotFoundError('Incident not found'));

      const res = await request(app)
        .get('/api/incidents/inc-404')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
