import { Router, RequestHandler } from 'express';
import { IncidentController } from '../controllers/incident.controller';

export function createIncidentRoutes(
  incidentController: IncidentController,
  authMiddleware: RequestHandler,
  tenantScopeMiddleware: RequestHandler
): Router {
  const router = Router();

  router.use(authMiddleware);
  router.use(tenantScopeMiddleware);

  router.get('/', incidentController.list);
  router.get('/:id', incidentController.getById);

  return router;
}
