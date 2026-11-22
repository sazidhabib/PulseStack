import { Router, RequestHandler } from 'express';
import { OrgController } from '../controllers/org.controller';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/authorize';
import { updateOrgSchema } from '@pulsestack/shared';

export function createOrgRoutes(
  orgController: OrgController,
  authMiddleware: RequestHandler,
  tenantScopeMiddleware: RequestHandler
): Router {
  const router = Router();

  router.use(authMiddleware);
  router.use(tenantScopeMiddleware);

  router.get('/', orgController.get);
  router.patch(
    '/',
    requireRole(['owner']),
    validate(updateOrgSchema),
    orgController.update
  );

  return router;
}
