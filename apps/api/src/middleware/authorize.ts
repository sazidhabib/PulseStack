import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '@pulsestack/shared';

export function requireRole(allowedRoles: ('owner' | 'admin' | 'viewer')[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Action requires one of the following roles: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}
