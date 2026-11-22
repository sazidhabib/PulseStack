import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsManager } from '../../src/ws/ws-manager';
import { WebSocket } from 'ws';
import { WsEvent } from '@pulsestack/shared';

describe('WsManager', () => {
  let wsManager: WsManager;

  beforeEach(() => {
    vi.useFakeTimers();
    wsManager = new WsManager();
  });

  afterEach(() => {
    wsManager.stopHeartbeat();
    vi.useRealTimers();
  });

  function createMockSocket(readyState: number = WebSocket.OPEN) {
    const listeners: Record<string, Function[]> = {};

    return {
      readyState,
      send: vi.fn(),
      ping: vi.fn(),
      terminate: vi.fn(),
      close: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      emit: (event: string, ...args: any[]) => {
        listeners[event]?.forEach((cb) => cb(...args));
      },
    } as unknown as WebSocket & { emit: (event: string, ...args: any[]) => void };
  }

  it('should register connection and update count', () => {
    const ws = createMockSocket();
    wsManager.addConnection('org-1', ws, 'user-1');

    expect(wsManager.getConnectionCount()).toBe(1);
    expect(wsManager.getConnectionCount('org-1')).toBe(1);
    expect(wsManager.getConnectionCount('org-2')).toBe(0);

    const meta = wsManager.getClientMeta(ws);
    expect(meta).toBeDefined();
    expect(meta?.orgId).toBe('org-1');
    expect(meta?.userId).toBe('user-1');
    expect(meta?.isAlive).toBe(true);
  });

  it('should remove connection when closed or error occurs', () => {
    const ws = createMockSocket();
    wsManager.addConnection('org-1', ws, 'user-1');
    expect(wsManager.getConnectionCount('org-1')).toBe(1);

    // Simulate close event
    ws.emit('close');
    expect(wsManager.getConnectionCount('org-1')).toBe(0);
    expect(wsManager.getConnectionCount()).toBe(0);
  });

  it('TENANT ISOLATION: broadcastToOrg sends message only to target org clients', () => {
    const wsOrg1A = createMockSocket();
    const wsOrg1B = createMockSocket();
    const wsOrg2 = createMockSocket();

    wsManager.addConnection('org-1', wsOrg1A, 'user-1a');
    wsManager.addConnection('org-1', wsOrg1B, 'user-1b');
    wsManager.addConnection('org-2', wsOrg2, 'user-2');

    const event: WsEvent = {
      type: 'health-check:result',
      data: {
        monitorId: 'mon-100',
        orgId: 'org-1',
        status: 'up',
        latencyMs: 45,
        statusCode: 200,
        checkedAt: new Date().toISOString(),
      },
    };

    wsManager.broadcastToOrg('org-1', event);

    const expectedPayload = JSON.stringify(event);

    // Both clients in org-1 should receive the message
    expect(wsOrg1A.send).toHaveBeenCalledWith(expectedPayload, expect.any(Function));
    expect(wsOrg1B.send).toHaveBeenCalledWith(expectedPayload, expect.any(Function));

    // Client in org-2 must NEVER receive org-1 events
    expect(wsOrg2.send).not.toHaveBeenCalled();
  });

  it('should skip and clean up closed or closing sockets during broadcast', () => {
    const activeWs = createMockSocket(WebSocket.OPEN);
    const closedWs = createMockSocket(WebSocket.CLOSED);

    wsManager.addConnection('org-1', activeWs, 'user-1');
    wsManager.addConnection('org-1', closedWs, 'user-2');

    expect(wsManager.getConnectionCount('org-1')).toBe(2);

    const event: WsEvent = {
      type: 'monitor:status-changed',
      data: {
        monitorId: 'mon-1',
        orgId: 'org-1',
        from: 'up',
        to: 'down',
        changedAt: new Date().toISOString(),
      },
    };

    wsManager.broadcastToOrg('org-1', event);

    expect(activeWs.send).toHaveBeenCalled();
    expect(closedWs.send).not.toHaveBeenCalled();

    // Closed socket should have been pruned
    expect(wsManager.getConnectionCount('org-1')).toBe(1);
  });

  it('Heartbeat: pings active sockets and terminates unresponsive ones', () => {
    const responsiveWs = createMockSocket(WebSocket.OPEN);
    const unresponsiveWs = createMockSocket(WebSocket.OPEN);

    wsManager.addConnection('org-1', responsiveWs, 'user-1');
    wsManager.addConnection('org-1', unresponsiveWs, 'user-2');

    // First heartbeat tick: sets isAlive = false and pings both
    vi.advanceTimersByTime(30000);

    expect(responsiveWs.ping).toHaveBeenCalledTimes(1);
    expect(unresponsiveWs.ping).toHaveBeenCalledTimes(1);

    // Responsive socket sends pong back
    responsiveWs.emit('pong');
    expect(wsManager.getClientMeta(responsiveWs)?.isAlive).toBe(true);
    expect(wsManager.getClientMeta(unresponsiveWs)?.isAlive).toBe(false);

    // Second heartbeat tick: unresponsive socket should be terminated
    vi.advanceTimersByTime(30000);

    expect(unresponsiveWs.terminate).toHaveBeenCalled();
    expect(wsManager.getConnectionCount('org-1')).toBe(1);
    expect(responsiveWs.ping).toHaveBeenCalledTimes(2);
  });
});
