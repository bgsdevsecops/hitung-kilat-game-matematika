import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';

  logger.error('unhandled_request_error', {
    path: req.path,
    method: req.method,
    status,
    error: err?.message,
    stack: isProd ? undefined : err?.stack,
  });

  res.status(status).json({
    error: err?.errorCode || 'INTERNAL_SERVER_ERROR',
    message: status === 500 && isProd
      ? 'An unexpected internal server error occurred.'
      : (err?.message || 'Unknown error'),
  });
}
