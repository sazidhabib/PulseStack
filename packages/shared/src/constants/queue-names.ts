export const QUEUE_NAMES = {
  HEALTH_CHECK: 'health-check',
  WEBHOOK_DISPATCH: 'webhook-dispatch',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
