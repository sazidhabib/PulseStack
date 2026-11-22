import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@pulsestack/shared';

export function validate(
  schema: ZodSchema,
  target: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const formatted = result.error.flatten();
      throw new ValidationError(
        `Validation failed for request ${target}`,
        formatted.fieldErrors
      );
    }

    req[target] = result.data;
    next();
  };
}
