import { Router, RequestHandler } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/authorize';
import { createWebhookSchema, updateWebhookSchema } from '@pulsestack/shared';

export function createWebhookRoutes(
  webhookController: WebhookController,
  authMiddleware: RequestHandler,
  tenantScopeMiddleware: RequestHandler
): Router {
  const router = Router();

  router.use(authMiddleware);
  router.use(tenantScopeMiddleware);

  router.get('/', webhookController.list);
  router.post(
    '/',
    requireRole(['owner', 'admin']),
    validate(createWebhookSchema),
    webhookController.create
  );

  router.get('/:id', webhookController.getById);
  router.patch(
    '/:id',
    requireRole(['owner', 'admin']),
    validate(updateWebhookSchema),
    webhookController.update
  );
  router.delete('/:id', requireRole(['owner', 'admin']), webhookController.delete);

  router.get('/:id/deliveries', webhookController.getDeliveries);
  router.post('/:id/test', requireRole(['owner', 'admin']), webhookController.test);

  return router;
}
