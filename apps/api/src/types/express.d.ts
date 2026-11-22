import { UserPayload } from '@pulsestack/shared';
import { TenantScope } from '@pulsestack/db';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      scope?: TenantScope;
    }
  }
}
