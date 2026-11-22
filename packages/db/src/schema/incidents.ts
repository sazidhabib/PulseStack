import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { monitors } from './monitors';

export const incidentTypeEnum = pgEnum('incident_type', ['down', 'degraded', 'recovered']);

export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  monitorId: uuid('monitor_id')
    .references(() => monitors.id, { onDelete: 'cascade' })
    .notNull(),
  orgId: uuid('org_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  type: incidentTypeEnum('type').notNull(),
  cause: text('cause'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
