import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisSubscriber } from '../../src/ws/redis-subscriber';
import { WsManager } from '../../src/ws/ws-manager';
import { WsEvent } from '@pulsestack/shared';

describe('RedisSubscriber', () => {
  let wsManager: WsManager;
  let mockRedis: any;
  let subscriber: RedisSubscriber;
  let listeners: Record<string, Function> = {};

  beforeEach(() => {
    listeners = {};
    mockRedis = {
      status: 'wait',
      connect: vi.fn().mockResolvedValue(undefined),
      psubscribe: vi.fn().mockResolvedValue('health-check:*'),
      punsubscribe: vi.fn().mockResolvedValue('health-check:*'),
      quit: vi.fn().mockResolvedValue('OK'),
      on: vi.fn((event: string, cb: Function) => {
        listeners[event] = cb;
      }),
    };

    wsManager = new WsManager();
    wsManager.stopHeartbeat();
    vi.spyOn(wsManager, 'broadcastToOrg');

    subscriber = new RedisSubscriber(wsManager, mockRedis);
  });

  it('should connect and psubscribe to health-check:* pattern', async () => {
    await subscriber.start();

    expect(mockRedis.connect).toHaveBeenCalled();
    expect(mockRedis.psubscribe).toHaveBeenCalledWith('health-check:*');
  });

  it('should forward incoming Redis Pub/Sub messages to wsManager.broadcastToOrg', async () => {
    await subscriber.start();

    const sampleEvent: WsEvent = {
      type: 'health-check:result',
      data: {
        monitorId: 'mon-test-1',
        orgId: 'org-test-99',
        status: 'up',
        latencyMs: 38,
        statusCode: 200,
        checkedAt: new Date().toISOString(),
      },
    };

    // Simulate Redis message received on pmessage
    const pmessageCb = listeners['pmessage'];
    expect(pmessageCb).toBeDefined();

    pmessageCb(
      'health-check:*',
      'health-check:org-test-99',
      JSON.stringify(sampleEvent)
    );

    expect(wsManager.broadcastToOrg).toHaveBeenCalledWith(
      'org-test-99',
      sampleEvent
    );
  });

  it('should gracefully handle malformed JSON messages without crashing', async () => {
    await subscriber.start();

    const pmessageCb = listeners['pmessage'];
    expect(() => {
      pmessageCb('health-check:*', 'health-check:org-test-99', 'invalid-json{{');
    }).not.toThrow();

    expect(wsManager.broadcastToOrg).not.toHaveBeenCalled();
  });

  it('should cleanly unsubscribe and disconnect on stop()', async () => {
    await subscriber.start();
    await subscriber.stop();

    expect(mockRedis.punsubscribe).toHaveBeenCalledWith('health-check:*');
    expect(mockRedis.quit).toHaveBeenCalled();
  });
});
