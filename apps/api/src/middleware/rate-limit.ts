import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '@pulsestack/shared';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message } = options;
  const requests = new Map<string, { count: number; resetTime: number }>();

  // Periodically clean up expired entries
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(ip);
      }
    }
  }, Math.min(windowMs, 60000));

  if (timer.unref) {
    timer.unref();
  }

  return (req: Request, _res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const client = requests.get(ip);

    if (!client || now > client.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    client.count++;

    if (client.count > max) {
      throw new RateLimitError(message || 'Too many requests, please try again later');
    }

    next();
  };
}
