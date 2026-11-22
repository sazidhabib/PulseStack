import { getDb, DbClient } from '@pulsestack/db';
import { TokenService } from './services/token.service';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { MonitorService } from './services/monitor.service';
import { MonitorController } from './controllers/monitor.controller';
import { WebhookService } from './services/webhook.service';
import { WebhookController } from './controllers/webhook.controller';
import { IncidentService } from './services/incident.service';
import { IncidentController } from './controllers/incident.controller';
import { OrgService } from './services/org.service';
import { OrgController } from './controllers/org.controller';
import { QueueService } from './services/queue.service';
import { WsManager } from './ws/ws-manager';
import { RedisSubscriber } from './ws/redis-subscriber';
import { createAuthMiddleware } from './middleware/authenticate';
import { createTenantScopeMiddleware } from './middleware/tenant-scope';
import { createRateLimiter } from './middleware/rate-limit';
import { RequestHandler } from 'express';

export interface AppContainer {
  db: DbClient;
  tokenService: TokenService;
  authService: AuthService;
  authController: AuthController;
  monitorService: MonitorService;
  monitorController: MonitorController;
  webhookService: WebhookService;
  webhookController: WebhookController;
  incidentService: IncidentService;
  incidentController: IncidentController;
  orgService: OrgService;
  orgController: OrgController;
  queueService: QueueService;
  wsManager: WsManager;
  redisSubscriber: RedisSubscriber;
  authMiddleware: RequestHandler;
  tenantScopeMiddleware: RequestHandler;
  authRateLimiter: RequestHandler;
}

export function createContainer(): AppContainer {
  const db = getDb();
  const queueService = new QueueService();
  const tokenService = new TokenService(db);
  const authService = new AuthService(db, tokenService);
  const authController = new AuthController(authService);
  const monitorService = new MonitorService(queueService);
  const monitorController = new MonitorController(monitorService);
  const webhookService = new WebhookService();
  const webhookController = new WebhookController(webhookService);
  const incidentService = new IncidentService();
  const incidentController = new IncidentController(incidentService);
  const orgService = new OrgService();
  const orgController = new OrgController(orgService);
  const wsManager = new WsManager();
  const redisSubscriber = new RedisSubscriber(wsManager);
  const authMiddleware = createAuthMiddleware(tokenService);
  const tenantScopeMiddleware = createTenantScopeMiddleware(db);
  const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  });

  return {
    db,
    tokenService,
    authService,
    authController,
    monitorService,
    monitorController,
    webhookService,
    webhookController,
    incidentService,
    incidentController,
    orgService,
    orgController,
    queueService,
    wsManager,
    redisSubscriber,
    authMiddleware,
    tenantScopeMiddleware,
    authRateLimiter,
  };
}
