import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const monitorStatusEnum = pgEnum('monitor_status', ['up', 'down', 'degraded', 'unknown']);
export const httpMethodEnum = pgEnum('http_method', ['GET', 'HEAD']);

export const monitors = pgTable('monitors', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  method: httpMethodEnum('method').default('GET').notNull(),
  intervalSeconds: integer('interval_seconds').default(60).notNull(),
  timeout: integer('timeout').default(30000).notNull(),
  expectedStatus: integer('expected_status').default(200).notNull(),
  headers: jsonb('headers').$type<Record<string, string>>().default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  status: monitorStatusEnum('status').default('unknown').notNull(),
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Monitor = typeof monitors.$inferSelect;
export type NewMonitor = typeof monitors.$inferInsert;
