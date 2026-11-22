import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHealthCheckProcessor } from '../../src/jobs/health-check.job';
import * as pingUtil from '../../src/utils/http-ping';

describe('HealthCheckJobProcessor', () => {
  let mockDb: any;
  let mockRedis: any;
  let mockWebhookQueue: any;
  let processor: any;

  const fakeJobData = {
    monitorId: 'mon-123',
    orgId: 'org-abc',
    url: 'https://myservice.com/health',
    method: 'GET' as const,
    timeout: 5000,
    expectedStatus: 200,
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(() => {
          const promise = Promise.resolve([{ id: 'inc-123' }]);
          (promise as any).returning = vi.fn().mockResolvedValue([{ id: 'inc-123' }]);
          return promise;
        }),
      }),
      select: vi.fn(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const promise = Promise.resolve([{ id: 'inc-123' }]);
            (promise as any).returning = vi.fn().mockResolvedValue([{ id: 'inc-123' }]);
            return promise;
          }),
        }),
      }),
    };

    mockRedis = {
      publish: vi.fn().mockResolvedValue(1),
    };

    mockWebhookQueue = {
      add: vi.fn().mockResolvedValue({ id: 'wh-job-1' }),
    };

    processor = createHealthCheckProcessor(mockDb, mockRedis, mockWebhookQueue);
  });

  it('STATUS TRANSITION UP -> DOWN: creates incident, dispatches webhook, publishes Redis event', async () => {
    // Mock ping returning 500 (down)
    vi.spyOn(pingUtil, 'httpPing').mockResolvedValue({
      statusCode: 500,
      latencyMs: 120,
      status: 'down',
      error: 'HTTP 500 Internal Server Error',
    });

    const existingMonitor = {
      id: fakeJobData.monitorId,
      orgId: fakeJobData.orgId,
      name: 'Production API',
      url: fakeJobData.url,
      status: 'up', // Previous status was UP
      isActive: true,
    };

    const registeredWebhook = {
      id: 'wh-hook-1',
      orgId: fakeJobData.orgId,
      url: 'https://hooks.slack.com/services/123',
      secret: 'webhook-secret',
      events: ['monitor.down'],
      isActive: true,
    };

    let selectCall = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(
          selectCall++ === 0 ? [existingMonitor] : [registeredWebhook]
        ),
      }),
    }));

    const result = await processor({ data: fakeJobData } as any);

    expect(result.status).toBe('down');
    expect(result.latencyMs).toBe(120);

    // Verify healthCheckResults inserted
    expect(mockDb.insert).toHaveBeenCalledTimes(2); // 1: healthCheckResults, 2: incident

    // Verify webhook queued
    expect(mockWebhookQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.objectContaining({
        webhookId: 'wh-hook-1',
        event: 'monitor.down',
      })
    );

    // Verify Redis published incident:created, monitor:status-changed, and health-check:result
    expect(mockRedis.publish).toHaveBeenCalledTimes(3);
    const publishedEvents = mockRedis.publish.mock.calls.map(([channel, payload]: [string, string]) => ({
      channel,
      event: JSON.parse(payload),
    }));
    expect(publishedEvents[0].event.type).toBe('incident:created');
    expect(publishedEvents[1].event.type).toBe('monitor:status-changed');
    expect(publishedEvents[2].event.type).toBe('health-check:result');
  });

  it('STATUS TRANSITION DOWN -> UP: resolves incident, triggers recovery webhook', async () => {
    // Mock ping returning 200 (up)
    vi.spyOn(pingUtil, 'httpPing').mockResolvedValue({
      statusCode: 200,
      latencyMs: 35,
      status: 'up',
      error: null,
    });

    const existingMonitor = {
      id: fakeJobData.monitorId,
      orgId: fakeJobData.orgId,
      name: 'Production API',
      url: fakeJobData.url,
      status: 'down', // Previous status was DOWN
      isActive: true,
    };

    const registeredWebhook = {
      id: 'wh-hook-1',
      orgId: fakeJobData.orgId,
      url: 'https://hooks.slack.com/services/123',
      secret: 'webhook-secret',
      events: ['monitor.up'],
      isActive: true,
    };

    let selectCall = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(
          selectCall++ === 0 ? [existingMonitor] : [registeredWebhook]
        ),
      }),
    }));

    const result = await processor({ data: fakeJobData } as any);

    expect(result.status).toBe('up');

    // Verify incident resolved via db.update
    expect(mockDb.update).toHaveBeenCalledTimes(2); // 1: monitor status, 2: incident resolvedAt
    expect(mockWebhookQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.objectContaining({
        event: 'monitor.up',
      })
    );

    // Verify Redis published incident:resolved, monitor:status-changed, and health-check:result
    expect(mockRedis.publish).toHaveBeenCalledTimes(3);
    const recoveryEvents = mockRedis.publish.mock.calls.map(([channel, payload]: [string, string]) => ({
      channel,
      event: JSON.parse(payload),
    }));
    expect(recoveryEvents[0].event.type).toBe('incident:resolved');
    expect(recoveryEvents[1].event.type).toBe('monitor:status-changed');
    expect(recoveryEvents[2].event.type).toBe('health-check:result');
  });

  it('NO STATUS CHANGE (UP -> UP): only updates lastCheckedAt, no incidents or webhooks', async () => {
    vi.spyOn(pingUtil, 'httpPing').mockResolvedValue({
      statusCode: 200,
      latencyMs: 40,
      status: 'up',
      error: null,
    });

    const existingMonitor = {
      id: fakeJobData.monitorId,
      orgId: fakeJobData.orgId,
      name: 'Production API',
      url: fakeJobData.url,
      status: 'up', // Previous was UP, current is UP
      isActive: true,
    };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([existingMonitor]),
      }),
    });

    const result = await processor({ data: fakeJobData } as any);

    expect(result.status).toBe('up');
    // Only 1 update call for lastCheckedAt
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    // No webhook queued
    expect(mockWebhookQueue.add).not.toHaveBeenCalled();
    // 1 Redis publish for live telemetry stream
    expect(mockRedis.publish).toHaveBeenCalledTimes(1);
  });
});
