import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@pulsestack/shared';
import { TokenService } from '../services/token.service';

export function createAuthMiddleware(tokenService: TokenService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Bearer token not provided');
    }

    const payload = tokenService.verifyAccessToken(token);
    req.user = payload;
    next();
  };
}
