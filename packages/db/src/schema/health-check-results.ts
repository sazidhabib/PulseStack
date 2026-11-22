import { pgTable, uuid, text, timestamp, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { monitors } from './monitors';

export const checkStatusEnum = pgEnum('check_status', ['up', 'down', 'degraded']);

export const healthCheckResults = pgTable(
  'health_check_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    monitorId: uuid('monitor_id')
      .references(() => monitors.id, { onDelete: 'cascade' })
      .notNull(),
    orgId: uuid('org_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    statusCode: integer('status_code'),
    latencyMs: integer('latency_ms').notNull(),
    status: checkStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_health_check_results_lookup').on(table.orgId, table.monitorId, table.checkedAt),
  ]
);

export type HealthCheckResult = typeof healthCheckResults.$inferSelect;
export type NewHealthCheckResult = typeof healthCheckResults.$inferInsert;
