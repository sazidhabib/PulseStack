import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  DbClient,
  refreshTokens,
  users,
  organizations,
  eq,
  and,
  isNull,
} from '@pulsestack/db';
import { UnauthorizedError, UserPayload } from '@pulsestack/shared';
import { env } from '../config/env';

export class TokenService {
  constructor(private db: DbClient) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateAccessToken(payload: UserPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): UserPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as UserPayload;
      return decoded;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired');
      }
      throw new UnauthorizedError('Invalid access token');
    }
  }

  async createRefreshToken(
    userId: string,
    existingFamily?: string
  ): Promise<{ rawToken: string; family: string }> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const hashedToken = this.hashToken(rawToken);
    const family = existingFamily || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.db.insert(refreshTokens).values({
      userId,
      token: hashedToken,
      family,
      expiresAt,
    });

    return { rawToken, family };
  }

  async rotateRefreshToken(rawToken: string): Promise<{
    accessToken: string;
    newRefreshToken: string;
    user: UserPayload;
  }> {
    const hashed = this.hashToken(rawToken);

    const tokenRecords = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, hashed));

    const record = tokenRecords[0];

    if (!record) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, someone is replaying a used token!
    if (record.revokedAt) {
      console.warn(
        `[SECURITY] Compromised refresh token reuse detected for family ${record.family}. Revoking entire family.`
      );
      await this.revokeFamily(record.family);
      throw new UnauthorizedError('Compromised refresh token reused. All sessions terminated.');
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Revoke the current token
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, record.id));

    // Fetch user and organization to build new UserPayload
    const userRecords = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        orgId: users.orgId,
      })
      .from(users)
      .where(eq(users.id, record.userId));

    const user = userRecords[0];
    if (!user) {
      throw new UnauthorizedError('User associated with token no longer exists');
    }

    const payload: UserPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    };

    // Issue new tokens maintaining the SAME family UUID
    const accessToken = this.generateAccessToken(payload);
    const { rawToken: newRefreshToken } = await this.createRefreshToken(user.id, record.family);

    return {
      accessToken,
      newRefreshToken,
      user: payload,
    };
  }

  async revokeFamily(family: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.family, family), isNull(refreshTokens.revokedAt)));
  }

  async revokeToken(rawToken: string): Promise<void> {
    const hashed = this.hashToken(rawToken);
    const records = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, hashed));

    if (records[0]) {
      await this.revokeFamily(records[0].family);
    }
  }
}
