import { Router, RequestHandler } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '@pulsestack/shared';

export function createAuthRoutes(
  authController: AuthController,
  authMiddleware: RequestHandler,
  rateLimiter?: RequestHandler
): Router {
  const router = Router();
  const limit = rateLimiter || ((_req, _res, next) => next());

  router.post('/register', limit, validate(registerSchema), authController.register);
  router.post('/login', limit, validate(loginSchema), authController.login);
  router.post('/refresh', authController.refresh);
  router.post('/logout', authController.logout);
  router.post('/demo', authController.demo);
  router.get('/me', authMiddleware, authController.me);

  return router;
}
