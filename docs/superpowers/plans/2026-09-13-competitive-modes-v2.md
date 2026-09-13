# Milestone V2.3 Competitive Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the competitive modes subsystem (Sprint 60s, Survival Kilat, Daily Challenge V2), sliding window session buffer, authoritative server-side validator, public leaderboard projections, and Firestore security rules according to PRD §15, §16, §17, §28 and criteria AC-COMP-01 to AC-COMP-12.

**Architecture:** Pure functional competitive engine under `src/engine/competitive/` decoupled from database and network I/O. Session protocol uses an authoritative sliding-window buffer ($3–5$ question views ahead) with zero answer secret exposure. Authoritative server validator recomputes 100% of score, accuracy, duration, and streaks, enforcing strict anti-replay and deadline constraints before projecting sanitized results to public leaderboard entries.

**Tech Stack:** TypeScript 5.8+, Vitest 5+, Node.js crypto / web crypto HMAC, Firestore Security Rules v2.

**Spec:** `docs/superpowers/specs/2026-09-13-competitive-modes-v2-design.md`

## Global Constraints

- Never use binary floating-point arithmetic for canonical scores or tie-breaking comparisons; all rounding uses integer arithmetic `roundHalfUp(n, d) = Math.floor((2n + d) / (2d))`.
- Tie-breaking accuracy comparisons must use exact fraction cross-multiplication: $\frac{c_1}{a_1} > \frac{c_2}{a_2} \iff c_1 \times a_2 > c_2 \times a_1$.
- Zero secret leakage: client-facing question views must never include answers, `AnswerSpec`, AST, or generator seeds.
- Direct client writes to `/competitiveResults/*` and `/leaderboardEntries/*` must be strictly denied in `firestore.rules`.
- Firestore `/competitiveSessions/*` collection is strictly internal to trusted server runtime (read and write denied to client SDKs).
- Public leaderboard documents must never expose internal Auth UIDs, emails, profile photos, question tokens, or gameplay evidence.
- Commit attribution format: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Data Contracts, Core Types, and Integer Scoring Engine

**Files:**
- Create: `src/engine/competitive/types.ts`
- Create: `src/engine/competitive/scoring.ts`
- Test: `tests/unit/competitiveScoring.test.ts`

**Interfaces:**
- Produces:
  - `roundHalfUp(n: number, d: number): number`
  - `calculateSprintScore(difficulty: number, streak: number): number`
  - `calculateDailyScore(correctCount: number, maxStreak: number, activeDurationMs: number): { score: number; base: number; streakBonus: number; speedBonus: number; perfectBonus: number }`
  - `compareSprintRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number`
  - `compareSurvivalRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number`
  - `compareDailyRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number`

- [ ] **Step 1: Write failing unit test for scoring formulas and comparators**

```typescript
// tests/unit/competitiveScoring.test.ts
import { describe, it, expect } from 'vitest';
import {
  roundHalfUp,
  calculateSprintScore,
  calculateDailyScore,
  compareSprintRecords,
  compareSurvivalRecords,
  compareDailyRecords,
} from '../../src/engine/competitive/scoring';
import { CompetitiveResultDoc } from '../../src/engine/competitive/types';

describe('Competitive Scoring & Comparators', () => {
  it('implements roundHalfUp correctly across edge cases and integer boundaries', () => {
    expect(roundHalfUp(15, 10)).toBe(2); // 1.5 -> 2
    expect(roundHalfUp(14, 10)).toBe(1); // 1.4 -> 1
    expect(roundHalfUp(25, 10)).toBe(3); // 2.5 -> 3
    expect(roundHalfUp(0, 10)).toBe(0);
  });

  it('computes Sprint points with base points and combo tenths capped at 3.0x', () => {
    // Difficulty 1: base = 100
    // streak 1: combo = min(30, 10 + 1 - 1) = 10 (1.0x) -> 100
    expect(calculateSprintScore(1, 1)).toBe(100);
    // streak 5: combo = 14 (1.4x) -> roundHalfUp(1400, 10) = 140
    expect(calculateSprintScore(1, 5)).toBe(140);
    // Difficulty 3: base = 100 + 25*2 = 150
    // streak 25: combo capped at 30 (3.0x) -> roundHalfUp(4500, 10) = 450
    expect(calculateSprintScore(3, 25)).toBe(450);
  });

  it('computes Daily Challenge score with accurate speed and perfect bonuses', () => {
    // 10 correct, 60s (60000ms), maxStreak 10
    // base = 10 * 120 = 1200
    // streakBonus = min(300, 10 * 30) = 300
    // speedNum = (75000 - 60000) * 800 * 10 = 15000 * 8000 = 120,000,000
    // speedBonus = roundHalfUp(120,000,000 / 750,000) = 160
    // perfectBonus = 200
    // total = 1200 + 300 + 160 + 200 = 1860
    const res = calculateDailyScore(10, 10, 60000);
    expect(res.base).toBe(1200);
    expect(res.streakBonus).toBe(300);
    expect(res.speedBonus).toBe(160);
    expect(res.perfectBonus).toBe(200);
    expect(res.score).toBe(1860);

    // If duration >= 75000ms, speedBonus is 0
    const slowRes = calculateDailyScore(8, 5, 80000);
    expect(slowRes.speedBonus).toBe(0);
    expect(slowRes.perfectBonus).toBe(0);
  });

  it('orders Sprint records using exact comparator chain', () => {
    const r1: CompetitiveResultDoc = {
      resultId: 'r1',
      sessionId: 's1',
      userId: 'u1',
      mode: 'sprint',
      status: 'VALIDATED',
      isRanked: true,
      score: 1500,
      accuracy: 90,
      correctCount: 20,
      wrongCount: 2,
      questionsAnswered: 22,
      rankedActiveDurationMs: 60000,
      maxStreak: 12,
      difficultyReached: 4,
      rejectionReasons: [],
      finalizedAt: 1000,
      rulesVersion: '1.0',
      contentVersion: '1.0',
    };
    const r2: CompetitiveResultDoc = { ...r1, resultId: 'r2', score: 1400 };
    expect(compareSprintRecords(r1, r2)).toBeLessThan(0); // r1 ranks higher
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/competitiveScoring.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `types.ts` and `scoring.ts`**

Create `src/engine/competitive/types.ts`:
```typescript
export type CompetitiveMode = 'sprint' | 'survival' | 'daily';

export type CompetitiveSessionStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'VALIDATED'
  | 'REJECTED'
  | 'FAILED'
  | 'ABANDONED';

export interface CompetitiveSessionContract {
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
  serverStartedAt: number;
  serverDeadlineAt: number;
  status: CompetitiveSessionStatus;
  isRanked: boolean;
  idempotencyKey: string;
}

export interface CompetitiveQuestionView {
  questionInstanceId: string;
  sequence: number;
  renderedPrompt: string;
  answerInputKind: 'numeric' | 'fraction' | 'decimal';
  constraints?: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
    precision?: number;
  };
  questionToken: string;
}

export interface SubmittedAnswerPayload {
  sequence: number;
  questionToken: string;
  rawInput: string;
  clientAnsweredAt: number;
  inputLatencyMs: number;
  idempotencyKey: string;
}

export interface CompetitiveResultDoc {
  resultId: string;
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  status: 'VALIDATED' | 'REJECTED';
  isRanked: boolean;
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  questionsAnswered: number;
  rankedActiveDurationMs: number;
  maxStreak: number;
  difficultyReached: number;
  rejectionReasons: string[];
  finalizedAt: number;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
}

export interface LeaderboardEntryDoc {
  entryId: string;
  mode: CompetitiveMode;
  periodKey: string;
  rulesVersion: string;
  contentVersion: string;
  pseudonym: string;
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  durationMs: number;
  finalizedAt: number;
  resultId: string;
}
```

Create `src/engine/competitive/scoring.ts`:
```typescript
import { CompetitiveResultDoc } from './types';

/**
 * Implements exact integer rounding: floor((2n + d) / (2d)) for non-negative integers.
 */
export function roundHalfUp(n: number, d: number): number {
  if (d <= 0) return 0;
  if (n <= 0) return 0;
  return Math.floor((2 * n + d) / (2 * d));
}

/**
 * Sprint points calculation:
 * basePoints = 100 + 25 * (difficulty - 1)
 * comboTenths = min(30, 10 + currentStreak - 1)
 * points = roundHalfUp(basePoints * comboTenths, 10)
 */
export function calculateSprintScore(difficulty: number, currentStreak: number): number {
  const d = Math.max(1, Math.min(6, Math.floor(difficulty)));
  const basePoints = 100 + 25 * (d - 1);
  const streak = Math.max(1, Math.floor(currentStreak));
  const comboTenths = Math.min(30, 10 + streak - 1);
  return roundHalfUp(basePoints * comboTenths, 10);
}

/**
 * Daily Challenge scoring:
 * base = correctCount * 120
 * streakBonus = min(300, maxStreak * 30)
 * speedBonus = roundHalfUp(max(0, 75000 - durationMs) * 800 * correctCount, 750000)
 * perfectBonus = (correctCount === 10) ? 200 : 0
 */
export function calculateDailyScore(
  correctCount: number,
  maxStreak: number,
  activeDurationMs: number
): { score: number; base: number; streakBonus: number; speedBonus: number; perfectBonus: number } {
  const c = Math.max(0, Math.min(10, Math.floor(correctCount)));
  const s = Math.max(0, Math.floor(maxStreak));
  const dur = Math.max(0, Math.floor(activeDurationMs));

  const base = c * 120;
  const streakBonus = Math.min(300, s * 30);
  const speedNum = Math.max(0, 75000 - dur) * 800 * c;
  const speedBonus = roundHalfUp(speedNum, 750000);
  const perfectBonus = c === 10 ? 200 : 0;
  const score = base + streakBonus + speedBonus + perfectBonus;

  return { score, base, streakBonus, speedBonus, perfectBonus };
}

/**
 * Exact cross-multiplication fraction comparator: c1/a1 vs c2/a2.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
function compareAccuracyFraction(
  c1: number,
  a1: number,
  c2: number,
  a2: number
): number {
  if (a1 === 0 && a2 === 0) return 0;
  if (a1 === 0) return -1;
  if (a2 === 0) return 1;
  return c1 * a2 - c2 * a1;
}

/**
 * Sprint Comparator:
 * score DESC -> accuracy DESC -> correctCount DESC -> wrongCount ASC -> finalizedAt ASC -> resultId ASC
 */
export function compareSprintRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number {
  if (a.score !== b.score) return b.score - a.score;
  const accComp = compareAccuracyFraction(
    b.correctCount,
    b.questionsAnswered,
    a.correctCount,
    a.questionsAnswered
  );
  if (accComp !== 0) return accComp;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  if (a.wrongCount !== b.wrongCount) return a.wrongCount - b.wrongCount;
  if (a.finalizedAt !== b.finalizedAt) return a.finalizedAt - b.finalizedAt;
  return a.resultId.localeCompare(b.resultId);
}

/**
 * Survival Comparator:
 * score DESC -> survivalDurationMs DESC -> accuracy DESC -> finalizedAt ASC -> resultId ASC
 */
export function compareSurvivalRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.rankedActiveDurationMs !== b.rankedActiveDurationMs) {
    return b.rankedActiveDurationMs - a.rankedActiveDurationMs;
  }
  const accComp = compareAccuracyFraction(
    b.correctCount,
    b.questionsAnswered,
    a.correctCount,
    a.questionsAnswered
  );
  if (accComp !== 0) return accComp;
  if (a.finalizedAt !== b.finalizedAt) return a.finalizedAt - b.finalizedAt;
  return a.resultId.localeCompare(b.resultId);
}

/**
 * Daily Comparator:
 * score DESC -> correctCount DESC -> rankedActiveDurationMs ASC -> finalizedAt ASC -> resultId ASC
 */
export function compareDailyRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  if (a.rankedActiveDurationMs !== b.rankedActiveDurationMs) {
    return a.rankedActiveDurationMs - b.rankedActiveDurationMs;
  }
  if (a.finalizedAt !== b.finalizedAt) return a.finalizedAt - b.finalizedAt;
  return a.resultId.localeCompare(b.resultId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/competitiveScoring.test.ts`
Expected: PASS with 4 tests passed.

- [ ] **Step 5: Commit changes**

```bash
git add src/engine/competitive/types.ts src/engine/competitive/scoring.ts tests/unit/competitiveScoring.test.ts
git commit -m "feat(competitive): implement core types, integer scoring formulas, and record comparators

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Game Mode Rules Engines (Sprint, Survival, Daily)

**Files:**
- Create: `src/engine/competitive/modes/sprint.ts`
- Create: `src/engine/competitive/modes/survival.ts`
- Create: `src/engine/competitive/modes/daily.ts`
- Test: `tests/unit/competitiveModes.test.ts`

**Interfaces:**
- Produces:
  - `getSprintDifficulty(correctCount: number): number`
  - `getSurvivalDifficulty(correctCount: number): number`
  - `applySurvivalTimerStep(currentTimerMs: number, isCorrect: boolean): number`
  - `generateDailyChallengeId(dateStr: string, contentVersion: string): string`
  - `hashDailySeed(challengeId: string): number`

- [ ] **Step 1: Write failing test for game mode rules**

```typescript
// tests/unit/competitiveModes.test.ts
import { describe, it, expect } from 'vitest';
import { getSprintDifficulty } from '../../src/engine/competitive/modes/sprint';
import {
  getSurvivalDifficulty,
  applySurvivalTimerStep,
} from '../../src/engine/competitive/modes/survival';
import {
  generateDailyChallengeId,
  hashDailySeed,
} from '../../src/engine/competitive/modes/daily';

describe('Competitive Game Mode Rules', () => {
  it('maps Sprint correct count to difficulty brackets 1-6', () => {
    expect(getSprintDifficulty(0)).toBe(1);
    expect(getSprintDifficulty(4)).toBe(1);
    expect(getSprintDifficulty(5)).toBe(2);
    expect(getSprintDifficulty(9)).toBe(2);
    expect(getSprintDifficulty(10)).toBe(3);
    expect(getSprintDifficulty(14)).toBe(3);
    expect(getSprintDifficulty(15)).toBe(4);
    expect(getSprintDifficulty(19)).toBe(4);
    expect(getSprintDifficulty(20)).toBe(5);
    expect(getSprintDifficulty(24)).toBe(5);
    expect(getSprintDifficulty(25)).toBe(6);
    expect(getSprintDifficulty(50)).toBe(6);
  });

  it('maps Survival correct count to progressive difficulty and handles timer caps', () => {
    expect(getSurvivalDifficulty(0)).toBe(1);
    expect(getSurvivalDifficulty(4)).toBe(1);
    expect(getSurvivalDifficulty(5)).toBe(2);
    expect(getSurvivalDifficulty(25)).toBe(6);

    // Timer adds 2000ms on correct, capped at 60000ms
    expect(applySurvivalTimerStep(59000, true)).toBe(60000);
    expect(applySurvivalTimerStep(30000, true)).toBe(32000);

    // Timer subtracts 4000ms on wrong
    expect(applySurvivalTimerStep(30000, false)).toBe(26000);
    expect(applySurvivalTimerStep(2000, false)).toBe(0);
  });

  it('formats Daily challenge ID and deterministic seed', () => {
    const id = generateDailyChallengeId('2026-09-13', 'v2.0');
    expect(id).toBe('2026-09-13@Asia/Jakarta:v2.0');
    const seed1 = hashDailySeed(id);
    const seed2 = hashDailySeed(id);
    expect(seed1).toBe(seed2);
    expect(seed1).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/competitiveModes.test.ts`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement mode rule modules**

Create `src/engine/competitive/modes/sprint.ts`:
```typescript
/**
 * Sprint 60s difficulty progression:
 * 1-5 correct: difficulty 1
 * 6-10 correct: difficulty 2
 * 11-15 correct: difficulty 3
 * 16-20 correct: difficulty 4
 * 21-25 correct: difficulty 5
 * 26+ correct: difficulty 6
 */
export function getSprintDifficulty(correctCount: number): number {
  const c = Math.max(0, Math.floor(correctCount));
  if (c < 5) return 1;
  if (c < 10) return 2;
  if (c < 15) return 3;
  if (c < 20) return 4;
  if (c < 25) return 5;
  return 6;
}

export const SPRINT_DEADLINE_MS = 60000;
```

Create `src/engine/competitive/modes/survival.ts`:
```typescript
export const SURVIVAL_INITIAL_TIMER_MS = 60000;
export const SURVIVAL_MAX_TIMER_MS = 60000;
export const SURVIVAL_HARD_CAP_MS = 600000; // 10 minutes
export const SURVIVAL_CORRECT_ADDITION_MS = 2000;
export const SURVIVAL_WRONG_PENALTY_MS = 4000;
export const SURVIVAL_MAX_HEARTBEAT_GAP_MS = 10000;

/**
 * Survival difficulty: min(6, 1 + floor(correctCount / 5))
 */
export function getSurvivalDifficulty(correctCount: number): number {
  const c = Math.max(0, Math.floor(correctCount));
  return Math.min(6, 1 + Math.floor(c / 5));
}

/**
 * Applies time reward (+2s capped at 60s) or penalty (-4s floor at 0).
 */
export function applySurvivalTimerStep(currentTimerMs: number, isCorrect: boolean): number {
  if (isCorrect) {
    return Math.min(SURVIVAL_MAX_TIMER_MS, currentTimerMs + SURVIVAL_CORRECT_ADDITION_MS);
  }
  return Math.max(0, currentTimerMs - SURVIVAL_WRONG_PENALTY_MS);
}
```

Create `src/engine/competitive/modes/daily.ts`:
```typescript
export const DAILY_TARGET_DURATION_MS = 75000;
export const DAILY_HARD_DEADLINE_MS = 90000;
export const DAILY_QUESTION_COUNT = 10;
export const DAILY_TIMEZONE = 'Asia/Jakarta';

/**
 * challengeId format: YYYY-MM-DD@Asia/Jakarta:<dailyContentVersion>
 */
export function generateDailyChallengeId(dateStr: string, contentVersion: string): string {
  return `${dateStr}@${DAILY_TIMEZONE}:${contentVersion}`;
}

/**
 * Deterministic 32-bit positive integer seed from challengeId
 */
export function hashDailySeed(challengeId: string): number {
  let hash = 0;
  for (let i = 0; i < challengeId.length; i++) {
    const char = challengeId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/competitiveModes.test.ts`
Expected: PASS with all tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add src/engine/competitive/modes/ tests/unit/competitiveModes.test.ts
git commit -m "feat(competitive): implement rules engines for Sprint, Survival, and Daily Challenge

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Session State Machine & Sliding Window Buffer

**Files:**
- Create: `src/engine/competitive/stateMachine.ts`
- Create: `src/engine/competitive/index.ts`
- Test: `tests/unit/competitiveSessionState.test.ts`

**Interfaces:**
- Produces:
  - `createCompetitiveSession(...)`
  - `advanceSessionBuffer(...)`
  - `generateQuestionToken(sessionId: string, sequence: number, instanceId: string, secret: string): string`
  - `verifyQuestionToken(...)`

- [ ] **Step 1: Write failing test for session state machine and sliding window**

```typescript
// tests/unit/competitiveSessionState.test.ts
import { describe, it, expect } from 'vitest';
import {
  createCompetitiveSession,
  advanceSessionBuffer,
  generateQuestionToken,
  verifyQuestionToken,
} from '../../src/engine/competitive/stateMachine';
import { Question } from '../../src/engine/types/question';

describe('Competitive Session State Machine & Buffer', () => {
  const secret = 'test-secret-key-12345';

  const mockQuestions: Question[] = Array.from({ length: 15 }, (_, i) => ({
    id: `q_${i + 1}`,
    templateFamily: 'addition_basic',
    prompt: `${i + 1} + 1 = ?`,
    displayExpression: `${i + 1} + 1`,
    difficulty: 1,
    skillId: 'addition',
    subSkillId: 'addition.single_digit',
    answerSpec: { kind: 'numeric', value: i + 2 },
  }));

  it('creates an active session with an initial 5-question pre-buffered window', () => {
    const session = createCompetitiveSession({
      sessionId: 'sess_1',
      userId: 'user_1',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });

    expect(session.contract.status).toBe('ACTIVE');
    expect(session.bufferedViews.length).toBe(5);
    expect(session.bufferedViews[0].sequence).toBe(1);
    expect(session.bufferedViews[0].questionInstanceId).toBe('q_1');
    // Ensure no secret leakage
    expect((session.bufferedViews[0] as any).answerSpec).toBeUndefined();
    expect(verifyQuestionToken(session.bufferedViews[0], 'sess_1', secret)).toBe(true);
  });

  it('replenishes buffer as answers are acknowledged, keeping 3-5 items ahead', () => {
    const session = createCompetitiveSession({
      sessionId: 'sess_1',
      userId: 'user_1',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });

    // Acknowledge sequence 1 and 2, refill with questions 6 and 7
    const updated = advanceSessionBuffer(
      session,
      [1, 2],
      mockQuestions.slice(5, 7),
      secret
    );

    expect(updated.bufferedViews.map((v) => v.sequence)).toEqual([3, 4, 5, 6, 7]);
    expect(updated.acknowledgedSequences.has(1)).toBe(true);
    expect(updated.acknowledgedSequences.has(2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/competitiveSessionState.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `stateMachine.ts` and `index.ts`**

Create `src/engine/competitive/stateMachine.ts`:
```typescript
import {
  CompetitiveMode,
  CompetitiveQuestionView,
  CompetitiveSessionContract,
} from './types';
import { Question } from '../types/question';

export interface InternalSessionState {
  contract: CompetitiveSessionContract;
  bufferedViews: CompetitiveQuestionView[];
  acknowledgedSequences: Set<number>;
  serverQuestions: Map<number, Question>;
}

export function generateQuestionToken(
  sessionId: string,
  sequence: number,
  instanceId: string,
  secret: string
): string {
  let hash = 0;
  const raw = `${sessionId}:${sequence}:${instanceId}:${secret}`;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `tok_${Math.abs(hash).toString(16)}_${sequence}`;
}

export function verifyQuestionToken(
  view: CompetitiveQuestionView,
  sessionId: string,
  secret: string
): boolean {
  const expected = generateQuestionToken(sessionId, view.sequence, view.questionInstanceId, secret);
  return view.questionToken === expected;
}

export function createCompetitiveSession(params: {
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
  serverStartedAt: number;
  initialQuestions: Question[];
  secret: string;
  isRanked?: boolean;
}): InternalSessionState {
  const deadlineDelta = params.mode === 'sprint' ? 60000 : params.mode === 'daily' ? 90000 : 600000;
  const contract: CompetitiveSessionContract = {
    sessionId: params.sessionId,
    userId: params.userId,
    mode: params.mode,
    rulesVersion: params.rulesVersion,
    contentVersion: params.contentVersion,
    challengeId: params.challengeId,
    serverStartedAt: params.serverStartedAt,
    serverDeadlineAt: params.serverStartedAt + deadlineDelta,
    status: 'ACTIVE',
    isRanked: params.isRanked ?? true,
    idempotencyKey: `start_${params.sessionId}`,
  };

  const serverQuestions = new Map<number, Question>();
  const bufferedViews: CompetitiveQuestionView[] = params.initialQuestions.map((q, idx) => {
    const seq = idx + 1;
    serverQuestions.set(seq, q);
    return {
      questionInstanceId: q.id,
      sequence: seq,
      renderedPrompt: q.prompt,
      answerInputKind: q.answerSpec.kind,
      constraints: q.answerSpec.constraints,
      questionToken: generateQuestionToken(params.sessionId, seq, q.id, params.secret),
    };
  });

  return {
    contract,
    bufferedViews,
    acknowledgedSequences: new Set<number>(),
    serverQuestions,
  };
}

export function advanceSessionBuffer(
  state: InternalSessionState,
  ackSequences: number[],
  newQuestions: Question[],
  secret: string
): InternalSessionState {
  for (const seq of ackSequences) {
    state.acknowledgedSequences.add(seq);
  }

  const remaining = state.bufferedViews.filter((v) => !state.acknowledgedSequences.has(v.sequence));
  let lastSeq = state.bufferedViews.reduce((max, v) => Math.max(max, v.sequence), 0);

  const newViews: CompetitiveQuestionView[] = [];
  for (const q of newQuestions) {
    lastSeq += 1;
    state.serverQuestions.set(lastSeq, q);
    newViews.push({
      questionInstanceId: q.id,
      sequence: lastSeq,
      renderedPrompt: q.prompt,
      answerInputKind: q.answerSpec.kind,
      constraints: q.answerSpec.constraints,
      questionToken: generateQuestionToken(state.contract.sessionId, lastSeq, q.id, secret),
    });
  }

  return {
    ...state,
    bufferedViews: [...remaining, ...newViews],
  };
}
```

Create `src/engine/competitive/index.ts`:
```typescript
export * from './types';
export * from './scoring';
export * from './modes/sprint';
export * from './modes/survival';
export * from './modes/daily';
export * from './stateMachine';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/competitiveSessionState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/engine/competitive/stateMachine.ts src/engine/competitive/index.ts tests/unit/competitiveSessionState.test.ts
git commit -m "feat(competitive): implement session state machine, question tokens, and sliding window buffer

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Authoritative Server-Side Validator & Anti-Cheat Pipeline

**Files:**
- Create: `src/engine/competitive/validator.ts`
- Modify: `src/engine/competitive/index.ts`
- Test: `tests/unit/competitiveValidator.test.ts`

**Interfaces:**
- Produces:
  - `validateCompetitiveSession(input: ValidationInput, secret: string): ValidationOutput`

- [ ] **Step 1: Write failing test for validator engine**

```typescript
// tests/unit/competitiveValidator.test.ts
import { describe, it, expect } from 'vitest';
import { validateCompetitiveSession, ValidationInput } from '../../src/engine/competitive/validator';
import { Question } from '../../src/engine/types/question';
import { generateQuestionToken } from '../../src/engine/competitive/stateMachine';

describe('Authoritative Server Validator', () => {
  const secret = 'server-secret-xyz';

  const mockQuestions = new Map<number, Question>([
    [1, { id: 'q1', prompt: '2+2', displayExpression: '2+2', difficulty: 1, skillId: 'add', subSkillId: 'add.1', answerSpec: { kind: 'numeric', value: 4 } }],
    [2, { id: 'q2', prompt: '3+3', displayExpression: '3+3', difficulty: 1, skillId: 'add', subSkillId: 'add.1', answerSpec: { kind: 'numeric', value: 6 } }],
    [3, { id: 'q3', prompt: '5+5', displayExpression: '5+5', difficulty: 1, skillId: 'add', subSkillId: 'add.1', answerSpec: { kind: 'numeric', value: 10 } }],
  ]);

  it('validates a correct Sprint session and calculates canonical score ignoring client claims', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        { sequence: 1, questionToken: generateQuestionToken('s1', 1, 'q1', secret), rawInput: '4', clientAnsweredAt: 2000, inputLatencyMs: 1000, idempotencyKey: 'a1' },
        { sequence: 2, questionToken: generateQuestionToken('s1', 2, 'q2', secret), rawInput: '6', clientAnsweredAt: 4000, inputLatencyMs: 2000, idempotencyKey: 'a2' },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 5000,
        receivedAnswerTimes: new Map([[1, 2050], [2, 4050]]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.canonicalMetrics.correctCount).toBe(2);
    expect(out.canonicalMetrics.wrongCount).toBe(0);
    expect(out.leaderboardEligible).toBe(true);
  });

  it('rejects sessions with invalid tokens or out-of-order sequence', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        { sequence: 2, questionToken: 'invalid_tok', rawInput: '6', clientAnsweredAt: 2000, inputLatencyMs: 1000, idempotencyKey: 'a2' },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 3000,
        receivedAnswerTimes: new Map([[2, 2050]]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('REJECTED');
    expect(out.leaderboardEligible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/competitiveValidator.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `validator.ts`**

Create `src/engine/competitive/validator.ts`:
```typescript
import {
  CompetitiveSessionContract,
  SubmittedAnswerPayload,
  CompetitiveResultDoc,
} from './types';
import { Question } from '../types/question';
import { evaluateAnswer } from '../evaluator';
import { generateQuestionToken } from './stateMachine';
import { calculateSprintScore, calculateDailyScore } from './scoring';
import { getSprintDifficulty } from './modes/sprint';
import { getSurvivalDifficulty, applySurvivalTimerStep } from './modes/survival';

export interface ValidationInput {
  session: CompetitiveSessionContract;
  serverQuestions: Map<number, Question>;
  submittedAnswers: SubmittedAnswerPayload[];
  serverTimestamps: {
    startedAt: number;
    finalizedAt: number;
    receivedAnswerTimes: Map<number, number>;
  };
}

export interface ValidationOutput {
  status: 'VALIDATED' | 'REJECTED';
  rejectionReasons: string[];
  canonicalMetrics: {
    score: number;
    accuracy: number;
    correctCount: number;
    wrongCount: number;
    questionsAnswered: number;
    rankedActiveDurationMs: number;
    maxStreak: number;
    difficultyReached: number;
  };
  leaderboardEligible: boolean;
  result: CompetitiveResultDoc;
}

export function validateCompetitiveSession(
  input: ValidationInput,
  secret: string
): ValidationOutput {
  const reasons: string[] = [];
  const { session, serverQuestions, submittedAnswers, serverTimestamps } = input;

  // 1. Sequence Contiguity Check
  for (let i = 0; i < submittedAnswers.length; i++) {
    const expectedSeq = i + 1;
    const ans = submittedAnswers[i];
    if (ans.sequence !== expectedSeq) {
      reasons.push(`Sequence non-contiguous: expected ${expectedSeq}, got ${ans.sequence}`);
      break;
    }
  }

  // 2. Token Integrity & Server Question Existence
  for (const ans of submittedAnswers) {
    const q = serverQuestions.get(ans.sequence);
    if (!q) {
      reasons.push(`Unknown question sequence ${ans.sequence}`);
      continue;
    }
    const expectedToken = generateQuestionToken(session.sessionId, ans.sequence, q.id, secret);
    if (ans.questionToken !== expectedToken) {
      reasons.push(`Invalid question token for sequence ${ans.sequence}`);
    }
  }

  // 3. Deadline Check
  const maxAllowedTime = session.serverDeadlineAt;
  for (const ans of submittedAnswers) {
    const serverReceived = serverTimestamps.receivedAnswerTimes.get(ans.sequence) ?? serverTimestamps.finalizedAt;
    if (serverReceived > maxAllowedTime + 500) { // 500ms grace window for network transit
      reasons.push(`Answer sequence ${ans.sequence} received after server deadline`);
    }
  }

  // 4. Authoritative Evaluation & Metrics
  let correctCount = 0;
  let wrongCount = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  let totalScore = 0;
  let survivalTimerMs = 60000;
  let difficultyReached = 1;

  for (const ans of submittedAnswers) {
    const q = serverQuestions.get(ans.sequence);
    if (!q) continue;

    const evalResult = evaluateAnswer(ans.rawInput, q.answerSpec);
    const isCorrect = evalResult.status === 'CORRECT';

    if (isCorrect) {
      correctCount++;
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);

      if (session.mode === 'sprint') {
        const diff = getSprintDifficulty(correctCount);
        difficultyReached = Math.max(difficultyReached, diff);
        totalScore += calculateSprintScore(diff, currentStreak);
      } else if (session.mode === 'survival') {
        const diff = getSurvivalDifficulty(correctCount);
        difficultyReached = Math.max(difficultyReached, diff);
        totalScore += calculateSprintScore(diff, currentStreak);
        survivalTimerMs = applySurvivalTimerStep(survivalTimerMs, true);
      }
    } else {
      wrongCount++;
      currentStreak = 0;
      if (session.mode === 'survival') {
        survivalTimerMs = applySurvivalTimerStep(survivalTimerMs, false);
      }
    }
  }

  const questionsAnswered = correctCount + wrongCount;
  const accuracy = questionsAnswered > 0 ? (correctCount / questionsAnswered) * 100 : 0;

  // Active duration calculation
  let rankedActiveDurationMs = serverTimestamps.finalizedAt - serverTimestamps.startedAt;
  if (session.mode === 'daily') {
    if (questionsAnswered === 10) {
      const lastAnswerTime = serverTimestamps.receivedAnswerTimes.get(10) ?? serverTimestamps.finalizedAt;
      rankedActiveDurationMs = Math.min(90000, Math.max(0, lastAnswerTime - serverTimestamps.startedAt));
    } else {
      rankedActiveDurationMs = 90000;
    }
    const dailyScoreRes = calculateDailyScore(correctCount, maxStreak, rankedActiveDurationMs);
    totalScore = dailyScoreRes.score;
  } else if (session.mode === 'sprint') {
    rankedActiveDurationMs = Math.min(60000, rankedActiveDurationMs);
  }

  const isValid = reasons.length === 0;
  const status = isValid ? 'VALIDATED' : 'REJECTED';

  const result: CompetitiveResultDoc = {
    resultId: `res_${session.sessionId}`,
    sessionId: session.sessionId,
    userId: session.userId,
    mode: session.mode,
    status,
    isRanked: session.isRanked && isValid,
    score: totalScore,
    accuracy,
    correctCount,
    wrongCount,
    questionsAnswered,
    rankedActiveDurationMs,
    maxStreak,
    difficultyReached,
    rejectionReasons: reasons,
    finalizedAt: serverTimestamps.finalizedAt,
    rulesVersion: session.rulesVersion,
    contentVersion: session.contentVersion,
    challengeId: session.challengeId,
  };

  return {
    status,
    rejectionReasons: reasons,
    canonicalMetrics: {
      score: totalScore,
      accuracy,
      correctCount,
      wrongCount,
      questionsAnswered,
      rankedActiveDurationMs,
      maxStreak,
      difficultyReached,
    },
    leaderboardEligible: isValid && session.isRanked,
    result,
  };
}
```

Update `src/engine/competitive/index.ts`:
```typescript
export * from './types';
export * from './scoring';
export * from './modes/sprint';
export * from './modes/survival';
export * from './modes/daily';
export * from './stateMachine';
export * from './validator';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/competitiveValidator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/engine/competitive/validator.ts src/engine/competitive/index.ts tests/unit/competitiveValidator.test.ts
git commit -m "feat(competitive): implement authoritative server-side validation and anti-cheat pipeline

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Leaderboard Projection & Firestore Security Rules

**Files:**
- Create: `src/engine/competitive/projection.ts`
- Modify: `src/engine/competitive/index.ts`
- Modify: `firestore.rules`
- Test: `tests/unit/competitiveProjection.test.ts`
- Test: `tests/unit/competitiveRules.test.ts`

**Interfaces:**
- Produces:
  - `generateLeaderboardEntryId(mode: string, periodKey: string, rulesVersion: string, contentVersion: string, subjectId: string): string`
  - `projectToLeaderboardEntry(result: CompetitiveResultDoc, pseudonym: string, periodKey: string, secret: string): LeaderboardEntryDoc`
  - `shouldReplaceLeaderboardEntry(existing: LeaderboardEntryDoc | null, candidate: LeaderboardEntryDoc): boolean`

- [ ] **Step 1: Write failing test for leaderboard projection**

```typescript
// tests/unit/competitiveProjection.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateLeaderboardEntryId,
  projectToLeaderboardEntry,
  shouldReplaceLeaderboardEntry,
} from '../../src/engine/competitive/projection';
import { CompetitiveResultDoc } from '../../src/engine/competitive/types';

describe('Competitive Leaderboard Projection', () => {
  const secret = 'proj-secret';

  it('creates sanitized public projection stripped of sensitive user identifiers', () => {
    const res: CompetitiveResultDoc = {
      resultId: 'res_1',
      sessionId: 'sess_1',
      userId: 'secret_user_uid_123',
      mode: 'sprint',
      status: 'VALIDATED',
      isRanked: true,
      score: 2000,
      accuracy: 95,
      correctCount: 19,
      wrongCount: 1,
      questionsAnswered: 20,
      rankedActiveDurationMs: 60000,
      maxStreak: 15,
      difficultyReached: 4,
      rejectionReasons: [],
      finalizedAt: 1700000000,
      rulesVersion: '1.0',
      contentVersion: '1.0',
    };

    const entry = projectToLeaderboardEntry(res, 'JuaraKilat', '2026-09-13', secret);
    expect(entry.pseudonym).toBe('JuaraKilat');
    expect(entry.score).toBe(2000);
    expect((entry as any).userId).toBeUndefined();
    expect((entry as any).sessionId).toBeUndefined();
    expect(entry.entryId).toContain('sprint_2026-09-13_1.0_1.0_');
  });

  it('correctly evaluates best-record replacement logic', () => {
    const e1 = projectToLeaderboardEntry({
      resultId: 'r1', sessionId: 's1', userId: 'u1', mode: 'sprint', status: 'VALIDATED', isRanked: true,
      score: 1500, accuracy: 90, correctCount: 18, wrongCount: 2, questionsAnswered: 20,
      rankedActiveDurationMs: 60000, maxStreak: 10, difficultyReached: 4, rejectionReasons: [],
      finalizedAt: 1000, rulesVersion: '1.0', contentVersion: '1.0',
    }, 'P1', 'all', secret);

    const betterScore = { ...e1, score: 1600, resultId: 'r2' };
    expect(shouldReplaceLeaderboardEntry(e1, betterScore)).toBe(true);

    const lowerScore = { ...e1, score: 1400, resultId: 'r3' };
    expect(shouldReplaceLeaderboardEntry(e1, lowerScore)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/competitiveProjection.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `projection.ts` and update `firestore.rules`**

Create `src/engine/competitive/projection.ts`:
```typescript
import { CompetitiveResultDoc, LeaderboardEntryDoc } from './types';
import {
  compareSprintRecords,
  compareSurvivalRecords,
  compareDailyRecords,
} from './scoring';

export function generateLeaderboardSubjectId(userId: string, secret: string): string {
  let hash = 0;
  const raw = `subj:${userId}:${secret}`;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateLeaderboardEntryId(
  mode: string,
  periodKey: string,
  rulesVersion: string,
  contentVersion: string,
  subjectId: string
): string {
  return `${mode}_${periodKey}_${rulesVersion}_${contentVersion}_${subjectId}`;
}

export function projectToLeaderboardEntry(
  result: CompetitiveResultDoc,
  pseudonym: string,
  periodKey: string,
  secret: string
): LeaderboardEntryDoc {
  const subjectId = generateLeaderboardSubjectId(result.userId, secret);
  const entryId = generateLeaderboardEntryId(
    result.mode,
    periodKey,
    result.rulesVersion,
    result.contentVersion,
    subjectId
  );

  return {
    entryId,
    mode: result.mode,
    periodKey,
    rulesVersion: result.rulesVersion,
    contentVersion: result.contentVersion,
    pseudonym: pseudonym.trim() || 'Pemain Kilat',
    score: result.score,
    accuracy: result.accuracy,
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    durationMs: result.rankedActiveDurationMs,
    finalizedAt: result.finalizedAt,
    resultId: result.resultId,
  };
}

function entryToStubResult(e: LeaderboardEntryDoc): CompetitiveResultDoc {
  return {
    resultId: e.resultId,
    sessionId: '',
    userId: '',
    mode: e.mode,
    status: 'VALIDATED',
    isRanked: true,
    score: e.score,
    accuracy: e.accuracy,
    correctCount: e.correctCount,
    wrongCount: e.wrongCount,
    questionsAnswered: e.correctCount + e.wrongCount,
    rankedActiveDurationMs: e.durationMs,
    maxStreak: 0,
    difficultyReached: 1,
    rejectionReasons: [],
    finalizedAt: e.finalizedAt,
    rulesVersion: e.rulesVersion,
    contentVersion: e.contentVersion,
  };
}

export function shouldReplaceLeaderboardEntry(
  existing: LeaderboardEntryDoc | null,
  candidate: LeaderboardEntryDoc
): boolean {
  if (!existing) return true;
  const resExisting = entryToStubResult(existing);
  const resCandidate = entryToStubResult(candidate);

  if (candidate.mode === 'sprint') {
    return compareSprintRecords(resCandidate, resExisting) < 0;
  }
  if (candidate.mode === 'survival') {
    return compareSurvivalRecords(resCandidate, resExisting) < 0;
  }
  return compareDailyRecords(resCandidate, resExisting) < 0;
}
```

Update `firestore.rules`:
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // User progress and profile synchronization
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Competitive Sessions: strictly internal to trusted server runtime
    match /competitiveSessions/{sessionId} {
      allow read, write: if false;
    }

    // Competitive Results: player can read their own verified results; client write forbidden
    match /competitiveResults/{resultId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow write: if false;
    }

    // Public Leaderboards: readable by all; client write forbidden
    match /leaderboardEntries/{entryId} {
      allow read: if true;
      allow write: if false;
    }

    // Legacy Time Attack: maintain read-only backwards compatibility
    match /timeAttackLeaderboard/{userId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Create `tests/unit/competitiveRules.test.ts` to assert structure of security rules:
```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules for Competitive Collections', () => {
  it('strictly forbids client write access to competitive collections', () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    const content = fs.readFileSync(rulesPath, 'utf8');

    // Verify /competitiveSessions deny-all
    expect(content).toContain('match /competitiveSessions/{sessionId}');
    expect(content).toMatch(/match \/competitiveSessions\/\{sessionId\}\s*\{\s*allow read, write:\s*if false;/);

    // Verify /competitiveResults client write denied
    expect(content).toContain('match /competitiveResults/{resultId}');
    expect(content).toMatch(/match \/competitiveResults\/\{resultId\}\s*\{[\s\S]*?allow write:\s*if false;/);

    // Verify /leaderboardEntries client write denied and public read allowed
    expect(content).toContain('match /leaderboardEntries/{entryId}');
    expect(content).toMatch(/match \/leaderboardEntries\/\{entryId\}\s*\{[\s\S]*?allow read:\s*if true;\s*allow write:\s*if false;/);
  });
});
```

Update `src/engine/competitive/index.ts` to export projection:
```typescript
export * from './types';
export * from './scoring';
export * from './modes/sprint';
export * from './modes/survival';
export * from './modes/daily';
export * from './stateMachine';
export * from './validator';
export * from './projection';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/competitiveProjection.test.ts tests/unit/competitiveRules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/engine/competitive/projection.ts src/engine/competitive/index.ts firestore.rules tests/unit/competitiveProjection.test.ts tests/unit/competitiveRules.test.ts
git commit -m "feat(competitive): implement leaderboard projections and enforce strict firestore security rules

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Comprehensive AC-COMP Invariant & Property-Based Test Suite

**Files:**
- Create: `tests/unit/competitiveInvariants.test.ts`

**Interfaces:**
- Consumes: All modules in `src/engine/competitive/`
- Verifies: `AC-COMP-01` through `AC-COMP-12`

- [ ] **Step 1: Write AC-COMP Invariant tests**

```typescript
// tests/unit/competitiveInvariants.test.ts
import { describe, it, expect } from 'vitest';
import {
  createCompetitiveSession,
  validateCompetitiveSession,
  generateQuestionToken,
  shouldReplaceLeaderboardEntry,
  projectToLeaderboardEntry,
  calculateSprintScore,
  calculateDailyScore,
} from '../../src/engine/competitive';
import { Question } from '../../src/engine/types/question';

describe('AC-COMP Invariant Suite (100+ Simulations)', () => {
  const secret = 'invariant-test-secret-2026';

  const generateMockQuestions = (count: number): Map<number, Question> => {
    const map = new Map<number, Question>();
    for (let i = 1; i <= count; i++) {
      map.set(i, {
        id: `q_${i}`,
        prompt: `${i} + ${i}`,
        displayExpression: `${i} + ${i}`,
        difficulty: Math.min(6, 1 + Math.floor(i / 5)),
        skillId: 'addition',
        subSkillId: 'addition.basic',
        answerSpec: { kind: 'numeric', value: i * 2 },
      });
    }
    return map;
  };

  it('AC-COMP-03 & AC-COMP-04: Discards client claims and rejects tampered tokens across 100 seeds', () => {
    const questions = generateMockQuestions(10);
    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `sess_${seed}`;
      const validToken = generateQuestionToken(sessionId, 1, 'q_1', secret);
      const invalidToken = 'tampered_token';

      const input = {
        session: {
          sessionId,
          userId: `u_${seed}`,
          mode: 'sprint' as const,
          rulesVersion: '1.0',
          contentVersion: '1.0',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000,
          status: 'PENDING' as const,
          isRanked: true,
          idempotencyKey: `fin_${seed}`,
        },
        serverQuestions: questions,
        submittedAnswers: [
          { sequence: 1, questionToken: seed % 2 === 0 ? validToken : invalidToken, rawInput: '2', clientAnsweredAt: 2000, inputLatencyMs: 1000, idempotencyKey: `a1_${seed}` }
        ],
        serverTimestamps: {
          startedAt: 1000,
          finalizedAt: 3000,
          receivedAnswerTimes: new Map([[1, 2050]]),
        },
      };

      const out = validateCompetitiveSession(input, secret);
      if (seed % 2 === 0) {
        expect(out.status).toBe('VALIDATED');
        expect(out.canonicalMetrics.correctCount).toBe(1);
      } else {
        expect(out.status).toBe('REJECTED');
        expect(out.leaderboardEligible).toBe(false);
      }
    }
  });

  it('AC-COMP-05: Idempotency simulation produces exact same validation result', () => {
    const questions = generateMockQuestions(5);
    const input = {
      session: {
        sessionId: 'idem_sess',
        userId: 'u_idem',
        mode: 'sprint' as const,
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING' as const,
        isRanked: true,
        idempotencyKey: 'fin_idem',
      },
      serverQuestions: questions,
      submittedAnswers: [
        { sequence: 1, questionToken: generateQuestionToken('idem_sess', 1, 'q_1', secret), rawInput: '2', clientAnsweredAt: 2000, inputLatencyMs: 1000, idempotencyKey: 'a1' },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 3000,
        receivedAnswerTimes: new Map([[1, 2050]]),
      },
    };

    const out1 = validateCompetitiveSession(input, secret);
    const out2 = validateCompetitiveSession(input, secret);
    expect(out1.result).toEqual(out2.result);
  });

  it('AC-COMP-07: Rejects answers received after Sprint server deadline', () => {
    const questions = generateMockQuestions(5);
    const input = {
      session: {
        sessionId: 'sprint_deadline',
        userId: 'u1',
        mode: 'sprint' as const,
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000, // 60s
        status: 'PENDING' as const,
        isRanked: true,
        idempotencyKey: 'fin_deadline',
      },
      serverQuestions: questions,
      submittedAnswers: [
        { sequence: 1, questionToken: generateQuestionToken('sprint_deadline', 1, 'q_1', secret), rawInput: '2', clientAnsweredAt: 62000, inputLatencyMs: 2000, idempotencyKey: 'a1' },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 63000,
        receivedAnswerTimes: new Map([[1, 62500]]), // Past 61000 deadline + grace
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('REJECTED');
    expect(out.rejectionReasons.some((r) => r.includes('deadline'))).toBe(true);
  });

  it('AC-COMP-10 & AC-COMP-11: Public projections contain zero identity leaks and separate scope partitions', () => {
    const questions = generateMockQuestions(1);
    const res = validateCompetitiveSession({
      session: {
        sessionId: 'priv_sess',
        userId: 'super_secret_auth_uid',
        mode: 'sprint',
        rulesVersion: '2.0',
        contentVersion: 'v2.1',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_p',
      },
      serverQuestions: questions,
      submittedAnswers: [
        { sequence: 1, questionToken: generateQuestionToken('priv_sess', 1, 'q_1', secret), rawInput: '2', clientAnsweredAt: 2000, inputLatencyMs: 1000, idempotencyKey: 'a1' }
      ],
      serverTimestamps: { startedAt: 1000, finalizedAt: 3000, receivedAnswerTimes: new Map([[1, 2050]]) },
    }, secret).result;

    const proj = projectToLeaderboardEntry(res, 'AnonymousSpeedster', '2026-09-13', secret);
    expect(JSON.stringify(proj)).not.toContain('super_secret_auth_uid');
    expect(JSON.stringify(proj)).not.toContain('priv_sess');
    expect(proj.entryId.startsWith('sprint_2026-09-13_2.0_v2.1_')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/unit/competitiveInvariants.test.ts`
Expected: PASS with all tests passing.

- [ ] **Step 3: Commit changes**

```bash
git add tests/unit/competitiveInvariants.test.ts
git commit -m "test(competitive): add comprehensive AC-COMP invariant test suite across 100+ simulations

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Full Verification, Clean Build, and Memory Update

**Files:**
- Modify: `memory/v2-milestone-e-competitive-modes.md`

- [ ] **Step 1: Run TypeScript typecheck across entire project**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 2: Run full test suite across entire project**

Run: `npm test`
Expected: All tests pass across all test files.

- [ ] **Step 3: Run production build check**

Run: `npm run build`
Expected: Exit code 0, dist generated.

- [ ] **Step 4: Update memory record**

Update `memory/v2-milestone-e-competitive-modes.md` to record completed scope, passed invariant criteria, and test metrics.

- [ ] **Step 5: Commit changes**

```bash
git add memory/
git commit -m "docs(competitive): update memory records for completed Milestone V2.3

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
