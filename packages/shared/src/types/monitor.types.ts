import { MonitorStatus, HttpMethod } from '../constants/monitor-status';

export interface HealthCheckJobData {
  monitorId: string;
  orgId: string;
  url: string;
  method: HttpMethod;
  timeout: number;
  expectedStatus: number;
  headers?: Record<string, string>;
}

export interface WebhookDispatchJobData {
  webhookId: string;
  orgId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}

export interface PingResult {
  statusCode: number | null;
  latencyMs: number;
  status: 'up' | 'down' | 'degraded';
  error: string | null;
}
