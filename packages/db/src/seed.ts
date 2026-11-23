import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { getDb, closeDb } from './client';
import {
  organizations,
  users,
  monitors,
  healthCheckResults,
  incidents,
  webhooks,
  webhookDeliveries,
} from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('[SEED] Starting PulseStack database seeder...');
  const db = getDb();

  try {
    // 1. Create or retrieve Demo Organization
    console.log('[SEED] Creating demo organization...');
    const demoSlug = 'pulsestack-demo';
    let [demoOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, demoSlug));

    if (!demoOrg) {
      [demoOrg] = await db
        .insert(organizations)
        .values({
          name: 'PulseStack Demo Inc',
          slug: demoSlug,
          plan: 'pro',
        })
        .returning();
      console.log(`[SEED] Created demo organization: ${demoOrg.id}`);
    } else {
      console.log(`[SEED] Demo organization already exists: ${demoOrg.id}`);
    }

    const orgId = demoOrg.id;

    // 2. Create or update Demo User
    console.log('[SEED] Creating demo user: demo@pulsestack.io ...');
    const demoEmail = 'demo@pulsestack.io';
    const passwordHash = await bcrypt.hash('Demo1234!', 10);

    let [demoUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, demoEmail));

    if (!demoUser) {
      [demoUser] = await db
        .insert(users)
        .values({
          email: demoEmail,
          passwordHash,
          name: 'Demo Admin',
          role: 'owner',
          orgId,
        })
        .returning();
      console.log(`[SEED] Created demo user: ${demoUser.id}`);
    } else {
      console.log(`[SEED] Demo user already exists: ${demoUser.id}`);
    }

    // 3. Create 5 Diverse Production Monitors
    console.log('[SEED] Seeding production monitors...');
    const monitorConfigs: Array<{
      name: string;
      url: string;
      method: 'GET' | 'HEAD';
      intervalSeconds: number;
      timeout: number;
      expectedStatus: number;
      status: 'up' | 'down' | 'degraded';
    }> = [
      {
        name: 'Production API Gateway',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        intervalSeconds: 60,
        timeout: 5000,
        expectedStatus: 200,
        status: 'up',
      },
      {
        name: 'Auth & Identity Microservice',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        intervalSeconds: 60,
        timeout: 5000,
        expectedStatus: 200,
        status: 'up',
      },
      {
        name: 'Payment Processing Webhook',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        intervalSeconds: 60,
        timeout: 5000,
        expectedStatus: 200,
        status: 'up',
      },
      {
        name: 'Analytics Ingestion Pipeline',
        url: 'https://httpbin.org/status/500',
        method: 'GET',
        intervalSeconds: 60,
        timeout: 5000,
        expectedStatus: 200,
        status: 'down',
      },
      {
        name: 'Global CDN Edge Health',
        url: 'https://httpbin.org/delay/2',
        method: 'GET',
        intervalSeconds: 60,
        timeout: 5000,
        expectedStatus: 200,
        status: 'degraded',
      },
    ];

    const seededMonitors: any[] = [];

    for (const config of monitorConfigs) {
      const existing = await db
        .select()
        .from(monitors)
        .where(eq(monitors.name, config.name));

      if (existing.length > 0) {
        seededMonitors.push(existing[0]);
      } else {
        const [created] = await db
          .insert(monitors)
          .values({
            orgId,
            name: config.name,
            url: config.url,
            method: config.method,
            intervalSeconds: config.intervalSeconds,
            timeout: config.timeout,
            expectedStatus: config.expectedStatus,
            status: config.status,
            isActive: true,
            lastCheckedAt: new Date(),
          })
          .returning();
        seededMonitors.push(created);
        console.log(`[SEED] Seeded monitor: ${config.name} (${created.id})`);
      }
    }

    // 4. Seed Historical Telemetry Check Results (last 24 hours)
    console.log('[SEED] Seeding historical health check telemetry...');
    const now = Date.now();
    const checksToInsert: any[] = [];

    for (const mon of seededMonitors) {
      // 50 historical points per monitor spaced every 20 minutes
      for (let i = 0; i < 50; i++) {
        const checkTime = new Date(now - i * 20 * 60 * 1000);

        let status: 'up' | 'down' | 'degraded' = 'up';
        let statusCode = 200;
        let latencyMs = Math.floor(35 + Math.random() * 30); // 35 - 65ms normal
        let error: string | null = null;

        if (mon.name.includes('Analytics')) {
          status = 'down';
          statusCode = 500;
          latencyMs = 120;
          error = 'HTTP 500 Internal Server Error';
        } else if (mon.name.includes('CDN Edge')) {
          status = 'degraded';
          statusCode = 200;
          latencyMs = Math.floor(1800 + Math.random() * 400); // 1.8s - 2.2s degraded
        } else if (i === 12 && mon.name.includes('Production API')) {
          // Occasional historical latency spike
          latencyMs = 210;
        }

        checksToInsert.push({
          monitorId: mon.id,
          orgId,
          statusCode,
          latencyMs,
          status,
          error,
          checkedAt: checkTime,
        });
      }
    }

    // Batch insert telemetry
    if (checksToInsert.length > 0) {
      await db.insert(healthCheckResults).values(checksToInsert);
      console.log(`[SEED] Inserted ${checksToInsert.length} historical health check entries.`);
    }

    // 5. Seed Realistic Incidents (1 resolved, 1 active)
    console.log('[SEED] Seeding incidents...');
    const apiGateway = seededMonitors.find((m) => m.name.includes('API Gateway'));
    const analytics = seededMonitors.find((m) => m.name.includes('Analytics'));

    if (apiGateway) {
      const pastStart = new Date(now - 48 * 60 * 60 * 1000); // 2 days ago
      const pastResolved = new Date(now - (48 * 60 - 4) * 60 * 1000); // resolved in 4 mins

      await db.insert(incidents).values({
        monitorId: apiGateway.id,
        orgId,
        type: 'down',
        cause: 'Upstream gateway DNS resolution failure',
        startedAt: pastStart,
        resolvedAt: pastResolved,
      });
      console.log('[SEED] Created resolved incident for Production API Gateway');
    }

    if (analytics) {
      const activeStart = new Date(now - 35 * 60 * 1000); // started 35 mins ago

      await db.insert(incidents).values({
        monitorId: analytics.id,
        orgId,
        type: 'down',
        cause: 'HTTP 500 Internal Server Error (Database connection pool exhausted)',
        startedAt: activeStart,
        resolvedAt: null, // Still active
      });
      console.log('[SEED] Created active incident for Analytics Ingestion Pipeline');
    }

    // 6. Seed Webhook and Deliveries
    console.log('[SEED] Seeding webhooks...');
    const [demoWebhook] = await db
      .insert(webhooks)
      .values({
        orgId,
        url: 'https://webhook.site/pulsestack-demo-alerts',
        secret: 'whsec_demo_secret_key_pulse_123456',
        events: ['*'],
        isActive: true,
      })
      .returning();

    if (demoWebhook) {
      console.log(`[SEED] Created webhook: ${demoWebhook.id}`);
      await db.insert(webhookDeliveries).values([
        {
          webhookId: demoWebhook.id,
          orgId,
          event: 'monitor.down',
          payload: { monitorId: apiGateway?.id, status: 'down' },
          responseStatus: 200,
          success: true,
          attemptCount: 1,
          deliveredAt: new Date(now - 34 * 60 * 1000),
        },
        {
          webhookId: demoWebhook.id,
          orgId,
          event: 'incident.created',
          payload: { monitorId: analytics?.id, type: 'down' },
          responseStatus: 200,
          success: true,
          attemptCount: 1,
          deliveredAt: new Date(now - 34 * 60 * 1000),
        },
      ]);
      console.log('[SEED] Created webhook delivery audit logs');
    }

    console.log('\n[SEED] 🎉 Seeding completed successfully!');
    console.log('---------------------------------------------------------');
    console.log('Demo Credentials:');
    console.log('Email:    demo@pulsestack.io');
    console.log('Password: Demo1234!');
    console.log('---------------------------------------------------------');
  } catch (err: any) {
    console.error('[SEED] Error during seeding:', err.message);
    throw err;
  } finally {
    await closeDb();
  }
}

seed();
