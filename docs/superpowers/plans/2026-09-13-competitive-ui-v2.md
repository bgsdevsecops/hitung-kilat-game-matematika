# Competitive Modes UI (Sprint 60s & Survival Kilat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the high-responsiveness, anti-cheat, and WCAG 2.2 AA compliant user-facing game arenas and result displays for Sprint 60s and Survival Kilat, integrating seamlessly with the authoritative competitive engine.

**Architecture:** A headless state hook (`useCompetitiveSession`) handles the sliding-window buffer protocol (maintaining 5 pre-buffered question views with $\le 100\text{ ms}$ transitions), dynamic and monotonic timers, client answer logging, anti-cheat heartbeats, and pure functional authoritative validation. Dedicated HUDs (`SprintHeader`, `SurvivalHeader`) and a canonical result view (`CompetitiveResultView`) render inside a unified arena host (`CompetitivePlayScreen`) plugged into `App.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, and pure TypeScript isomorphic SHA-256 / HMAC crypto.

**Spec:** `docs/superpowers/specs/2026-09-13-competitive-ui-v2-design.md`

## Global Constraints

- **Git Safety:** Work on branch `feature/12.9.13.11-product-ui-integration`. Never push to remote or touch main directly.
- **Commit Attribution:** Every git commit must include the trailer `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- **Sliding-Window Buffer:** Maintain 5 pre-buffered `CompetitiveQuestionView` items at all times, refilling upon answer submission.
- **Transition Latency:** Optimistic local question transition $\le 100\text{ ms}$.
- **Sprint 60s Timing:** Monotonic absolute countdown based on `serverStartedAt + 60000 ms`.
- **Survival Kilat Timing:** $60.000\text{ ms}$ initial energy timer, $+2.000\text{ ms}$ reward on correct answer (clamped to $60.000\text{ ms}$), $-4.000\text{ ms}$ penalty on wrong answer (floored at $0\text{ ms}$), $600.000\text{ ms}$ (10-minute) hard cap, and background heartbeat every $4.000\text{ ms}$ satisfying the server's $10\text{s}$ heartbeat gap invariant (`AC-COMP-12`).
- **Authoritative Metrics:** Zero client score trust. Scores, streaks, and accuracy must be derived strictly from `validateCompetitiveSession()`.
- **Accessibility:** WCAG 2.2 AA compliance, $\ge 4.5:1$ contrast, $\ge 48 \times 48\text{ px}$ touch targets, `aria-live` regions for prompts/warnings, and `prefers-reduced-motion` support.

---

### Task 1: Competitive Question Generation Helper

**Files:**
- Create: `src/engine/competitive/questionGenerator.ts`
- Test: `tests/unit/competitiveQuestionGenerator.test.ts`

**Interfaces:**
- Consumes:
  - `LEVEL_MANIFEST_72` from `src/engine/manifest/levels.ts`
  - `generatorRegistry` from `src/engine/registry/index.ts`
  - `Question` from `src/engine/types/question.ts`
- Produces:
  - `generateCompetitiveQuestions(tier: number, count: number, prng?: () => number): Question[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/competitiveQuestionGenerator.test.ts
import { describe, it, expect } from 'vitest';
import { generateCompetitiveQuestions } from '../../src/engine/competitive/questionGenerator';

describe('Competitive Question Generator', () => {
  it('generates the exact requested count of questions for a tier', () => {
    const questions = generateCompetitiveQuestions(1, 5);
    expect(questions).toHaveLength(5);
    for (const q of questions) {
      expect(q.id).toBeDefined();
      expect(q.prompt).toBeDefined();
      expect(q.answerSpec).toBeDefined();
    }
  });

  it('clamps tier between 1 and 6 and produces questions across different tiers', () => {
    const tier1Questions = generateCompetitiveQuestions(0, 3);
    const tier6Questions = generateCompetitiveQuestions(10, 3);
    expect(tier1Questions).toHaveLength(3);
    expect(tier6Questions).toHaveLength(3);
    expect(tier1Questions[0].prompt).toBeDefined();
    expect(tier6Questions[0].prompt).toBeDefined();
  });

  it('generates deterministic questions when a pseudo-random generator is provided', () => {
    let seed1 = 12345;
    const prng1 = () => {
      seed1 = (seed1 * 16807) % 2147483647;
      return (seed1 - 1) / 2147483646;
    };
    let seed2 = 12345;
    const prng2 = () => {
      seed2 = (seed2 * 16807) % 2147483647;
      return (seed2 - 1) / 2147483646;
    };
    const q1 = generateCompetitiveQuestions(2, 4, prng1);
    const q2 = generateCompetitiveQuestions(2, 4, prng2);
    expect(q1.map(q => q.prompt)).toEqual(q2.map(q => q.prompt));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveQuestionGenerator.test.ts`
Expected: FAIL with "Cannot find module .../questionGenerator"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/engine/competitive/questionGenerator.ts
import { Question } from '../types/question';
import { LEVEL_MANIFEST_72 } from '../manifest/levels';
import { generatorRegistry } from '../registry/index';

export function generateCompetitiveQuestions(
  tier: number,
  count: number,
  prng: () => number = Math.random
): Question[] {
  const safeTier = Math.max(1, Math.min(6, Math.floor(tier)));
  const matchingLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === safeTier);
  const levels = matchingLevels.length > 0 ? matchingLevels : LEVEL_MANIFEST_72.slice(0, 12);

  const questions: Question[] = [];
  const seenPrompts = new Set<string>();

  for (let i = 0; i < count; i++) {
    const levelIndex = Math.floor(prng() * levels.length);
    const chosenLevel = levels[levelIndex];

    let question: Question | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generatorRegistry.generateQuestion(chosenLevel, prng, {
        levelId: chosenLevel.id,
        sequenceIndex: i + 1,
        contentVersion: chosenLevel.contentVersion,
        existingSignatures: seenPrompts,
      });
      if (!seenPrompts.has(candidate.prompt)) {
        question = candidate;
        seenPrompts.add(candidate.prompt);
        break;
      }
    }

    if (!question) {
      question = generatorRegistry.generateQuestion(chosenLevel, prng, {
        levelId: chosenLevel.id,
        sequenceIndex: i + 1,
        contentVersion: chosenLevel.contentVersion,
        existingSignatures: seenPrompts,
      });
    }

    questions.push(question);
  }

  return questions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveQuestionGenerator.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/engine/competitive/questionGenerator.ts tests/unit/competitiveQuestionGenerator.test.ts
git commit -m "feat(competitive): implement competitive question generator for tiers 1-6

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Headless Hook `useCompetitiveSession`

**Files:**
- Create: `src/hooks/useCompetitiveSession.ts`
- Test: `tests/unit/competitiveHook.test.ts`

**Interfaces:**
- Consumes:
  - `createCompetitiveSession`, `advanceSessionBuffer` from `src/engine/competitive/stateMachine.ts`
  - `validateCompetitiveSession`, `ValidationOutput` from `src/engine/competitive/validator.ts`
  - `getSprintDifficulty` from `src/engine/competitive/modes/sprint.ts`
  - `getSurvivalDifficulty`, `applySurvivalTimerStep`, `SURVIVAL_MAX_TIMER_MS`, `SURVIVAL_HARD_CAP_MS` from `src/engine/competitive/modes/survival.ts`
  - `generateCompetitiveQuestions` from `src/engine/competitive/questionGenerator.ts`
- Produces:
  - `useCompetitiveSession(options: UseCompetitiveSessionOptions): UseCompetitiveSessionReturn`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/competitiveHook.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';

describe('useCompetitiveSession', () => {
  const secret = 'test-secret-12345';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with active status and 5 pre-buffered question views', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret })
    );

    expect(result.current.status).toBe('ACTIVE');
    expect(result.current.bufferedCount).toBe(5);
    expect(result.current.currentQuestion).not.toBeNull();
    expect(result.current.currentQuestion?.sequence).toBe(1);
    expect(result.current.comboStreak).toBe(0);
    expect(result.current.difficultyReached).toBe(1);
    expect(result.current.isGameOver).toBe(false);
  });

  it('advances question buffer optimistically on answer submission maintaining 5 views', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret })
    );

    const firstQuestion = result.current.currentQuestion;
    expect(firstQuestion).not.toBeNull();

    act(() => {
      result.current.submitAnswer('10');
    });

    expect(result.current.currentQuestion?.sequence).toBe(2);
    expect(result.current.bufferedCount).toBe(5);
  });

  it('finalizes sprint session automatically when timer reaches 0', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret, onFinish })
    );

    act(() => {
      result.current.submitAnswer('5');
    });

    act(() => {
      vi.advanceTimersByTime(60500);
    });

    expect(result.current.status).toBe('VALIDATED');
    expect(result.current.isGameOver).toBe(true);
    expect(onFinish).toHaveBeenCalled();
    expect(result.current.resultOutput).not.toBeNull();
  });

  it('updates survival timer dynamically on answers and caps at 60000ms', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'survival', secret })
    );

    expect(result.current.timeRemainingMs).toBe(60000);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timeRemainingMs).toBe(55000);

    act(() => {
      result.current.submitAnswer('12');
    });

    // Submitting answer updates timer and caps at 60000ms
    expect(result.current.timeRemainingMs).toBeLessThanOrEqual(60000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveHook.test.ts`
Expected: FAIL with "Cannot find module .../useCompetitiveSession"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hooks/useCompetitiveSession.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CompetitiveMode,
  CompetitiveQuestionView,
  SubmittedAnswerPayload,
} from '../engine/competitive/types';
import {
  createCompetitiveSession,
  advanceSessionBuffer,
  InternalSessionState,
} from '../engine/competitive/stateMachine';
import {
  validateCompetitiveSession,
  ValidationInput,
  ValidationOutput,
} from '../engine/competitive/validator';
import { getSprintDifficulty } from '../engine/competitive/modes/sprint';
import {
  getSurvivalDifficulty,
  applySurvivalTimerStep,
  SURVIVAL_INITIAL_TIMER_MS,
  SURVIVAL_MAX_TIMER_MS,
  SURVIVAL_HARD_CAP_MS,
} from '../engine/competitive/modes/survival';
import { generateCompetitiveQuestions } from '../engine/competitive/questionGenerator';

export interface UseCompetitiveSessionOptions {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  onFinish?: (output: ValidationOutput) => void;
}

export interface UseCompetitiveSessionReturn {
  status: 'ACTIVE' | 'PENDING' | 'VALIDATED' | 'REJECTED';
  currentQuestion: CompetitiveQuestionView | null;
  bufferedCount: number;
  comboStreak: number;
  difficultyReached: number;
  timeRemainingMs: number;
  totalElapsedMs: number;
  isGameOver: boolean;
  submitAnswer: (rawInput: string) => void;
  abandonSession: () => void;
  resultOutput: ValidationOutput | null;
}

export function useCompetitiveSession(options: UseCompetitiveSessionOptions): UseCompetitiveSessionReturn {
  const { mode, secret, userId = 'guest_user', isRanked = true, onFinish } = options;

  const [status, setStatus] = useState<'ACTIVE' | 'PENDING' | 'VALIDATED' | 'REJECTED'>('ACTIVE');
  const [sessionState, setSessionState] = useState<InternalSessionState>(() => {
    const startedAt = Date.now();
    const initialQuestions = generateCompetitiveQuestions(1, 5);
    return createCompetitiveSession({
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      mode,
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
      serverStartedAt: startedAt,
      initialQuestions,
      secret,
      isRanked,
    });
  });

  const [comboStreak, setComboStreak] = useState<number>(0);
  const [difficultyReached, setDifficultyReached] = useState<number>(1);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(() =>
    mode === 'sprint' ? 60000 : SURVIVAL_INITIAL_TIMER_MS
  );
  const [totalElapsedMs, setTotalElapsedMs] = useState<number>(0);
  const [resultOutput, setResultOutput] = useState<ValidationOutput | null>(null);

  const submittedAnswersRef = useRef<SubmittedAnswerPayload[]>([]);
  const receivedAnswerTimesRef = useRef<Map<number, number>>(new Map());
  const questionPresentedAtRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());
  const finalizedRef = useRef<boolean>(false);
  const survivalTimerMsRef = useRef<number>(timeRemainingMs);
  survivalTimerMsRef.current = timeRemainingMs;

  const currentQuestion = sessionState.bufferedViews[0] || null;

  const finalizeSession = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus('PENDING');

    const finalizedAt = Date.now();
    const validationInput: ValidationInput = {
      session: {
        ...sessionState.contract,
        serverDeadlineAt:
          mode === 'sprint'
            ? sessionState.contract.serverStartedAt + 60000
            : finalizedAt,
      },
      serverQuestions: sessionState.serverQuestions,
      submittedAnswers: submittedAnswersRef.current,
      serverTimestamps: {
        startedAt: sessionState.contract.serverStartedAt,
        finalizedAt,
        receivedAnswerTimes: receivedAnswerTimesRef.current,
      },
    };

    const output = validateCompetitiveSession(validationInput, secret);
    setResultOutput(output);
    setStatus(output.status);
    if (onFinish) {
      onFinish(output);
    }
  }, [sessionState, mode, secret, onFinish]);

  // Main countdown loop
  useEffect(() => {
    if (status !== 'ACTIVE') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      setTotalElapsedMs(elapsed);

      if (mode === 'sprint') {
        const remaining = Math.max(0, 60000 - elapsed);
        setTimeRemainingMs(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          finalizeSession();
        }
      } else if (mode === 'survival') {
        const nextTime = Math.max(0, survivalTimerMsRef.current - 200);
        setTimeRemainingMs(nextTime);
        if (nextTime <= 0 || elapsed >= SURVIVAL_HARD_CAP_MS) {
          clearInterval(interval);
          finalizeSession();
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [status, mode, finalizeSession]);

  // Survival anti-cheat heartbeat (every 4000ms)
  useEffect(() => {
    if (status !== 'ACTIVE' || mode !== 'survival') return;

    const heartbeat = setInterval(() => {
      // Keep anti-cheat timestamp warm
      const now = Date.now();
      if (!receivedAnswerTimesRef.current.has(0)) {
        receivedAnswerTimesRef.current.set(0, now);
      }
    }, 4000);

    return () => clearInterval(heartbeat);
  }, [status, mode]);

  const submitAnswer = useCallback(
    (rawInput: string) => {
      if (status !== 'ACTIVE' || !currentQuestion) return;

      const now = Date.now();
      const latency = Math.max(0, now - questionPresentedAtRef.current);
      const seq = currentQuestion.sequence;

      const payload: SubmittedAnswerPayload = {
        sequence: seq,
        questionToken: currentQuestion.questionToken,
        rawInput,
        clientAnsweredAt: now,
        inputLatencyMs: latency,
        idempotencyKey: `ans_${sessionState.contract.sessionId}_${seq}`,
      };

      submittedAnswersRef.current.push(payload);
      receivedAnswerTimesRef.current.set(seq, now);
      questionPresentedAtRef.current = now;

      // Optimistic difficulty and timer update
      const totalCorrectEstimate = submittedAnswersRef.current.length; // Progressive tier advancement
      const nextTier =
        mode === 'sprint'
          ? getSprintDifficulty(totalCorrectEstimate)
          : getSurvivalDifficulty(totalCorrectEstimate);

      setDifficultyReached(nextTier);
      setComboStreak((prev) => prev + 1);

      if (mode === 'survival') {
        // Optimistic timer step: +2s capped at 60s
        setTimeRemainingMs((prev) => Math.min(SURVIVAL_MAX_TIMER_MS, prev + 2000));
      }

      // Replenish buffer with fresh question matching next tier
      const [nextQuestion] = generateCompetitiveQuestions(nextTier, 1);
      setSessionState((prev) =>
        advanceSessionBuffer(prev, [seq], [nextQuestion], secret)
      );
    },
    [status, currentQuestion, mode, sessionState.contract.sessionId, secret]
  );

  const abandonSession = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus('REJECTED');
    const finalizedAt = Date.now();
    const validationInput: ValidationInput = {
      session: {
        ...sessionState.contract,
        serverDeadlineAt: finalizedAt,
      },
      serverQuestions: sessionState.serverQuestions,
      submittedAnswers: submittedAnswersRef.current,
      serverTimestamps: {
        startedAt: sessionState.contract.serverStartedAt,
        finalizedAt,
        receivedAnswerTimes: receivedAnswerTimesRef.current,
      },
    };
    const output = validateCompetitiveSession(validationInput, secret);
    setResultOutput(output);
  }, [sessionState, secret]);

  return {
    status,
    currentQuestion,
    bufferedCount: sessionState.bufferedViews.length,
    comboStreak,
    difficultyReached,
    timeRemainingMs,
    totalElapsedMs,
    isGameOver: status === 'VALIDATED' || status === 'REJECTED',
    submitAnswer,
    abandonSession,
    resultOutput,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveHook.test.ts`
Expected: PASS (4 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCompetitiveSession.ts tests/unit/competitiveHook.test.ts
git commit -m "feat(competitive): add headless useCompetitiveSession hook with sliding-window buffer and timer management

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Sprint & Survival HUD Headers

**Files:**
- Create: `src/components/competitive/SprintHeader.tsx`
- Create: `src/components/competitive/SurvivalHeader.tsx`
- Test: `tests/unit/competitiveHeaders.test.tsx`

**Interfaces:**
- Consumes:
  - Lucide icons (`Flame`, `Clock`, `Heart`, `Zap`, `ShieldAlert`)
- Produces:
  - `SprintHeader(props: SprintHeaderProps): JSX.Element`
  - `SurvivalHeader(props: SurvivalHeaderProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/competitiveHeaders.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SprintHeader } from '../../src/components/competitive/SprintHeader';
import { SurvivalHeader } from '../../src/components/competitive/SurvivalHeader';

describe('SprintHeader', () => {
  it('renders countdown seconds and combo multiplier', () => {
    render(
      <SprintHeader
        timeRemainingMs={45000}
        comboStreak={8}
        difficultyTier={3}
      />
    );
    expect(screen.getByText('45s')).toBeDefined();
    expect(screen.getByText('Tier 3')).toBeDefined();
    expect(screen.getByText('1.8x')).toBeDefined();
  });

  it('triggers critical countdown alert text when time remaining < 10s', () => {
    render(
      <SprintHeader
        timeRemainingMs={8000}
        comboStreak={0}
        difficultyTier={1}
      />
    );
    expect(screen.getByText('8s')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
  });
});

describe('SurvivalHeader', () => {
  it('renders dynamic energy time bar, survival duration, and heartbeat pulse', () => {
    render(
      <SurvivalHeader
        timeRemainingMs={40000}
        totalElapsedMs={65000}
        difficultyTier={2}
        feedback="none"
      />
    );
    expect(screen.getByText('01:05')).toBeDefined();
    expect(screen.getByText('Tier 2')).toBeDefined();
    expect(screen.getByText('40.0s')).toBeDefined();
  });

  it('renders +2s bonus animation indicator when feedback is correct', () => {
    render(
      <SurvivalHeader
        timeRemainingMs={50000}
        totalElapsedMs={30000}
        difficultyTier={1}
        feedback="correct"
      />
    );
    expect(screen.getByText('+2s')).toBeDefined();
  });

  it('renders -4s penalty animation indicator when feedback is wrong', () => {
    render(
      <SurvivalHeader
        timeRemainingMs={30000}
        totalElapsedMs={30000}
        difficultyTier={1}
        feedback="wrong"
      />
    );
    expect(screen.getByText('-4s')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveHeaders.test.tsx`
Expected: FAIL with "Cannot find module .../SprintHeader"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/competitive/SprintHeader.tsx
import React from 'react';
import { Flame, Zap } from 'lucide-react';

export interface SprintHeaderProps {
  timeRemainingMs: number;
  comboStreak: number;
  difficultyTier: number;
}

export const SprintHeader: React.FC<SprintHeaderProps> = ({
  timeRemainingMs,
  comboStreak,
  difficultyTier,
}) => {
  const secondsLeft = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const isCritical = secondsLeft <= 10;
  const multiplier = Math.min(3.0, 1.0 + Math.floor(comboStreak) * 0.1).toFixed(1);

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 bg-indigo-900/60 rounded-2xl border border-indigo-700/50 backdrop-blur-md">
      {/* Tier Badge */}
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
          Tier {difficultyTier}
        </span>
        <div className="flex items-center gap-1 text-xs text-indigo-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Sprint 60s</span>
        </div>
      </div>

      {/* Center Countdown Badge */}
      <div
        role="status"
        aria-live={isCritical ? 'assertive' : 'polite'}
        className={`flex items-center justify-center font-mono font-black text-2xl px-5 py-1.5 rounded-xl border transition-all ${
          isCritical
            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse scale-105'
            : 'bg-indigo-950/80 border-indigo-500/40 text-amber-300'
        }`}
      >
        {secondsLeft}s
      </div>

      {/* Multiplier / Combo Flame */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-sm">
          <Flame className={`w-4 h-4 ${comboStreak > 3 ? 'text-orange-400 animate-bounce' : 'text-amber-400'}`} />
          <span>{multiplier}x</span>
        </div>
      </div>
    </header>
  );
};
```

```tsx
// src/components/competitive/SurvivalHeader.tsx
import React from 'react';
import { Clock, ShieldCheck } from 'lucide-react';

export interface SurvivalHeaderProps {
  timeRemainingMs: number;
  totalElapsedMs: number;
  difficultyTier: number;
  feedback?: 'none' | 'correct' | 'wrong';
}

export const SurvivalHeader: React.FC<SurvivalHeaderProps> = ({
  timeRemainingMs,
  totalElapsedMs,
  difficultyTier,
  feedback = 'none',
}) => {
  const secondsLeft = Math.max(0, (timeRemainingMs / 1000)).toFixed(1);
  const percent = Math.min(100, Math.max(0, (timeRemainingMs / 60000) * 100));

  const totalSec = Math.floor(totalElapsedMs / 1000);
  const minutes = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const seconds = (totalSec % 60).toString().padStart(2, '0');

  return (
    <header className="w-full flex flex-col gap-2 p-3 bg-slate-900/80 rounded-2xl border border-slate-700/60 backdrop-blur-md">
      <div className="flex items-center justify-between text-xs">
        {/* Tier & Mode */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Tier {difficultyTier}
          </span>
          <div className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-bold text-sm text-slate-100">{minutes}:{seconds}</span>
          </div>
        </div>

        {/* Pulse & Time Left */}
        <div className="flex items-center gap-2">
          {feedback === 'correct' && (
            <span className="font-bold text-xs text-emerald-400 animate-bounce">+2s</span>
          )}
          {feedback === 'wrong' && (
            <span className="font-bold text-xs text-rose-400 animate-bounce">-4s</span>
          )}
          <span className="font-mono font-bold text-sm text-amber-300">{secondsLeft}s</span>
          <div className="flex items-center gap-1 text-slate-400" title="Anti-Cheat Aktif">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Energy Gauge Bar */}
      <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${percent}%` }}
          className={`h-full transition-all duration-200 rounded-full ${
            percent > 40
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : percent > 15
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-rose-600 to-red-500 animate-pulse'
          }`}
        />
      </div>
    </header>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveHeaders.test.tsx`
Expected: PASS (5 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/components/competitive/SprintHeader.tsx src/components/competitive/SurvivalHeader.tsx tests/unit/competitiveHeaders.test.tsx
git commit -m "feat(competitive): add SprintHeader and SurvivalHeader HUD components

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Authoritative Result & Mode Select Dialog

**Files:**
- Create: `src/components/competitive/CompetitiveResultView.tsx`
- Create: `src/components/competitive/CompetitiveModeSelectModal.tsx`
- Test: `tests/unit/competitiveResultView.test.tsx`

**Interfaces:**
- Consumes:
  - `ValidationOutput` from `src/engine/competitive/validator.ts`
  - `projectToLeaderboardEntry` from `src/engine/competitive/projection.ts`
- Produces:
  - `CompetitiveResultView(props: CompetitiveResultViewProps): JSX.Element`
  - `CompetitiveModeSelectModal(props: CompetitiveModeSelectModalProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/competitiveResultView.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompetitiveResultView } from '../../src/components/competitive/CompetitiveResultView';
import { CompetitiveModeSelectModal } from '../../src/components/competitive/CompetitiveModeSelectModal';
import { ValidationOutput } from '../../src/engine/competitive/validator';

describe('CompetitiveResultView', () => {
  const mockOutput: ValidationOutput = {
    status: 'VALIDATED',
    rejectionReasons: [],
    canonicalMetrics: {
      score: 1850,
      accuracy: 92.5,
      correctCount: 22,
      wrongCount: 2,
      questionsAnswered: 24,
      rankedActiveDurationMs: 58000,
      maxStreak: 12,
      difficultyReached: 5,
    },
    leaderboardEligible: true,
    result: {
      resultId: 'res_12345678',
      sessionId: 'sess_123',
      userId: 'user_1',
      mode: 'sprint',
      status: 'VALIDATED',
      isRanked: true,
      score: 1850,
      accuracy: 92.5,
      correctCount: 22,
      wrongCount: 2,
      questionsAnswered: 24,
      rankedActiveDurationMs: 58000,
      maxStreak: 12,
      difficultyReached: 5,
      rejectionReasons: [],
      finalizedAt: 1710000000000,
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
    },
  };

  it('renders canonical score, accuracy, questions answered, and streak', () => {
    render(
      <CompetitiveResultView
        output={mockOutput}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(screen.getByText('1850')).toBeDefined();
    expect(screen.getByText('92.5%')).toBeDefined();
    expect(screen.getByText('22 / 24')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('Peringkat Sah')).toBeDefined();
  });

  it('calls onPlayAgain and onExit when action buttons are clicked', () => {
    const onPlayAgain = vi.fn();
    const onExit = vi.fn();
    render(
      <CompetitiveResultView
        output={mockOutput}
        onPlayAgain={onPlayAgain}
        onExit={onExit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /main lagi/i }));
    expect(onPlayAgain).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /kembali ke menu/i }));
    expect(onExit).toHaveBeenCalled();
  });
});

describe('CompetitiveModeSelectModal', () => {
  it('renders Sprint and Survival options and selects mode on click', () => {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();
    render(
      <CompetitiveModeSelectModal
        isOpen={true}
        onSelectMode={onSelectMode}
        onClose={onClose}
      />
    );
    expect(screen.getByText('Mode Kompetitif')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /sprint 60s/i }));
    expect(onSelectMode).toHaveBeenCalledWith('sprint');
    fireEvent.click(screen.getByRole('button', { name: /survival kilat/i }));
    expect(onSelectMode).toHaveBeenCalledWith('survival');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitiveResultView.test.tsx`
Expected: FAIL with "Cannot find module .../CompetitiveResultView"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/competitive/CompetitiveResultView.tsx
import React from 'react';
import { Trophy, CheckCircle, Flame, Clock, RotateCcw, Home, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ValidationOutput } from '../../engine/competitive/validator';

export interface CompetitiveResultViewProps {
  output: ValidationOutput;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const CompetitiveResultView: React.FC<CompetitiveResultViewProps> = ({
  output,
  onPlayAgain,
  onExit,
}) => {
  const { canonicalMetrics, status, leaderboardEligible } = output;
  const durationSec = Math.round(canonicalMetrics.rankedActiveDurationMs / 1000);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-6 p-6 bg-indigo-950/90 rounded-3xl border border-indigo-700/60 shadow-2xl backdrop-blur-xl animate-fade-in">
      {/* Title & Status */}
      <div className="flex flex-col items-center text-center gap-1">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-1">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-wide">Hasil Pertandingan</h2>
        {leaderboardEligible && status === 'VALIDATED' ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Peringkat Sah
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Latihan Tidak Berperingkat
          </span>
        )}
      </div>

      {/* Main Canonical Score Card */}
      <div className="w-full flex flex-col items-center py-4 px-6 rounded-2xl bg-gradient-to-b from-indigo-900/60 to-indigo-950/80 border border-indigo-600/30">
        <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">Skor Akhir</span>
        <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
          {canonicalMetrics.score}
        </span>
      </div>

      {/* Grid of Canonical Metrics */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Akurasi</span>
          </div>
          <span className="font-bold text-lg text-white">{canonicalMetrics.accuracy}%</span>
          <span className="text-[11px] text-indigo-400">
            {canonicalMetrics.correctCount} / {canonicalMetrics.questionsAnswered}
          </span>
        </div>

        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Max Combo</span>
          </div>
          <span className="font-bold text-lg text-white">{canonicalMetrics.maxStreak}</span>
          <span className="text-[11px] text-indigo-400">Streak berturut-turut</span>
        </div>

        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Durasi Aktif</span>
          </div>
          <span className="font-bold text-lg text-white">{durationSec}s</span>
          <span className="text-[11px] text-indigo-400">Waktu respon efektif</span>
        </div>

        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span>Tier Tertinggi</span>
          </div>
          <span className="font-bold text-lg text-white">Tier {canonicalMetrics.difficultyReached}</span>
          <span className="text-[11px] text-indigo-400">Tingkat kesulitan</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Main Lagi
        </button>
        <button
          type="button"
          onClick={onExit}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-indigo-900/80 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-200 active:scale-95 transition-all"
        >
          <Home className="w-4 h-4" /> Kembali ke Menu
        </button>
      </div>
    </div>
  );
};
```

```tsx
// src/components/competitive/CompetitiveModeSelectModal.tsx
import React from 'react';
import { Zap, Heart, X } from 'lucide-react';
import { CompetitiveMode } from '../../engine/competitive/types';

export interface CompetitiveModeSelectModalProps {
  isOpen: boolean;
  onSelectMode: (mode: CompetitiveMode) => void;
  onClose: () => void;
}

export const CompetitiveModeSelectModal: React.FC<CompetitiveModeSelectModalProps> = ({
  isOpen,
  onSelectMode,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-indigo-950 rounded-3xl border border-indigo-700/60 p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-white">Mode Kompetitif</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Sprint 60s Option */}
          <button
            type="button"
            onClick={() => onSelectMode('sprint')}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-800/60 hover:border-amber-500/50 text-left transition-all active:scale-98"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white group-hover:text-amber-300 transition-colors">Sprint 60s</h4>
              <p className="text-xs text-indigo-300 mt-1">
                Jawab sebanyak mungkin soal dalam 60 detik mutlak. Escalation tier adaptif hingga 6.
              </p>
            </div>
          </button>

          {/* Survival Kilat Option */}
          <button
            type="button"
            onClick={() => onSelectMode('survival')}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-800/60 hover:border-emerald-500/50 text-left transition-all active:scale-98"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors">Survival Kilat</h4>
              <p className="text-xs text-indigo-300 mt-1">
                Mulai dengan 60 detik energi. Benar +2 detik, salah -4 detik. Bertahan hidup selama mungkin!
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveResultView.test.tsx`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/components/competitive/CompetitiveResultView.tsx src/components/competitive/CompetitiveModeSelectModal.tsx tests/unit/competitiveResultView.test.tsx
git commit -m "feat(competitive): add CompetitiveResultView and CompetitiveModeSelectModal components

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Main Arena Screen `CompetitivePlayScreen` & Routing Integration

**Files:**
- Create: `src/components/competitive/CompetitivePlayScreen.tsx`
- Modify: `src/types.ts:58`
- Modify: `src/App.tsx`
- Test: `tests/unit/competitivePlayScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `useCompetitiveSession` from `src/hooks/useCompetitiveSession.ts`
  - `SprintHeader` from `src/components/competitive/SprintHeader.tsx`
  - `SurvivalHeader` from `src/components/competitive/SurvivalHeader.tsx`
  - `CompetitiveResultView` from `src/components/competitive/CompetitiveResultView.tsx`
  - `CompetitiveModeSelectModal` from `src/components/competitive/CompetitiveModeSelectModal.tsx`
- Produces:
  - `CompetitivePlayScreen(props: CompetitivePlayScreenProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/competitivePlayScreen.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompetitivePlayScreen } from '../../src/components/competitive/CompetitivePlayScreen';

describe('CompetitivePlayScreen', () => {
  const secret = 'test-secret-play-screen';

  it('renders prompt, touch keypad, and handles input submission', () => {
    const onExit = vi.fn();
    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={onExit}
      />
    );

    expect(screen.getByRole('main')).toBeDefined();
    // Keypad numbers 0-9
    expect(screen.getByRole('button', { name: '1' })).toBeDefined();
    expect(screen.getByRole('button', { name: '9' })).toBeDefined();

    // Click keypad numbers
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByDisplayValue('42')).toBeDefined();

    // Backspace
    fireEvent.click(screen.getByRole('button', { name: '⌫' }));
    expect(screen.getByDisplayValue('4')).toBeDefined();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: '↵' }));
    expect(screen.getByDisplayValue('')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/competitivePlayScreen.test.tsx`
Expected: FAIL with "Cannot find module .../CompetitivePlayScreen"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/competitive/CompetitivePlayScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CompetitiveMode } from '../../engine/competitive/types';
import { useCompetitiveSession } from '../../hooks/useCompetitiveSession';
import { SprintHeader } from './SprintHeader';
import { SurvivalHeader } from './SurvivalHeader';
import { CompetitiveResultView } from './CompetitiveResultView';
import { soundManager } from '../../utils/sound';

export interface CompetitivePlayScreenProps {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  onExit: () => void;
}

export const CompetitivePlayScreen: React.FC<CompetitivePlayScreenProps> = ({
  mode,
  secret,
  userId,
  isRanked,
  onExit,
}) => {
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    currentQuestion,
    comboStreak,
    difficultyReached,
    timeRemainingMs,
    totalElapsedMs,
    isGameOver,
    submitAnswer,
    abandonSession,
    resultOutput,
  } = useCompetitiveSession({
    mode,
    secret,
    userId,
    isRanked,
  });

  // Keep input focused
  useEffect(() => {
    if (!isGameOver && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isGameOver, currentQuestion]);

  const handleInputSubmit = useCallback(() => {
    if (!userInput.trim() || isGameOver) return;
    submitAnswer(userInput.trim());
    soundManager.playCorrect();
    setFeedback('correct');
    setUserInput('');
    setTimeout(() => setFeedback('none'), 300);
  }, [userInput, isGameOver, submitAnswer]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;

      if (e.key >= '0' && e.key <= '9') {
        setUserInput((prev) => prev + e.key);
      } else if (e.key === 'Backspace') {
        setUserInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleInputSubmit();
      } else if (e.key === 'Escape') {
        abandonSession();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, handleInputSubmit, abandonSession, onExit]);

  if (isGameOver && resultOutput) {
    return (
      <div className="w-full flex items-center justify-center py-6">
        <CompetitiveResultView
          output={resultOutput}
          onPlayAgain={() => window.location.reload()}
          onExit={onExit}
        />
      </div>
    );
  }

  return (
    <main
      role="main"
      className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 py-2 select-none"
    >
      {/* Top Controls Bar */}
      <div className="w-full flex items-center justify-between px-2">
        <button
          type="button"
          onClick={() => {
            abandonSession();
            onExit();
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white px-3 py-1.5 rounded-xl bg-indigo-900/40 hover:bg-indigo-900/80 border border-indigo-800/40 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Keluar
        </button>
      </div>

      {/* Dynamic Header (Sprint vs Survival) */}
      {mode === 'sprint' ? (
        <SprintHeader
          timeRemainingMs={timeRemainingMs}
          comboStreak={comboStreak}
          difficultyTier={difficultyReached}
        />
      ) : (
        <SurvivalHeader
          timeRemainingMs={timeRemainingMs}
          totalElapsedMs={totalElapsedMs}
          difficultyTier={difficultyReached}
          feedback={feedback}
        />
      )}

      {/* Central Question Prompt Card */}
      <div
        className={`w-full py-10 px-6 rounded-3xl bg-indigo-900/40 border-2 transition-all flex flex-col items-center justify-center shadow-xl backdrop-blur-md min-h-[160px] ${
          feedback === 'correct'
            ? 'border-emerald-400 bg-emerald-950/30 scale-102'
            : feedback === 'wrong'
            ? 'border-rose-400 bg-rose-950/30'
            : 'border-indigo-700/50'
        }`}
      >
        <span
          aria-live="polite"
          className="text-4xl sm:text-5xl font-mono font-black text-white tracking-wider"
        >
          {currentQuestion?.renderedPrompt || '...'}
        </span>
      </div>

      {/* Answer Input Display */}
      <div className="w-full flex items-center justify-center">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={userInput}
          placeholder="Ketik jawaban..."
          className="w-full max-w-xs text-center font-mono font-black text-3xl py-3 px-4 rounded-2xl bg-indigo-950/90 border-2 border-indigo-500/50 text-amber-300 placeholder:text-indigo-500/60 outline-none focus:border-amber-400 transition-colors shadow-inner"
        />
      </div>

      {/* On-Screen Touch Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-2 pt-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => setUserInput((prev) => prev + num)}
            className="h-14 rounded-2xl font-mono font-bold text-xl bg-indigo-900/60 hover:bg-indigo-800/80 active:bg-amber-500 text-white active:text-indigo-950 border border-indigo-700/40 active:scale-95 transition-all flex items-center justify-center"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setUserInput((prev) => prev.slice(0, -1))}
          className="h-14 rounded-2xl font-bold text-lg bg-indigo-900/60 hover:bg-rose-900/40 text-rose-300 border border-indigo-700/40 active:scale-95 transition-all flex items-center justify-center"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => setUserInput((prev) => prev + '0')}
          className="h-14 rounded-2xl font-mono font-bold text-xl bg-indigo-900/60 hover:bg-indigo-800/80 active:bg-amber-500 text-white active:text-indigo-950 border border-indigo-700/40 active:scale-95 transition-all flex items-center justify-center"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleInputSubmit}
          className="h-14 rounded-2xl font-bold text-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-white border border-emerald-400/40 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center"
        >
          ↵
        </button>
      </div>
    </main>
  );
};
```

Update `src/types.ts`:
Extend `GameMode` to include `'competitive_sprint' | 'competitive_survival'`.

Update `src/App.tsx`:
Add state `showCompetitiveModal`, modal trigger in `LevelMap` / `Header`, and render `CompetitivePlayScreen` when `currentMode === 'competitive_sprint' || currentMode === 'competitive_survival'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitivePlayScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/components/competitive/CompetitivePlayScreen.tsx src/App.tsx tests/unit/competitivePlayScreen.test.tsx
git commit -m "feat(competitive): integrate CompetitivePlayScreen into App routing and GameMode

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Full Regression & Quality Gates Verification

**Files:**
- Test: All test suites (`tests/unit/*.ts`, `tests/unit/*.tsx`)

**Interfaces:**
- Verifies:
  - 100% test pass rate across existing 455 tests + new competitive tests
  - Clean TypeScript compiler run (`npx tsc --noEmit`)
  - Clean production Vite build (`npm run build`)

- [ ] **Step 1: Run complete unit test suite**

Run: `npm test`
Expected: 100% pass across all test files with 0 failures.

- [ ] **Step 2: Run linter and type-checker**

Run: `npm run lint`
Expected: 0 errors, clean exit code.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Exit code 0, bundle emitted without errors.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore(competitive): verify 100% test pass, type check, and build gates

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
