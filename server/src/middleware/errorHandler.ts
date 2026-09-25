import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    return _next(err);
  }

  const status = typeof err?.statusCode === 'number'
    ? err.statusCode
    : typeof err?.status === 'number'
      ? err.status
      : 500;
  const isProd = process.env.NODE_ENV === 'production';

  logger.error('unhandled_request_error', {
    path: req.path,
    method: req.method,
    status,
    error: err?.message,
    stack: isProd ? undefined : err?.stack,
  });

  const defaultErrorCode = status === 400
    ? 'BAD_REQUEST'
    : status === 404
      ? 'NOT_FOUND'
      : 'INTERNAL_SERVER_ERROR';

  res.status(status).json({
    error: err?.errorCode || defaultErrorCode,
    message: status === 500 && isProd
      ? 'An unexpected internal server error occurred.'
      : (err?.message || 'Unknown error'),
  });
}
