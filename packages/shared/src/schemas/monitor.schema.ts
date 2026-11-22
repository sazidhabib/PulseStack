import { z } from 'zod';
import { HTTP_METHODS } from '../constants/monitor-status';

export const createMonitorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  url: z.string().url('Must be a valid HTTP or HTTPS URL').refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    'URL must use HTTP or HTTPS protocol'
  ),
  method: z.enum([HTTP_METHODS.GET, HTTP_METHODS.HEAD]).default(HTTP_METHODS.GET),
  intervalSeconds: z
    .number()
    .int()
    .min(10, 'Interval must be at least 10 seconds')
    .max(86400, 'Interval cannot exceed 24 hours')
    .default(60),
  timeout: z
    .number()
    .int()
    .min(1000, 'Timeout must be at least 1 second')
    .max(60000, 'Timeout cannot exceed 60 seconds')
    .default(30000),
  expectedStatus: z
    .number()
    .int()
    .min(100)
    .max(599)
    .default(200),
  headers: z.record(z.string()).default({}),
  isActive: z.boolean().default(true),
});

export const updateMonitorSchema = createMonitorSchema.partial();

export const monitorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['up', 'down', 'degraded', 'unknown']).optional(),
  search: z.string().optional(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type MonitorQueryInput = z.infer<typeof monitorQuerySchema>;
