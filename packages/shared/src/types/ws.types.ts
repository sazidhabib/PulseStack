export type WsEvent =
  | {
      type: 'health-check:result';
      data: {
        monitorId: string;
        orgId: string;
        status: 'up' | 'down' | 'degraded';
        latencyMs: number;
        statusCode: number | null;
        checkedAt: string;
      };
    }
  | {
      type: 'monitor:status-changed';
      data: {
        monitorId: string;
        orgId: string;
        from: string;
        to: string;
        changedAt: string;
      };
    }
  | {
      type: 'incident:created';
      data: {
        incidentId: string;
        monitorId: string;
        orgId: string;
        type: string;
        startedAt: string;
      };
    }
  | {
      type: 'incident:resolved';
      data: {
        incidentId: string;
        monitorId: string;
        orgId: string;
        resolvedAt: string;
      };
    };
