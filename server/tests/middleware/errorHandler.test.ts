import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { logger } from '../../src/utils/logger';

describe('Global Error Handler', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('formats unknown errors as 500 without leaking stack traces in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Database connection failed');
    const req: any = { path: '/api/test', method: 'GET' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred.',
      })
    );
  });

  it('includes error message in non-production environments', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Detailed debug error message');
    const req: any = { path: '/api/debug', method: 'POST' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Detailed debug error message',
    });
  });

  it('respects custom statusCode and errorCode on custom errors', () => {
    process.env.NODE_ENV = 'production';
    const err: any = new Error('Invalid submission payload');
    err.statusCode = 400;
    err.errorCode = 'VALIDATION_FAILED';

    const req: any = { path: '/api/submit', method: 'POST' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'VALIDATION_FAILED',
      message: 'Invalid submission payload',
    });
  });

  it('logs unhandled error with path, method, status and message', () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const err = new Error('Something broke');
    const req: any = { path: '/api/broken', method: 'DELETE' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(loggerSpy).toHaveBeenCalledWith(
      'unhandled_request_error',
      expect.objectContaining({
        path: '/api/broken',
        method: 'DELETE',
        status: 500,
        error: 'Something broke',
      })
    );
  });

  it('handles null/undefined err or missing message gracefully', () => {
    process.env.NODE_ENV = 'development';
    const err: any = {};
    const req: any = { path: '/api/empty', method: 'GET' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unknown error',
    });
  });
});
