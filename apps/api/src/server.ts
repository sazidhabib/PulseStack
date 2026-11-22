import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { env } from './config/env';
import { createContainer } from './container';
import { createAuthRoutes } from './routes/auth.routes';
import { createMonitorRoutes } from './routes/monitor.routes';
import { createWebhookRoutes } from './routes/webhook.routes';
import { createIncidentRoutes } from './routes/incident.routes';
import { createOrgRoutes } from './routes/org.routes';
import { setupWebSocketServer } from './ws/ws-server';
import { errorHandler } from './middleware/error-handler';
import { closeDb } from '@pulsestack/db';

const app: Express = express();
const container = createContainer();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Base endpoints
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req, res) => {
  res.json({
    message: 'Welcome to PulseStack API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      monitors: '/api/monitors',
      incidents: '/api/incidents',
      webhooks: '/api/webhooks',
      org: '/api/org',
    },
  });
});

// Mount Routes
app.use(
  '/api/auth',
  createAuthRoutes(container.authController, container.authMiddleware, container.authRateLimiter)
);
app.use(
  '/api/monitors',
  createMonitorRoutes(container.monitorController, container.authMiddleware, container.tenantScopeMiddleware)
);
app.use(
  '/api/webhooks',
  createWebhookRoutes(container.webhookController, container.authMiddleware, container.tenantScopeMiddleware)
);
app.use(
  '/api/incidents',
  createIncidentRoutes(container.incidentController, container.authMiddleware, container.tenantScopeMiddleware)
);
app.use(
  '/api/org',
  createOrgRoutes(container.orgController, container.authMiddleware, container.tenantScopeMiddleware)
);

// Global Error Handler
app.use(errorHandler);

const server: http.Server = http.createServer(app);

// Setup WebSocket Server on /ws with JWT handshake authentication
const wsServer = setupWebSocketServer({
  server,
  tokenService: container.tokenService,
  wsManager: container.wsManager,
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(env.API_PORT, async () => {
    console.log(`[API] PulseStack API running on port ${env.API_PORT} in ${env.NODE_ENV} mode`);
    console.log(`[API] WebSocket endpoint ready at ws://localhost:${env.API_PORT}/ws`);

    // Connect to Redis Pub/Sub for real-time telemetry forwarding
    await container.redisSubscriber.start();
    console.log('[API] Real-time Redis telemetry subscriber active');
  });
}

const gracefulShutdown = async () => {
  console.log('\n[API] Received kill signal, closing server...');
  await wsServer.close();
  await container.redisSubscriber.stop();
  await container.queueService.close();

  server.close(async () => {
    await closeDb();
    console.log('[API] Server, WebSockets, and database connections closed gracefully.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { app, server, container, wsServer };
