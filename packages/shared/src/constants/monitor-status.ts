export const MONITOR_STATUS = {
  UP: 'up',
  DOWN: 'down',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown',
} as const;

export type MonitorStatus = typeof MONITOR_STATUS[keyof typeof MONITOR_STATUS];

export const HTTP_METHODS = {
  GET: 'GET',
  HEAD: 'HEAD',
} as const;

export type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS];
