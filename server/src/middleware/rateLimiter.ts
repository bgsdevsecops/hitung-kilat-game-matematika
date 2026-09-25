import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './firebaseAuth.js';
import { logger } from '../utils/logger.js';

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: AuthenticatedRequest) => string;
}

interface RateRecord {
  timestamps: number[];
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateRecord>();
  const defaultKeyGen = (req: AuthenticatedRequest) => req.user?.uid || req.ip || 'anonymous';
  const getKey = options.keyGenerator || defaultKeyGen;

  // Cleanup old keys every minute to avoid memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60000).unref();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = getKey(req);
    const now = Date.now();
    let record = store.get(key);

    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);

    if (record.timestamps.length >= options.maxRequests) {
      logger.warn('rate_limit_exceeded', {
        clientIdentifier: key,
        limit: options.maxRequests,
        windowMs: options.windowMs,
      });

      const oldestTimestamp = record.timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestTimestamp + options.windowMs - now) / 1000));
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(retryAfterSeconds));
      }

      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait before trying again.',
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}
