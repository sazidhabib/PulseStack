import { z } from 'zod';

export const createWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL').refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    'Webhook URL must use HTTP or HTTPS'
  ),
  secret: z.string().min(16, 'Secret must be at least 16 characters for security').optional(),
  events: z.array(z.string()).min(1, 'Select at least one event').default(['monitor.down', 'monitor.up']),
  isActive: z.boolean().default(true),
});

export const updateWebhookSchema = createWebhookSchema.partial();

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
