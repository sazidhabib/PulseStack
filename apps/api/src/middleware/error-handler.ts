import { Request, Response, NextFunction } from 'express';
import { AppError } from '@pulsestack/shared';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle generic / unexpected server errors
  console.error(`[UNHANDLED ERROR] ${req.method} ${req.path}:`, err);

  const isDev = process.env.NODE_ENV !== 'production';

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message || 'An unexpected internal error occurred' : 'An unexpected internal error occurred',
      details: isDev ? (err as any).stack : undefined,
    },
  });
}
