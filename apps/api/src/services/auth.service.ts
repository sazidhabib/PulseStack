import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  DbClient,
  users,
  organizations,
  User,
  Organization,
  eq,
} from '@pulsestack/db';
import {
  RegisterInput,
  LoginInput,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  UserPayload,
} from '@pulsestack/shared';
import { TokenService } from './token.service';

export class AuthService {
  constructor(
    private db: DbClient,
    private tokenService: TokenService
  ) {}

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${base || 'org'}-${suffix}`;
  }

  async register(input: RegisterInput) {
    // 1. Check if user already exists
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()));

    if (existing.length > 0) {
      throw new ConflictError('Email address is already in use');
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);

    // 3. Create Organization
    const slug = this.slugify(input.orgName);
    const orgs = await this.db
      .insert(organizations)
      .values({
        name: input.orgName,
        slug,
        plan: 'free',
      })
      .returning();

    const org = orgs[0];

    // 4. Create User as 'owner'
    const createdUsers = await this.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: 'owner',
        orgId: org.id,
      })
      .returning();

    const user = createdUsers[0];

    // 5. Generate tokens
    const userPayload: UserPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: org.id,
    };

    const accessToken = this.tokenService.generateAccessToken(userPayload);
    const { rawToken: refreshToken } = await this.tokenService.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput) {
    // 1. Find user
    const foundUsers = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()));

    const user = foundUsers[0];
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Compare password
    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Fetch Organization
    const foundOrgs = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId));

    const org = foundOrgs[0];
    if (!org) {
      throw new NotFoundError('Organization not found for this account');
    }

    // 4. Generate tokens
    const userPayload: UserPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: org.id,
    };

    const accessToken = this.tokenService.generateAccessToken(userPayload);
    const { rawToken: refreshToken } = await this.tokenService.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(rawRefreshToken: string) {
    return this.tokenService.rotateRefreshToken(rawRefreshToken);
  }

  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      await this.tokenService.revokeToken(rawRefreshToken);
    }
    return { success: true };
  }

  async demoLogin() {
    const demoEmail = 'demo@pulsestack.io';

    // 1. Find or create demo user
    let userRecord: User;
    let orgRecord: Organization;

    const existingUsers = await this.db
      .select()
      .from(users)
      .where(eq(users.email, demoEmail));

    if (existingUsers.length > 0) {
      userRecord = existingUsers[0];
      const orgs = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, userRecord.orgId));
      orgRecord = orgs[0];
    } else {
      // Create demo org
      const orgs = await this.db
        .insert(organizations)
        .values({
          name: 'PulseStack Demo Inc',
          slug: 'demo-pulsestack',
          plan: 'pro',
        })
        .returning();
      orgRecord = orgs[0];

      // Create demo user
      const dummyPasswordHash = await bcrypt.hash('DemoUser123!', 10);
      const newUsers = await this.db
        .insert(users)
        .values({
          email: demoEmail,
          passwordHash: dummyPasswordHash,
          name: 'Demo Evaluator',
          role: 'admin',
          orgId: orgRecord.id,
        })
        .returning();
      userRecord = newUsers[0];
    }

    const userPayload: UserPayload = {
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      orgId: orgRecord.id,
    };

    const accessToken = this.tokenService.generateAccessToken(userPayload);
    const { rawToken: refreshToken } = await this.tokenService.createRefreshToken(userRecord.id);

    return {
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        role: userRecord.role,
      },
      organization: {
        id: orgRecord.id,
        name: orgRecord.name,
        slug: orgRecord.slug,
        plan: orgRecord.plan,
      },
      accessToken,
      refreshToken,
    };
  }

  async getCurrentUser(userId: string) {
    const userRecords = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    const user = userRecords[0];
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const orgRecords = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId));

    const org = orgRecords[0];

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan: org.plan,
          }
        : null,
    };
  }
}
