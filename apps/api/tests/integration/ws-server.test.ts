import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import { setupWebSocketServer, WsServerInstance } from '../../src/ws/ws-server';
import { WsManager } from '../../src/ws/ws-manager';
import { TokenService } from '../../src/services/token.service';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import { WsEvent } from '@pulsestack/shared';

describe('WebSocket Server Integration', () => {
  let server: http.Server;
  let wsServer: WsServerInstance;
  let wsManager: WsManager;
  let tokenService: TokenService;
  let port: number;

  const org1Id = 'org-tenant-1';
  const org2Id = 'org-tenant-2';

  const userOrg1Token = jwt.sign(
    { userId: 'user-1', orgId: org1Id, email: 'user1@tenant1.com', role: 'owner' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const userOrg2Token = jwt.sign(
    { userId: 'user-2', orgId: org2Id, email: 'user2@tenant2.com', role: 'member' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  beforeAll(async () => {
    server = http.createServer();
    tokenService = new TokenService({} as any);
    wsManager = new WsManager();
    wsManager.stopHeartbeat(); // avoid timers during tests

    wsServer = setupWebSocketServer({
      server,
      tokenService,
      wsManager,
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  function closeSocket(ws: WebSocket): Promise<void> {
    return new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      ws.once('close', () => resolve());
      ws.close();
    });
  }

  afterAll(async () => {
    await wsServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('HANDSHAKE AUTH: rejects connection with 401 when token query param is missing', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    const result = await new Promise<'connected' | 'rejected'>((resolve) => {
      ws.on('open', () => resolve('connected'));
      ws.on('unexpected-response', (_req, res) => {
        expect(res.statusCode).toBe(401);
        resolve('rejected');
      });
      ws.on('error', () => {
        // Expected handshake abort
        resolve('rejected');
      });
    });

    expect(result).toBe('rejected');
    ws.terminate();
  });

  it('HANDSHAKE AUTH: rejects connection with 401 when token is invalid or expired', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=invalid.jwt.token`);

    const result = await new Promise<'connected' | 'rejected'>((resolve) => {
      ws.on('open', () => resolve('connected'));
      ws.on('unexpected-response', (_req, res) => {
        expect(res.statusCode).toBe(401);
        resolve('rejected');
      });
      ws.on('error', () => {
        resolve('rejected');
      });
    });

    expect(result).toBe('rejected');
    ws.terminate();
  });

  it('CONNECTION & WELCOME: accepts valid token and sends connection:established payload', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${userOrg1Token}`);

    const welcomeMessage = await new Promise<any>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
      ws.on('error', reject);
    });

    expect(welcomeMessage.type).toBe('connection:established');
    expect(welcomeMessage.data.orgId).toBe(org1Id);
    expect(welcomeMessage.data.userId).toBe('user-1');
    expect(welcomeMessage.data.role).toBe('owner');

    await closeSocket(ws);
  });

  it('CLIENT MESSAGES: client ping receives pong response', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${userOrg1Token}`);

    const pongResponse = await new Promise<any>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connection:established') {
            ws.send(JSON.stringify({ type: 'ping' }));
          } else if (msg.type === 'pong') {
            resolve(msg);
          }
        } catch (e) {
          reject(e);
        }
      });
      ws.on('error', reject);
    });

    expect(pongResponse.type).toBe('pong');
    expect(pongResponse.timestamp).toBeDefined();

    await closeSocket(ws);
  });

  it('TENANT ISOLATION: ensures real-time events are strictly isolated between tenants', async () => {
    const wsClient1 = new WebSocket(`ws://localhost:${port}/ws?token=${userOrg1Token}`);
    const wsClient2 = new WebSocket(`ws://localhost:${port}/ws?token=${userOrg2Token}`);

    const client1ReceivedMessages: any[] = [];
    const client2ReceivedMessages: any[] = [];

    // Wait until both clients receive connection:established message
    await Promise.all([
      new Promise<void>((resolve) => {
        wsClient1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connection:established') {
            resolve();
          } else {
            client1ReceivedMessages.push(msg);
          }
        });
      }),
      new Promise<void>((resolve) => {
        wsClient2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'connection:established') {
            resolve();
          } else {
            client2ReceivedMessages.push(msg);
          }
        });
      }),
    ]);

    expect(wsManager.getConnectionCount(org1Id)).toBe(1);
    expect(wsManager.getConnectionCount(org2Id)).toBe(1);

    // Broadcast event targeted specifically at Org 1
    const org1Event: WsEvent = {
      type: 'health-check:result',
      data: {
        monitorId: 'mon-org1-check',
        orgId: org1Id,
        status: 'up',
        latencyMs: 50,
        statusCode: 200,
        checkedAt: new Date().toISOString(),
      },
    };

    wsManager.broadcastToOrg(org1Id, org1Event);

    // Wait for WebSocket delivery
    await new Promise((r) => setTimeout(r, 60));

    expect(client1ReceivedMessages.length).toBe(1);
    expect(client1ReceivedMessages[0].type).toBe('health-check:result');
    expect(client1ReceivedMessages[0].data.orgId).toBe(org1Id);
    expect(client2ReceivedMessages.length).toBe(0);

    // Broadcast event targeted specifically at Org 2
    const org2Event: WsEvent = {
      type: 'monitor:status-changed',
      data: {
        monitorId: 'mon-org2-alert',
        orgId: org2Id,
        from: 'up',
        to: 'down',
        changedAt: new Date().toISOString(),
      },
    };

    wsManager.broadcastToOrg(org2Id, org2Event);
    await new Promise((r) => setTimeout(r, 60));

    expect(client2ReceivedMessages.length).toBe(1);
    expect(client2ReceivedMessages[0].type).toBe('monitor:status-changed');
    expect(client2ReceivedMessages[0].data.orgId).toBe(org2Id);
    expect(client1ReceivedMessages.length).toBe(1);

    await Promise.all([closeSocket(wsClient1), closeSocket(wsClient2)]);
  });
});
