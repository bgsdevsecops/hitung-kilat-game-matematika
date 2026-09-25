import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

describe('In-Memory Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });
    const req: any = { ip: '127.0.0.1', user: { uid: 'user-1' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('rejects requests exceeding limit with 429', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 10000 });
    const req: any = { ip: '127.0.0.1', user: { uid: 'user-2' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'RATE_LIMIT_EXCEEDED' }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keys by IP when user is unauthenticated', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 5000 });
    const req1: any = { ip: '192.168.1.1' };
    const req2: any = { ip: '192.168.1.2' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req1, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Different IP should be allowed
    limiter(req2, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    // Same IP should be blocked
    limiter(req1, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('falls back to "anonymous" when neither user nor ip is present', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 5000 });
    const req1: any = {};
    const req2: any = {};
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req1, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req2, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('supports custom keyGenerator', () => {
    const keyGen = vi.fn((req: any) => req.headers?.['x-api-key'] || 'none');
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 5000, keyGenerator: keyGen });
    const req1: any = { headers: { 'x-api-key': 'key-abc' } };
    const req2: any = { headers: { 'x-api-key': 'key-def' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req1, res, next);
    expect(keyGen).toHaveBeenCalledWith(req1);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req2, res, next);
    expect(next).toHaveBeenCalledTimes(2);

    limiter(req1, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('allows requests again after sliding window expires', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });
    const req: any = { ip: '10.0.0.1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Blocked before window expires
    limiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);

    // Advance time past windowMs
    vi.advanceTimersByTime(1001);

    // Allowed again
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
