import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { AuthController } from '../../src/controllers/auth.controller';
import { AuthService } from '../../src/services/auth.service';
import { TokenService } from '../../src/services/token.service';
import { createAuthRoutes } from '../../src/routes/auth.routes';
import { createAuthMiddleware } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/error-handler';

describe('Auth Routes (Integration)', () => {
  let app: Express;
  let mockAuthService: any;
  let mockTokenService: any;

  beforeEach(() => {
    mockTokenService = {
      verifyAccessToken: vi.fn(),
    };

    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      demoLogin: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    const authController = new AuthController(mockAuthService as unknown as AuthService);
    const authMiddleware = createAuthMiddleware(mockTokenService as unknown as TokenService);

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', createAuthRoutes(authController, authMiddleware));
    app.use(errorHandler);
  });

  describe('POST /api/auth/register', () => {
    it('should validate inputs and return 400 when email is invalid', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'invalid-email',
        password: 'short',
        name: 'A',
        orgName: 'B',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.email).toBeDefined();
    });

    it('should register user, return 201, and set refresh cookie', async () => {
      mockAuthService.register.mockResolvedValue({
        user: { id: 'u-1', email: 'owner@test.com', name: 'Owner', role: 'owner' },
        organization: { id: 'o-1', name: 'Test Org', slug: 'test-org', plan: 'free' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const res = await request(app).post('/api/auth/register').send({
        email: 'owner@test.com',
        password: 'ValidPassword123!',
        name: 'Owner',
        orgName: 'Test Org',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe('mock-access-token');
      expect(res.body.data.user.email).toBe('owner@test.com');
      // Verify cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=mock-refresh-token');
      expect(cookies[0]).toContain('HttpOnly');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login, return 200, and set refresh cookie', async () => {
      mockAuthService.login.mockResolvedValue({
        user: { id: 'u-1', email: 'login@test.com', name: 'User', role: 'admin' },
        organization: { id: 'o-1', name: 'Test Org', slug: 'test-org', plan: 'pro' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@test.com',
        password: 'ValidPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe('mock-access-token');
    });
  });

  describe('POST /api/auth/demo', () => {
    it('should authenticate demo user on 1-click and return tokens', async () => {
      mockAuthService.demoLogin.mockResolvedValue({
        user: { id: 'demo-u-1', email: 'demo@pulsestack.io', name: 'Demo Evaluator', role: 'admin' },
        organization: { id: 'demo-o-1', name: 'PulseStack Demo', slug: 'demo', plan: 'pro' },
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
      });

      const res = await request(app).post('/api/auth/demo').send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('demo@pulsestack.io');
      expect(res.body.data.accessToken).toBe('demo-access-token');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 200 and profile when valid Bearer token is provided', async () => {
      mockTokenService.verifyAccessToken.mockReturnValue({
        userId: 'u-123',
        email: 'user@test.com',
        role: 'owner',
        orgId: 'org-123',
      });

      mockAuthService.getCurrentUser.mockResolvedValue({
        user: { id: 'u-123', email: 'user@test.com', name: 'Test User', role: 'owner' },
        organization: { id: 'org-123', name: 'My Org', slug: 'my-org', plan: 'pro' },
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe('u-123');
      expect(res.body.data.organization.name).toBe('My Org');
    });
  });
});
