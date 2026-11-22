import { WebSocket } from 'ws';
import { WsEvent } from '@pulsestack/shared';

export interface ClientMeta {
  orgId: string;
  userId: string;
  isAlive: boolean;
  connectedAt: Date;
}

export class WsManager {
  private connections = new Map<string, Set<WebSocket>>();
  private clientMeta = new WeakMap<WebSocket, ClientMeta>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register a new authenticated WebSocket connection under an organization.
   */
  public addConnection(orgId: string, ws: WebSocket, userId: string): void {
    if (!this.connections.has(orgId)) {
      this.connections.set(orgId, new Set<WebSocket>());
    }

    this.connections.get(orgId)!.add(ws);

    this.clientMeta.set(ws, {
      orgId,
      userId,
      isAlive: true,
      connectedAt: new Date(),
    });

    ws.on('pong', () => {
      const meta = this.clientMeta.get(ws);
      if (meta) {
        meta.isAlive = true;
      }
    });

    ws.on('close', () => {
      this.removeConnection(orgId, ws);
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket] Error on connection (org: ${orgId}, user: ${userId}):`, err.message);
      this.removeConnection(orgId, ws);
    });
  }

  /**
   * Unregister a WebSocket connection.
   */
  public removeConnection(orgId: string, ws: WebSocket): void {
    const orgSockets = this.connections.get(orgId);
    if (orgSockets) {
      orgSockets.delete(ws);
      if (orgSockets.size === 0) {
        this.connections.delete(orgId);
      }
    }
  }

  /**
   * Broadcast an event strictly to connected clients belonging to the specified tenant orgId.
   */
  public broadcastToOrg(orgId: string, event: WsEvent | { type: string; data: unknown }): void {
    const orgSockets = this.connections.get(orgId);
    if (!orgSockets || orgSockets.size === 0) {
      return;
    }

    const payload = JSON.stringify(event);

    for (const ws of orgSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload, (err) => {
          if (err) {
            console.error(`[WebSocket] Failed to send to client in org ${orgId}:`, err.message);
            this.removeConnection(orgId, ws);
          }
        });
      } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        this.removeConnection(orgId, ws);
      }
    }
  }

  /**
   * Get active connection count (either total or for a specific tenant org).
   */
  public getConnectionCount(orgId?: string): number {
    if (orgId) {
      return this.connections.get(orgId)?.size ?? 0;
    }

    let total = 0;
    for (const sockets of this.connections.values()) {
      total += sockets.size;
    }
    return total;
  }

  /**
   * Get metadata for a connected client.
   */
  public getClientMeta(ws: WebSocket): ClientMeta | undefined {
    return this.clientMeta.get(ws);
  }

  /**
   * Start 30-second ping/pong heartbeat to clean up stale or dropped sockets.
   */
  public startHeartbeat(intervalMs: number = 30000): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      for (const [orgId, sockets] of this.connections.entries()) {
        for (const ws of sockets) {
          const meta = this.clientMeta.get(ws);
          if (!meta || !meta.isAlive) {
            // Socket failed to respond to previous ping — terminate
            ws.terminate();
            this.removeConnection(orgId, ws);
            continue;
          }

          meta.isAlive = false;
          ws.ping();
        }
      }
    }, intervalMs);

    // Unref heartbeat so it doesn't prevent Node process exit in tests
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Stop heartbeat timer.
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Close all active connections cleanly (e.g. on server shutdown).
   */
  public closeAll(): void {
    this.stopHeartbeat();
    for (const [orgId, sockets] of this.connections.entries()) {
      for (const ws of sockets) {
        try {
          ws.close(1001, 'Server shutting down');
        } catch {
          ws.terminate();
        }
      }
    }
    this.connections.clear();
  }
}
