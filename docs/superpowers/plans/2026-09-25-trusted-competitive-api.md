# Trusted Competitive API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a self-hosted Node.js/Express backend (`hitung-kilat-api`) on the existing Kubernetes cluster that acts as the single trusted authority for competitive game validation (Sprint 60s, Survival Kilat, Daily Challenge V2) and writes verified scores directly to Firestore.

**Architecture:** A standalone TypeScript Express service in `server/` that mounts Firebase Admin SDK credentials from a Kubernetes Secret. It exposes `/api/competitive/*` endpoints, verifies Firebase ID tokens, runs authoritative game validation via the shared isomorphic engine (`src/engine/competitive/`), records results and leaderboards in Firestore, and is routed via APISIX HTTPRoute `/api/*`.

**Tech Stack:** Node.js 22 LTS, Express 4, TypeScript 5.8, Firebase Admin SDK 13, Vitest 5, Supertest 7, esbuild, Docker, Helm (chart `myindo:1.0.4`), Kubernetes.

**Spec:** `docs/superpowers/specs/2026-09-25-trusted-competitive-api-design.md`

## Global Constraints

- Backend directory lives strictly in `server/` with isolated dependencies in `server/package.json`.
- Must import shared competitive engine logic from `../src/engine/competitive/` without copying or duplicating code.
- Every mutating competitive endpoint requires a valid Firebase Authentication ID token verified via Firebase Admin SDK `verifyIdToken(token, true)`.
- All competitive Firestore writes (`competitiveSessions`, `competitiveResults`, `leaderboardEntries`) happen exclusively via server Admin SDK; client rules remain `allow write: if false`.
- Never log raw Firebase tokens, private keys, service account secrets, or user answer payloads.
- Docker image for `hitung-kilat-api` must run as non-root user (`appuser:1001`) with multi-stage build.
- Helm deployment uses existing `oci://registry-1.docker.io/solusik8s/myindo:1.0.4` chart as a separate release `hitung-kilat-api` with container port 3000 mapped to service port 80.
- All endpoints must be prefixed with `/api`. Health probe endpoint `/api/health` must not require authentication.
- Existing frontend tests (860+ tests) and bundle budget (<= 350 KiB gzip) must not regress.

## Review Focus

1. **Token revocation and expiry edge cases:** Token expired mid-game or revoked by Firebase Auth must return `401 Unauthorized` without crashing the Express process.
2. **Double-submit replay attacks:** Submitting answers twice with the same `sessionId` or `submissionIdempotencyKey` must return the previously computed result idempotently without duplicate Firestore writes or score inflation.
3. **Clock-skew and latency handling:** Client answers submitted right at the deadline window must respect the 500ms network grace period while rejecting any answer where `inputLatencyMs < 120ms` (sub-human anomaly).
4. **Missing or unmounted credentials at startup:** If `GOOGLE_APPLICATION_CREDENTIALS` points to a missing file or invalid JSON, server initialization must fail fast with a descriptive startup error instead of crashing silently on the first incoming HTTP request.
5. **Partial or malformed answer payloads:** Submissions with missing sequences, empty arrays, or non-contiguous sequences (e.g. sequence 1 then sequence 3) must be safely classified as `REJECTED` by the domain validator without throwing unhandled exceptions.

---

### Task 1: Backend Scaffolding & Build Configuration

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/utils/logger.ts`
- Create: `server/tests/utils/logger.test.ts`
- Modify: `package.json` (add root convenience scripts)

**Interfaces:**
- Consumes: Node.js 22 built-ins (`process`, `console`).
- Produces: `logger` object with `{ info, warn, error, debug }` methods emitting structured JSON.

- [ ] **Step 1: Write the failing test for logger**

```typescript
// server/tests/utils/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger';

describe('Structured Logger', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('emits structured JSON to stdout for info level', () => {
    logger.info('session_created', { sessionId: 'sess-123', mode: 'sprint' });
    expect(stdoutSpy).toHaveBeenCalled();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.msg).toBe('session_created');
    expect(output.sessionId).toBe('sess-123');
    expect(output.mode).toBe('sprint');
    expect(typeof output.timestamp).toBe('string');
  });

  it('redacts sensitive fields like token and authorization', () => {
    logger.info('auth_event', { token: 'secret-token-value', authorization: 'Bearer abc', userId: 'user-1' });
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.token).toBe('[REDACTED]');
    expect(output.authorization).toBe('[REDACTED]');
    expect(output.userId).toBe('user-1');
  });
});
```

- [ ] **Step 2: Create server configuration files and run test to verify failure**

Create `server/package.json`:
```json
{
  "name": "hitung-kilat-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "firebase-admin": "^13.2.0",
    "helmet": "^8.0.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "esbuild": "^0.25.0",
    "supertest": "^7.0.0",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vitest": "^3.0.7"
  }
}
```

Create `server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@engine/*": ["../src/engine/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "../src/engine/**/*"]
}
```

Create `server/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../src/engine'),
    },
  },
});
```

Create `server/build.mjs`:
```javascript
import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.resolve(__dirname, 'src/server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: path.resolve(__dirname, 'dist/server.js'),
  packages: 'external',
  alias: {
    '@engine': path.resolve(__dirname, '../src/engine'),
  },
  sourcemap: true,
});
console.log('Server bundle build complete: dist/server.js');
```

Install dependencies in `server/`:
Run: `cd server && npm install`
Run: `npm test` inside `server/`
Expected: FAIL with "Cannot find module '../../src/utils/logger'"

- [ ] **Step 3: Implement structured logger**

Create `server/src/utils/logger.ts`:
```typescript
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
```

- [ ] **Step 4: Add convenience scripts to root package.json and run tests**

Add to root `package.json` under `"scripts"`:
```json
"server:test": "npm --prefix server test",
"server:build": "npm --prefix server run build",
"server:lint": "npm --prefix server run lint",
```

Run: `cd server && npm test`
Expected: PASS (2 tests pass)
Run: `cd .. && npm run server:test`
Expected: PASS

- [ ] **Step 5: Commit scaffolding**

```bash
git add server/ package.json
git commit -m "feat(api): scaffold server workspace with logger, tsconfig, and vitest

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Firebase Admin Initialization & Auth Middleware

**Files:**
- Create: `server/src/config/firebaseAdmin.ts`
- Create: `server/src/middleware/firebaseAuth.ts`
- Create: `server/tests/middleware/firebaseAuth.test.ts`

**Interfaces:**
- Consumes: `firebase-admin/app`, `firebase-admin/auth`, `firebase-admin/firestore`.
- Produces:
  - `getAdminAuth()`: returns initialized `Auth` instance.
  - `getAdminFirestore()`: returns initialized `Firestore` instance.
  - `requireFirebaseAuth`: Express middleware that populates `req.user = { uid, email }` or returns `401`.

- [ ] **Step 1: Write the failing test for firebaseAuth middleware**

```typescript
// server/tests/middleware/firebaseAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireFirebaseAuth } from '../../src/middleware/firebaseAuth';
import * as adminConfig from '../../src/config/firebaseAdmin';

describe('requireFirebaseAuth middleware', () => {
  let mockVerifyIdToken: any;

  beforeEach(() => {
    mockVerifyIdToken = vi.fn();
    vi.spyOn(adminConfig, 'getAdminAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    } as any);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req: any = { headers: {} };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'MISSING_AUTHORIZATION_HEADER' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails or is revoked', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));
    const req: any = { headers: { authorization: 'Bearer expired.token.jwt' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_OR_EXPIRED_TOKEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user to request and calls next when token is valid', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-abc-123',
      email: 'player@example.com',
    });
    const req: any = { headers: { authorization: 'Bearer valid.token.jwt' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.token.jwt', true);
    expect(req.user).toEqual({ uid: 'user-abc-123', email: 'player@example.com' });
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm --prefix server test tests/middleware/firebaseAuth.test.ts`
Expected: FAIL with "Cannot find module '../../src/middleware/firebaseAuth'"

- [ ] **Step 3: Implement firebaseAdmin config and firebaseAuth middleware**

Create `server/src/config/firebaseAdmin.ts`:
```typescript
import { initializeApp, getApps, applicationDefault, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger.js';

let appInstance: App | null = null;

export function initializeFirebaseAdmin(): App {
  if (appInstance) return appInstance;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
    return appInstance;
  }

  try {
    appInstance = initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
    });
    logger.info('firebase_admin_initialized', {
      projectId: appInstance.options.projectId ?? 'auto-detected',
    });
    return appInstance;
  } catch (err: any) {
    logger.error('firebase_admin_init_failed', { error: err?.message });
    throw new Error(`Failed to initialize Firebase Admin SDK: ${err?.message}`);
  }
}

export function getAdminAuth(): Auth {
  const app = appInstance ?? initializeFirebaseAdmin();
  return getAuth(app);
}

export function getAdminFirestore(): Firestore {
  const app = appInstance ?? initializeFirebaseAdmin();
  return getFirestore(app);
}
```

Create `server/src/middleware/firebaseAuth.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { getAdminAuth } from '../config/firebaseAdmin.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'MISSING_AUTHORIZATION_HEADER',
      message: 'An Authorization header with Bearer token is required.',
    });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({
      error: 'INVALID_TOKEN_FORMAT',
      message: 'Bearer token value cannot be empty.',
    });
    return;
  }

  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken, true);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch (err: any) {
    logger.warn('auth_token_verification_failed', {
      reason: err?.message,
      code: err?.code,
    });
    res.status(401).json({
      error: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'The provided Firebase ID token is invalid, expired, or revoked.',
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test tests/middleware/firebaseAuth.test.ts`
Expected: PASS (3 tests pass)

- [ ] **Step 5: Commit auth middleware**

```bash
git add server/src/config/firebaseAdmin.ts server/src/middleware/firebaseAuth.ts server/tests/middleware/firebaseAuth.test.ts
git commit -m "feat(api): implement Firebase Admin initialization and ID token auth middleware

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Rate Limiting & Error Handling Middleware

**Files:**
- Create: `server/src/middleware/rateLimiter.ts`
- Create: `server/src/middleware/errorHandler.ts`
- Create: `server/tests/middleware/rateLimiter.test.ts`
- Create: `server/tests/middleware/errorHandler.test.ts`

**Interfaces:**
- Consumes: Express Request/Response, `server/src/utils/logger.ts`.
- Produces:
  - `createRateLimiter(options)`: in-memory sliding-window limiter by UID or IP.
  - `errorHandler`: global Express error handler returning uniform JSON error shapes.

- [ ] **Step 1: Write failing tests for rate limiter and error handler**

```typescript
// server/tests/middleware/rateLimiter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

describe('In-Memory Rate Limiter', () => {
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
  });
});
```

```typescript
// server/tests/middleware/errorHandler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler';

describe('Global Error Handler', () => {
  it('formats unknown errors as 500 without leaking stack traces in production', () => {
    const err = new Error('Database connection failed');
    const req: any = { path: '/api/test', method: 'GET' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --prefix server test tests/middleware/rateLimiter.test.ts tests/middleware/errorHandler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement rate limiter and error handler**

Create `server/src/middleware/rateLimiter.ts`:
```typescript
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './firebaseAuth.js';
import { logger } from '../utils/logger.js';

interface RateLimiterOptions {
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
      logger.warn('rate_limit_exceeded', { key, limit: options.maxRequests, windowMs: options.windowMs });
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
```

Create `server/src/middleware/errorHandler.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';

  logger.error('unhandled_request_error', {
    path: req.path,
    method: req.method,
    status,
    error: err?.message,
    stack: isProd ? undefined : err?.stack,
  });

  res.status(status).json({
    error: err.errorCode || 'INTERNAL_SERVER_ERROR',
    message: status === 500 && isProd
      ? 'An unexpected internal server error occurred.'
      : (err?.message || 'Unknown error'),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix server test tests/middleware/rateLimiter.test.ts tests/middleware/errorHandler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit middleware**

```bash
git add server/src/middleware/rateLimiter.ts server/src/middleware/errorHandler.ts server/tests/middleware/
git commit -m "feat(api): implement in-memory rate limiter and global error handler

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Session & Validation Services

**Files:**
- Create: `server/src/services/sessionService.ts`
- Create: `server/src/services/validationService.ts`
- Create: `server/tests/services/sessionService.test.ts`
- Create: `server/tests/services/validationService.test.ts`

**Interfaces:**
- Consumes: `@engine/competitive/types`, `@engine/competitive/stateMachine`, `@engine/competitive/validator`, `@engine/competitive/questionGenerator`, `@engine/competitive/modes/daily`.
- Produces:
  - `createSession(params)`: generates questions, builds HMAC-signed session contract, writes to Firestore `competitiveSessions`.
  - `submitAndValidateSession(params)`: loads session, runs `validateCompetitiveSession`, writes results to Firestore in a transaction.

- [ ] **Step 1: Write failing tests for sessionService and validationService**

```typescript
// server/tests/services/sessionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../../src/services/sessionService';

describe('SessionService', () => {
  let mockFirestore: any;
  let mockDoc: any;
  let mockCollection: any;

  beforeEach(() => {
    mockDoc = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
    mockCollection = {
      doc: vi.fn().mockReturnValue(mockDoc),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    };
    mockFirestore = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };
  });

  it('creates sprint session with 60s deadline and HMAC question tokens', async () => {
    const service = new SessionService(mockFirestore);
    const result = await service.createSession({
      userId: 'user-test-1',
      mode: 'sprint',
      idempotencyKey: 'idemp-123',
    });

    expect(result.session.sessionId).toBeDefined();
    expect(result.session.mode).toBe('sprint');
    expect(result.session.isRanked).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions[0].questionToken).toMatch(/^tok_/);
    expect(mockDoc.set).toHaveBeenCalled();
  });
});
```

```typescript
// server/tests/services/validationService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '../../src/services/validationService';

describe('ValidationService', () => {
  let mockFirestore: any;

  beforeEach(() => {
    mockFirestore = {
      runTransaction: vi.fn(async (cb) => {
        const tx: any = {
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
        };
        return cb(tx);
      }),
    };
  });

  it('instantiates and provides validation interface', () => {
    const service = new ValidationService(mockFirestore);
    expect(service.validateAndFinalize).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --prefix server test tests/services/sessionService.test.ts tests/services/validationService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SessionService and ValidationService**

Create `server/src/services/sessionService.ts`:
```typescript
import { Firestore } from 'firebase-admin/firestore';
import { randomBytes, randomUUID } from 'crypto';
import {
  CompetitiveMode,
  CompetitiveQuestionView,
  CompetitiveSessionContract,
} from '@engine/competitive/types.js';
import { createCompetitiveSession } from '@engine/competitive/stateMachine.js';
import { generateCompetitiveQuestions } from '@engine/competitive/questionGenerator.js';
import { generateDailyChallengeId } from '@engine/competitive/modes/daily.js';
import { logger } from '../utils/logger.js';

export interface CreateSessionParams {
  userId: string;
  mode: CompetitiveMode;
  idempotencyKey: string;
}

export interface CreateSessionResult {
  session: {
    sessionId: string;
    mode: CompetitiveMode;
    rulesVersion: string;
    contentVersion: string;
    serverStartedAt: number;
    serverDeadlineAt: number;
    isRanked: boolean;
  };
  questions: CompetitiveQuestionView[];
}

export class SessionService {
  constructor(private firestore: Firestore) {}

  async createSession(params: {
    userId: string;
    mode: CompetitiveMode;
    idempotencyKey: string;
  }): Promise<CreateSessionResult> {
    const sessionsCol = this.firestore.collection('competitiveSessions');

    // 1. Idempotency check
    const existing = await sessionsCol
      .where('userId', '==', params.userId)
      .where('idempotencyKey', '==', params.idempotencyKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0].data();
      logger.info('session_idempotency_hit', { sessionId: doc.sessionId, userId: params.userId });
      return {
        session: {
          sessionId: doc.sessionId,
          mode: doc.mode,
          rulesVersion: doc.rulesVersion,
          contentVersion: doc.contentVersion,
          serverStartedAt: doc.serverStartedAt,
          serverDeadlineAt: doc.serverDeadlineAt,
          isRanked: doc.isRanked,
        },
        questions: doc.clientQuestionViews,
      };
    }

    const sessionId = randomUUID();
    const serverSecret = randomBytes(32).toString('hex');
    const serverStartedAt = Date.now();
    const rulesVersion = '2.0';
    const contentVersion = '72L-v1';

    let isRanked = true;
    let challengeId: string | undefined;

    if (params.mode === 'daily') {
      const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      challengeId = generateDailyChallengeId(todayWib, contentVersion);

      // Check if user already completed a ranked daily challenge today
      const resultsCol = this.firestore.collection('competitiveResults');
      const dailyCompleted = await resultsCol
        .where('userId', '==', params.userId)
        .where('challengeId', '==', challengeId)
        .where('status', '==', 'VALIDATED')
        .where('isRanked', '==', true)
        .limit(1)
        .get();

      if (!dailyCompleted.empty) {
        isRanked = false; // Archive practice mode
      }
    }

    const initialQuestions = generateCompetitiveQuestions(1, params.mode === 'daily' ? 10 : 30);
    const internalState = createCompetitiveSession({
      sessionId,
      userId: params.userId,
      mode: params.mode,
      rulesVersion,
      contentVersion,
      challengeId,
      serverStartedAt,
      initialQuestions,
      secret: serverSecret,
      isRanked,
    });

    // Serialize server questions map for storage
    const serializedQuestions: Record<string, unknown> = {};
    for (const [seq, q] of internalState.serverQuestions.entries()) {
      serializedQuestions[String(seq)] = q;
    }

    const sessionDoc = {
      ...internalState.contract,
      serverSecret,
      serverQuestions: serializedQuestions,
      clientQuestionViews: internalState.bufferedViews,
      createdAt: serverStartedAt,
      updatedAt: serverStartedAt,
    };

    await sessionsCol.doc(sessionId).set(sessionDoc);

    logger.info('session_created', {
      sessionId,
      userId: params.userId,
      mode: params.mode,
      isRanked,
    });

    return {
      session: {
        sessionId,
        mode: params.mode,
        rulesVersion,
        contentVersion,
        serverStartedAt,
        serverDeadlineAt: internalState.contract.serverDeadlineAt,
        isRanked,
      },
      questions: internalState.bufferedViews,
    };
  }
}
```

Create `server/src/services/validationService.ts`:
```typescript
import { Firestore } from 'firebase-admin/firestore';
import {
  CompetitiveResultDoc,
  LeaderboardEntryDoc,
  SubmittedAnswerPayload,
} from '@engine/competitive/types.js';
import { validateCompetitiveSession, ValidationInput } from '@engine/competitive/validator.js';
import { Question } from '@engine/types/question.js';
import { logger } from '../utils/logger.js';

export interface FinalizeSessionParams {
  sessionId: string;
  userId: string;
  answers: SubmittedAnswerPayload[];
  submissionIdempotencyKey: string;
  pseudonym?: string;
}

export interface FinalizeSessionResult {
  status: 'VALIDATED' | 'REJECTED';
  result: CompetitiveResultDoc;
  leaderboardPosition?: number;
}

export class ValidationService {
  constructor(private firestore: Firestore) {}

  async validateAndFinalize(params: FinalizeSessionParams): Promise<FinalizeSessionResult> {
    const sessionRef = this.firestore.collection('competitiveSessions').doc(params.sessionId);

    return await this.firestore.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) {
        const err: any = new Error('Competitive session not found.');
        err.statusCode = 404;
        err.errorCode = 'SESSION_NOT_FOUND';
        throw err;
      }

      const sessionData = sessionSnap.data()!;
      if (sessionData.userId !== params.userId) {
        const err: any = new Error('You are not authorized to submit this session.');
        err.statusCode = 403;
        err.errorCode = 'SESSION_FORBIDDEN';
        throw err;
      }

      // Check submission idempotency
      if (sessionData.submissionIdempotencyKey === params.submissionIdempotencyKey) {
        const existingResultId = sessionData.resultId;
        if (existingResultId) {
          const resSnap = await tx.get(this.firestore.collection('competitiveResults').doc(existingResultId));
          if (resSnap.exists) {
            logger.info('submission_idempotency_hit', { sessionId: params.sessionId });
            return {
              status: sessionData.status,
              result: resSnap.data() as CompetitiveResultDoc,
            };
          }
        }
      }

      if (sessionData.status !== 'ACTIVE') {
        const err: any = new Error(`Session is already finalized with status: ${sessionData.status}`);
        err.statusCode = 409;
        err.errorCode = 'SESSION_ALREADY_FINALIZED';
        throw err;
      }

      const now = Date.now();
      const serverQuestionsMap = new Map<number, Question>();
      const rawStoredQ = sessionData.serverQuestions || {};
      for (const [seqStr, qObj] of Object.entries(rawStoredQ)) {
        serverQuestionsMap.set(Number(seqStr), qObj as Question);
      }

      const receivedAnswerTimes = new Map<number, number>();
      for (const ans of params.answers) {
        receivedAnswerTimes.set(ans.sequence, sessionData.serverStartedAt + ans.clientAnsweredAt);
      }

      const validationInput: ValidationInput = {
        session: {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          mode: sessionData.mode,
          rulesVersion: sessionData.rulesVersion,
          contentVersion: sessionData.contentVersion,
          challengeId: sessionData.challengeId,
          serverStartedAt: sessionData.serverStartedAt,
          serverDeadlineAt: sessionData.serverDeadlineAt,
          status: 'ACTIVE',
          isRanked: sessionData.isRanked,
          idempotencyKey: sessionData.idempotencyKey,
        },
        serverQuestions: serverQuestionsMap,
        submittedAnswers: params.answers,
        serverTimestamps: {
          startedAt: sessionData.serverStartedAt,
          finalizedAt: now,
          receivedAnswerTimes,
        },
      };

      const valOutput = validateCompetitiveSession(validationInput, sessionData.serverSecret);
      const resultDoc = valOutput.result;

      const resultRef = this.firestore.collection('competitiveResults').doc(resultDoc.resultId);
      tx.set(resultRef, resultDoc);

      let leaderboardPosition: number | undefined;

      if (valOutput.leaderboardEligible) {
        const periodKey = sessionData.mode === 'daily'
          ? (sessionData.challengeId?.split('@')[0] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()))
          : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7); // monthly for sprint/survival

        const entryId = `lb_${sessionData.mode}_${periodKey}_${params.userId}`;
        const lbRef = this.firestore.collection('leaderboardEntries').doc(entryId);

        const lbEntry: LeaderboardEntryDoc = {
          entryId,
          mode: sessionData.mode,
          periodKey,
          rulesVersion: sessionData.rulesVersion,
          contentVersion: sessionData.contentVersion,
          pseudonym: params.pseudonym || 'Pemain Kilat',
          score: resultDoc.score,
          accuracy: resultDoc.accuracy,
          correctCount: resultDoc.correctCount,
          wrongCount: resultDoc.wrongCount,
          durationMs: resultDoc.rankedActiveDurationMs,
          finalizedAt: now,
          resultId: resultDoc.resultId,
        };

        tx.set(lbRef, lbEntry, { merge: true });
      }

      tx.update(sessionRef, {
        status: valOutput.status,
        resultId: resultDoc.resultId,
        submissionIdempotencyKey: params.submissionIdempotencyKey,
        updatedAt: now,
      });

      logger.info('session_finalized', {
        sessionId: params.sessionId,
        status: valOutput.status,
        score: resultDoc.score,
        rejectionReasons: valOutput.rejectionReasons,
      });

      return {
        status: valOutput.status,
        result: resultDoc,
        leaderboardPosition,
      };
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix server test tests/services/sessionService.test.ts tests/services/validationService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit services**

```bash
git add server/src/services/ server/tests/services/
git commit -m "feat(api): implement SessionService and ValidationService with domain engine integration

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Leaderboard Service

**Files:**
- Create: `server/src/services/leaderboardService.ts`
- Create: `server/tests/services/leaderboardService.test.ts`

**Interfaces:**
- Consumes: Firestore `leaderboardEntries` and `competitiveResults`.
- Produces:
  - `getLeaderboard(mode, periodKey, limit, offset)`: queries Firestore ordered by `score DESC`, returns ranked entries.
  - `getUserResults(userId, mode, limit, offset)`: queries Firestore for a player's verified past games.

- [ ] **Step 1: Write failing test for LeaderboardService**

```typescript
// server/tests/services/leaderboardService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeaderboardService } from '../../src/services/leaderboardService';

describe('LeaderboardService', () => {
  let mockFirestore: any;
  let mockCollection: any;

  beforeEach(() => {
    mockCollection = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          {
            data: () => ({
              entryId: 'lb_1',
              pseudonym: 'Kancil Gesit',
              score: 1100,
              accuracy: 100,
              correctCount: 10,
              durationMs: 35000,
              finalizedAt: 1727200000000,
            }),
          },
        ],
      }),
    };
    mockFirestore = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };
  });

  it('fetches leaderboard entries with computed 1-based ranks', async () => {
    const service = new LeaderboardService(mockFirestore);
    const result = await service.getLeaderboard({
      mode: 'daily',
      periodKey: '2026-09-25',
      limit: 10,
      offset: 0,
    });

    expect(result.periodKey).toBe('2026-09-25');
    expect(result.mode).toBe('daily');
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].pseudonym).toBe('Kancil Gesit');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm --prefix server test tests/services/leaderboardService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement LeaderboardService**

Create `server/src/services/leaderboardService.ts`:
```typescript
import { Firestore } from 'firebase-admin/firestore';
import { CompetitiveMode, CompetitiveResultDoc } from '@engine/competitive/types.js';

export interface LeaderboardQuery {
  mode: CompetitiveMode;
  periodKey: string;
  limit?: number;
  offset?: number;
}

export interface RankedLeaderboardEntry {
  rank: number;
  pseudonym: string;
  score: number;
  accuracy: number;
  correctCount: number;
  durationMs: number;
  finalizedAt: number;
}

export class LeaderboardService {
  constructor(private firestore: Firestore) {}

  async getLeaderboard(query: LeaderboardQuery): Promise<{
    periodKey: string;
    mode: CompetitiveMode;
    entries: RankedLeaderboardEntry[];
    total: number;
  }> {
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const offset = Math.max(0, query.offset || 0);

    const snapshot = await this.firestore
      .collection('leaderboardEntries')
      .where('mode', '==', query.mode)
      .where('periodKey', '==', query.periodKey)
      .orderBy('score', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const entries: RankedLeaderboardEntry[] = snapshot.docs.map((doc, idx) => {
      const data = doc.data();
      return {
        rank: offset + idx + 1,
        pseudonym: data.pseudonym || 'Anonim',
        score: data.score || 0,
        accuracy: data.accuracy || 0,
        correctCount: data.correctCount || 0,
        durationMs: data.durationMs || 0,
        finalizedAt: data.finalizedAt || 0,
      };
    });

    return {
      periodKey: query.periodKey,
      mode: query.mode,
      entries,
      total: entries.length,
    };
  }

  async getUserResults(params: {
    userId: string;
    mode?: CompetitiveMode;
    limit?: number;
    offset?: number;
  }): Promise<{ results: CompetitiveResultDoc[] }> {
    const limit = Math.max(1, Math.min(50, params.limit || 10));
    const offset = Math.max(0, params.offset || 0);

    let q = this.firestore
      .collection('competitiveResults')
      .where('userId', '==', params.userId);

    if (params.mode) {
      q = q.where('mode', '==', params.mode);
    }

    const snapshot = await q
      .orderBy('finalizedAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const results = snapshot.docs.map((d) => d.data() as CompetitiveResultDoc);
    return { results };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test tests/services/leaderboardService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit LeaderboardService**

```bash
git add server/src/services/leaderboardService.ts server/tests/services/leaderboardService.test.ts
git commit -m "feat(api): implement LeaderboardService for public rankings and user history

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Express App, Controller, & Routes

**Files:**
- Create: `server/src/controllers/competitiveController.ts`
- Create: `server/src/routes/competitive.ts`
- Create: `server/src/app.ts`
- Create: `server/src/server.ts`
- Create: `server/tests/app.test.ts`

**Interfaces:**
- Consumes: `requireFirebaseAuth`, `createRateLimiter`, `errorHandler`, `SessionService`, `ValidationService`, `LeaderboardService`.
- Produces: Runnable Express application listening on `PORT` (default 3000) with full API routes mounted at `/api`.

- [ ] **Step 1: Write integration tests for API endpoints**

```typescript
// server/tests/app.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('API Endpoints Integration', () => {
  let app: any;
  let mockSessionService: any;
  let mockValidationService: any;
  let mockLeaderboardService: any;

  beforeEach(() => {
    mockSessionService = {
      createSession: vi.fn().mockResolvedValue({
        session: { sessionId: 'sess-abc', mode: 'sprint', isRanked: true },
        questions: [{ sequence: 1, questionToken: 'tok_1', renderedPrompt: '2 + 2' }],
      }),
    };
    mockValidationService = {
      validateAndFinalize: vi.fn().mockResolvedValue({
        status: 'VALIDATED',
        result: { resultId: 'res-1', score: 100 },
      }),
    };
    mockLeaderboardService = {
      getLeaderboard: vi.fn().mockResolvedValue({
        periodKey: '2026-09-25',
        mode: 'daily',
        entries: [{ rank: 1, pseudonym: 'Juara', score: 1000 }],
        total: 1,
      }),
      getUserResults: vi.fn().mockResolvedValue({ results: [] }),
    };

    app = createApp({
      sessionService: mockSessionService,
      validationService: mockValidationService,
      leaderboardService: mockLeaderboardService,
      skipAuth: true, // test mode bypass
    });
  });

  it('GET /api/health returns 200 OK without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/competitive/sessions validates body and returns 201', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions')
      .send({ mode: 'sprint', idempotencyKey: 'key-1' });

    expect(res.status).toBe(201);
    expect(res.body.session.sessionId).toBe('sess-abc');
  });

  it('POST /api/competitive/sessions rejects invalid mode with 400', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions')
      .send({ mode: 'invalid_mode', idempotencyKey: 'key-1' });

    expect(res.status).toBe(400);
  });

  it('GET /api/competitive/leaderboard/:periodKey returns ranking', async () => {
    const res = await request(app)
      .get('/api/competitive/leaderboard/2026-09-25?mode=daily');

    expect(res.status).toBe(200);
    expect(res.body.entries[0].rank).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm --prefix server test tests/app.test.ts`
Expected: FAIL with "Cannot find module '../src/app'"

- [ ] **Step 3: Implement controller, routes, app, and server**

Create `server/src/controllers/competitiveController.ts`:
```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/firebaseAuth.js';
import { SessionService } from '../services/sessionService.js';
import { ValidationService } from '../services/validationService.js';
import { LeaderboardService } from '../services/leaderboardService.js';
import { CompetitiveMode } from '@engine/competitive/types.js';

export class CompetitiveController {
  constructor(
    private sessionService: SessionService,
    private validationService: ValidationService,
    private leaderboardService: LeaderboardService
  ) {}

  createSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { mode, idempotencyKey } = req.body;
    if (!mode || !['sprint', 'survival', 'daily'].includes(mode)) {
      res.status(400).json({ error: 'INVALID_MODE', message: 'Mode must be sprint, survival, or daily.' });
      return;
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY', message: 'A non-empty string idempotencyKey is required.' });
      return;
    }

    const userId = req.user!.uid;
    const result = await this.sessionService.createSession({ userId, mode: mode as CompetitiveMode, idempotencyKey });
    res.status(201).json(result);
  };

  submitSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { answers, submissionIdempotencyKey, pseudonym } = req.body;

    if (!Array.isArray(answers)) {
      res.status(400).json({ error: 'INVALID_ANSWERS', message: 'answers must be an array.' });
      return;
    }
    if (!submissionIdempotencyKey || typeof submissionIdempotencyKey !== 'string') {
      res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY', message: 'A non-empty submissionIdempotencyKey is required.' });
      return;
    }

    const userId = req.user!.uid;
    const result = await this.validationService.validateAndFinalize({
      sessionId,
      userId,
      answers,
      submissionIdempotencyKey,
      pseudonym,
    });

    res.status(200).json(result);
  };

  getLeaderboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { periodKey } = req.params;
    const { mode, limit, offset } = req.query;

    if (!mode || !['sprint', 'survival', 'daily'].includes(mode as string)) {
      res.status(400).json({ error: 'INVALID_MODE', message: 'Query parameter mode is required.' });
      return;
    }

    const result = await this.leaderboardService.getLeaderboard({
      periodKey,
      mode: mode as CompetitiveMode,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    res.status(200).json(result);
  };

  getMyResults = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.uid;
    const { mode, limit, offset } = req.query;

    const result = await this.leaderboardService.getUserResults({
      userId,
      mode: mode ? (mode as CompetitiveMode) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    res.status(200).json(result);
  };
}
```

Create `server/src/routes/competitive.ts`:
```typescript
import { Router } from 'express';
import { CompetitiveController } from '../controllers/competitiveController.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

export function createCompetitiveRouter(
  controller: CompetitiveController,
  skipAuth = false
): Router {
  const router = Router();
  const authMiddleware = skipAuth
    ? (req: any, _res: any, next: any) => { req.user = req.user || { uid: 'test-user-id' }; next(); }
    : requireFirebaseAuth;

  const sessionLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });
  const submitLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });
  const leaderboardLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60000 });

  router.post('/sessions', authMiddleware, sessionLimiter, controller.createSession);
  router.post('/sessions/:sessionId/submit', authMiddleware, submitLimiter, controller.submitSession);
  router.get('/leaderboard/:periodKey', leaderboardLimiter, controller.getLeaderboard);
  router.get('/results/me', authMiddleware, controller.getMyResults);

  return router;
}
```

Create `server/src/app.ts`:
```typescript
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { CompetitiveController } from './controllers/competitiveController.js';
import { createCompetitiveRouter } from './routes/competitive.js';
import { errorHandler } from './middleware/errorHandler.js';
import { SessionService } from './services/sessionService.js';
import { ValidationService } from './services/validationService.js';
import { LeaderboardService } from './services/leaderboardService.js';

export interface AppDependencies {
  sessionService: SessionService;
  validationService: ValidationService;
  leaderboardService: LeaderboardService;
  skipAuth?: boolean;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const controller = new CompetitiveController(
    deps.sessionService,
    deps.validationService,
    deps.leaderboardService
  );

  app.use('/api/competitive', createCompetitiveRouter(controller, deps.skipAuth));
  app.use(errorHandler);

  return app;
}
```

Create `server/src/server.ts`:
```typescript
import { createApp } from './app.js';
import { initializeFirebaseAdmin, getAdminFirestore } from './config/firebaseAdmin.js';
import { SessionService } from './services/sessionService.js';
import { ValidationService } from './services/validationService.js';
import { LeaderboardService } from './services/leaderboardService.js';
import { logger } from './utils/logger.js';

try {
  initializeFirebaseAdmin();
  const firestore = getAdminFirestore();

  const sessionService = new SessionService(firestore);
  const validationService = new ValidationService(firestore);
  const leaderboardService = new LeaderboardService(firestore);

  const app = createApp({
    sessionService,
    validationService,
    leaderboardService,
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    logger.info('server_started', { port, env: process.env.NODE_ENV || 'development' });
  });
} catch (err: any) {
  logger.error('server_fatal_startup_error', { error: err?.message });
  process.exit(1);
}
```

- [ ] **Step 4: Run integration tests to verify they pass**

Run: `npm --prefix server test tests/app.test.ts`
Expected: PASS (4 tests pass)

- [ ] **Step 5: Verify production bundle build with esbuild**

Run: `npm --prefix server run build`
Expected: PASS, outputs `dist/server.js`

- [ ] **Step 6: Commit app, routes, controller, and server entrypoint**

```bash
git add server/src/controllers/ server/src/routes/ server/src/app.ts server/src/server.ts server/build.mjs server/tests/app.test.ts
git commit -m "feat(api): implement Express app with competitive routes, controller, and esbuild bundler

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Containerization & Docker Compose

**Files:**
- Create: `server/Dockerfile`
- Create: `server/.dockerignore`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: Node.js 22 alpine image, root build context.
- Produces: Production Docker image `hitung-kilat-api` running as unprivileged `appuser`.

- [ ] **Step 1: Create server/.dockerignore**

Create `server/.dockerignore`:
```
node_modules
dist
.env*
*.local
secrets
serviceAccount*.json
firebase-admin*.json
npm-debug.log*
.DS_Store
```

- [ ] **Step 2: Create server/Dockerfile**

Create `server/Dockerfile`:
```dockerfile
# ------------------------------------------------------------------------------
# Stage 1: Build & Bundle
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy server package definitions
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy shared engine and server sources
COPY src/engine/ ./src/engine/
COPY server/ ./server/

# Build standalone distribution via esbuild
RUN cd server && npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package*.json ./

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: Update docker-compose.yml to include both web and api**

Edit `docker-compose.yml`:
```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DOCKER_REGISTRY: ${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}
      DOCKER_USER: ${DOCKER_USER:-myindo}
      DOCKER_IMAGE: ${DOCKER_IMAGE:-hitung-kilat-web}
      DOCKER_VERSION: ${DOCKER_VERSION:-v1.0.1}
    image: "${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}/${DOCKER_USER:-myindo}/${DOCKER_IMAGE:-hitung-kilat-web}:${DOCKER_VERSION:-v1.0.1}"
    restart: unless-stopped
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
    networks:
      - myindo-net
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: server/Dockerfile
    environment:
      NODE_ENV: production
      PORT: "3000"
      DOCKER_REGISTRY: ${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}
      DOCKER_USER: ${DOCKER_USER:-myindo}
      DOCKER_IMAGE: ${DOCKER_IMAGE_API:-hitung-kilat-api}
      DOCKER_VERSION: ${DOCKER_VERSION:-v1.0.1}
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase_admin
    image: "${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}/${DOCKER_USER:-myindo}/${DOCKER_IMAGE_API:-hitung-kilat-api}:${DOCKER_VERSION:-v1.0.1}"
    restart: unless-stopped
    ports:
      - "3000:3000"
    secrets:
      - firebase_admin
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - myindo-net

secrets:
  firebase_admin:
    file: ${FIREBASE_ADMIN_KEY_PATH:-/home/cachak/secrets/hitung-kilat-firebase-admin.json}

networks:
  myindo-net:
    name: myindo-net
    external: true
```

- [ ] **Step 4: Validate docker-compose config syntax**

Run: `docker compose config`
Expected: Valid YAML output with both `web` and `api` services rendered.

- [ ] **Step 5: Commit containerization files**

```bash
git add server/Dockerfile server/.dockerignore docker-compose.yml
git commit -m "feat(api): add multi-stage Dockerfile and unify docker-compose for web and api

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Helm Values & Kubernetes Manifests

**Files:**
- Create: `values-hitung-kilat-api.yaml`
- Create: `values-hitung-kilat-api-prod.yaml`

**Interfaces:**
- Consumes: Chart `myindo:1.0.4`, Secret `hitung-kilat-firebase-admin`.
- Produces: Helm values rendering Deployment, ClusterIP Service, probes, volumeMounts, and APISIX HTTPRoute for `/api/*`.

- [ ] **Step 1: Create values-hitung-kilat-api.yaml (dev / template)**

Create `values-hitung-kilat-api.yaml`:
```yaml
replicaCount: 1

nameOverride: "hitung-kilat-api"
fullnameOverride: "hitung-kilat-api"

image:
  repository: docker-hub.solusi-k8s.com/myindo/hitung-kilat-api
  pullPolicy: Always
  tag: "latest"

kind: Deployment

env:
  - name: NODE_ENV
    value: "development"
  - name: PORT
    value: "3000"
  - name: GOOGLE_APPLICATION_CREDENTIALS
    value: "/var/run/secrets/firebase/serviceAccount.json"

envFrom: []

imagePullSecrets:
  - name: myindo-read

service:
  type: ClusterIP
  port: 80
  protocol: TCP
  containerPort: 3000

livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 15
  timeoutSeconds: 3
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 15
  timeoutSeconds: 3
  periodSeconds: 10
  failureThreshold: 3

httpRoute:
  enabled: true
  routes:
    - name: api
      parentRefs:
        - kind: Gateway
          name: apisix
          namespace: ingress-apisix
          sectionName: https
          port: 443
      hostnames:
        - hitung-kilat.k8s.web.id
      rules:
        - matches:
            - path:
                type: PathPrefix
                value: /api
          timeouts:
            request: 30s
            backendRequest: 30s
          backendRefs:
            - name: hitung-kilat-api
              port: 80

extraVolumes:
  - name: firebase-admin
    secret:
      secretName: hitung-kilat-firebase-admin
      optional: false

volumeMounts:
  - name: firebase-admin
    mountPath: /var/run/secrets/firebase
    readOnly: true
```

- [ ] **Step 2: Create values-hitung-kilat-api-prod.yaml (production)**

Create `values-hitung-kilat-api-prod.yaml`:
```yaml
replicaCount: 2

nameOverride: "hitung-kilat-api"
fullnameOverride: "hitung-kilat-api"

image:
  repository: docker-hub.solusi-k8s.com/myindo/hitung-kilat-api
  pullPolicy: Always
  tag: "v1.0.0"

kind: Deployment

env:
  - name: NODE_ENV
    value: "production"
  - name: PORT
    value: "3000"
  - name: GOOGLE_APPLICATION_CREDENTIALS
    value: "/var/run/secrets/firebase/serviceAccount.json"
  - name: MANAGEMENT_ENDPOINT_PROMETHEUS_ENABLED
    value: "false"
  - name: ELASTIC_APM_ENABLE
    value: "1"
  - name: ELASTIC_APM_API_KEY
    value: "MERyR21vOEJzU0hOakJXLXZYNlU6WWZwcFlFUmJRaFctM0RlZ2V5VGZWUQ=="
  - name: ELASTIC_APM_SERVICE_NAME
    value: "hitung-kilat-api"
  - name: ELASTIC_APM_ENVIRONMENT
    value: "production"
  - name: ELASTIC_APM_SERVER_URL
    value: "https://htz-apm.solusi-k8s.com"
  - name: ELASTIC_APM_TRANSACTION_IGNORE_URLS
    value: "/api/health"

envFrom: []

imagePullSecrets:
  - name: myindo-read

service:
  type: ClusterIP
  port: 80
  protocol: TCP
  containerPort: 3000

livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 15
  timeoutSeconds: 3
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 15
  timeoutSeconds: 3
  periodSeconds: 10
  failureThreshold: 3

httpRoute:
  enabled: true
  routes:
    - name: api
      parentRefs:
        - kind: Gateway
          name: apisix
          namespace: ingress-apisix
          sectionName: https
          port: 443
      hostnames:
        - hitung-kilat.k8s.web.id
      rules:
        - matches:
            - path:
                type: PathPrefix
                value: /api
          timeouts:
            request: 30s
            backendRequest: 30s
          backendRefs:
            - name: hitung-kilat-api
              port: 80

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

extraVolumes:
  - name: firebase-admin
    secret:
      secretName: hitung-kilat-firebase-admin
      optional: false

volumeMounts:
  - name: firebase-admin
    mountPath: /var/run/secrets/firebase
    readOnly: true
```

- [ ] **Step 3: Verify Helm template rendering**

Run: `helm template test-api oci://registry-1.docker.io/solusik8s/myindo --version 1.0.4 -f values-hitung-kilat-api-prod.yaml > /dev/null`
Expected: Exit 0 with valid Kubernetes Deployment, Service, and HTTPRoute.

- [ ] **Step 4: Commit Helm values**

```bash
git add values-hitung-kilat-api.yaml values-hitung-kilat-api-prod.yaml
git commit -m "feat(k8s): add Helm values for hitung-kilat-api with secret volumeMounts and APISIX HTTPRoute

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: CI/CD Deployment Script Update

**Files:**
- Modify: `hitung-kilat.sh`
- Create: `tests/ci/hitung-kilat-sh.test.sh`

**Interfaces:**
- Consumes: Environment variables `TARGET` (default `web`), `DOCKER_VERSION`, `HELM_VALUES`.
- Produces: CLI commands `./hitung-kilat.sh build|push|deploy` supporting both `TARGET=web` and `TARGET=api`.

- [ ] **Step 1: Write verification test for hitung-kilat.sh TARGET switching**

Create `tests/ci/hitung-kilat-sh.test.sh`:
```bash
#!/usr/bin/env bash
set -e

# Test that TARGET=web selects hitung-kilat-web
OUTPUT_WEB=$(TARGET=web ./hitung-kilat.sh help | grep "Image:")
echo "$OUTPUT_WEB" | grep -q "hitung-kilat-web" || { echo "FAIL: web target image mismatch"; exit 1; }

# Test that TARGET=api selects hitung-kilat-api
OUTPUT_API=$(TARGET=api ./hitung-kilat.sh help | grep "Image:")
echo "$OUTPUT_API" | grep -q "hitung-kilat-api" || { echo "FAIL: api target image mismatch"; exit 1; }

echo "PASS: hitung-kilat.sh TARGET routing tests succeeded."
```

- [ ] **Step 2: Run test to verify failure**

Run: `chmod +x tests/ci/hitung-kilat-sh.test.sh && ./tests/ci/hitung-kilat-sh.test.sh`
Expected: FAIL with "FAIL: api target image mismatch"

- [ ] **Step 3: Update hitung-kilat.sh**

Edit `hitung-kilat.sh` around lines 15–40 to add `TARGET` switching:
```bash
TARGET="${TARGET:-web}"

if [ "${TARGET}" = "api" ]; then
  DOCKER_IMAGE="${DOCKER_IMAGE:-hitung-kilat-api}"
  APPLICATION_NAME="${APPLICATION_NAME:-hitung-kilat-api}"
  HELM_NAME="${HELM_NAME:-hitung-kilat-api}"
  HELM_VALUES="${HELM_VALUES:-values-hitung-kilat-api-prod.yaml}"
else
  DOCKER_IMAGE="${DOCKER_IMAGE:-hitung-kilat-web}"
  APPLICATION_NAME="${APPLICATION_NAME:-hitung-kilat-web}"
  HELM_NAME="${HELM_NAME:-hitung-kilat-web}"
  HELM_VALUES="${HELM_VALUES:-values-hitung-kilat-web-prod.yaml}"
fi
```

And update `do_build()` to build the specific compose service:
```bash
do_build() {
  log_info "Starting Docker build for target '${TARGET}' using docker-compose.yml..."
  log_info "Target image: ${FULL_IMAGE}"

  if ! docker network inspect myindo-net >/dev/null 2>&1; then
    log_info "Network 'myindo-net' not found. Creating network..."
    docker network create myindo-net || true
  fi

  docker compose -f docker-compose.yml build "${TARGET}"
  log_success "Docker build completed successfully for ${TARGET}: ${FULL_IMAGE}"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./tests/ci/hitung-kilat-sh.test.sh`
Expected: PASS

- [ ] **Step 5: Commit script updates**

```bash
git add hitung-kilat.sh tests/ci/hitung-kilat-sh.test.sh
git commit -m "feat(ci): add TARGET=web|api multi-target support to hitung-kilat.sh

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: Full Verification & Integration Self-Check

**Files:**
- None modified (validation pass).

**Interfaces:**
- Consumes: All tests across frontend and backend.
- Produces: Green test suite, clean build, verified Helm templates.

- [ ] **Step 1: Run frontend test suite**

Run: `npm test`
Expected: 94/94 files pass, 860/860 tests pass.

- [ ] **Step 2: Run frontend bundle verification**

Run: `npm run verify:bundle`
Expected: Bundle budget passes (<= 350 KiB gzip).

- [ ] **Step 3: Run backend test suite**

Run: `npm run server:test`
Expected: All backend unit and integration tests pass.

- [ ] **Step 4: Run backend build**

Run: `npm run server:build`
Expected: `dist/server.js` generated cleanly.

- [ ] **Step 5: Run Helm template verification on both web and api**

Run: `helm template test-web oci://registry-1.docker.io/solusik8s/myindo --version 1.0.4 -f values-hitung-kilat-web-prod.yaml > /dev/null`
Run: `helm template test-api oci://registry-1.docker.io/solusik8s/myindo --version 1.0.4 -f values-hitung-kilat-api-prod.yaml > /dev/null`
Expected: Both exit 0.

- [ ] **Step 6: Confirm git working tree is clean**

Run: `git status --short`
Expected: Clean.
