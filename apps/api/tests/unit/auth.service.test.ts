import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth.service';
import { TokenService } from '../../src/services/token.service';
import { ConflictError, UnauthorizedError, NotFoundError } from '@pulsestack/shared';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let mockDb: any;
  let mockTokenService: any;
  let authService: AuthService;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    mockTokenService = {
      generateAccessToken: vi.fn().mockReturnValue('mock-jwt-access-token'),
      createRefreshToken: vi.fn().mockResolvedValue({
        rawToken: 'mock-raw-refresh-token',
        family: 'mock-family-uuid',
      }),
      rotateRefreshToken: vi.fn(),
      revokeToken: vi.fn(),
    };
    authService = new AuthService(mockDb, mockTokenService as unknown as TokenService);
  });

  describe('Register', () => {
    it('should register a new organization and owner successfully', async () => {
      // Mock existing email lookup -> empty (not in use)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const fakeOrg = {
        id: 'org-uuid-1',
        name: 'Acme Health',
        slug: 'acme-health-123456',
        plan: 'free',
      };

      const fakeUser = {
        id: 'user-uuid-1',
        email: 'owner@acme.com',
        name: 'Acme Founder',
        role: 'owner',
        orgId: fakeOrg.id,
      };

      let insertCount = 0;
      mockDb.insert.mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(
            insertCount++ === 0 ? [fakeOrg] : [fakeUser]
          ),
        }),
      }));

      const result = await authService.register({
        email: 'owner@acme.com',
        password: 'Password123!',
        name: 'Acme Founder',
        orgName: 'Acme Health',
      });

      expect(result.user.email).toBe('owner@acme.com');
      expect(result.user.role).toBe('owner');
      expect(result.organization.name).toBe('Acme Health');
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.refreshToken).toBe('mock-raw-refresh-token');
      expect(mockTokenService.generateAccessToken).toHaveBeenCalled();
    });

    it('should throw ConflictError if email is already registered', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'existing-id' }]),
        }),
      });

      await expect(
        authService.register({
          email: 'duplicate@acme.com',
          password: 'Password123!',
          name: 'Jane Doe',
          orgName: 'Acme Inc',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Login', () => {
    it('should login successfully with valid credentials', async () => {
      const password = 'CorrectPassword123!';
      const passwordHash = await bcrypt.hash(password, 10);

      const fakeUser = {
        id: 'user-id-1',
        email: 'login@pulsestack.io',
        passwordHash,
        name: 'Active User',
        role: 'admin',
        orgId: 'org-id-1',
      };

      const fakeOrg = {
        id: 'org-id-1',
        name: 'PulseStack Team',
        slug: 'pulsestack-team',
        plan: 'pro',
      };

      let selectCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            selectCount++ === 0 ? [fakeUser] : [fakeOrg]
          ),
        }),
      }));

      const result = await authService.login({
        email: 'login@pulsestack.io',
        password,
      });

      expect(result.user.email).toBe('login@pulsestack.io');
      expect(result.organization.name).toBe('PulseStack Team');
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.refreshToken).toBe('mock-raw-refresh-token');
    });

    it('should throw UnauthorizedError when user is not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        authService.login({
          email: 'unknown@pulsestack.io',
          password: 'anyPassword',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError on incorrect password', async () => {
      const passwordHash = await bcrypt.hash('realPassword', 10);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'user-1',
              email: 'test@pulsestack.io',
              passwordHash,
              orgId: 'org-1',
            },
          ]),
        }),
      });

      await expect(
        authService.login({
          email: 'test@pulsestack.io',
          password: 'wrongPassword',
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('Demo Login', () => {
    it('should return demo user and org tokens without requiring a password', async () => {
      const fakeDemoUser = {
        id: 'demo-user-id',
        email: 'demo@pulsestack.io',
        name: 'Demo Evaluator',
        role: 'admin',
        orgId: 'demo-org-id',
      };

      const fakeDemoOrg = {
        id: 'demo-org-id',
        name: 'PulseStack Demo Inc',
        slug: 'demo-pulsestack',
        plan: 'pro',
      };

      let selectCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            selectCount++ === 0 ? [fakeDemoUser] : [fakeDemoOrg]
          ),
        }),
      }));

      const result = await authService.demoLogin();

      expect(result.user.email).toBe('demo@pulsestack.io');
      expect(result.organization.slug).toBe('demo-pulsestack');
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(result.refreshToken).toBe('mock-raw-refresh-token');
    });
  });
});
