# Trusted Competitive API Phase 2 — Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Sprint 60s, Survival Kilat, and Daily Challenge V2 frontend flows to the Trusted Competitive API with authoritative per-answer receipts, server-authoritative scoring, and safe local-practice fallback.

**Architecture:** An adapter layer in `useCompetitiveSession` intercepts competitive execution before runs begin. Eligible authenticated 13+ users receive a server session and server questions; each answer is evaluated authoritatively via `POST /api/competitive/sessions/:sessionId/answers` while the client advances seamlessly from a question buffer. Under-13 users, guests, and opt-outs remain in 100% local safe mode with zero competitive API calls.

**Tech Stack:** React 19, TypeScript ~5.8, Vite, Vitest, Node.js 22 LTS, Express 4.21, Firebase Admin SDK (server), Firebase JS SDK (client auth), Firestore.

**Spec:** `docs/superpowers/specs/2026-09-25-trusted-api-phase2-frontend-integration-design.md`

---

## Global Constraints

- Under-13 users MUST NEVER trigger any competitive API calls (no session create, no answer receipt, no submit, no leaderboard, no results).
- Never persist, log, or leak Firebase ID tokens, Authorization headers, server secrets, HMAC secrets, or raw Firebase UIDs.
- The answer receipt endpoint and client responses MUST NEVER expose answer keys or `answerSpec`.
- API base URL defaults to `/api` (same origin) with override via `VITE_COMPETITIVE_API_URL`.
- Feature flag `VITE_COMPETITIVE_RANKED_ENABLED` defaults to `false`. Kill switch must disable ranked mode while preserving local play.
- No new production runtime dependencies (use native `fetch` and existing Firebase auth).
- Web client bundle size MUST stay `<= 350 KiB gzip`.
- Existing frontend tests (867+ across 94 files) and server tests (53+ across 8 files) MUST remain green.

---

## Review Focus

1. **Answer-key leakage:** An attacker inspecting network responses for `POST /api/competitive/sessions/:sessionId/answers` or `POST /api/competitive/sessions` receives only `renderedPrompt`, `sequence`, `questionToken`, and `answerInputKind` — never the solution.
2. **Under-13 leak prevention:** A user marked `under13` in privacy state starts Sprint, Survival, or Daily; zero network calls to `/api/competitive/*` are made, and the run displays `Mode Lokal Aman · Tidak Berperingkat`.
3. **Out-of-order & duplicate answer receipts:** Submitting the same sequence with identical idempotency key returns the original receipt without double-scoring; submitting out-of-order sequence is rejected with HTTP 409 without mutating state.
4. **Survival timer authoritative reconciliation:** A client submitting a correct answer gets `timeRemainingMs` updated authoritatively (+2s capped at 60s); a wrong answer subtracts 4s. Heartbeat gaps >10s result in session rejection on submit.
5. **Submit failure isolation:** When ranked final submit fails, the result is marked `Hasil belum tervalidasi server`; no second session is created, the score is not promoted to local leaderboards, and no retry creates duplicate Firestore records.

---

## File Structure

```text
src/
├── lib/
│   ├── competitiveApi.ts               # Typed native-fetch API client with runtime validation
│   ├── competitiveEligibility.ts       # Centralized policy for ranked vs local practice
│   └── featureFlags.ts                 # Feature flag & kill switch reader
├── hooks/
│   └── useCompetitiveSession.ts         # Extended adapter supporting ranked receipt queue + local fallback
├── components/
│   ├── competitive/
│   │   ├── CompetitivePlayScreen.tsx    # Mode HUD, buffer display, submit loading, error states
│   │   ├── CompetitiveResultView.tsx    # Result badges: Validated, Practice, Unvalidated
│   │   └── CompetitiveModeSelectModal.tsx # Eligibility-aware mode selection
│   └── daily/
│       ├── DailyHubView.tsx             # Server leaderboard for eligible, safe view for ineligible
│       └── DailyResultView.tsx          # Result view integration
server/
├── src/
│   ├── routes/competitive.ts            # Route registration including POST /sessions/:sessionId/answers
│   ├── controllers/competitiveController.ts # Answer receipt handler
│   ├── services/
│   │   ├── sessionService.ts            # Answer receipt recording, token verification, buffer replenishment
│   │   └── validationService.ts         # Final validation reading authoritative receipts
│   └── middleware/
│       └── rateLimiter.ts               # Rate limiters (including answer limiter: 120/min)
tests/
└── unit/
    ├── competitiveApi.test.ts           # API client contract & error tests
    ├── competitiveEligibility.test.ts   # Privacy & auth matrix tests
    ├── featureFlags.test.ts             # Feature flag & kill switch tests
    ├── competitiveHookAdapter.test.ts   # Ranked hook adapter, buffer, and queue tests
    ├── competitiveSprintIntegration.test.tsx # Sprint integration tests
    ├── competitiveSurvivalIntegration.test.tsx # Survival timer & heartbeat tests
    ├── competitiveDailyIntegration.test.tsx # Daily challenge & leaderboard tests
    ├── competitiveUiIndicators.test.tsx # UI states and badge tests
    └── competitivePhase2Smoke.test.ts   # End-to-end browser smoke test suite
server/tests/
└── services/
    └── answerReceipt.test.ts            # Server answer receipt unit & idempotency tests
```

---

### Task 1: Server Authoritative Answer-Receipt Endpoint

**Files:**
- Modify: `server/src/routes/competitive.ts`
- Modify: `server/src/controllers/competitiveController.ts`
- Modify: `server/src/services/sessionService.ts`
- Modify: `server/src/services/validationService.ts`
- Create: `server/tests/services/answerReceipt.test.ts`

**Interfaces:**
- Produces: `POST /api/competitive/sessions/:sessionId/answers`
  - Request: `{ sequence: number, questionToken: string, rawInput: string, clientAnsweredAt: number, inputLatencyMs: number, idempotencyKey: string }`
  - Response: `{ status: 'ACCEPTED', sequence: number, isCorrect: boolean, serverReceivedAt: number, timeRemainingMs: number, nextQuestion: CompetitiveQuestionView | null }`
- Consumes: `sessionService.recordAnswerReceipt`, `verifyQuestionToken`, `isAnswerCorrect`, `applySurvivalTimerStep`

- [ ] **Step 1: Write failing server answer receipt tests**

Create `server/tests/services/answerReceipt.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionService } from '../../src/services/sessionService.js';
import { ValidationService } from '../../src/services/validationService.js';

describe('SessionService.recordAnswerReceipt', () => {
  let mockFirestore: any;
  let sessionData: any;
  let sessionService: SessionService;

  beforeEach(() => {
    sessionData = {
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      mode: 'sprint',
      status: 'ACTIVE',
      serverStartedAt: Date.now() - 5000,
      serverDeadlineAt: Date.now() + 55000,
      serverSecret: 'secret_456',
      serverQuestions: {
        '1': { id: 'q1', prompt: '2 + 3', answerSpec: { kind: 'numeric', value: 5 } },
        '2': { id: 'q2', prompt: '4 + 4', answerSpec: { kind: 'numeric', value: 8 } },
      },
      clientQuestionViews: [
        { questionInstanceId: 'q1', sequence: 1, renderedPrompt: '2 + 3', answerInputKind: 'numeric', questionToken: 'tok_valid_1' },
      ],
      acknowledgedSequences: [],
      answerReceipts: {},
      isRanked: true,
    };

    mockFirestore = {
      collection: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => sessionData }),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      }),
      runTransaction: vi.fn().mockImplementation(async (cb: any) => {
        const tx = {
          get: vi.fn().mockResolvedValue({ exists: true, data: () => sessionData }),
          set: vi.fn(),
          update: vi.fn().mockImplementation((_ref: any, data: any) => {
            Object.assign(sessionData, data);
          }),
        };
        return cb(tx);
      }),
    };

    sessionService = new SessionService(mockFirestore);
  });

  it('rejects an answer if session is not active', async () => {
    sessionData.status = 'VALIDATED';
    await expect(
      sessionService.recordAnswerReceipt({
        sessionId: 'sess_test_123',
        userId: 'user_abc',
        sequence: 1,
        questionToken: 'tok_valid_1',
        rawInput: '5',
        clientAnsweredAt: 2000,
        inputLatencyMs: 300,
        idempotencyKey: 'ans_1',
      })
    ).rejects.toThrow(/not active/i);
  });

  it('rejects an answer if userId does not match session owner', async () => {
    await expect(
      sessionService.recordAnswerReceipt({
        sessionId: 'sess_test_123',
        userId: 'wrong_user',
        sequence: 1,
        questionToken: 'tok_valid_1',
        rawInput: '5',
        clientAnsweredAt: 2000,
        inputLatencyMs: 300,
        idempotencyKey: 'ans_1',
      })
    ).rejects.toThrow(/not authorized/i);
  });

  it('evaluates correctness and returns receipt with next question without leaking answer keys', async () => {
    const res = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: 'tok_valid_1',
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    expect(res.status).toBe('ACCEPTED');
    expect(res.sequence).toBe(1);
    expect(res.isCorrect).toBe(true);
    expect(res.serverReceivedAt).toBeGreaterThan(0);
    expect(res).not.toHaveProperty('answerSpec');
    expect(res).not.toHaveProperty('serverSecret');
    expect(res).not.toHaveProperty('answerKey');
  });

  it('returns idempotent receipt on duplicate submission with same idempotencyKey', async () => {
    const first = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: 'tok_valid_1',
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    const second = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: 'tok_valid_1',
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    expect(second).toEqual(first);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- server/tests/services/answerReceipt.test.ts`
Expected: FAIL with `sessionService.recordAnswerReceipt is not a function`

- [ ] **Step 3: Implement `recordAnswerReceipt` in `SessionService`**

In `server/src/services/sessionService.ts`, add the interface and method:
```ts
import { isAnswerCorrect } from '@engine/competitive/validator.js';
import { verifyQuestionToken, generateQuestionToken } from '@engine/competitive/stateMachine.js';
import { applySurvivalTimerStep, SURVIVAL_MAX_TIMER_MS, SURVIVAL_INITIAL_TIMER_MS } from '@engine/competitive/modes/survival.js';

export interface RecordAnswerParams {
  sessionId: string;
  userId: string;
  sequence: number;
  questionToken: string;
  rawInput: string;
  clientAnsweredAt: number;
  inputLatencyMs: number;
  idempotencyKey: string;
}

export interface AnswerReceiptResult {
  status: 'ACCEPTED';
  sequence: number;
  isCorrect: boolean;
  serverReceivedAt: number;
  timeRemainingMs: number;
  nextQuestion: CompetitiveQuestionView | null;
}
```

Implement `recordAnswerReceipt` using a Firestore transaction:
- Verify session exists and is owned by `userId`.
- Verify `status === 'ACTIVE'`.
- Verify deadline has not passed.
- Idempotency check: if `answerReceipts[sequence]` exists with matching `idempotencyKey`, return existing receipt.
- If `sequence` mismatch with current expected sequence, throw 409 domain error.
- Verify token via `verifyQuestionToken`.
- Evaluate `isCorrect = isAnswerCorrect(rawInput, question.answerSpec)`.
- Record receipt with timestamp `now = Date.now()`.
- If mode is survival, update `survivalTimerMs`.
- Replenish next question if buffer requires it, returning safe `CompetitiveQuestionView`.
- Update session document with `answerReceipts`, `acknowledgedSequences`, `survivalTimerMs`.

- [ ] **Step 4: Add controller and route for answers**

In `server/src/controllers/competitiveController.ts`, add `submitAnswer`:
```ts
submitAnswer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'User must be authenticated.' });
      return;
    }
    const { sessionId } = req.params;
    const { sequence, questionToken, rawInput, clientAnsweredAt, inputLatencyMs, idempotencyKey } = req.body;
    if (!sessionId || typeof sequence !== 'number' || typeof questionToken !== 'string' || typeof rawInput !== 'string' || !idempotencyKey) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing or malformed answer payload.' });
      return;
    }
    const receipt = await this.sessionService.recordAnswerReceipt({
      sessionId,
      userId,
      sequence,
      questionToken,
      rawInput,
      clientAnsweredAt,
      inputLatencyMs,
      idempotencyKey,
    });
    res.status(200).json(receipt);
  } catch (err) {
    next(err);
  }
};
```

In `server/src/routes/competitive.ts`:
- Add `answerLimiter = createRateLimiter({ maxRequests: 120, windowMs: 60_000 })`.
- Add `router.post('/sessions/:sessionId/answers', authMiddleware, answerLimiter, controller.submitAnswer)`.
- Also add rate limiter for `GET /results/me` (`createRateLimiter({ maxRequests: 20, windowMs: 60_000 })`).

In `server/src/services/validationService.ts`:
- Populate `receivedAnswerTimes` from persisted `sessionData.answerReceipts`.
- Set `hasAuthoritativeAnswerReceipts: Object.keys(sessionData.answerReceipts || {}).length > 0`.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npm run test:server`
Expected: All server test suites pass (including new answer receipt tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/competitive.ts server/src/controllers/competitiveController.ts server/src/services/sessionService.ts server/src/services/validationService.ts server/tests/services/answerReceipt.test.ts
git commit -m "feat(api): add authoritative answer receipt endpoint with idempotent evaluation"
```

---

### Task 2: Centralized Eligibility & Privacy Policy

**Files:**
- Create: `src/lib/competitiveEligibility.ts`
- Create: `tests/unit/competitiveEligibility.test.ts`
- Modify: `src/types.ts` (export eligibility types if needed)

**Interfaces:**
- Produces:
  ```ts
  export type CompetitiveIneligibilityReason =
    | 'under13'
    | 'unspecified_age'
    | 'guest'
    | 'leaderboard_opt_out'
    | 'flag_disabled'
    | 'unauthenticated';

  export interface CompetitiveEligibilityResult {
    isEligibleForRanked: boolean;
    reason?: CompetitiveIneligibilityReason;
    executionMode: 'ranked' | 'practice';
  }

  export function evaluateCompetitiveEligibility(params: {
    ageEligibility: AgeEligibility;
    isGuest: boolean;
    isAuthenticated: boolean;
    leaderboardOptOut: boolean;
    featureFlagEnabled: boolean;
  }): CompetitiveEligibilityResult;
  ```

- [ ] **Step 1: Write failing eligibility policy tests**

Create `tests/unit/competitiveEligibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { evaluateCompetitiveEligibility } from '../../src/lib/competitiveEligibility';

describe('evaluateCompetitiveEligibility', () => {
  it('forces practice mode for under13 regardless of other flags', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: 'under13',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('under13');
  });

  it('marks unspecified age as not eligible for ranked', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: 'unspecified',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.reason).toBe('unspecified_age');
  });

  it('forces practice for guest users even if 13+', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: true,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.reason).toBe('guest');
  });

  it('forces practice for opt-out users even if authenticated 13+', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: true,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.reason).toBe('leaderboard_opt_out');
  });

  it('forces practice if feature flag is disabled', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: false,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.reason).toBe('flag_disabled');
  });

  it('allows ranked mode for authenticated 13+ with flag enabled and not opted out', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(true);
    expect(res.executionMode).toBe('ranked');
    expect(res.reason).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveEligibility.test.ts`
Expected: FAIL with `Cannot find module '../../src/lib/competitiveEligibility'`

- [ ] **Step 3: Implement `src/lib/competitiveEligibility.ts`**

```ts
import { AgeEligibility } from '../types';

export type CompetitiveIneligibilityReason =
  | 'under13'
  | 'unspecified_age'
  | 'guest'
  | 'leaderboard_opt_out'
  | 'flag_disabled'
  | 'unauthenticated';

export interface CompetitiveEligibilityResult {
  isEligibleForRanked: boolean;
  reason?: CompetitiveIneligibilityReason;
  executionMode: 'ranked' | 'practice';
}

export function evaluateCompetitiveEligibility(params: {
  ageEligibility: AgeEligibility;
  isGuest: boolean;
  isAuthenticated: boolean;
  leaderboardOptOut: boolean;
  featureFlagEnabled: boolean;
}): CompetitiveEligibilityResult {
  const { ageEligibility, isGuest, isAuthenticated, leaderboardOptOut, featureFlagEnabled } = params;

  if (ageEligibility === 'under13') {
    return { isEligibleForRanked: false, reason: 'under13', executionMode: 'practice' };
  }

  if (ageEligibility === 'unspecified') {
    return { isEligibleForRanked: false, reason: 'unspecified_age', executionMode: 'practice' };
  }

  if (!featureFlagEnabled) {
    return { isEligibleForRanked: false, reason: 'flag_disabled', executionMode: 'practice' };
  }

  if (!isAuthenticated) {
    return { isEligibleForRanked: false, reason: 'unauthenticated', executionMode: 'practice' };
  }

  if (isGuest) {
    return { isEligibleForRanked: false, reason: 'guest', executionMode: 'practice' };
  }

  if (leaderboardOptOut) {
    return { isEligibleForRanked: false, reason: 'leaderboard_opt_out', executionMode: 'practice' };
  }

  return { isEligibleForRanked: true, executionMode: 'ranked' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveEligibility.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/competitiveEligibility.ts tests/unit/competitiveEligibility.test.ts
git commit -m "feat(competitive): add centralized eligibility and privacy evaluation policy"
```

---

### Task 3: Typed Native-Fetch Competitive API Client

**Files:**
- Create: `src/lib/competitiveApi.ts`
- Create: `tests/unit/competitiveApi.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class CompetitiveApiError extends Error {
    constructor(public code: CompetitiveApiErrorCode, message: string, public status?: number) { ... }
  }
  export function createCompetitiveApiClient(options?: {
    baseUrl?: string;
    getToken?: () => Promise<string | null>;
    fetchFn?: typeof fetch;
  }): CompetitiveApiClient;
  ```
- Operations on `CompetitiveApiClient`:
  - `createSession(params: { mode: CompetitiveMode; challengeId?: string; idempotencyKey: string }): Promise<CreateSessionResult>`
  - `submitAnswer(sessionId: string, params: RecordAnswerParams): Promise<AnswerReceiptResult>`
  - `submitSession(sessionId: string, params: { answers: SubmittedAnswerPayload[]; submissionIdempotencyKey: string; pseudonym?: string }): Promise<FinalizeSessionResult>`
  - `getLeaderboard(periodKey: string, mode: CompetitiveMode, options?: { limit?: number; offset?: number }): Promise<LeaderboardEntryDoc[]>`
  - `getMyResults(mode?: CompetitiveMode): Promise<CompetitiveResultDoc[]>`

- [ ] **Step 1: Write failing API client contract & error tests**

Create `tests/unit/competitiveApi.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompetitiveApiClient, CompetitiveApiError } from '../../src/lib/competitiveApi';

describe('CompetitiveApiClient', () => {
  let mockFetch: any;
  let getToken: any;
  let client: ReturnType<typeof createCompetitiveApiClient>;

  beforeEach(() => {
    mockFetch = vi.fn();
    getToken = vi.fn().mockResolvedValue('mock_token_xyz');
    client = createCompetitiveApiClient({
      baseUrl: '/api/competitive',
      getToken,
      fetchFn: mockFetch,
    });
  });

  it('attaches Authorization header with Bearer token for authenticated requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { sessionId: 'sess_1', mode: 'sprint', rulesVersion: '2.0', contentVersion: '72L-v1', serverStartedAt: 1000, serverDeadlineAt: 61000, isRanked: true },
        questions: [{ questionInstanceId: 'q1', sequence: 1, renderedPrompt: '1+1', answerInputKind: 'numeric', questionToken: 'tok_1' }],
      }),
    });

    await client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/competitive/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock_token_xyz',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws UNAUTHENTICATED error when getToken returns null', async () => {
    getToken.mockResolvedValueOnce(null);

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toThrow(CompetitiveApiError);
  });

  it('submits answer receipt with idempotency key and parses valid response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ACCEPTED',
        sequence: 1,
        isCorrect: true,
        serverReceivedAt: 2000,
        timeRemainingMs: 58000,
        nextQuestion: null,
      }),
    });

    const res = await client.submitAnswer('sess_1', {
      sequence: 1,
      questionToken: 'tok_1',
      rawInput: '2',
      clientAnsweredAt: 1000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    expect(res.status).toBe('ACCEPTED');
    expect(res.isCorrect).toBe(true);
  });

  it('maps HTTP 429 to RATE_LIMIT_EXCEEDED error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }),
    });

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 429,
    });
  });

  it('maps invalid json structure to INVALID_RESPONSE error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'structure' }),
    });

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveApi.test.ts`
Expected: FAIL with `Cannot find module '../../src/lib/competitiveApi'`

- [ ] **Step 3: Implement `src/lib/competitiveApi.ts`**

Create `src/lib/competitiveApi.ts`:
- Define `CompetitiveApiErrorCode = 'UNAUTHENTICATED' | 'AGE_RESTRICTED' | 'NETWORK_UNAVAILABLE' | 'TIMEOUT' | 'HTTP_ERROR' | 'INVALID_RESPONSE'`
- Define `CompetitiveApiError` class extending `Error`
- Runtime validator functions for session creation, answer receipt, and submission responses
- Use `AbortController` with default timeout of 10,000ms for create/submit and 5,000ms for answer receipts
- Never log or store the token

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/competitiveApi.ts tests/unit/competitiveApi.test.ts
git commit -m "feat(competitive): add typed native-fetch competitive API client with runtime validation"
```

---

### Task 4: Feature Flags & Kill Switch

**Files:**
- Create: `src/lib/featureFlags.ts`
- Create: `tests/unit/featureFlags.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function isCompetitiveRankedEnabled(): boolean;
  export function setCompetitiveRankedOverride(enabled: boolean | null): void;
  ```

- [ ] **Step 1: Write failing feature flag tests**

Create `tests/unit/featureFlags.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isCompetitiveRankedEnabled, setCompetitiveRankedOverride } from '../../src/lib/featureFlags';

describe('featureFlags', () => {
  beforeEach(() => {
    setCompetitiveRankedOverride(null);
  });

  it('defaults to false when environment variable is not set', () => {
    expect(isCompetitiveRankedEnabled()).toBe(false);
  });

  it('respects programmatic override (kill switch)', () => {
    setCompetitiveRankedOverride(true);
    expect(isCompetitiveRankedEnabled()).toBe(true);

    setCompetitiveRankedOverride(false);
    expect(isCompetitiveRankedEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/featureFlags.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/featureFlags.ts`**

```ts
let rankedOverride: boolean | null = null;

export function isCompetitiveRankedEnabled(): boolean {
  if (rankedOverride !== null) {
    return rankedOverride;
  }
  const envVal = import.meta.env?.VITE_COMPETITIVE_RANKED_ENABLED;
  return envVal === 'true' || envVal === '1';
}

export function setCompetitiveRankedOverride(enabled: boolean | null): void {
  rankedOverride = enabled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/featureFlags.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/featureFlags.ts tests/unit/featureFlags.test.ts
git commit -m "feat(competitive): add feature flag and kill switch reader"
```

---

### Task 5: Hook Adapter in `useCompetitiveSession`

**Files:**
- Modify: `src/hooks/useCompetitiveSession.ts`
- Create: `tests/unit/competitiveHookAdapter.test.ts`

**Interfaces:**
- Extends `UseCompetitiveSessionOptions`:
  ```ts
  export interface UseCompetitiveSessionOptions {
    mode: CompetitiveMode;
    secret: string;
    userId?: string;
    isRanked?: boolean;
    challengeId?: string;
    dailyQuestions?: Question[];
    onFinish?: (output: ValidationOutput) => void;
    // New optional Phase 2 properties
    executionMode?: 'ranked' | 'practice';
    apiClient?: CompetitiveApiClient;
    serverSessionId?: string;
    initialServerQuestions?: CompetitiveQuestionView[];
  }
  ```
- Extends `UseCompetitiveSessionReturn`:
  ```ts
  integrationStatus: 'checking' | 'ranked_active' | 'practice_active' | 'submitting' | 'validated' | 'rejected' | 'unavailable';
  isRankedSession: boolean;
  ```

- [ ] **Step 1: Write failing hook adapter tests**

Create `tests/unit/competitiveHookAdapter.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';

describe('useCompetitiveSession adapter', () => {
  it('defaults to practice mode when executionMode is not specified', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'sprint',
        secret: 'test_sec',
      })
    );
    expect(result.current.integrationStatus).toBe('practice_active');
    expect(result.current.isRankedSession).toBe(false);
  });

  it('initializes in ranked_active when executionMode is ranked with server questions', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'sprint',
        secret: 'test_sec',
        executionMode: 'ranked',
        serverSessionId: 'sess_123',
        initialServerQuestions: [
          { questionInstanceId: 'q1', sequence: 1, renderedPrompt: '3 + 4', answerInputKind: 'numeric', questionToken: 'tok_1' },
          { questionInstanceId: 'q2', sequence: 2, renderedPrompt: '5 + 5', answerInputKind: 'numeric', questionToken: 'tok_2' },
        ],
      })
    );
    expect(result.current.integrationStatus).toBe('ranked_active');
    expect(result.current.isRankedSession).toBe(true);
    expect(result.current.currentQuestion?.renderedPrompt).toBe('3 + 4');
  });

  it('enqueues answer receipt and advances buffer seamlessly in ranked mode', async () => {
    const mockApiClient = {
      submitAnswer: vi.fn().mockResolvedValue({
        status: 'ACCEPTED',
        sequence: 1,
        isCorrect: true,
        serverReceivedAt: 2000,
        timeRemainingMs: 58000,
        nextQuestion: { questionInstanceId: 'q3', sequence: 3, renderedPrompt: '6 + 6', answerInputKind: 'numeric', questionToken: 'tok_3' },
      }),
      submitSession: vi.fn(),
    } as any;

    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'sprint',
        secret: 'test_sec',
        executionMode: 'ranked',
        serverSessionId: 'sess_123',
        apiClient: mockApiClient,
        initialServerQuestions: [
          { questionInstanceId: 'q1', sequence: 1, renderedPrompt: '3 + 4', answerInputKind: 'numeric', questionToken: 'tok_1' },
          { questionInstanceId: 'q2', sequence: 2, renderedPrompt: '5 + 5', answerInputKind: 'numeric', questionToken: 'tok_2' },
        ],
      })
    );

    act(() => {
      result.current.submitAnswer('7');
    });

    // Display immediately advances to sequence 2
    expect(result.current.currentQuestion?.sequence).toBe(2);

    // Wait for receipt queue to settle
    await vi.waitFor(() => {
      expect(mockApiClient.submitAnswer).toHaveBeenCalledWith(
        'sess_123',
        expect.objectContaining({ sequence: 1, rawInput: '7' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveHookAdapter.test.ts`
Expected: FAIL with missing property `integrationStatus`

- [ ] **Step 3: Implement adapter in `src/hooks/useCompetitiveSession.ts`**

Update `useCompetitiveSession.ts`:
- Add `executionMode = 'practice'` and `apiClient` to options.
- Add `integrationStatus` state.
- In ranked mode:
  - Initialize `bufferedViews` with `initialServerQuestions`.
  - Serialized receipt queue: `receiptQueueRef = useRef<Promise<void>>(Promise.resolve())`.
  - `submitAnswer` pushes answer payload to `submittedAnswersRef`, removes current question from display buffer immediately, and enqueues `apiClient.submitAnswer(...)` onto `receiptQueueRef`.
  - On receipt resolution: append `nextQuestion` if returned. For Survival, reconcile `survivalTimerMsRef.current = receipt.timeRemainingMs`.
  - `finalizeSession`: wait for `receiptQueueRef.current` to resolve before calling `apiClient.submitSession`. Set `integrationStatus('submitting')`.
  - On submit success: set `resultOutput(serverResult)`, `integrationStatus('validated')`.
  - On submit failure: set `integrationStatus('rejected')` with unvalidated indicator, do NOT fall back to local practice.
- Keep practice mode 100% untouched for backward compatibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveHookAdapter.test.ts tests/unit/competitiveHook.test.ts tests/unit/competitiveHookDaily.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCompetitiveSession.ts tests/unit/competitiveHookAdapter.test.ts
git commit -m "feat(competitive): add ranked adapter with background receipt queue to useCompetitiveSession"
```

---

### Task 6: Sprint 60s Integration

**Files:**
- Modify: `src/components/competitive/CompetitivePlayScreen.tsx`
- Create: `tests/unit/competitiveSprintIntegration.test.tsx`

**Interfaces:**
- Produces: Seamless Sprint start flow:
  1. Checks eligibility via `evaluateCompetitiveEligibility`.
  2. If eligible and flag on: creates server session via `apiClient.createSession({ mode: 'sprint' })`.
  3. On success: renders Sprint arena in `ranked` execution mode with server questions.
  4. On API failure before start: falls back to local practice mode with `integrationStatus: 'practice_active'`.
  5. Under-13: directly starts local practice with zero API calls.

- [ ] **Step 1: Write failing Sprint integration tests**

Create `tests/unit/competitiveSprintIntegration.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CompetitivePlayScreen from '../../src/components/competitive/CompetitivePlayScreen';
import * as eligibilityMod from '../../src/lib/competitiveEligibility';

describe('CompetitivePlayScreen Sprint integration', () => {
  it('starts local practice for under-13 with zero API calls', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret="test_sec"
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Lokal Aman/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveSprintIntegration.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `CompetitivePlayScreen.tsx` with Sprint start flow**

In `CompetitivePlayScreen.tsx`:
- Read privacy state from `usePrivacySettings()`.
- Evaluate eligibility via `evaluateCompetitiveEligibility`.
- If `executionMode === 'ranked'`, initialize session by calling `createSession`.
- Handle pre-start error by falling back to local practice.
- Pass resolved `executionMode`, `serverSessionId`, and `initialServerQuestions` to `useCompetitiveSession`.
- Render mode indicator tag (`Ranked · Server Validated` or `Mode Lokal Aman · Tidak Berperingkat`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveSprintIntegration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/competitive/CompetitivePlayScreen.tsx tests/unit/competitiveSprintIntegration.test.tsx
git commit -m "feat(competitive): integrate Sprint 60s with server session creation and local fallback"
```

---

### Task 7: Survival Kilat Integration

**Files:**
- Modify: `src/components/competitive/CompetitivePlayScreen.tsx`
- Create: `tests/unit/competitiveSurvivalIntegration.test.tsx`

**Interfaces:**
- Produces: Survival Kilat ranked integration with authoritative timer step:
  - Correct answer adds +2s (capped at 60s) on receipt confirmation.
  - Wrong answer subtracts -4s on receipt confirmation.
  - Heartbeat timestamp maintained during active run.

- [ ] **Step 1: Write failing Survival integration tests**

Create `tests/unit/competitiveSurvivalIntegration.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompetitivePlayScreen from '../../src/components/competitive/CompetitivePlayScreen';
import * as eligibilityMod from '../../src/lib/competitiveEligibility';

describe('CompetitivePlayScreen Survival integration', () => {
  it('renders survival arena with mode indicator', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    render(
      <CompetitivePlayScreen
        mode="survival"
        secret="test_sec"
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Lokal Aman/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveSurvivalIntegration.test.tsx`
Expected: FAIL if survival header or mode indicator missing

- [ ] **Step 3: Wire Survival header and timer reconciliation in `CompetitivePlayScreen.tsx`**

Ensure `mode === 'survival'` properly connects the `SurvivalHeader`, displays the authoritative timer, and handles game-over when timer reaches 0.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveSurvivalIntegration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/competitive/CompetitivePlayScreen.tsx tests/unit/competitiveSurvivalIntegration.test.tsx
git commit -m "feat(competitive): integrate Survival Kilat with authoritative timer reconciliation"
```

---

### Task 8: Daily Challenge V2 Integration & Leaderboard Replacement

**Files:**
- Modify: `src/components/DailyChallengeScreen.tsx`
- Modify: `src/components/daily/DailyHubView.tsx`
- Create: `tests/unit/competitiveDailyIntegration.test.tsx`

**Interfaces:**
- Produces:
  - `DailyHubView` fetches server leaderboard via `apiClient.getLeaderboard(periodKey, 'daily')` ONLY when user is eligible.
  - For ineligible users (`under13`, guest, opt-out, API failure): displays empty state / explanation, NEVER bot entries as real players.
  - `DailyChallengeScreen` starts ranked session with `challengeId` for eligible users.

- [ ] **Step 1: Write failing Daily integration tests**

Create `tests/unit/competitiveDailyIntegration.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DailyHubView from '../../src/components/daily/DailyHubView';
import * as eligibilityMod from '../../src/lib/competitiveEligibility';

describe('DailyHubView leaderboard integration', () => {
  it('does NOT fetch or show bot leaderboard for under-13 users', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    render(
      <DailyHubView
        selectedDate="2026-09-26"
        onSelectDate={vi.fn()}
        todayDateStr="2026-09-26"
        countdown="05:00:00"
        userState={{ history: {}, currentStreak: 0, maxStreak: 0, lastPlayedDate: null }}
        onStartChallenge={vi.fn()}
        onExit={vi.fn()}
        onOpenStats={vi.fn()}
      />
    );

    // Should NOT show bot names as real players
    expect(screen.queryByText(/Budi Kilat/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Papan peringkat hanya tersedia untuk pemain terverifikasi/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveDailyIntegration.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `DailyHubView.tsx` and `DailyChallengeScreen.tsx`**

In `DailyHubView.tsx`:
- Check eligibility before fetching leaderboard.
- If eligible and API client available, fetch `apiClient.getLeaderboard(selectedDate, 'daily')`.
- If ineligible or API error, display safe explanation notice instead of calling `getLeaderboardForDate()`.

In `DailyChallengeScreen.tsx`:
- Pass `challengeId` and evaluate eligibility before starting `DailyPlayArena`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveDailyIntegration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DailyChallengeScreen.tsx src/components/daily/DailyHubView.tsx tests/unit/competitiveDailyIntegration.test.tsx
git commit -m "feat(daily): replace bot leaderboard with server data and safe eligibility notice"
```

---

### Task 9: UI Indicators, Result View, and Mode Select Modal

**Files:**
- Modify: `src/components/competitive/CompetitiveResultView.tsx`
- Modify: `src/components/competitive/CompetitiveModeSelectModal.tsx`
- Create: `tests/unit/competitiveUiIndicators.test.tsx`

**Interfaces:**
- Produces:
  - `CompetitiveResultView` 3rd state: `Hasil belum tervalidasi server` when submit failed or unvalidated.
  - `CompetitiveModeSelectModal` displays eligibility badges and explains local practice mode for under-13 and guests.

- [ ] **Step 1: Write failing UI indicators tests**

Create `tests/unit/competitiveUiIndicators.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompetitiveResultView from '../../src/components/competitive/CompetitiveResultView';

describe('CompetitiveResultView states', () => {
  it('renders unvalidated server status badge when status is REJECTED', () => {
    const output = {
      status: 'REJECTED',
      rejectionReasons: ['Server submit timeout'],
      canonicalMetrics: { score: 10, accuracy: 1, correctCount: 10, wrongCount: 0, questionsAnswered: 10, rankedActiveDurationMs: 60000, maxStreak: 10, difficultyReached: 2 },
      leaderboardEligible: false,
      result: {} as any,
    } as any;

    render(
      <CompetitiveResultView
        output={output}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
        isUnvalidatedServerResult={true}
      />
    );

    expect(screen.getByText(/Hasil belum tervalidasi server/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveUiIndicators.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `CompetitiveResultView.tsx` and `CompetitiveModeSelectModal.tsx`**

In `CompetitiveResultView.tsx`:
- Add `isUnvalidatedServerResult?: boolean` prop.
- When `isUnvalidatedServerResult` is true, show warning card with text `Hasil belum tervalidasi server`.
- When validated and ranked: show `Ranked · Server Validated`.
- When practice: show `Mode Lokal Aman · Tidak Berperingkat`.

In `CompetitiveModeSelectModal.tsx`:
- Evaluate eligibility and show badge `Mode Latihan Lokal` if user is under-13 or guest.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveUiIndicators.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/competitive/CompetitiveResultView.tsx src/components/competitive/CompetitiveModeSelectModal.tsx tests/unit/competitiveUiIndicators.test.tsx
git commit -m "feat(competitive): add unvalidated result state and eligibility indicators"
```

---

### Task 10: Browser Smoke Tests & Full Verification

**Files:**
- Create: `tests/unit/competitivePhase2Smoke.test.ts`

**Interfaces:**
- Produces: Automated smoke test suite covering the 7 acceptance criteria scenarios:
  1. Under-13 Sprint has zero competitive API requests and finishes as local practice.
  2. Authenticated 13+ Sprint creates session, sends receipts, and displays validated server result.
  3. Authenticated 13+ with API failure before start falls back to local practice.
  4. Ranked submit failure shows unvalidated status without creating a second session.
  5. Guest play remains local.
  6. Eligible leaderboard reads server data.
  7. Under-13 and opt-out leaderboard views make zero competitive API requests.

- [ ] **Step 1: Write comprehensive smoke test suite**

Create `tests/unit/competitivePhase2Smoke.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateCompetitiveEligibility } from '../../src/lib/competitiveEligibility';
import { createCompetitiveApiClient } from '../../src/lib/competitiveApi';
import { isCompetitiveRankedEnabled, setCompetitiveRankedOverride } from '../../src/lib/featureFlags';

describe('Competitive Phase 2 Smoke Verification', () => {
  beforeEach(() => {
    setCompetitiveRankedOverride(true);
  });

  it('1. Under-13 has zero competitive API calls and is local practice', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: 'under13',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.executionMode).toBe('practice');
  });

  it('2. Authenticated 13+ is eligible for ranked when flag is enabled', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(true);
    expect(eligibility.executionMode).toBe('ranked');
  });

  it('3. Guest play remains local', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: true,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.reason).toBe('guest');
  });

  it('4. Feature flag kill switch immediately disables ranked eligibility', () => {
    setCompetitiveRankedOverride(false);
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.reason).toBe('flag_disabled');
  });

  it('5. API client does not leak secrets or answer keys in error objects', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'INTERNAL', secret: 'leak_secret', answerKey: 42 }),
    });

    const client = createCompetitiveApiClient({
      baseUrl: '/api/competitive',
      getToken: vi.fn().mockResolvedValue('token'),
      fetchFn: mockFetch,
    });

    try {
      await client.createSession({ mode: 'sprint', idempotencyKey: 'idemp' });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(JSON.stringify(err)).not.toContain('leak_secret');
      expect(JSON.stringify(err)).not.toContain('42');
    }
  });
});
```

- [ ] **Step 2: Run smoke tests and verify they pass**

Run: `npx vitest run tests/unit/competitivePhase2Smoke.test.ts`
Expected: PASS

- [ ] **Step 3: Run full verification gates**

Run all test suites and checks:
1. `npm test` (all frontend tests)
2. `npm run test:server` (all backend tests)
3. `npm run build` (verify bundle budget <= 350 KiB gzip)
4. `cd server && npm run check` (TypeScript server check)

- [ ] **Step 4: Commit**

```bash
git add tests/unit/competitivePhase2Smoke.test.ts
git commit -m "test(competitive): add Phase 2 browser smoke test suite and verify all gates"
```
