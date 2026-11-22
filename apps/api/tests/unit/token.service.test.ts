import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenService } from '../../src/services/token.service';
import { UnauthorizedError, UserPayload } from '@pulsestack/shared';

describe('TokenService', () => {
  let mockDb: any;
  let tokenService: TokenService;

  const mockPayload: UserPayload = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'test@pulsestack.io',
    role: 'owner',
    orgId: '22222222-2222-2222-2222-222222222222',
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
      select: vi.fn(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    tokenService = new TokenService(mockDb);
  });

  describe('Access Token', () => {
    it('should generate a valid JWT access token and verify it correctly', () => {
      const token = tokenService.generateAccessToken(mockPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const decoded = tokenService.verifyAccessToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
      expect(decoded.orgId).toBe(mockPayload.orgId);
    });

    it('should throw UnauthorizedError on an invalid access token', () => {
      expect(() => tokenService.verifyAccessToken('invalid.token.here')).toThrow(
        UnauthorizedError
      );
    });
  });

  describe('Refresh Token Rotation & Security', () => {
    it('should create a refresh token and store hashed token in database', async () => {
      const { rawToken, family } = await tokenService.createRefreshToken(mockPayload.userId);

      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBe(80); // 40 bytes hex
      expect(typeof family).toBe('string');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should rotate valid refresh token: revoke old, issue new with same family', async () => {
      const familyId = '33333333-3333-3333-3333-333333333333';
      const fakeTokenRecord = {
        id: 'token-id-1',
        userId: mockPayload.userId,
        family: familyId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
      };

      const fakeUserRecord = {
        id: mockPayload.userId,
        email: mockPayload.email,
        role: mockPayload.role,
        orgId: mockPayload.orgId,
      };

      let selectCall = 0;
      mockDb.select.mockImplementation(() => {
        selectCall++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(
              selectCall === 1 ? [fakeTokenRecord] : [fakeUserRecord]
            ),
          }),
        };
      });

      const result = await tokenService.rotateRefreshToken('valid-raw-refresh-token');

      expect(result.accessToken).toBeDefined();
      expect(result.newRefreshToken).toBeDefined();
      expect(result.user.email).toBe(mockPayload.email);
      // Verify DB update was called to revoke the previous token
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('REUSE DETECTION: should revoke entire token family when compromised token is reused', async () => {
      const familyId = 'compromised-family-uuid';
      const compromisedTokenRecord = {
        id: 'compromised-token-id',
        userId: mockPayload.userId,
        family: familyId,
        revokedAt: new Date(Date.now() - 10000), // Already revoked previously!
        expiresAt: new Date(Date.now() + 100000),
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([compromisedTokenRecord]),
        }),
      });

      const revokeFamilySpy = vi.spyOn(tokenService, 'revokeFamily');

      await expect(
        tokenService.rotateRefreshToken('stolen-used-refresh-token')
      ).rejects.toThrow(
        /Compromised refresh token reused/i
      );

      expect(revokeFamilySpy).toHaveBeenCalledWith(familyId);
    });

    it('should throw UnauthorizedError when refresh token is expired', async () => {
      const expiredTokenRecord = {
        id: 'expired-token-id',
        userId: mockPayload.userId,
        family: 'some-family',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired in the past
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([expiredTokenRecord]),
        }),
      });

      await expect(
        tokenService.rotateRefreshToken('expired-token')
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
