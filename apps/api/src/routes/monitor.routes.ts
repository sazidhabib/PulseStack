import { Router, RequestHandler } from 'express';
import { MonitorController } from '../controllers/monitor.controller';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/authorize';
import {
  createMonitorSchema,
  updateMonitorSchema,
  monitorQuerySchema,
} from '@pulsestack/shared';

export function createMonitorRoutes(
  monitorController: MonitorController,
  authMiddleware: RequestHandler,
  tenantScopeMiddleware: RequestHandler
): Router {
  const router = Router();

  // All monitor routes require authentication & tenant scoping
  router.use(authMiddleware);
  router.use(tenantScopeMiddleware);

  router.get('/', validate(monitorQuerySchema, 'query'), monitorController.list);
  router.post(
    '/',
    requireRole(['owner', 'admin']),
    validate(createMonitorSchema),
    monitorController.create
  );

  router.get('/:id', monitorController.getById);
  router.patch(
    '/:id',
    requireRole(['owner', 'admin']),
    validate(updateMonitorSchema),
    monitorController.update
  );
  router.delete('/:id', requireRole(['owner', 'admin']), monitorController.delete);

  router.get('/:id/results', monitorController.getResults);
  router.get('/:id/stats', monitorController.getStats);
  router.post('/:id/pause', requireRole(['owner', 'admin']), monitorController.pause);
  router.post('/:id/resume', requireRole(['owner', 'admin']), monitorController.resume);

  return router;
}
