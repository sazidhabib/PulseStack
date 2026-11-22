import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@pulsestack/shared';
import { DbClient, createTenantScope } from '@pulsestack/db';

export function createTenantScopeMiddleware(db: DbClient) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !req.user.orgId) {
      throw new UnauthorizedError('Tenant context could not be determined');
    }

    req.scope = createTenantScope(db, req.user.orgId);
    next();
  };
}
