const SENSITIVE_PATTERNS = ['token', 'secret', 'password', 'key', 'authorization', 'answer'];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === 'object') {
    return sanitize(value as Record<string, unknown>);
  }
  return value;
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeValue(value);
    }
  }
  return result;
}

export const logger = {
  info(msg: string, meta: Record<string, unknown> = {}) {
    const payload = {
      level: 'info',
      msg,
      timestamp: new Date().toISOString(),
      ...sanitize(meta),
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  },
  warn(msg: string, meta: Record<string, unknown> = {}) {
    const payload = {
      level: 'warn',
      msg,
      timestamp: new Date().toISOString(),
      ...sanitize(meta),
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  },
  error(msg: string, meta: Record<string, unknown> = {}) {
    const payload = {
      level: 'error',
      msg,
      timestamp: new Date().toISOString(),
      ...sanitize(meta),
    };
    process.stderr.write(JSON.stringify(payload) + '\n');
  },
  debug(msg: string, meta: Record<string, unknown> = {}) {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      const payload = {
        level: 'debug',
        msg,
        timestamp: new Date().toISOString(),
        ...sanitize(meta),
      };
      process.stdout.write(JSON.stringify(payload) + '\n');
    }
  },
};
