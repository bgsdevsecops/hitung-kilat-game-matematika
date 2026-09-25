const SENSITIVE_KEYS = new Set(['token', 'authorization', 'secret', 'password', 'key', 'privatekey', 'private_key']);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = value;
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
