import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { webhooks } from './webhooks';

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id')
      .references(() => webhooks.id, { onDelete: 'cascade' })
      .notNull(),
    orgId: uuid('org_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    responseStatus: integer('response_status'),
    success: boolean('success').notNull(),
    attemptCount: integer('attempt_count').default(1).notNull(),
    deliveredAt: timestamp('delivered_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_webhook_deliveries_lookup').on(table.orgId, table.webhookId, table.deliveredAt),
  ]
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
