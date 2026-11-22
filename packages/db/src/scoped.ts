import { eq, and, desc, isNull, isNotNull, sql, ilike } from 'drizzle-orm';
import { DbClient } from './client';
import {
  organizations,
  monitors,
  healthCheckResults,
  incidents,
  webhooks,
  webhookDeliveries,
  NewMonitor,
  NewHealthCheckResult,
  NewIncident,
  NewWebhook,
  NewWebhookDelivery,
} from './schema';

export function createTenantScope(db: DbClient, orgId: string) {
  return {
    organization: {
      get: () =>
        db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .then((rows) => rows[0] ?? null),

      update: (data: { name?: string }) =>
        db
          .update(organizations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(organizations.id, orgId))
          .returning()
          .then((rows) => rows[0] ?? null),
    },

    monitors: {
      findAll: (options: { limit?: number; offset?: number; status?: any; search?: string } = {}) => {
        const { limit = 50, offset = 0, status, search } = options;
        const conditions = [eq(monitors.orgId, orgId)];

        if (status) {
          conditions.push(eq(monitors.status, status));
        }
        if (search) {
          conditions.push(ilike(monitors.name, `%${search}%`));
        }

        return db
          .select()
          .from(monitors)
          .where(and(...conditions))
          .orderBy(desc(monitors.createdAt))
          .limit(limit)
          .offset(offset);
      },

      count: (options: { status?: any; search?: string } = {}) => {
        const { status, search } = options;
        const conditions = [eq(monitors.orgId, orgId)];

        if (status) {
          conditions.push(eq(monitors.status, status));
        }
        if (search) {
          conditions.push(ilike(monitors.name, `%${search}%`));
        }

        return db
          .select({ count: sql<number>`count(*)::int` })
          .from(monitors)
          .where(and(...conditions))
          .then((rows) => rows[0]?.count ?? 0);
      },

      findById: (id: string) =>
        db
          .select()
          .from(monitors)
          .where(and(eq(monitors.id, id), eq(monitors.orgId, orgId)))
          .then((rows) => rows[0] ?? null),

      create: (data: Omit<NewMonitor, 'orgId'>) =>
        db
          .insert(monitors)
          .values({ ...data, orgId })
          .returning()
          .then((rows) => rows[0]),

      update: (id: string, data: Partial<Omit<NewMonitor, 'id' | 'orgId'>>) =>
        db
          .update(monitors)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(monitors.id, id), eq(monitors.orgId, orgId)))
          .returning()
          .then((rows) => rows[0] ?? null),

      delete: (id: string) =>
        db
          .delete(monitors)
          .where(and(eq(monitors.id, id), eq(monitors.orgId, orgId)))
          .returning()
          .then((rows) => rows[0] ?? null),
    },

    healthChecks: {
      findByMonitor: (monitorId: string, limit = 100, offset = 0) =>
        db
          .select()
          .from(healthCheckResults)
          .where(
            and(
              eq(healthCheckResults.orgId, orgId),
              eq(healthCheckResults.monitorId, monitorId)
            )
          )
          .orderBy(desc(healthCheckResults.checkedAt))
          .limit(limit)
          .offset(offset),

      countByMonitor: (monitorId: string) =>
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(healthCheckResults)
          .where(
            and(
              eq(healthCheckResults.orgId, orgId),
              eq(healthCheckResults.monitorId, monitorId)
            )
          )
          .then((rows) => rows[0]?.count ?? 0),

      getStats: async (monitorId: string) => {
        // Query recent 100 checks or last 24h
        const checks = await db
          .select({
            status: healthCheckResults.status,
            latencyMs: healthCheckResults.latencyMs,
          })
          .from(healthCheckResults)
          .where(
            and(
              eq(healthCheckResults.orgId, orgId),
              eq(healthCheckResults.monitorId, monitorId)
            )
          )
          .orderBy(desc(healthCheckResults.checkedAt))
          .limit(200);

        if (checks.length === 0) {
          return {
            totalChecks: 0,
            uptimePercentage: 100,
            avgLatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
          };
        }

        const upCount = checks.filter((c) => c.status === 'up').length;
        const uptimePercentage = Number(((upCount / checks.length) * 100).toFixed(2));

        const latencies = checks.map((c) => c.latencyMs).sort((a, b) => a - b);
        const sum = latencies.reduce((acc, val) => acc + val, 0);
        const avgLatencyMs = Math.round(sum / latencies.length);

        const p95Index = Math.min(
          Math.floor(latencies.length * 0.95),
          latencies.length - 1
        );
        const p99Index = Math.min(
          Math.floor(latencies.length * 0.99),
          latencies.length - 1
        );

        return {
          totalChecks: checks.length,
          uptimePercentage,
          avgLatencyMs,
          p95LatencyMs: latencies[p95Index],
          p99LatencyMs: latencies[p99Index],
        };
      },

      create: (data: Omit<NewHealthCheckResult, 'orgId'>) =>
        db
          .insert(healthCheckResults)
          .values({ ...data, orgId })
          .returning()
          .then((rows) => rows[0]),
    },

    incidents: {
      findAll: (options: { limit?: number; offset?: number; status?: 'open' | 'resolved' } = {}) => {
        const { limit = 50, offset = 0, status } = options;
        const conditions = [eq(incidents.orgId, orgId)];

        if (status === 'open') {
          conditions.push(isNull(incidents.resolvedAt));
        } else if (status === 'resolved') {
          conditions.push(isNotNull(incidents.resolvedAt));
        }

        return db
          .select({
            id: incidents.id,
            monitorId: incidents.monitorId,
            orgId: incidents.orgId,
            type: incidents.type,
            cause: incidents.cause,
            startedAt: incidents.startedAt,
            resolvedAt: incidents.resolvedAt,
            createdAt: incidents.createdAt,
            monitorName: monitors.name,
          })
          .from(incidents)
          .leftJoin(monitors, eq(incidents.monitorId, monitors.id))
          .where(and(...conditions))
          .orderBy(desc(incidents.startedAt))
          .limit(limit)
          .offset(offset);
      },

      count: (options: { status?: 'open' | 'resolved' } = {}) => {
        const { status } = options;
        const conditions = [eq(incidents.orgId, orgId)];

        if (status === 'open') {
          conditions.push(isNull(incidents.resolvedAt));
        } else if (status === 'resolved') {
          conditions.push(isNotNull(incidents.resolvedAt));
        }

        return db
          .select({ count: sql<number>`count(*)::int` })
          .from(incidents)
          .where(and(...conditions))
          .then((rows) => rows[0]?.count ?? 0);
      },

      findById: (id: string) =>
        db
          .select({
            id: incidents.id,
            monitorId: incidents.monitorId,
            orgId: incidents.orgId,
            type: incidents.type,
            cause: incidents.cause,
            startedAt: incidents.startedAt,
            resolvedAt: incidents.resolvedAt,
            createdAt: incidents.createdAt,
            monitorName: monitors.name,
          })
          .from(incidents)
          .leftJoin(monitors, eq(incidents.monitorId, monitors.id))
          .where(and(eq(incidents.id, id), eq(incidents.orgId, orgId)))
          .then((rows) => rows[0] ?? null),

      create: (data: Omit<NewIncident, 'orgId'>) =>
        db
          .insert(incidents)
          .values({ ...data, orgId })
          .returning()
          .then((rows) => rows[0]),

      resolve: (monitorId: string) =>
        db
          .update(incidents)
          .set({ resolvedAt: new Date() })
          .where(
            and(
              eq(incidents.orgId, orgId),
              eq(incidents.monitorId, monitorId),
              isNull(incidents.resolvedAt)
            )
          )
          .returning(),
    },

    webhooks: {
      findAll: () =>
        db.select().from(webhooks).where(eq(webhooks.orgId, orgId)),

      findById: (id: string) =>
        db
          .select()
          .from(webhooks)
          .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)))
          .then((rows) => rows[0] ?? null),

      create: (data: Omit<NewWebhook, 'orgId'>) =>
        db
          .insert(webhooks)
          .values({ ...data, orgId })
          .returning()
          .then((rows) => rows[0]),

      update: (id: string, data: Partial<Omit<NewWebhook, 'id' | 'orgId'>>) =>
        db
          .update(webhooks)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)))
          .returning()
          .then((rows) => rows[0] ?? null),

      delete: (id: string) =>
        db
          .delete(webhooks)
          .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)))
          .returning()
          .then((rows) => rows[0] ?? null),

      getDeliveries: (webhookId: string, limit = 50) =>
        db
          .select()
          .from(webhookDeliveries)
          .where(
            and(
              eq(webhookDeliveries.orgId, orgId),
              eq(webhookDeliveries.webhookId, webhookId)
            )
          )
          .orderBy(desc(webhookDeliveries.deliveredAt))
          .limit(limit),

      logDelivery: (data: Omit<NewWebhookDelivery, 'orgId'>) =>
        db
          .insert(webhookDeliveries)
          .values({ ...data, orgId })
          .returning()
          .then((rows) => rows[0]),
    },
  };
}

export type TenantScope = ReturnType<typeof createTenantScope>;
