# Daily Challenge V2 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the end-to-end user-facing UI and orchestration for Daily Challenge V2, supporting WIB timezone synchronization, deterministic 10-puzzle generation, single-attempt ranked consumption, unified `useCompetitiveSession` integration, authoritative 4-tier score breakdown, and modular accessible views (`DailyHubView`, `DailyHeader`, `DailyResultView`, `DailyChallengeScreen`).

**Architecture:** Extend `useCompetitiveSession` to support `mode: 'daily'` using the authoritative pure functional validator (`validateCompetitiveSession`). Decouple the monolithic V1 `DailyChallengeScreen` into focused, testable components: `DailyHubView` (WIB countdown and 1x ranked badge), `DailyHeader` (segmented 10-question bar and 90s/75s timer), and `DailyResultView` (4-tier score breakdown and streak eligibility). All user actions and inputs support touch-friendly ($\ge 48\text{px}$) targets and physical keyboards.

**Tech Stack:** React 18, TypeScript 5.8+, Tailwind CSS, Vitest 5, Lucide React, Canvas Confetti.

**Spec:** `docs/superpowers/specs/2026-09-13-daily-challenge-v2-design.md`

## Global Constraints

- **Strict Branch Safety**: All work must occur on `feature/12.9.13.24-daily-challenge-v2-ui`. Never modify or commit directly on `main`/`master`.
- **WIB Timezone**: All daily windows and countdowns are calculated using `Asia/Jakarta` (UTC+7) via `Intl.DateTimeFormat`.
- **Single Ranked Attempt (Anti-Reroll)**: First session today is `isRanked: true`; subsequent sessions or abandoned attempts are `isRanked: false` (replay).
- **Authoritative Score Calculation**: Never compute scores locally in state; display 4-tier breakdown (`base`, `streakBonus`, `speedBonus`, `perfectBonus`) returned by `validateCompetitiveSession`.
- **Accessibility**: Minimum touch targets $\ge 48\text{px} \times 48\text{px}$ on all interactive controls, `aria-live="polite"` on prompts, and `motion-reduce:animate-none` on animations.
- **Mandatory Git Trailer**: All commits must conclude with:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

### Task 1: Timezone, Deterministic Question Generator, and Streak Eligibility Utilities

**Files:**
- Create: `src/utils/dailyWib.ts`
- Modify: `src/engine/competitive/modes/daily.ts`
- Test: `tests/unit/dailyChallengeEngine.test.ts`

**Interfaces:**
- Consumes: `Question` from `src/types.ts`, `DAILY_TIMEZONE` from `src/engine/competitive/modes/daily.ts`
- Produces:
  - `getWIBDateString(date?: Date): string`
  - `getWIBTimeUntilMidnight(now?: Date): { hours: number; minutes: number; seconds: number; ms: number }`
  - `generateDailyQuestions(challengeId: string): Question[]` (10 deterministic questions with `answerSpec`)
  - `isDailyStreakEligible(result): boolean`

- [ ] **Step 1: Write failing tests for WIB utilities and deterministic question generator**

Create `tests/unit/dailyChallengeEngine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  getWIBDateString,
  getWIBTimeUntilMidnight,
  generateDailyQuestions,
} from '../../src/utils/dailyWib';
import { isDailyStreakEligible } from '../../src/engine/competitive/modes/daily';

describe('Daily Challenge Engine Utilities', () => {
  it('formats dates in Asia/Jakarta (WIB) regardless of local timezone', () => {
    // 2026-09-13 16:30:00 UTC is 2026-09-13 23:30:00 WIB
    const utcEvening = new Date('2026-09-13T16:30:00Z');
    expect(getWIBDateString(utcEvening)).toBe('2026-09-13');

    // 2026-09-13 17:30:00 UTC is 2026-09-14 00:30:00 WIB
    const utcMidnightCross = new Date('2026-09-13T17:30:00Z');
    expect(getWIBDateString(utcMidnightCross)).toBe('2026-09-14');
  });

  it('calculates remaining time until midnight WIB correctly', () => {
    // 2026-09-13 16:59:00 UTC is 23:59:00 WIB (1 minute before midnight WIB)
    const justBeforeMidnight = new Date('2026-09-13T16:59:00Z');
    const res = getWIBTimeUntilMidnight(justBeforeMidnight);
    expect(res.hours).toBe(0);
    expect(res.minutes).toBe(1);
    expect(res.seconds).toBe(0);
    expect(res.ms).toBe(60000);
  });

  it('generates 10 deterministic questions from challengeId with answerSpec', () => {
    const challengeId = '2026-09-13@Asia/Jakarta:2.0.0';
    const questions1 = generateDailyQuestions(challengeId);
    const questions2 = generateDailyQuestions(challengeId);

    expect(questions1.length).toBe(10);
    expect(questions1).toEqual(questions2);

    for (let i = 0; i < questions1.length; i++) {
      const q = questions1[i];
      expect(q.id).toBe(`daily_${challengeId}_q${i + 1}`);
      expect(q.prompt).toBeDefined();
      expect(q.answerSpec).toBeDefined();
      expect(q.answerSpec.kind).toBe('integer');
      expect(typeof q.answerSpec.value).toBe('number');
      expect(q.difficulty).toBeGreaterThanOrEqual(1);
      expect(q.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('evaluates daily streak eligibility according to PRD §15.2', () => {
    // Eligible: VALIDATED, daily, 10 answered, correctCount >= 6
    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 6,
      })
    ).toBe(true);

    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 10,
      })
    ).toBe(true);

    // Ineligible: < 6 correct
    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 5,
      })
    ).toBe(false);

    // Ineligible: < 10 answered
    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 9,
        correctCount: 9,
      })
    ).toBe(false);

    // Ineligible: REJECTED status
    expect(
      isDailyStreakEligible({
        status: 'REJECTED' as any,
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 8,
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/dailyChallengeEngine.test.ts`
Expected: FAIL (Cannot find module `../../src/utils/dailyWib`)

- [ ] **Step 3: Implement `src/utils/dailyWib.ts`**

Create `src/utils/dailyWib.ts`:
```typescript
import { DAILY_TIMEZONE, hashDailySeed } from '../engine/competitive/modes/daily';
import { Question } from '../types';

/**
 * Returns formatted YYYY-MM-DD in Asia/Jakarta timezone
 */
export function getWIBDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Calculates remaining hours, minutes, seconds, and milliseconds until 00:00:00 WIB
 */
export function getWIBTimeUntilMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
} {
  const nowMs = now.getTime();
  const wibDateStr = getWIBDateString(now);
  const [y, m, d] = wibDateStr.split('-').map(Number);

  // Next midnight WIB is (d + 1) at 00:00:00 WIB.
  // WIB is UTC+7, so 00:00:00 WIB is 17:00:00 UTC of previous day.
  const nextMidnightUtc = Date.UTC(y, m - 1, d + 1, -7, 0, 0, 0);
  const diffMs = Math.max(0, nextMidnightUtc - nowMs);

  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { hours, minutes, seconds, ms: diffMs };
}

function createMulberry32(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates 10 curated deterministic questions for the daily challenge.
 */
export function generateDailyQuestions(challengeId: string): Question[] {
  const seed = hashDailySeed(challengeId);
  const rng = createMulberry32(seed);
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const questions: Question[] = [];

  // Stage 1: Refleks Puluhan (Addition)
  const s1_a = randInt(25, 68);
  const s1_b = randInt(18, 49);
  questions.push({
    id: `daily_${challengeId}_q1`,
    prompt: `${s1_a} + ${s1_b} = ?`,
    displayPrompt: `${s1_a} + ${s1_b} = ?`,
    difficulty: 1,
    skillId: 'addition',
    subSkillId: 'add.tens',
    answerSpec: { kind: 'integer', value: s1_a + s1_b },
  });

  // Stage 2: Pengurangan Puluhan
  const s2_a = randInt(65, 99);
  const s2_b = randInt(22, s2_a - 15);
  questions.push({
    id: `daily_${challengeId}_q2`,
    prompt: `${s2_a} - ${s2_b} = ?`,
    displayPrompt: `${s2_a} - ${s2_b} = ?`,
    difficulty: 1,
    skillId: 'subtraction',
    subSkillId: 'sub.tens',
    answerSpec: { kind: 'integer', value: s2_a - s2_b },
  });

  // Stage 3: Perkalian Refleks Tabel
  const s3_a = randInt(6, 12);
  const s3_b = randInt(7, 12);
  questions.push({
    id: `daily_${challengeId}_q3`,
    prompt: `${s3_a} × ${s3_b} = ?`,
    displayPrompt: `${s3_a} × ${s3_b} = ?`,
    difficulty: 2,
    skillId: 'multiplication',
    subSkillId: 'mul.table',
    answerSpec: { kind: 'integer', value: s3_a * s3_b },
  });

  // Stage 4: Pembagian Cepat
  const s4_div = randInt(4, 9);
  const s4_ans = randInt(7, 14);
  const s4_num = s4_div * s4_ans;
  questions.push({
    id: `daily_${challengeId}_q4`,
    prompt: `${s4_num} ÷ ${s4_div} = ?`,
    displayPrompt: `${s4_num} ÷ ${s4_div} = ?`,
    difficulty: 2,
    skillId: 'division',
    subSkillId: 'div.basic',
    answerSpec: { kind: 'integer', value: s4_ans },
  });

  // Stage 5: Rantai Tiga Bilangan
  const s5_a = randInt(15, 35);
  const s5_b = randInt(10, 25);
  const s5_c = randInt(8, 19);
  questions.push({
    id: `daily_${challengeId}_q5`,
    prompt: `${s5_a} + ${s5_b} - ${s5_c} = ?`,
    displayPrompt: `${s5_a} + ${s5_b} - ${s5_c} = ?`,
    difficulty: 3,
    skillId: 'mixed',
    subSkillId: 'chain.three',
    answerSpec: { kind: 'integer', value: s5_a + s5_b - s5_c },
  });

  // Stage 6: Pengurangan Majemuk
  const s6_a = randInt(85, 145);
  const s6_b = randInt(35, 65);
  questions.push({
    id: `daily_${challengeId}_q6`,
    prompt: `${s6_a} - ${s6_b} = ?`,
    displayPrompt: `${s6_a} - ${s6_b} = ?`,
    difficulty: 3,
    skillId: 'subtraction',
    subSkillId: 'sub.compound',
    answerSpec: { kind: 'integer', value: s6_a - s6_b },
  });

  // Stage 7: Perkalian Puluhan Dekat
  const s7_a = randInt(13, 24);
  const s7_b = randInt(4, 8);
  questions.push({
    id: `daily_${challengeId}_q7`,
    prompt: `${s7_a} × ${s7_b} = ?`,
    displayPrompt: `${s7_a} × ${s7_b} = ?`,
    difficulty: 4,
    skillId: 'multiplication',
    subSkillId: 'mul.twodigit',
    answerSpec: { kind: 'integer', value: s7_a * s7_b },
  });

  // Stage 8: Operasi Prioritas BODMAS
  const s8_a = randInt(20, 50);
  const s8_b = randInt(3, 7);
  const s8_c = randInt(4, 9);
  questions.push({
    id: `daily_${challengeId}_q8`,
    prompt: `${s8_a} + ${s8_b} × ${s8_c} = ?`,
    displayPrompt: `${s8_a} + ${s8_b} × ${s8_c} = ?`,
    difficulty: 4,
    skillId: 'mixed',
    subSkillId: 'bodmas.basic',
    answerSpec: { kind: 'integer', value: s8_a + s8_b * s8_c },
  });

  // Stage 9: Persamaan Linear Cepat
  const s9_x = randInt(12, 38);
  const s9_add = randInt(15, 45);
  const s9_total = s9_x + s9_add;
  questions.push({
    id: `daily_${challengeId}_q9`,
    prompt: `x + ${s9_add} = ${s9_total}, x = ?`,
    displayPrompt: `x + ${s9_add} = ${s9_total}, x = ?`,
    difficulty: 5,
    skillId: 'algebra',
    subSkillId: 'linear.step1',
    answerSpec: { kind: 'integer', value: s9_x },
  });

  // Stage 10: Grandmaster Mental Math
  const s10_a = randInt(12, 19);
  const s10_b = randInt(11, 16);
  questions.push({
    id: `daily_${challengeId}_q10`,
    prompt: `${s10_a} × ${s10_b} = ?`,
    displayPrompt: `${s10_a} × ${s10_b} = ?`,
    difficulty: 5,
    skillId: 'multiplication',
    subSkillId: 'mul.teen',
    answerSpec: { kind: 'integer', value: s10_a * s10_b },
  });

  return questions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/dailyChallengeEngine.test.ts`
Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit**

```bash
git add src/utils/dailyWib.ts tests/unit/dailyChallengeEngine.test.ts
git commit -m "feat(daily): implement wib timezone and deterministic daily question generator

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Unified Hook Extension (`useCompetitiveSession` Daily Mode)

**Files:**
- Modify: `src/hooks/useCompetitiveSession.ts`
- Test: `tests/unit/competitiveHookDaily.test.ts`

**Interfaces:**
- Consumes: `dailyQuestions?: Question[]`, `challengeId?: string` via `UseCompetitiveSessionOptions`
- Produces: `useCompetitiveSession` supporting `mode: 'daily'`, 90.000 ms countdown, 75.000 ms target speed, and auto-finalization on sequence 10.

- [ ] **Step 1: Write failing test for `useCompetitiveSession` daily mode**

Create `tests/unit/competitiveHookDaily.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';
import { generateDailyQuestions } from '../../src/utils/dailyWib';

describe('useCompetitiveSession - Daily Mode', () => {
  const secret = 'test-secret-daily-123';
  const challengeId = '2026-09-13@Asia/Jakarta:2.0.0';
  const questions = generateDailyQuestions(challengeId);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes daily session with 90,000ms countdown and 5 pre-buffered questions', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'daily',
        secret,
        challengeId,
        dailyQuestions: questions,
        isRanked: true,
      })
    );

    expect(result.current.status).toBe('ACTIVE');
    expect(result.current.timeRemainingMs).toBe(90000);
    expect(result.current.bufferedCount).toBe(5);
    expect(result.current.currentQuestion?.sequence).toBe(1);
    expect(result.current.currentQuestion?.renderedPrompt).toBe(questions[0].prompt);
  });

  it('auto-finalizes session and calculates 4-tier score upon completing 10th question', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'daily',
        secret,
        challengeId,
        dailyQuestions: questions,
        isRanked: true,
        onFinish,
      })
    );

    // Answer all 10 questions correctly
    for (let seq = 1; seq <= 10; seq++) {
      const currentQ = questions[seq - 1];
      act(() => {
        vi.advanceTimersByTime(2000); // 2s per question -> total active duration ~20s
        const isCorrect = result.current.submitAnswer(String(currentQ.answerSpec.value));
        expect(isCorrect).toBe(true);
      });
    }

    expect(result.current.isGameOver).toBe(true);
    expect(result.current.status).toBe('VALIDATED');
    expect(result.current.resultOutput).toBeDefined();

    const output = result.current.resultOutput!;
    expect(output.status).toBe('VALIDATED');
    expect(output.result.correctCount).toBe(10);
    expect(output.result.questionsAnswered).toBe(10);
    expect(output.result.maxStreak).toBe(10);
    expect(output.result.isRanked).toBe(true);
    // 10 correct: base 1200, streak 300, perfect 200, plus speed bonus
    expect(output.result.score).toBeGreaterThan(1700);
    expect(onFinish).toHaveBeenCalledWith(output);
  });

  it('finalizes session when 90s hard deadline expires', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'daily',
        secret,
        challengeId,
        dailyQuestions: questions,
        isRanked: true,
      })
    );

    // Answer 3 questions
    for (let seq = 1; seq <= 3; seq++) {
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.submitAnswer(String(questions[seq - 1].answerSpec.value));
      });
    }

    // Advance remaining time past 90s
    act(() => {
      vi.advanceTimersByTime(90000);
    });

    expect(result.current.isGameOver).toBe(true);
    expect(result.current.timeRemainingMs).toBe(0);
    expect(result.current.resultOutput?.result.questionsAnswered).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/competitiveHookDaily.test.ts`
Expected: FAIL (timeRemainingMs is not 90000 or session does not auto-finalize on question 10)

- [ ] **Step 3: Modify `src/hooks/useCompetitiveSession.ts` to support daily mode**

Update `src/hooks/useCompetitiveSession.ts`:
```typescript
// Add Question import from types and Question[] parameter to options:
import { Question } from '../types';
import { DAILY_HARD_DEADLINE_MS } from '../engine/competitive/modes/daily';

export interface UseCompetitiveSessionOptions {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  challengeId?: string;
  dailyQuestions?: Question[];
  onFinish?: (output: ValidationOutput) => void;
}
```
In `useCompetitiveSession`:
1. `sessionState` initialization:
   ```typescript
   const initialQuestions =
     mode === 'daily' && options.dailyQuestions && options.dailyQuestions.length >= 5
       ? options.dailyQuestions.slice(0, 5)
       : generateCompetitiveQuestions(1, 5);
   ```
2. Pass `challengeId: options.challengeId` into `createCompetitiveSession`.
3. `timeRemainingMs` initial value:
   ```typescript
   const [timeRemainingMs, setTimeRemainingMs] = useState<number>(() => {
     if (mode === 'daily') return DAILY_HARD_DEADLINE_MS;
     return mode === 'sprint' ? 60000 : SURVIVAL_INITIAL_TIMER_MS;
   });
   ```
4. `serverDeadlineAt` in `finalizeSession`:
   ```typescript
   serverDeadlineAt:
     mode === 'daily'
       ? currentSession.contract.serverStartedAt + DAILY_HARD_DEADLINE_MS
       : mode === 'sprint'
       ? currentSession.contract.serverStartedAt + 60000
       : finalizedAt,
   ```
5. Main countdown loop:
   ```typescript
   if (mode === 'daily') {
     const remaining = Math.max(0, DAILY_HARD_DEADLINE_MS - elapsed);
     setTimeRemainingMs(remaining);
     if (remaining <= 0) {
       clearInterval(interval);
       finalizeSession();
     }
   }
   ```
6. In `submitAnswer`:
   ```typescript
   if (mode === 'daily') {
     if (seq >= 10) {
       finalizeSession();
       return isCorrect;
     }
     const nextQIndex = seq + 4; // next question index for 5-buffered window
     const nextQ = options.dailyQuestions?.[nextQIndex];
     if (nextQ) {
       setSessionState((prev) =>
         advanceSessionBuffer(prev, [seq], [nextQ], secret)
       );
     } else {
       setSessionState((prev) =>
         advanceSessionBuffer(prev, [seq], [], secret)
       );
     }
     return isCorrect;
   }
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/competitiveHookDaily.test.ts`
Expected: PASS (3 tests passing)

- [ ] **Step 5: Run existing tests to verify zero regression**

Run: `npx vitest run tests/unit/competitiveHook.test.ts tests/unit/competitivePlayScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCompetitiveSession.ts tests/unit/competitiveHookDaily.test.ts
git commit -m "feat(daily): extend useCompetitiveSession with daily challenge mode support

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: HUD Header Component `DailyHeader`

**Files:**
- Create: `src/components/daily/DailyHeader.tsx`
- Test: `tests/unit/dailyHeader.test.tsx`

**Interfaces:**
- Produces: `<DailyHeader timeRemainingMs={...} currentQuestionIdx={...} totalQuestions={...} comboStreak={...} stageTitle={...} onExit={...} />`

- [ ] **Step 1: Write failing test for `DailyHeader`**

Create `tests/unit/dailyHeader.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyHeader } from '../../src/components/daily/DailyHeader';

describe('DailyHeader Component', () => {
  it('renders countdown timer, stage title, and segmented progress bar', () => {
    const onExit = vi.fn();
    render(
      <DailyHeader
        timeRemainingMs={85000}
        currentQuestionIdx={3}
        totalQuestions={10}
        comboStreak={4}
        stageTitle="Perkalian Refleks"
        onExit={onExit}
      />
    );

    // Timer rendering (85s formatted as 01:25)
    expect(screen.getByText('01:25')).toBeDefined();
    expect(screen.getByText('Target: 75s')).toBeDefined();

    // Stage title and question counter
    expect(screen.getByText(/Perkalian Refleks/i)).toBeDefined();
    expect(screen.getByText(/Soal 4 dari 10/i)).toBeDefined();

    // Combo streak badge
    expect(screen.getByText(/4x Kombo/i)).toBeDefined();

    // Exit button with 48px touch target
    const exitBtn = screen.getByRole('button', { name: /keluar|kembali/i });
    expect(exitBtn).toBeDefined();
    fireEvent.click(exitBtn);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('renders 10 progress segments with accessible progressbar attributes', () => {
    render(
      <DailyHeader
        timeRemainingMs={50000}
        currentQuestionIdx={2}
        totalQuestions={10}
        comboStreak={0}
        stageTitle="Tahap 3"
        onExit={vi.fn()}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('3');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('10');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/dailyHeader.test.tsx`
Expected: FAIL (Cannot find module `DailyHeader`)

- [ ] **Step 3: Implement `src/components/daily/DailyHeader.tsx`**

Create `src/components/daily/DailyHeader.tsx`:
```tsx
import React from 'react';
import { ArrowLeft, Clock, Flame, Zap } from 'lucide-react';

export interface DailyHeaderProps {
  timeRemainingMs: number;
  currentQuestionIdx: number;
  totalQuestions?: number;
  comboStreak: number;
  stageTitle: string;
  onExit: () => void;
}

export const DailyHeader: React.FC<DailyHeaderProps> = ({
  timeRemainingMs,
  currentQuestionIdx,
  totalQuestions = 10,
  comboStreak,
  stageTitle,
  onExit,
}) => {
  const totalSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Speed target is 75s (remaining time >= 15s out of 90s)
  const isWithinTarget = timeRemainingMs >= 15000;

  return (
    <header className="w-full flex flex-col gap-2.5" role="banner">
      {/* Top Action & Status Row */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke Beranda"
          title="Keluar (Escape)"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Center: Stage Title and Question Indicator */}
        <div className="flex-1 flex flex-col items-center text-center truncate">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="truncate">{stageTitle}</span>
          </div>
          <span className="text-sm font-black text-white font-mono">
            Soal {Math.min(totalQuestions, currentQuestionIdx + 1)} dari {totalQuestions}
          </span>
        </div>

        {/* Right: Monotonic Countdown Timer */}
        <div
          className={`flex flex-col items-end px-3 py-1.5 rounded-2xl border transition-colors ${
            isWithinTarget
              ? 'bg-indigo-950/80 border-emerald-500/50 text-emerald-400'
              : 'bg-indigo-950/80 border-amber-500/60 text-amber-400'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono font-black text-lg">
            <Clock className="w-4 h-4" />
            <span>{formattedTime}</span>
          </div>
          <span className="text-[10px] font-bold text-indigo-300">Target: 75s</span>
        </div>
      </div>

      {/* Segmented 10-Question Progress Bar */}
      <div
        role="progressbar"
        aria-label="Progres Soal Tantangan Harian"
        aria-valuenow={currentQuestionIdx + 1}
        aria-valuemin={1}
        aria-valuemax={totalQuestions}
        className="flex gap-1.5 w-full"
      >
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const isPassed = idx < currentQuestionIdx;
          const isCurrent = idx === currentQuestionIdx;
          return (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                isPassed
                  ? 'bg-emerald-400'
                  : isCurrent
                  ? 'bg-amber-400 animate-pulse motion-reduce:animate-none'
                  : 'bg-indigo-950 border border-indigo-800/60'
              }`}
            />
          );
        })}
      </div>

      {/* Combo Streak Indicator */}
      {comboStreak > 1 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-black text-xs shadow-md border border-amber-300 animate-bounce motion-reduce:animate-none">
            <Flame className="w-3.5 h-3.5 fill-amber-950" />
            <span>{comboStreak}x Kombo Beruntun! (+{comboStreak * 30} Poin)</span>
          </div>
        </div>
      )}
    </header>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/dailyHeader.test.tsx`
Expected: PASS (2 tests passing)

- [ ] **Step 5: Commit**

```bash
git add src/components/daily/DailyHeader.tsx tests/unit/dailyHeader.test.tsx
git commit -m "feat(daily): implement accessible DailyHeader HUD with segmented bar and timer

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Authoritative Result View `DailyResultView`

**Files:**
- Create: `src/components/daily/DailyResultView.tsx`
- Test: `tests/unit/dailyResultView.test.tsx`

**Interfaces:**
- Produces: `<DailyResultView output={...} isRanked={...} challengeId={...} currentStreak={...} isStreakIncremented={...} onPlayAgain={...} onExit={...} />`

- [ ] **Step 1: Write failing test for `DailyResultView`**

Create `tests/unit/dailyResultView.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyResultView } from '../../src/components/daily/DailyResultView';
import { ValidationOutput } from '../../src/engine/competitive/validator';

describe('DailyResultView Component', () => {
  const mockOutput: ValidationOutput = {
    status: 'VALIDATED',
    result: {
      resultId: 'res_123',
      sessionId: 'sess_123',
      userId: 'user_1',
      mode: 'daily',
      status: 'VALIDATED',
      isRanked: true,
      score: 2150,
      accuracy: 100,
      correctCount: 10,
      wrongCount: 0,
      questionsAnswered: 10,
      rankedActiveDurationMs: 35000,
      maxStreak: 10,
      difficultyReached: 5,
      rejectionReasons: [],
      finalizedAt: Date.now(),
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
      challengeId: '2026-09-13@Asia/Jakarta:2.0.0',
    },
    rejectionReasons: [],
  };

  it('renders 4-tier score breakdown cards, total score, and streak flame', () => {
    render(
      <DailyResultView
        output={mockOutput}
        isRanked={true}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={true}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Total Score
    expect(screen.getByText('2150')).toBeDefined();
    expect(screen.getByText(/Skor Resmi Tercatat/i)).toBeDefined();

    // 4 Score Tiers
    expect(screen.getByText(/Skor Dasar/i)).toBeDefined();
    expect(screen.getByText(/1200/)).toBeDefined(); // 10 * 120

    expect(screen.getByText(/Bonus Kombo/i)).toBeDefined();
    expect(screen.getByText(/300/)).toBeDefined(); // min(300, 10 * 30)

    expect(screen.getByText(/Bonus Kecepatan/i)).toBeDefined();

    expect(screen.getByText(/Bonus Sempurna/i)).toBeDefined();
    expect(screen.getByText(/200/)).toBeDefined();

    // Daily Streak Flame Indicator
    expect(screen.getByText(/5 Hari/i)).toBeDefined();
  });

  it('displays Mode Latihan badge when played as unranked replay', () => {
    const replayOutput: ValidationOutput = {
      ...mockOutput,
      result: {
        ...mockOutput.result,
        isRanked: false,
      },
    };

    render(
      <DailyResultView
        output={replayOutput}
        isRanked={false}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={false}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Latihan/i)).toBeDefined();
    expect(screen.getByText(/Tidak Mengubah Rekor Resmi/i)).toBeDefined();
  });

  it('copies shareable summary text on share button click', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    render(
      <DailyResultView
        output={mockOutput}
        isRanked={true}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={true}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /bagikan/i });
    fireEvent.click(shareBtn);
    expect(writeTextSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/dailyResultView.test.tsx`
Expected: FAIL (Cannot find module `DailyResultView`)

- [ ] **Step 3: Implement `src/components/daily/DailyResultView.tsx`**

Create `src/components/daily/DailyResultView.tsx`:
```tsx
import React, { useState } from 'react';
import { Trophy, Flame, Zap, Clock, Sparkles, Share2, Check, RotateCcw, Home } from 'lucide-react';
import { ValidationOutput } from '../../engine/competitive/validator';
import { calculateDailyScore } from '../../engine/competitive/scoring';

export interface DailyResultViewProps {
  output: ValidationOutput;
  isRanked: boolean;
  challengeId?: string;
  currentStreak: number;
  isStreakIncremented: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const DailyResultView: React.FC<DailyResultViewProps> = ({
  output,
  isRanked,
  challengeId,
  currentStreak,
  isStreakIncremented,
  onPlayAgain,
  onExit,
}) => {
  const [copied, setCopied] = useState(false);
  const { result } = output;

  const scoreDetails = calculateDailyScore(
    result.correctCount,
    result.maxStreak,
    result.rankedActiveDurationMs
  );

  const durationSec = (result.rankedActiveDurationMs / 1000).toFixed(1);

  const handleShare = () => {
    const datePart = challengeId ? challengeId.split('@')[0] : 'Hari Ini';
    const text =
      `⚡ Hitung Kilat - Tantangan Harian (${datePart})\n` +
      `🏆 Skor: ${result.score} Poin\n` +
      `⏱️ Waktu: ${durationSec}s | Akurasi: ${result.accuracy.toFixed(0)}%\n` +
      `🎯 Benar: ${result.correctCount}/10 (Max Kombo: ${result.maxStreak}x)\n` +
      `🔥 Streak: ${currentStreak} Hari\n\n` +
      `Uji kecepatan kalkulasi mentalmu di Hitung Kilat!`;

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 py-6 px-4">
      {/* Top Banner & Status Badge */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-700/70 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 p-6 text-center text-white shadow-2xl">
        <div className="flex justify-center mb-3">
          {isRanked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-black text-emerald-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Skor Resmi Tercatat
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1 text-xs font-black text-amber-300 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              Mode Latihan (Tidak Mengubah Rekor Resmi)
            </span>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black italic text-white tracking-tight">
          Tantangan Harian Selesai!
        </h2>
        <div className="my-4">
          <div className="text-5xl sm:text-6xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
            {result.score}
          </div>
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
            Total Poin Diperoleh
          </span>
        </div>

        {/* Streak Flame Tracker */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-white/10 border border-white/15 text-sm font-black text-amber-300">
          <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Streak: {currentStreak} Hari</span>
          {isStreakIncremented && (
            <span className="text-xs text-emerald-400 font-bold">(+1 Hari Ini!)</span>
          )}
        </div>
      </div>

      {/* 4-Tier Score Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tier 1: Base */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Skor Dasar</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.base}</div>
          <div className="text-[10px] text-indigo-400">{result.correctCount} benar × 120</div>
        </div>

        {/* Tier 2: Streak */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Bonus Kombo</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.streakBonus}</div>
          <div className="text-[10px] text-indigo-400">Max kombo {result.maxStreak}x</div>
        </div>

        {/* Tier 3: Speed */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Bonus Kecepatan</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.speedBonus}</div>
          <div className="text-[10px] text-indigo-400">Waktu aktif {durationSec}s</div>
        </div>

        {/* Tier 4: Perfect */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Bonus Sempurna</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.perfectBonus}</div>
          <div className="text-[10px] text-indigo-400">
            {result.correctCount === 10 ? '10/10 Sempurna!' : '0 (Perlu 10/10)'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={handleShare}
          aria-label="Bagikan Hasil"
          className="w-full sm:flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-indigo-800 hover:bg-indigo-700 border border-indigo-600 text-white font-black text-sm transition-all shadow-md active:scale-98"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          <span>{copied ? 'Tersalin ke Clipboard!' : 'Bagikan'}</span>
        </button>

        <button
          type="button"
          onClick={onPlayAgain}
          aria-label="Main Ulang Mode Latihan"
          className="w-full sm:flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm transition-all shadow-md active:scale-98"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Main Ulang (Latihan)</span>
        </button>

        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke Beranda"
          className="w-full sm:w-auto min-h-[48px] px-5 flex items-center justify-center gap-2 rounded-2xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-300 hover:text-white font-bold text-sm transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/dailyResultView.test.tsx`
Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit**

```bash
git add src/components/daily/DailyResultView.tsx tests/unit/dailyResultView.test.tsx
git commit -m "feat(daily): implement DailyResultView with 4-tier score breakdown and streak tracking

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Hub View `DailyHubView` and Container `DailyChallengeScreen`

**Files:**
- Create: `src/components/daily/DailyHubView.tsx`
- Modify: `src/components/DailyChallengeScreen.tsx`
- Test: `tests/unit/dailyChallengeScreen.test.tsx`

**Interfaces:**
- Produces: `<DailyHubView ... />` and refactored `<DailyChallengeScreen onExit={...} onOpenStats={...} />`

- [ ] **Step 1: Write failing integration test for `DailyChallengeScreen`**

Create `tests/unit/dailyChallengeScreen.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DailyChallengeScreen } from '../../src/components/DailyChallengeScreen';
import { soundManager } from '../../src/utils/sound';

describe('DailyChallengeScreen Integration', () => {
  beforeEach(() => {
    vi.spyOn(soundManager, 'playCorrect').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playWrong').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders DailyHubView initially with WIB countdown and start button', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    expect(screen.getByText(/Tantangan Harian/i)).toBeDefined();
    expect(screen.getByText(/Reset dlm/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /mulai tantangan/i })).toBeDefined();
  });

  it('transitions from hub to gameplay on start challenge button click', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /mulai tantangan/i });
    fireEvent.click(startBtn);

    // Should render input and keypad
    expect(screen.getByPlaceholderText('Ketik jawaban...')).toBeDefined();
    expect(screen.getByRole('button', { name: '5' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/dailyChallengeScreen.test.tsx`
Expected: FAIL (Cannot find module or missing props/elements)

- [ ] **Step 3: Implement `src/components/daily/DailyHubView.tsx`**

Create `src/components/daily/DailyHubView.tsx`:
```tsx
import React from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Trophy,
  Sparkles,
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  DailyChallengeRecord,
  DailyChallengeUserState,
  LeaderboardEntry,
} from '../../types';
import { formatIndonesianDate, getLeaderboardForDate } from '../../utils/dailyChallenge';

export interface DailyHubViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  todayDateStr: string;
  countdown: { hours: number; minutes: number; seconds: number; ms: number };
  userState: DailyChallengeUserState;
  todayRecord?: DailyChallengeRecord;
  onStartChallenge: () => void;
  onExit: () => void;
  onOpenStats: () => void;
}

const STAGE_PREVIEWS = [
  { num: 1, title: 'Refleks Puluhan', icon: '⚡', diff: 'Mudah' },
  { num: 2, title: 'Pengurangan Cepat', icon: '➖', diff: 'Mudah' },
  { num: 3, title: 'Tabel Perkalian', icon: '✖️', diff: 'Sedang' },
  { num: 4, title: 'Pembagian Refleks', icon: '➗', diff: 'Sedang' },
  { num: 5, title: 'Rantai 3 Bilangan', icon: '⛓️', diff: 'Menantang' },
  { num: 6, title: 'Pengurangan Majemuk', icon: '🎯', diff: 'Menantang' },
  { num: 7, title: 'Perkalian 2-Digit', icon: '🔢', diff: 'Tinggi' },
  { num: 8, title: 'BODMAS Prioritas', icon: '📐', diff: 'Tinggi' },
  { num: 9, title: 'Aljabar Linear Kilat', icon: '🧩', diff: 'Master' },
  { num: 10, title: 'Grandmaster Math', icon: '👑', diff: 'Grandmaster' },
];

export const DailyHubView: React.FC<DailyHubViewProps> = ({
  selectedDate,
  onSelectDate,
  todayDateStr,
  countdown,
  userState,
  todayRecord,
  onStartChallenge,
  onExit,
  onOpenStats,
}) => {
  const isToday = selectedDate === todayDateStr;
  const leaderboard: LeaderboardEntry[] = getLeaderboardForDate(selectedDate);

  const formattedCountdown = `${String(countdown.hours).padStart(2, '0')}:${String(
    countdown.minutes
  ).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    onSelectDate(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (selectedDate >= todayDateStr) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    onSelectDate(next.toISOString().split('T')[0]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 py-6 px-4">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke Beranda"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black italic tracking-tight text-white">
            Tantangan Harian
          </h1>
          <span className="text-xs text-indigo-300 font-medium">
            Waktu Indonesia Barat (WIB)
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenStats}
          aria-label="Buka Statistik & Rekor"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-amber-400 hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <Trophy className="w-5 h-5" />
        </button>
      </header>

      {/* Date Navigator & Midnight WIB Countdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-indigo-950/70 border border-indigo-800/60 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            aria-label="Hari Sebelumnya"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/70 hover:bg-indigo-800 text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-2">
            <div className="text-sm font-black text-white">
              {formatIndonesianDate(selectedDate)}
            </div>
            {isToday && (
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Hari Ini
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            disabled={selectedDate >= todayDateStr}
            aria-label="Hari Berikutnya"
            className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl transition-colors ${
              selectedDate >= todayDateStr
                ? 'opacity-40 cursor-not-allowed bg-indigo-950 text-indigo-600'
                : 'bg-indigo-900/70 hover:bg-indigo-800 text-white'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* WIB Midnight Countdown & Streak Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs">
            <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Streak: {userState.currentStreak} Hari</span>
          </div>

          {isToday && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-indigo-900/60 border border-indigo-700/40 text-indigo-300 font-mono text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Reset dlm: {formattedCountdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hero Action Card */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-700/80 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 p-6 shadow-2xl text-center">
        {todayRecord ? (
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-black text-emerald-300 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              Rekor Resmi Hari Ini Tercatat
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black font-mono text-amber-300">
                {todayRecord.score} Poin
              </span>
              <span className="text-xs text-indigo-300 mt-1">
                Akurasi: {todayRecord.accuracy}% | Benar: {todayRecord.correctCount}/10
              </span>
            </div>

            <button
              type="button"
              onClick={onStartChallenge}
              aria-label="Main Ulang Tantangan (Mode Latihan)"
              className="w-full sm:w-auto min-h-[48px] px-8 py-3 flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm shadow-xl active:scale-98 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Main Ulang (Mode Latihan)</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-xs font-black text-yellow-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              1x Kesempatan Resmi per Hari
            </div>
            <p className="text-sm text-indigo-200 max-w-md">
              Selesaikan 10 soal deterministik dalam 90 detik. Sesi ini menentukan perolehan
              peringkat resmi dan streak harianmu!
            </p>

            <button
              type="button"
              onClick={onStartChallenge}
              aria-label="Mulai Tantangan Harian"
              className="w-full sm:w-auto min-h-[48px] px-10 py-3.5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-amber-950 font-black text-base shadow-2xl active:scale-98 transition-all"
            >
              <Play className="w-5 h-5 fill-amber-950" />
              <span>Mulai Tantangan (10 Soal)</span>
            </button>
          </div>
        )}
      </div>

      {/* 10-Stage Preview */}
      <section aria-labelledby="stage-preview-heading" className="flex flex-col gap-3">
        <h2 id="stage-preview-heading" className="text-sm font-black text-indigo-300 uppercase tracking-wider">
          Rincian 10 Tahap Soal Curated
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {STAGE_PREVIEWS.map((st) => (
            <div
              key={st.num}
              className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-indigo-950/60 border border-indigo-800/40"
            >
              <span className="text-lg">{st.icon}</span>
              <span className="text-[11px] font-black text-white mt-1 truncate w-full">
                {st.title}
              </span>
              <span className="text-[10px] text-indigo-400 font-medium">{st.diff}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard Benchmark Table */}
      <section aria-labelledby="leaderboard-heading" className="flex flex-col gap-3">
        <h2 id="leaderboard-heading" className="text-sm font-black text-indigo-300 uppercase tracking-wider">
          Peringkat Global ({formatIndonesianDate(selectedDate)})
        </h2>
        <div className="overflow-hidden rounded-2xl border border-indigo-800/50 bg-indigo-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-indigo-900/50 text-indigo-300 font-bold uppercase tracking-wider border-b border-indigo-800/50">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Pemain</th>
                <th className="py-2.5 px-3 text-right">Waktu</th>
                <th className="py-2.5 px-3 text-right">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-900/40 text-white font-medium">
              {leaderboard.slice(0, 5).map((entry, idx) => (
                <tr key={idx} className="hover:bg-indigo-900/30 transition-colors">
                  <td className="py-2 px-3 text-center font-bold text-amber-400">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <span className="mr-1.5">{entry.flag}</span>
                    <span className="font-bold">{entry.name}</span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-indigo-300">
                    {entry.timeTakenSec.toFixed(1)}s
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black text-amber-300">
                    {entry.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
```

- [ ] **Step 4: Refactor `src/components/DailyChallengeScreen.tsx`**

Replace `src/components/DailyChallengeScreen.tsx` with unified container implementation:
```tsx
import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  DailyChallengeUserState,
  DailyChallengeRecord,
} from '../types';
import {
  loadDailyChallengeState,
  saveDailyChallengeState,
} from '../utils/dailyChallenge';
import {
  getWIBDateString,
  getWIBTimeUntilMidnight,
  generateDailyQuestions,
} from '../utils/dailyWib';
import { isDailyStreakEligible } from '../engine/competitive/modes/daily';
import { useCompetitiveSession } from '../hooks/useCompetitiveSession';
import { ValidationOutput } from '../engine/competitive/validator';
import { DailyHubView } from './daily/DailyHubView';
import { DailyHeader } from './daily/DailyHeader';
import { DailyResultView } from './daily/DailyResultView';
import { soundManager } from '../utils/sound';

export interface DailyChallengeScreenProps {
  onExit: () => void;
  onOpenStats: () => void;
}

const STAGE_TITLES = [
  'Refleks Puluhan',
  'Pengurangan Puluhan',
  'Perkalian Refleks',
  'Pembagian Cepat',
  'Rantai 3 Bilangan',
  'Pengurangan Majemuk',
  'Perkalian Puluhan Dekat',
  'Operasi BODMAS',
  'Aljabar Linear Cepat',
  'Grandmaster Mental Math',
];

const DAILY_SECRET = 'daily-challenge-v2-local-secret';

export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({
  onExit,
  onOpenStats,
}) => {
  const [screenState, setScreenState] = useState<'hub' | 'playing' | 'result'>('hub');
  const [userState, setUserState] = useState<DailyChallengeUserState>(() =>
    loadDailyChallengeState()
  );

  const todayStr = getWIBDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [countdown, setCountdown] = useState(() => getWIBTimeUntilMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getWIBTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const challengeId = `${selectedDate}@Asia/Jakarta:2.0.0`;
  const dailyQuestions = React.useMemo(
    () => generateDailyQuestions(challengeId),
    [challengeId]
  );

  const isRanked = !userState.history[selectedDate] && selectedDate === todayStr;

  const [inputBuffer, setInputBuffer] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ValidationOutput | null>(null);
  const [isStreakIncremented, setIsStreakIncremented] = useState<boolean>(false);

  const handleFinish = useCallback(
    (output: ValidationOutput) => {
      setValidationResult(output);
      const isEligible = isDailyStreakEligible(output.result);

      if (output.status === 'VALIDATED' && isRanked) {
        setUserState((prev) => {
          const newStreak = isEligible ? prev.currentStreak + 1 : prev.currentStreak;
          const newBest = Math.max(newStreak, prev.bestStreak);
          const newRecord: DailyChallengeRecord = {
            date: selectedDate,
            completed: true,
            score: output.result.score,
            timeTakenSec: output.result.rankedActiveDurationMs / 1000,
            correctCount: output.result.correctCount,
            totalQuestions: 10,
            accuracy: output.result.accuracy,
            maxStreak: output.result.maxStreak,
            rank: 1,
            completedAt: new Date().toISOString(),
            answers: [],
          };
          const nextState: DailyChallengeUserState = {
            ...prev,
            currentStreak: newStreak,
            bestStreak: newBest,
            lastCompletedDate: selectedDate,
            history: {
              ...prev.history,
              [selectedDate]: newRecord,
            },
          };
          saveDailyChallengeState(nextState);
          return nextState;
        });
        setIsStreakIncremented(isEligible);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } else {
        setIsStreakIncremented(false);
      }

      setScreenState('result');
    },
    [isRanked, selectedDate]
  );

  const session = useCompetitiveSession({
    mode: 'daily',
    secret: DAILY_SECRET,
    challengeId,
    dailyQuestions,
    isRanked,
    onFinish: handleFinish,
  });

  const handleSubmitAnswer = () => {
    if (!inputBuffer.trim()) return;
    const isCorrect = session.submitAnswer(inputBuffer.trim());
    if (isCorrect) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }
    setInputBuffer('');
  };

  // Keyboard navigation during play
  useEffect(() => {
    if (screenState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setInputBuffer((prev) => prev + e.key);
      } else if (e.key === '-') {
        setInputBuffer((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev));
      } else if (e.key === '/') {
        setInputBuffer((prev) => (prev.includes('/') ? prev : prev + '/'));
      } else if (e.key === 'Backspace') {
        setInputBuffer((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleSubmitAnswer();
      } else if (e.key === 'Escape') {
        setScreenState('hub');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenState, inputBuffer, session]);

  if (screenState === 'hub') {
    return (
      <DailyHubView
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        todayDateStr={todayStr}
        countdown={countdown}
        userState={userState}
        todayRecord={userState.history[selectedDate]}
        onStartChallenge={() => {
          setInputBuffer('');
          setScreenState('playing');
        }}
        onExit={onExit}
        onOpenStats={onOpenStats}
      />
    );
  }

  if (screenState === 'result' && validationResult) {
    return (
      <DailyResultView
        output={validationResult}
        isRanked={isRanked}
        challengeId={challengeId}
        currentStreak={userState.currentStreak}
        isStreakIncremented={isStreakIncremented}
        onPlayAgain={() => {
          setInputBuffer('');
          setScreenState('playing');
        }}
        onExit={() => setScreenState('hub')}
      />
    );
  }

  const currentQIdx = Math.min(9, Math.max(0, (session.currentQuestion?.sequence ?? 1) - 1));
  const currentStageTitle = STAGE_TITLES[currentQIdx] || 'Tantangan Harian';

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-between min-h-[90vh] py-6 px-4">
      {/* HUD Header */}
      <DailyHeader
        timeRemainingMs={session.timeRemainingMs}
        currentQuestionIdx={currentQIdx}
        totalQuestions={10}
        comboStreak={session.comboStreak}
        stageTitle={currentStageTitle}
        onExit={() => setScreenState('hub')}
      />

      {/* Central Math Prompt Card */}
      <div className="w-full my-auto flex flex-col items-center justify-center">
        <div
          role="region"
          aria-live="polite"
          className="w-full p-8 rounded-3xl bg-gradient-to-b from-indigo-950/90 to-indigo-900/90 border-2 border-indigo-700/80 shadow-2xl text-center"
        >
          <span className="text-3xl sm:text-5xl font-black font-mono tracking-wider text-white">
            {session.currentQuestion?.renderedPrompt || '...'}
          </span>
        </div>

        {/* Answer Display Field */}
        <div className="w-full mt-4">
          <input
            type="text"
            readOnly
            value={inputBuffer}
            placeholder="Ketik jawaban..."
            aria-label="Jawaban Anda"
            className="w-full min-h-[56px] text-center text-2xl font-mono font-black rounded-2xl bg-indigo-950 border-2 border-indigo-700 text-white placeholder-indigo-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Virtual Touch Keypad (>= 48px targets) */}
      <div className="w-full grid grid-cols-4 gap-2 sm:gap-2.5 mt-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => setInputBuffer((prev) => prev + String(digit))}
            aria-label={String(digit)}
            className="min-h-[52px] rounded-2xl bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700/60 text-white font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 shadow-md"
          >
            {digit}
          </button>
        ))}

        {/* 0 and Utility Buttons */}
        <button
          type="button"
          onClick={() =>
            setInputBuffer((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev))
          }
          aria-label="Minus atau Negatif"
          className="min-h-[52px] rounded-2xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95"
        >
          -
        </button>

        <button
          type="button"
          onClick={() => setInputBuffer((prev) => prev + '0')}
          aria-label="0"
          className="min-h-[52px] rounded-2xl bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700/60 text-white font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 shadow-md"
        >
          0
        </button>

        <button
          type="button"
          onClick={() => setInputBuffer((prev) => (prev.includes('/') ? prev : prev + '/'))}
          aria-label="Garis Miring atau Pecahan"
          className="min-h-[52px] rounded-2xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95"
        >
          /
        </button>

        <button
          type="button"
          onClick={() => setInputBuffer((prev) => prev.slice(0, -1))}
          aria-label="Backspace"
          className="min-h-[52px] rounded-2xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95"
        >
          ⌫
        </button>

        <button
          type="button"
          onClick={handleSubmitAnswer}
          aria-label="Submit Jawaban"
          className="col-span-4 min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center transition-all active:scale-98 shadow-lg"
        >
          Jawab (↵)
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/dailyChallengeScreen.test.tsx`
Expected: PASS (2 tests passing)

- [ ] **Step 6: Commit**

```bash
git add src/components/daily/DailyHubView.tsx src/components/DailyChallengeScreen.tsx tests/unit/dailyChallengeScreen.test.tsx
git commit -m "feat(daily): implement DailyHubView and refactor DailyChallengeScreen with unified session flow

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Full Regression Verification & Quality Gates

**Files:**
- Repository root & all test suites

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All 48+ test files pass (100% pass rate).

- [ ] **Step 2: Run TypeScript compiler check**

Run: `npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Vite build succeeds with exit code 0.

- [ ] **Step 4: Commit verification chore if needed**

```bash
git commit --allow-empty -m "chore(daily): verify 100% test pass, lint, and build quality gates

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
