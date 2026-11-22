import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { TokenService } from '../services/token.service';
import { WsManager } from './ws-manager';
import { UserPayload } from '@pulsestack/shared';

export interface SetupWebSocketOptions {
  server: http.Server;
  tokenService: TokenService;
  wsManager: WsManager;
}

export interface WsServerInstance {
  wss: WebSocketServer;
  close: () => Promise<void>;
}

export function setupWebSocketServer({
  server,
  tokenService,
  wsManager,
}: SetupWebSocketOptions): WsServerInstance {
  const wss = new WebSocketServer({ noServer: true });

  const upgradeHandler = (
    request: http.IncomingMessage,
    socket: any,
    head: Buffer
  ) => {
    const host = request.headers.host || 'localhost';
    const protocol = (request.socket as any).encrypted ? 'https' : 'http';
    let url: URL;

    try {
      url = new URL(request.url || '', `${protocol}://${host}`);
    } catch {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    if (url.pathname !== '/ws') {
      // Ignore paths other than /ws
      return;
    }

    // Authenticate handshake via query parameter ?token=<accessToken>
    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let payload: UserPayload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, payload);
    });
  };

  server.on('upgrade', upgradeHandler);

  wss.on('connection', (ws: WebSocket, _request: http.IncomingMessage, payload: UserPayload) => {
    const { orgId, userId, role } = payload;

    // Register connection under tenant organization
    wsManager.addConnection(orgId, ws, userId);

    // Send connection established confirmation
    ws.send(
      JSON.stringify({
        type: 'connection:established',
        data: {
          userId,
          orgId,
          role,
          connectedAt: new Date().toISOString(),
        },
      })
    );

    // Client messages (e.g. ping/pong heartbeat or client commands)
    ws.on('message', (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Ignore unparseable client messages
      }
    });
  });

  const close = async (): Promise<void> => {
    server.off('upgrade', upgradeHandler);
    wsManager.closeAll();
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  };

  return { wss, close };
}
