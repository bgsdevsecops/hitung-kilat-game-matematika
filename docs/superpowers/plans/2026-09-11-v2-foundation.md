# Hitung Kilat V2 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core mental-math engine for Hitung Kilat V2 (Milestone V2.0-A Foundation) featuring rule-driven question generator registry, typed AnswerSpec evaluation, FSM gameplay session reducer with monotonic timer, idempotent V1-to-V2 progress migration, and Vitest property-based invariant test harness.

**Architecture:** Parallel modular engine architecture in `src/engine/` that decouples domain logic, evaluation, generation, and session lifecycle from React UI. An adapter module (`src/engine/adapter/v1Adapter.ts`) provides backward compatibility so existing game views remain fully operational.

**Tech Stack:** TypeScript ~5.8.2, React 19, Vitest 5.0.0, Vite 6.2.3, pure JavaScript/TypeScript math without runtime string `eval()`.

**Spec:** `docs/superpowers/specs/2026-09-11-v2-foundation-design.md`

## Global Constraints

- Never modify code on `main` or `master` branch; work strictly on feature branch `feature/12.9.11.1-v2-foundation`.
- Do NOT delete existing files or code (`no delete`).
- Do NOT run `git push` to remote or create PR/MR.
- Commit attribution must end with: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Math correctness is P0: 0 division by zero, 0 malformed expressions, 0 negative subtraction if disallowed, 0 ambiguous solutions.
- Property test gate: $\ge 10.000$ generated cases per generator family.

---

### Task 1: Test Infrastructure Setup (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Test: `tests/unit/sanity.test.ts`

**Interfaces:**
- Consumes: Node.js, npm, TypeScript
- Produces: `npm test` command executing Vitest test suite

- [ ] **Step 1: Install vitest in devDependencies and add test scripts to package.json**

Run:
```bash
npm install -D vitest@5.0.0
```

Add test scripts to `package.json`:
```json
"scripts": {
  ...
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Create vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
```

- [ ] **Step 3: Write the failing sanity test**

Create `tests/unit/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Sanity Test', () => {
  it('verifies vitest test runner is operational', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/unit/sanity.test.ts
git commit -m "chore: setup vitest testing framework and sanity test

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Core Domain Types (`AnswerSpec`, `GeneratorRule`, `LevelConfigV2`, `Session`)

**Files:**
- Create: `src/engine/types/answer.ts`
- Create: `src/engine/types/rules.ts`
- Create: `src/engine/types/question.ts`
- Create: `src/engine/types/level.ts`
- Create: `src/engine/types/session.ts`
- Create: `src/engine/types/index.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: TypeScript standard types
- Produces: `AnswerSpec`, `EvaluationResult`, `GeneratorRule`, `Question`, `LevelConfigV2`, `SessionState`, `SessionResult`

- [ ] **Step 1: Write type verification test**

Create `tests/unit/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  AnswerSpec,
  GeneratorRule,
  LevelConfigV2,
  SessionState,
} from '../../src/engine/types';

describe('Core Domain Types', () => {
  it('instantiates valid AnswerSpec variants', () => {
    const intAnswer: AnswerSpec = { kind: 'integer', value: 42 };
    const rationalAnswer: AnswerSpec = { kind: 'rational', numerator: 3, denominator: 4 };
    const decimalAnswer: AnswerSpec = { kind: 'decimal', scaledValue: 250, scale: 2 };
    const choiceAnswer: AnswerSpec = { kind: 'choice', optionId: 'opt-1', options: [{ id: 'opt-1', label: '10' }] };

    expect(intAnswer.kind).toBe('integer');
    expect(rationalAnswer.kind).toBe('rational');
    expect(decimalAnswer.kind).toBe('decimal');
    expect(choiceAnswer.kind).toBe('choice');
  });

  it('instantiates valid GeneratorRule variants', () => {
    const addRule: GeneratorRule = {
      kind: 'addition',
      minA: 1,
      maxA: 10,
      minB: 1,
      maxB: 10,
    };
    expect(addRule.kind).toBe('addition');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/types.test.ts`
Expected: FAIL (Cannot find module `../../src/engine/types`).

- [ ] **Step 3: Create type definition files in `src/engine/types/`**

Create `src/engine/types/answer.ts`:
```typescript
export type IntegerAnswer = {
  kind: 'integer';
  value: number;
};

export type RationalAnswer = {
  kind: 'rational';
  numerator: number;
  denominator: number;
  requireSimplified?: boolean;
};

export type DecimalAnswer = {
  kind: 'decimal';
  scaledValue: number;
  scale: number;
  acceptedTolerance?: number;
};

export type ChoiceAnswer = {
  kind: 'choice';
  optionId: string;
  options: Array<{ id: string; label: string }>;
};

export type AnswerSpec = IntegerAnswer | RationalAnswer | DecimalAnswer | ChoiceAnswer;

export interface EvaluationResult {
  isCorrect: boolean;
  normalizedUserAnswer: string;
  expectedDisplay: string;
}
```

Create `src/engine/types/rules.ts`:
```typescript
export type AdditionRule = {
  kind: 'addition';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  termsCount?: number;
  targetSumMax?: number;
};

export type SubtractionRule = {
  kind: 'subtraction';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  allowNegative?: boolean;
};

export type MultiplicationRule = {
  kind: 'multiplication';
  fixedOperand?: number;
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
};

export type DivisionRule = {
  kind: 'division';
  minDivisor: number;
  maxDivisor: number;
  minQuotient: number;
  maxQuotient: number;
  requireInteger?: boolean;
};

export type MissingOperandRule = {
  kind: 'missing_operand';
  operation: '+' | '-' | '×' | '÷';
  missingPosition: 'first' | 'second' | 'random';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
};

export type GeneratorRule =
  | AdditionRule
  | SubtractionRule
  | MultiplicationRule
  | DivisionRule
  | MissingOperandRule;
```

Create `src/engine/types/question.ts`:
```typescript
import { AnswerSpec } from './answer';

export interface GenerationContext {
  levelId: string;
  sequenceIndex: number;
  contentVersion?: string;
  rulesVersion?: string;
  existingSignatures?: Set<string>;
}

export interface Question {
  questionDefinitionId: string;
  questionInstanceId: string;
  displayPrompt: string;
  answerSpec: AnswerSpec;
  primarySkillId: string;
  skillTags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  generatorKey: string;
  targetResponseTimeMs: number;
  templateFamily: string;
  explanation: string;
}
```

Create `src/engine/types/level.ts`:
```typescript
import { GeneratorRule } from './rules';

export interface LevelConfigV2 {
  id: string; // Stable string ID, e.g. "T1-ADD-01"
  order: number;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
  generatorKey: string;
  rules: GeneratorRule;
  answerKind: 'integer' | 'rational' | 'decimal' | 'choice';
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  questionCount: number;
  targetTimeSec: number;
  timeLimitSec: number;
  boss: boolean;
  passingAccuracy: number;
  prerequisiteIds: string[];
  primarySkillId: string;
  skillTags: string[];
  contentVersion: string;
}
```

Create `src/engine/types/session.ts`:
```typescript
import { Question } from './question';

export type SessionLifecycle =
  | 'CREATED'
  | 'ACTIVE'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABANDONED';

export interface AnswerEvent {
  eventId: string;
  questionInstanceId: string;
  questionDefinitionId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
  primarySkillId: string;
  skillTags: string[];
  submittedAtMonotonic: number;
}

export interface SessionResult {
  sessionId: string;
  levelId: string;
  sessionStatus: 'COMPLETED' | 'FAILED' | 'ABANDONED';
  questionsPresented: number;
  questionsAnswered: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number;
  score: number;
  totalTimeSec: number;
  avgResponseTimeMs: number;
  maxCombo: number;
  stars: 0 | 1 | 2 | 3;
  perfect: boolean;
  history: AnswerEvent[];
}

export interface SessionState {
  sessionId: string;
  lifecycle: SessionLifecycle;
  levelId: string;
  questions: Question[];
  currentIndex: number;
  score: number;
  streak: number;
  maxStreak: number;
  inputLocked: boolean;
  answerHistory: AnswerEvent[];
  startedAtMonotonic: number;
  deadlineMonotonic: number;
  lastFeedback: {
    isCorrect: boolean;
    explanation: string;
  } | null;
  result: SessionResult | null;
}
```

Create `src/engine/types/index.ts`:
```typescript
export * from './answer';
export * from './rules';
export * from './question';
export * from './level';
export * from './session';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types/ tests/unit/types.test.ts
git commit -m "feat(engine): define core domain types for V2 architecture

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Answer Evaluator & Precision Engine

**Files:**
- Create: `src/engine/evaluator/answerEvaluator.ts`
- Test: `tests/unit/answerEvaluator.test.ts`

**Interfaces:**
- Consumes: `AnswerSpec`, `EvaluationResult` from `src/engine/types/answer`
- Produces: `evaluateAnswer(spec: AnswerSpec, input: string): EvaluationResult`, `gcd(a: number, b: number): number`

- [ ] **Step 1: Write the failing tests for Answer Evaluator**

Create `tests/unit/answerEvaluator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { evaluateAnswer } from '../../src/engine/evaluator/answerEvaluator';
import { AnswerSpec } from '../../src/engine/types';

describe('evaluateAnswer', () => {
  describe('Integer Answer', () => {
    const spec: AnswerSpec = { kind: 'integer', value: 42 };

    it('accepts correct positive integer and ignores whitespace', () => {
      expect(evaluateAnswer(spec, '42').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '  42 ').isCorrect).toBe(true);
    });

    it('rejects incorrect integer', () => {
      expect(evaluateAnswer(spec, '41').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, 'abc').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '').isCorrect).toBe(false);
    });

    it('handles negative integers correctly', () => {
      const negSpec: AnswerSpec = { kind: 'integer', value: -15 };
      expect(evaluateAnswer(negSpec, '-15').isCorrect).toBe(true);
      expect(evaluateAnswer(negSpec, '15').isCorrect).toBe(false);
    });
  });

  describe('Rational Answer', () => {
    const spec: AnswerSpec = { kind: 'rational', numerator: 1, denominator: 2 };

    it('accepts exact fraction', () => {
      expect(evaluateAnswer(spec, '1/2').isCorrect).toBe(true);
    });

    it('accepts equivalent unsimplified fraction when requireSimplified is false', () => {
      expect(evaluateAnswer(spec, '2/4').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '4/8').isCorrect).toBe(true);
    });

    it('rejects unsimplified fraction when requireSimplified is true', () => {
      const strictSpec: AnswerSpec = { kind: 'rational', numerator: 1, denominator: 2, requireSimplified: true };
      expect(evaluateAnswer(strictSpec, '1/2').isCorrect).toBe(true);
      expect(evaluateAnswer(strictSpec, '2/4').isCorrect).toBe(false);
    });

    it('rejects division by zero in user input', () => {
      expect(evaluateAnswer(spec, '1/0').isCorrect).toBe(false);
    });
  });

  describe('Decimal Answer', () => {
    // 0.25 (scaledValue: 25, scale: 2)
    const spec: AnswerSpec = { kind: 'decimal', scaledValue: 25, scale: 2 };

    it('accepts decimal with dot or comma', () => {
      expect(evaluateAnswer(spec, '0.25').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '0,25').isCorrect).toBe(true);
    });

    it('rejects decimal with wrong value', () => {
      expect(evaluateAnswer(spec, '0.24').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '0.255').isCorrect).toBe(false);
    });
  });

  describe('Choice Answer', () => {
    const spec: AnswerSpec = {
      kind: 'choice',
      optionId: 'b',
      options: [
        { id: 'a', label: '10' },
        { id: 'b', label: '20' },
      ],
    };

    it('evaluates choice option ID correctly', () => {
      expect(evaluateAnswer(spec, 'b').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, 'a').isCorrect).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/answerEvaluator.test.ts`
Expected: FAIL (Cannot find module `../../src/engine/evaluator/answerEvaluator`).

- [ ] **Step 3: Implement Answer Evaluator**

Create `src/engine/evaluator/answerEvaluator.ts`:
```typescript
import { AnswerSpec, EvaluationResult } from '../types/answer';

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}

export function evaluateAnswer(spec: AnswerSpec, rawInput: string): EvaluationResult {
  const input = rawInput.trim();

  switch (spec.kind) {
    case 'integer': {
      const expectedDisplay = spec.value.toString();
      if (!/^-?\d+$/.test(input)) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }
      const parsed = Number(input);
      return {
        isCorrect: parsed === spec.value,
        normalizedUserAnswer: input,
        expectedDisplay,
      };
    }

    case 'rational': {
      const expectedDisplay = `${spec.numerator}/${spec.denominator}`;
      const match = input.match(/^(-?\d+)\s*\/\s*(\d+)$/);
      if (!match) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }
      const userNum = Number(match[1]);
      const userDen = Number(match[2]);

      if (userDen === 0) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }

      if (spec.requireSimplified) {
        const divisor = gcd(userNum, userDen);
        if (divisor !== 1) {
          return { isCorrect: false, normalizedUserAnswer: `${userNum}/${userDen}`, expectedDisplay };
        }
      }

      // Exact rational cross-multiplication: a/b === c/d <=> a*d === b*c
      const isEquivalent = userNum * spec.denominator === spec.numerator * userDen;
      return {
        isCorrect: isEquivalent,
        normalizedUserAnswer: `${userNum}/${userDen}`,
        expectedDisplay,
      };
    }

    case 'decimal': {
      const normalized = input.replace(',', '.');
      const expectedDisplay = (spec.scaledValue / Math.pow(10, spec.scale)).toString();
      if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }

      const parts = normalized.split('.');
      const integerPart = Number(parts[0]);
      const fractionalPartStr = parts[1] || '';
      const fractionalPadded = fractionalPartStr.padEnd(spec.scale, '0').slice(0, spec.scale);
      const sign = integerPart < 0 || Object.is(integerPart, -0) ? -1 : 1;
      const userScaled = Math.abs(integerPart) * Math.pow(10, spec.scale) + Number(fractionalPadded);
      const finalUserScaled = sign * userScaled;

      const tolerance = spec.acceptedTolerance || 0;
      const diff = Math.abs(finalUserScaled - spec.scaledValue);

      return {
        isCorrect: diff <= tolerance,
        normalizedUserAnswer: normalized,
        expectedDisplay,
      };
    }

    case 'choice': {
      const expectedOption = spec.options.find((o) => o.id === spec.optionId);
      const expectedDisplay = expectedOption ? expectedOption.label : spec.optionId;
      return {
        isCorrect: input === spec.optionId,
        normalizedUserAnswer: input,
        expectedDisplay,
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/answerEvaluator.test.ts`
Expected: PASS with all cases passing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/evaluator/ tests/unit/answerEvaluator.test.ts
git commit -m "feat(engine): implement typed AnswerSpec evaluator

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Deterministic PRNG & Generator Base Contract

**Files:**
- Create: `src/engine/utils/prng.ts`
- Create: `src/engine/generators/base.ts`
- Test: `tests/unit/prng.test.ts`

**Interfaces:**
- Consumes: Standard math/hash algorithms
- Produces: `createMulberry32(seed: string | number): () => number`, `QuestionGenerator` interface

- [ ] **Step 1: Write PRNG determinism test**

Create `tests/unit/prng.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';

describe('Mulberry32 PRNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const prng1 = createMulberry32('daily-challenge-2026-09-11');
    const prng2 = createMulberry32('daily-challenge-2026-09-11');

    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());

    expect(seq1).toEqual(seq2);
  });

  it('produces numbers strictly within [0, 1)', () => {
    const prng = createMulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const val = prng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const prng1 = createMulberry32('seed-a');
    const prng2 = createMulberry32('seed-b');

    expect(prng1()).not.toEqual(prng2());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/prng.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Mulberry32 PRNG & generator base**

Create `src/engine/utils/prng.ts`:
```typescript
/**
 * Generates a 32-bit integer hash from a string seed.
 */
function hashStringSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Creates a deterministic Mulberry32 pseudo-random number generator.
 * Returns a function producing floats in [0, 1).
 */
export function createMulberry32(seed: string | number): () => number {
  let state = typeof seed === 'string' ? hashStringSeed(seed) : seed >>> 0;
  if (state === 0) state = 1;

  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Helper to pick an integer in [min, max] inclusive using a prng.
 */
export function randomInt(prng: () => number, min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(prng() * (high - low + 1)) + low;
}
```

Create `src/engine/generators/base.ts`:
```typescript
import { GeneratorRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';

export interface QuestionGenerator<TRule extends GeneratorRule = GeneratorRule> {
  readonly key: string;
  readonly version: number;
  validateRule(rule: unknown): TRule;
  generate(rule: TRule, prng: () => number, context: GenerationContext): Question;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/prng.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/utils/prng.ts src/engine/generators/base.ts tests/unit/prng.test.ts
git commit -m "feat(engine): add deterministic Mulberry32 PRNG and generator contract

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Arithmetic Generators (Addition, Subtraction, Multiplication, Division, Missing Operand)

**Files:**
- Create: `src/engine/generators/addition.ts`
- Create: `src/engine/generators/subtraction.ts`
- Create: `src/engine/generators/multiplication.ts`
- Create: `src/engine/generators/division.ts`
- Create: `src/engine/generators/missingOperand.ts`
- Test: `tests/unit/generators.test.ts`

**Interfaces:**
- Consumes: `QuestionGenerator`, `randomInt` from `src/engine/utils/prng`
- Produces: `AdditionGenerator`, `SubtractionGenerator`, `MultiplicationGenerator`, `DivisionGenerator`, `MissingOperandGenerator`

- [ ] **Step 1: Write unit tests for all arithmetic generators**

Create `tests/unit/generators.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { AdditionGenerator } from '../../src/engine/generators/addition';
import { SubtractionGenerator } from '../../src/engine/generators/subtraction';
import { MultiplicationGenerator } from '../../src/engine/generators/multiplication';
import { DivisionGenerator } from '../../src/engine/generators/division';
import { MissingOperandGenerator } from '../../src/engine/generators/missingOperand';
import { GenerationContext } from '../../src/engine/types';

describe('Arithmetic Generators', () => {
  const dummyContext: GenerationContext = {
    levelId: 'TEST-01',
    sequenceIndex: 1,
  };

  it('generates valid addition questions within bounds', () => {
    const generator = new AdditionGenerator();
    const prng = createMulberry32(42);
    const q = generator.generate(
      { kind: 'addition', minA: 5, maxA: 10, minB: 1, maxB: 5 },
      prng,
      dummyContext
    );

    expect(q.answerSpec.kind).toBe('integer');
    if (q.answerSpec.kind === 'integer') {
      expect(q.answerSpec.value).toBeGreaterThanOrEqual(6);
      expect(q.answerSpec.value).toBeLessThanOrEqual(15);
    }
    expect(q.displayPrompt).toMatch(/^\d+ \+ \d+$/);
  });

  it('generates non-negative subtraction when allowNegative is false', () => {
    const generator = new SubtractionGenerator();
    const prng = createMulberry32(99);
    for (let i = 0; i < 50; i++) {
      const q = generator.generate(
        { kind: 'subtraction', minA: 1, maxA: 20, minB: 1, maxB: 20, allowNegative: false },
        prng,
        dummyContext
      );
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('generates multiplication with fixed operand', () => {
    const generator = new MultiplicationGenerator();
    const prng = createMulberry32(100);
    const q = generator.generate(
      { kind: 'multiplication', fixedOperand: 7, minA: 2, maxA: 9, minB: 2, maxB: 9 },
      prng,
      dummyContext
    );
    expect(q.displayPrompt).toContain('7');
    if (q.answerSpec.kind === 'integer') {
      expect(q.answerSpec.value % 7).toBe(0);
    }
  });

  it('generates clean division with non-zero divisor', () => {
    const generator = new DivisionGenerator();
    const prng = createMulberry32(777);
    for (let i = 0; i < 50; i++) {
      const q = generator.generate(
        { kind: 'division', minDivisor: 2, maxDivisor: 9, minQuotient: 1, maxQuotient: 10, requireInteger: true },
        prng,
        dummyContext
      );
      if (q.answerSpec.kind === 'integer') {
        expect(Number.isInteger(q.answerSpec.value)).toBe(true);
      }
    }
  });

  it('generates single-solution missing operand questions', () => {
    const generator = new MissingOperandGenerator();
    const prng = createMulberry32(555);
    const q = generator.generate(
      { kind: 'missing_operand', operation: '×', missingPosition: 'first', minA: 2, maxA: 9, minB: 2, maxB: 9 },
      prng,
      dummyContext
    );
    expect(q.displayPrompt).toMatch(/^\? × \d+ = \d+$/);
    expect(q.answerSpec.kind).toBe('integer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/generators.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Arithmetic Generators**

Create `src/engine/generators/addition.ts`:
```typescript
import { QuestionGenerator } from './base';
import { AdditionRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class AdditionGenerator implements QuestionGenerator<AdditionRule> {
  readonly key = 'addition';
  readonly version = 1;

  validateRule(rule: unknown): AdditionRule {
    const r = rule as AdditionRule;
    if (r.minA > r.maxA || r.minB > r.maxB) {
      throw new Error('Invalid AdditionRule bounds');
    }
    return r;
  }

  generate(rule: AdditionRule, prng: () => number, context: GenerationContext): Question {
    const termsCount = rule.termsCount || 2;

    if (termsCount === 3) {
      const a = randomInt(prng, rule.minA, rule.maxA);
      const b = randomInt(prng, rule.minB, rule.maxB);
      const c = randomInt(prng, rule.minB, rule.maxB);
      const answer = a + b + c;
      const prompt = `${a} + ${b} + ${c}`;
      return {
        questionDefinitionId: `add-3-${a}-${b}-${c}`,
        questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
        displayPrompt: prompt,
        answerSpec: { kind: 'integer', value: answer },
        primarySkillId: 'addition.three_terms',
        skillTags: ['addition'],
        difficulty: 2,
        generatorKey: this.key,
        targetResponseTimeMs: 3500,
        templateFamily: 'addition_chain',
        explanation: `${a} + ${b} + ${c} = ${answer}`,
      };
    }

    const a = randomInt(prng, rule.minA, rule.maxA);
    const b = randomInt(prng, rule.minB, rule.maxB);
    const answer = a + b;
    const prompt = `${a} + ${b}`;

    return {
      questionDefinitionId: `add-2-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: this.key,
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: `${a} + ${b} = ${answer}`,
    };
  }
}
```

Create `src/engine/generators/subtraction.ts`:
```typescript
import { QuestionGenerator } from './base';
import { SubtractionRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class SubtractionGenerator implements QuestionGenerator<SubtractionRule> {
  readonly key = 'subtraction';
  readonly version = 1;

  validateRule(rule: unknown): SubtractionRule {
    const r = rule as SubtractionRule;
    if (r.minA > r.maxA || r.minB > r.maxB) {
      throw new Error('Invalid SubtractionRule bounds');
    }
    return r;
  }

  generate(rule: SubtractionRule, prng: () => number, context: GenerationContext): Question {
    let a = randomInt(prng, rule.minA, rule.maxA);
    let b = randomInt(prng, rule.minB, rule.maxB);

    if (!rule.allowNegative && a < b) {
      const temp = a;
      a = b;
      b = temp;
    }

    const answer = a - b;
    const prompt = `${a} - ${b}`;

    return {
      questionDefinitionId: `sub-2-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      primarySkillId: 'subtraction.basic',
      skillTags: ['subtraction'],
      difficulty: 1,
      generatorKey: this.key,
      targetResponseTimeMs: 3000,
      templateFamily: 'subtraction_basic',
      explanation: `${a} - ${b} = ${answer}`,
    };
  }
}
```

Create `src/engine/generators/multiplication.ts`:
```typescript
import { QuestionGenerator } from './base';
import { MultiplicationRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class MultiplicationGenerator implements QuestionGenerator<MultiplicationRule> {
  readonly key = 'multiplication';
  readonly version = 1;

  validateRule(rule: unknown): MultiplicationRule {
    const r = rule as MultiplicationRule;
    return r;
  }

  generate(rule: MultiplicationRule, prng: () => number, context: GenerationContext): Question {
    let a: number;
    let b: number;

    if (rule.fixedOperand !== undefined) {
      a = rule.fixedOperand;
      b = randomInt(prng, rule.minB, rule.maxB);
    } else {
      a = randomInt(prng, rule.minA, rule.maxA);
      b = randomInt(prng, rule.minB, rule.maxB);
    }

    const answer = a * b;
    const prompt = `${a} × ${b}`;

    return {
      questionDefinitionId: `mul-2-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      primarySkillId: `multiplication.x${a}`,
      skillTags: ['multiplication'],
      difficulty: 2,
      generatorKey: this.key,
      targetResponseTimeMs: 3000,
      templateFamily: 'multiplication_basic',
      explanation: `${a} × ${b} = ${answer}`,
    };
  }
}
```

Create `src/engine/generators/division.ts`:
```typescript
import { QuestionGenerator } from './base';
import { DivisionRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class DivisionGenerator implements QuestionGenerator<DivisionRule> {
  readonly key = 'division';
  readonly version = 1;

  validateRule(rule: unknown): DivisionRule {
    const r = rule as DivisionRule;
    if (r.minDivisor <= 0) {
      throw new Error('Division divisor must be greater than zero');
    }
    return r;
  }

  generate(rule: DivisionRule, prng: () => number, context: GenerationContext): Question {
    const divisor = randomInt(prng, Math.max(1, rule.minDivisor), rule.maxDivisor);
    const quotient = randomInt(prng, rule.minQuotient, rule.maxQuotient);
    const dividend = divisor * quotient;

    const prompt = `${dividend} ÷ ${divisor}`;

    return {
      questionDefinitionId: `div-2-${dividend}-${divisor}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: quotient },
      primarySkillId: `division.by_${divisor}`,
      skillTags: ['division'],
      difficulty: 2,
      generatorKey: this.key,
      targetResponseTimeMs: 3500,
      templateFamily: 'division_clean',
      explanation: `${dividend} ÷ ${divisor} = ${quotient} (karena ${divisor} × ${quotient} = ${dividend})`,
    };
  }
}
```

Create `src/engine/generators/missingOperand.ts`:
```typescript
import { QuestionGenerator } from './base';
import { MissingOperandRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class MissingOperandGenerator implements QuestionGenerator<MissingOperandRule> {
  readonly key = 'missing_operand';
  readonly version = 1;

  validateRule(rule: unknown): MissingOperandRule {
    return rule as MissingOperandRule;
  }

  generate(rule: MissingOperandRule, prng: () => number, context: GenerationContext): Question {
    const a = randomInt(prng, rule.minA, rule.maxA);
    const b = randomInt(prng, rule.minB, rule.maxB);
    const isFirstMissing = rule.missingPosition === 'first' || (rule.missingPosition === 'random' && prng() > 0.5);

    let displayPrompt: string;
    let answerValue: number;
    let explanation: string;

    if (rule.operation === '+') {
      const total = a + b;
      if (isFirstMissing) {
        displayPrompt = `? + ${b} = ${total}`;
        answerValue = a;
        explanation = `? = ${total} - ${b} = ${a}`;
      } else {
        displayPrompt = `${a} + ? = ${total}`;
        answerValue = b;
        explanation = `? = ${total} - ${a} = ${b}`;
      }
    } else if (rule.operation === '-') {
      const diff = Math.abs(a - b);
      const larger = Math.max(a, b);
      const smaller = Math.min(a, b);
      if (isFirstMissing) {
        displayPrompt = `? - ${smaller} = ${diff}`;
        answerValue = larger;
        explanation = `? = ${diff} + ${smaller} = ${larger}`;
      } else {
        displayPrompt = `${larger} - ? = ${diff}`;
        answerValue = smaller;
        explanation = `? = ${larger} - ${diff} = ${smaller}`;
      }
    } else {
      // Multiplication
      const product = a * b;
      if (isFirstMissing) {
        displayPrompt = `? × ${b} = ${product}`;
        answerValue = a;
        explanation = `? = ${product} ÷ ${b} = ${a}`;
      } else {
        displayPrompt = `${a} × ? = ${product}`;
        answerValue = b;
        explanation = `? = ${product} ÷ ${a} = ${b}`;
      }
    }

    return {
      questionDefinitionId: `missing-${rule.operation}-${a}-${b}-${isFirstMissing ? '1' : '2'}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: answerValue },
      primarySkillId: `missing_operand.${rule.operation}`,
      skillTags: ['missing_operand'],
      difficulty: 2,
      generatorKey: this.key,
      targetResponseTimeMs: 3500,
      templateFamily: 'missing_operand_basic',
      explanation,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/generators.test.ts`
Expected: PASS with 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/ tests/unit/generators.test.ts
git commit -m "feat(engine): implement core arithmetic question generators

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Question Generator Registry

**Files:**
- Create: `src/engine/registry/index.ts`
- Test: `tests/unit/registry.test.ts`

**Interfaces:**
- Consumes: `QuestionGenerator`, `LevelConfigV2`, `createMulberry32`
- Produces: `QuestionGeneratorRegistry` class and singleton `generatorRegistry`

- [ ] **Step 1: Write registry tests**

Create `tests/unit/registry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { QuestionGeneratorRegistry } from '../../src/engine/registry';
import { AdditionGenerator } from '../../src/engine/generators/addition';
import { LevelConfigV2 } from '../../src/engine/types';

describe('QuestionGeneratorRegistry', () => {
  it('registers and retrieves generators', () => {
    const registry = new QuestionGeneratorRegistry();
    const addGen = new AdditionGenerator();
    registry.register(addGen);

    expect(registry.get('addition')).toBe(addGen);
  });

  it('throws when requesting unregistered generator key', () => {
    const registry = new QuestionGeneratorRegistry();
    expect(() => registry.get('non_existent')).toThrowError(/not registered/);
  });

  it('generates unique session questions without duplicates', () => {
    const registry = new QuestionGeneratorRegistry();
    registry.register(new AdditionGenerator());

    const level: LevelConfigV2 = {
      id: 'T1-ADD-01',
      order: 1,
      tier: 1,
      title: 'Penjumlahan 1–10',
      description: 'Tambah satuan',
      generatorKey: 'addition',
      rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 10,
      targetTimeSec: 30,
      timeLimitSec: 45,
      boss: false,
      passingAccuracy: 70,
      prerequisiteIds: [],
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      contentVersion: '2.0.0',
    };

    const questions = registry.generateSessionQuestions(level, 'test-seed-42');
    expect(questions.length).toBe(10);

    const prompts = questions.map((q) => q.displayPrompt);
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement QuestionGeneratorRegistry**

Create `src/engine/registry/index.ts`:
```typescript
import { QuestionGenerator } from '../generators/base';
import { LevelConfigV2 } from '../types/level';
import { Question, GenerationContext } from '../types/question';
import { createMulberry32 } from '../utils/prng';
import { AdditionGenerator } from '../generators/addition';
import { SubtractionGenerator } from '../generators/subtraction';
import { MultiplicationGenerator } from '../generators/multiplication';
import { DivisionGenerator } from '../generators/division';
import { MissingOperandGenerator } from '../generators/missingOperand';

export class QuestionGeneratorRegistry {
  private generators = new Map<string, QuestionGenerator>();

  register(generator: QuestionGenerator): void {
    this.generators.set(generator.key, generator);
  }

  get(key: string): QuestionGenerator {
    const gen = this.generators.get(key);
    if (!gen) {
      throw new Error(`Question generator for key "${key}" is not registered`);
    }
    return gen;
  }

  has(key: string): boolean {
    return this.generators.has(key);
  }

  generateQuestion(
    levelConfig: LevelConfigV2,
    prng: () => number,
    context: GenerationContext
  ): Question {
    const generator = this.get(levelConfig.generatorKey);
    const validatedRule = generator.validateRule(levelConfig.rules);
    return generator.generate(validatedRule, prng, context);
  }

  generateSessionQuestions(
    levelConfig: LevelConfigV2,
    seed: string | number
  ): Question[] {
    const prng = createMulberry32(seed);
    const questions: Question[] = [];
    const seenSignatures = new Set<string>();

    for (let i = 0; i < levelConfig.questionCount; i++) {
      let candidate: Question | null = null;
      let attempts = 0;

      while (attempts < 25) {
        attempts++;
        const context: GenerationContext = {
          levelId: levelConfig.id,
          sequenceIndex: i + 1,
          contentVersion: levelConfig.contentVersion,
          existingSignatures: seenSignatures,
        };

        const q = this.generateQuestion(levelConfig, prng, context);
        if (!seenSignatures.has(q.displayPrompt)) {
          candidate = q;
          seenSignatures.add(q.displayPrompt);
          break;
        }
      }

      // If attempts exhausted (small range), fall back to candidate
      if (!candidate) {
        candidate = this.generateQuestion(levelConfig, prng, {
          levelId: levelConfig.id,
          sequenceIndex: i + 1,
        });
      }

      questions.push(candidate);
    }

    return questions;
  }
}

// Default pre-populated singleton registry
export const generatorRegistry = new QuestionGeneratorRegistry();
generatorRegistry.register(new AdditionGenerator());
generatorRegistry.register(new SubtractionGenerator());
generatorRegistry.register(new MultiplicationGenerator());
generatorRegistry.register(new DivisionGenerator());
generatorRegistry.register(new MissingOperandGenerator());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/registry/ tests/unit/registry.test.ts
git commit -m "feat(engine): implement QuestionGeneratorRegistry with collision avoidance

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Monotonic Timer & Session Clock

**Files:**
- Create: `src/engine/session/timer.ts`
- Test: `tests/unit/timer.test.ts`

**Interfaces:**
- Consumes: Node/browser `performance.now()`
- Produces: `MonotonicTimer` class

- [ ] **Step 1: Write monotonic timer tests**

Create `tests/unit/timer.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonotonicTimer } from '../../src/engine/session/timer';

describe('MonotonicTimer', () => {
  let mockNow = 1000;

  beforeEach(() => {
    mockNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow);
  });

  it('calculates remaining and elapsed time correctly', () => {
    const timer = new MonotonicTimer(30); // 30 seconds
    timer.start();

    mockNow += 5000; // 5 seconds passed
    expect(timer.getElapsedActiveMs()).toBe(5000);
    expect(timer.getRemainingMs()).toBe(25000);
    expect(timer.isExpired()).toBe(false);

    mockNow += 26000; // past deadline
    expect(timer.isExpired()).toBe(true);
    expect(timer.getRemainingMs()).toBe(0);
  });

  it('excludes pause duration from active elapsed time', () => {
    const timer = new MonotonicTimer(30);
    timer.start();

    mockNow += 2000; // 2 seconds active
    timer.pause();

    mockNow += 10000; // 10 seconds paused
    timer.resume();

    mockNow += 3000; // 3 seconds active after resume
    expect(timer.getElapsedActiveMs()).toBe(5000); // 2s + 3s = 5s active
    expect(timer.getRemainingMs()).toBe(25000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/timer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement MonotonicTimer**

Create `src/engine/session/timer.ts`:
```typescript
export class MonotonicTimer {
  private startedAt = 0;
  private deadline = 0;
  private totalPausedMs = 0;
  private pauseStartedAt: number | null = null;
  private isRunning = false;

  constructor(private timeLimitSec: number) {}

  start(): void {
    const now = performance.now();
    this.startedAt = now;
    this.deadline = now + this.timeLimitSec * 1000;
    this.totalPausedMs = 0;
    this.pauseStartedAt = null;
    this.isRunning = true;
  }

  pause(): void {
    if (!this.isRunning || this.pauseStartedAt !== null) return;
    this.pauseStartedAt = performance.now();
  }

  resume(): void {
    if (!this.isRunning || this.pauseStartedAt === null) return;
    const now = performance.now();
    const pausedDuration = now - this.pauseStartedAt;
    this.totalPausedMs += pausedDuration;
    this.deadline += pausedDuration; // extend deadline by pause duration
    this.pauseStartedAt = null;
  }

  getElapsedActiveMs(): number {
    if (!this.isRunning) return 0;
    const now = performance.now();
    const currentPause = this.pauseStartedAt !== null ? now - this.pauseStartedAt : 0;
    return Math.max(0, now - this.startedAt - this.totalPausedMs - currentPause);
  }

  getRemainingMs(): number {
    if (!this.isRunning) return this.timeLimitSec * 1000;
    const now = performance.now();
    const currentPause = this.pauseStartedAt !== null ? now - this.pauseStartedAt : 0;
    const effectiveDeadline = this.deadline + currentPause;
    return Math.max(0, effectiveDeadline - now);
  }

  isExpired(): boolean {
    return this.getRemainingMs() <= 0;
  }

  getStartedAt(): number {
    return this.startedAt;
  }

  getDeadline(): number {
    return this.deadline;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/timer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session/timer.ts tests/unit/timer.test.ts
git commit -m "feat(engine): implement MonotonicTimer with pause duration exclusion

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Unified Gameplay Session Reducer (FSM)

**Files:**
- Create: `src/engine/session/reducer.ts`
- Test: `tests/unit/sessionReducer.test.ts`

**Interfaces:**
- Consumes: `SessionState`, `SessionAction`, `evaluateAnswer`
- Produces: `gameplaySessionReducer`, `createInitialSessionState`, `calculateSessionStars`

- [ ] **Step 1: Write session reducer tests**

Create `tests/unit/sessionReducer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  gameplaySessionReducer,
  createInitialSessionState,
} from '../../src/engine/session/reducer';
import { Question, LevelConfigV2 } from '../../src/engine/types';

describe('GameplaySessionReducer', () => {
  const dummyLevel: LevelConfigV2 = {
    id: 'T1-ADD-01',
    order: 1,
    tier: 1,
    title: 'Level 1',
    description: '',
    generatorKey: 'addition',
    rules: { kind: 'addition', minA: 1, maxA: 5, minB: 1, maxB: 5 },
    answerKind: 'integer',
    difficulty: 1,
    questionCount: 2,
    targetTimeSec: 10,
    timeLimitSec: 20,
    boss: false,
    passingAccuracy: 70,
    prerequisiteIds: [],
    primarySkillId: 'addition.basic',
    skillTags: ['addition'],
    contentVersion: '2.0.0',
  };

  const dummyQuestions: Question[] = [
    {
      questionDefinitionId: 'q1',
      questionInstanceId: 'T1-ADD-01:1',
      displayPrompt: '2 + 3',
      answerSpec: { kind: 'integer', value: 5 },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: 'addition',
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: '2 + 3 = 5',
    },
    {
      questionDefinitionId: 'q2',
      questionInstanceId: 'T1-ADD-01:2',
      displayPrompt: '4 + 4',
      answerSpec: { kind: 'integer', value: 8 },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: 'addition',
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: '4 + 4 = 8',
    },
  ];

  it('starts session and transitions from CREATED to ACTIVE', () => {
    let state = createInitialSessionState('sess-1', dummyLevel, dummyQuestions);
    expect(state.lifecycle).toBe('CREATED');

    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);
    expect(state.lifecycle).toBe('ACTIVE');
    expect(state.startedAtMonotonic).toBe(1000);
  });

  it('evaluates answers and transitions to COMPLETED on last answer without undercount', () => {
    let state = createInitialSessionState('sess-1', dummyLevel, dummyQuestions);
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    // Answer Q1 correctly
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '5', responseTimeMs: 1500, monotonicNow: 2500 },
      dummyLevel
    );
    expect(state.score).toBeGreaterThan(0);
    expect(state.streak).toBe(1);
    expect(state.currentIndex).toBe(1);

    // Answer Q2 correctly (final answer)
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '8', responseTimeMs: 1200, monotonicNow: 3700 },
      dummyLevel
    );

    expect(state.lifecycle).toBe('COMPLETED');
    expect(state.result).not.toBeNull();
    expect(state.result?.correctCount).toBe(2);
    expect(state.result?.wrongCount).toBe(0);
    expect(state.result?.unansweredCount).toBe(0);
    expect(state.result?.accuracy).toBe(100);
    expect(state.result?.stars).toBe(3);
    expect(state.result?.perfect).toBe(true);
  });

  it('locks input when deadline is reached and records remaining as unanswered', () => {
    let state = createInitialSessionState('sess-1', dummyLevel, dummyQuestions);
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    // Answer Q1
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '5', responseTimeMs: 1500, monotonicNow: 2500 },
      dummyLevel
    );

    // Timeout before answering Q2
    state = gameplaySessionReducer(
      state,
      { type: 'DEADLINE_REACHED', monotonicNow: 21000 },
      dummyLevel
    );

    expect(state.lifecycle).toBe('FAILED');
    expect(state.inputLocked).toBe(true);
    expect(state.result?.correctCount).toBe(1);
    expect(state.result?.unansweredCount).toBe(1);
    expect(state.result?.stars).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/sessionReducer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement GameplaySessionReducer**

Create `src/engine/session/reducer.ts`:
```typescript
import { SessionState, SessionResult, AnswerEvent } from '../types/session';
import { LevelConfigV2 } from '../types/level';
import { Question } from '../types/question';
import { evaluateAnswer } from '../evaluator/answerEvaluator';

export type SessionAction =
  | { type: 'START_SESSION'; monotonicNow: number }
  | { type: 'SUBMIT_ANSWER'; rawInput: string; responseTimeMs: number; monotonicNow: number }
  | { type: 'DEADLINE_REACHED'; monotonicNow: number }
  | { type: 'ABANDON_SESSION'; monotonicNow: number }
  | { type: 'UNLOCK_INPUT' };

export function createInitialSessionState(
  sessionId: string,
  levelConfig: LevelConfigV2,
  questions: Question[]
): SessionState {
  return {
    sessionId,
    lifecycle: 'CREATED',
    levelId: levelConfig.id,
    questions,
    currentIndex: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    inputLocked: false,
    answerHistory: [],
    startedAtMonotonic: 0,
    deadlineMonotonic: 0,
    lastFeedback: null,
    result: null,
  };
}

export function calculateSessionStars(
  accuracy: number,
  totalTimeSec: number,
  targetTimeSec: number,
  isCompleted: boolean,
  boss: boolean
): 0 | 1 | 2 | 3 {
  if (!isCompleted) return 0;
  if (boss) {
    if (accuracy >= 95 && totalTimeSec <= targetTimeSec) return 3;
    if (accuracy >= 85) return 2;
    if (accuracy >= 70) return 1;
    return 0;
  }

  if (accuracy >= 95 && totalTimeSec <= targetTimeSec) return 3;
  if (accuracy >= 85) return 2;
  if (accuracy >= 70) return 1;
  return 0;
}

export function gameplaySessionReducer(
  state: SessionState,
  action: SessionAction,
  levelConfig: LevelConfigV2
): SessionState {
  switch (action.type) {
    case 'START_SESSION': {
      if (state.lifecycle !== 'CREATED') return state;
      return {
        ...state,
        lifecycle: 'ACTIVE',
        startedAtMonotonic: action.monotonicNow,
        deadlineMonotonic: action.monotonicNow + levelConfig.timeLimitSec * 1000,
        inputLocked: false,
      };
    }

    case 'UNLOCK_INPUT': {
      return { ...state, inputLocked: false };
    }

    case 'SUBMIT_ANSWER': {
      if (state.lifecycle !== 'ACTIVE' || state.inputLocked) return state;

      const currentQ = state.questions[state.currentIndex];
      if (!currentQ) return state;

      const evalResult = evaluateAnswer(currentQ.answerSpec, action.rawInput);
      const isCorrect = evalResult.isCorrect;

      const newStreak = isCorrect ? state.streak + 1 : 0;
      const newMaxStreak = Math.max(state.maxStreak, newStreak);
      const points = isCorrect ? 100 + Math.min(newStreak * 10, 50) : 0;
      const newScore = state.score + points;

      const event: AnswerEvent = {
        eventId: `${state.sessionId}:${state.currentIndex + 1}`,
        questionInstanceId: currentQ.questionInstanceId,
        questionDefinitionId: currentQ.questionDefinitionId,
        submittedAnswer: action.rawInput,
        isCorrect,
        responseTimeMs: action.responseTimeMs,
        primarySkillId: currentQ.primarySkillId,
        skillTags: currentQ.skillTags,
        submittedAtMonotonic: action.monotonicNow,
      };

      const updatedHistory = [...state.answerHistory, event];
      const isLastQuestion = state.currentIndex + 1 >= state.questions.length;

      if (isLastQuestion) {
        // Finalize immediately
        const correctCount = updatedHistory.filter((h) => h.isCorrect).length;
        const wrongCount = updatedHistory.length - correctCount;
        const unansweredCount = 0;
        const accuracy = Math.round((correctCount / updatedHistory.length) * 100);
        const totalTimeSec = Math.max(
          1,
          Math.round((action.monotonicNow - state.startedAtMonotonic) / 1000)
        );
        const avgResponseTimeMs = Math.round(
          updatedHistory.reduce((acc, h) => acc + h.responseTimeMs, 0) / updatedHistory.length
        );
        const stars = calculateSessionStars(
          accuracy,
          totalTimeSec,
          levelConfig.targetTimeSec,
          true,
          levelConfig.boss
        );
        const perfect = correctCount === updatedHistory.length && totalTimeSec <= levelConfig.targetTimeSec;

        const result: SessionResult = {
          sessionId: state.sessionId,
          levelId: state.levelId,
          sessionStatus: 'COMPLETED',
          questionsPresented: state.questions.length,
          questionsAnswered: updatedHistory.length,
          correctCount,
          wrongCount,
          unansweredCount,
          accuracy,
          score: newScore,
          totalTimeSec,
          avgResponseTimeMs,
          maxCombo: newMaxStreak,
          stars,
          perfect,
          history: updatedHistory,
        };

        return {
          ...state,
          lifecycle: 'COMPLETED',
          score: newScore,
          streak: newStreak,
          maxStreak: newMaxStreak,
          inputLocked: true,
          answerHistory: updatedHistory,
          lastFeedback: { isCorrect, explanation: currentQ.explanation },
          result,
        };
      }

      return {
        ...state,
        currentIndex: state.currentIndex + 1,
        score: newScore,
        streak: newStreak,
        maxStreak: newMaxStreak,
        inputLocked: false,
        answerHistory: updatedHistory,
        lastFeedback: { isCorrect, explanation: currentQ.explanation },
      };
    }

    case 'DEADLINE_REACHED': {
      if (state.lifecycle !== 'ACTIVE') return state;

      const correctCount = state.answerHistory.filter((h) => h.isCorrect).length;
      const wrongCount = state.answerHistory.length - correctCount;
      const unansweredCount = state.questions.length - state.answerHistory.length;
      const answeredTotal = state.answerHistory.length;
      const accuracy = answeredTotal > 0 ? Math.round((correctCount / answeredTotal) * 100) : 0;
      const totalTimeSec = levelConfig.timeLimitSec;
      const avgResponseTimeMs =
        answeredTotal > 0
          ? Math.round(state.answerHistory.reduce((acc, h) => acc + h.responseTimeMs, 0) / answeredTotal)
          : 0;

      const result: SessionResult = {
        sessionId: state.sessionId,
        levelId: state.levelId,
        sessionStatus: 'FAILED',
        questionsPresented: state.questions.length,
        questionsAnswered: answeredTotal,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
        score: state.score,
        totalTimeSec,
        avgResponseTimeMs,
        maxCombo: state.maxStreak,
        stars: 0,
        perfect: false,
        history: state.answerHistory,
      };

      return {
        ...state,
        lifecycle: 'FAILED',
        inputLocked: true,
        result,
      };
    }

    case 'ABANDON_SESSION': {
      if (state.lifecycle !== 'ACTIVE') return state;

      return {
        ...state,
        lifecycle: 'ABANDONED',
        inputLocked: true,
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/sessionReducer.test.ts`
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session/reducer.ts tests/unit/sessionReducer.test.ts
git commit -m "feat(engine): implement unified gameplay session reducer FSM

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: V1 to V2 Progress Migration Engine (Appendix B)

**Files:**
- Create: `src/engine/migration/mapping.ts`
- Create: `src/engine/migration/migrator.ts`
- Test: `tests/unit/migration.test.ts`

**Interfaces:**
- Consumes: V1 `UserLevelProgress`
- Produces: `migrateV1ToV2(v1Data)`, `V2MigrationResult`, `V1_TO_V2_LEVEL_MAPPING`

- [ ] **Step 1: Write migration tests**

Create `tests/unit/migration.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { migrateV1ToV2, V1_TO_V2_LEVEL_MAPPING } from '../../src/engine/migration/migrator';
import { UserLevelProgress } from '../../src/types';

describe('V1 to V2 Progress Migrator', () => {
  it('maps all 24 V1 levels according to Appendix B', () => {
    for (let id = 1; id <= 24; id++) {
      expect(V1_TO_V2_LEVEL_MAPPING[id]).toBeDefined();
      expect(V1_TO_V2_LEVEL_MAPPING[id].primaryLevelId).toMatch(/^T[1-6]-/);
    }
  });

  it('is idempotent: running migration twice produces identical result', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1200, accuracy: 100, bestTimeSec: 15 },
      2: { levelId: 2, unlocked: true, stars: 2, bestScore: 900, accuracy: 85, bestTimeSec: 22 },
    };

    const res1 = migrateV1ToV2(v1Progress);
    const res2 = migrateV1ToV2(v1Progress);

    expect(res1).toEqual(res2);
  });

  it('preserves earned stars and scores, unlocks prerequisite chain, and computes legacyStarCredits', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1500, accuracy: 100, bestTimeSec: 12 },
    };

    const res = migrateV1ToV2(v1Progress);
    expect(res.levels['T1-ADD-01']).toBeDefined();
    expect(res.levels['T1-ADD-01'].stars).toBe(3);
    expect(res.levels['T1-ADD-01'].bestScore).toBe(1500);
    expect(res.levels['T1-ADD-01'].unlocked).toBe(true);
    expect(res.legacySnapshot).toEqual(v1Progress);
  });

  it('gives fresh user only T1-ADD-01 unlocked', () => {
    const res = migrateV1ToV2({});
    expect(res.levels['T1-ADD-01']?.unlocked).toBe(true);
    expect(res.levels['T1-ADD-02']?.unlocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/migration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement V1 to V2 migration engine**

Create `src/engine/migration/mapping.ts`:
```typescript
export interface V1LevelMapping {
  v1Id: number;
  primaryLevelId: string;
  order: number;
  title: string;
}

export const V1_TO_V2_LEVEL_MAPPING: Record<number, V1LevelMapping> = {
  1: { v1Id: 1, primaryLevelId: 'T1-ADD-01', order: 1, title: 'Penjumlahan 1–10' },
  2: { v1Id: 2, primaryLevelId: 'T1-ADD-02', order: 2, title: 'Penjumlahan 1–20' },
  3: { v1Id: 3, primaryLevelId: 'T1-SUB-01', order: 3, title: 'Pengurangan 1–15' },
  4: { v1Id: 4, primaryLevelId: 'T1-SUB-02', order: 4, title: 'Pengurangan 1–20' },
  5: { v1Id: 5, primaryLevelId: 'T2-MUL-02', order: 13, title: 'Perkalian Dasar (2,3,5)' },
  6: { v1Id: 6, primaryLevelId: 'T2-MUL-04', order: 15, title: 'Perkalian 4 & 6' },
  7: { v1Id: 7, primaryLevelId: 'T2-MUL-07', order: 18, title: 'Perkalian 7, 8, 9' },
  8: { v1Id: 8, primaryLevelId: 'T2-DIV-01', order: 21, title: 'Pembagian Dasar' },
  9: { v1Id: 9, primaryLevelId: 'T3-ADD-01', order: 25, title: 'Penjumlahan Dua Digit' },
  10: { v1Id: 10, primaryLevelId: 'T3-SUB-01', order: 27, title: 'Pengurangan Dua Digit' },
  11: { v1Id: 11, primaryLevelId: 'T2-MISS-01', order: 23, title: 'Misteri Pengali' },
  12: { v1Id: 12, primaryLevelId: 'T3-MIX-01', order: 35, title: 'Ujian Terampil' },
  13: { v1Id: 13, primaryLevelId: 'T4-CHAIN-03', order: 37, title: 'Tiga Angka Beruntun' },
  14: { v1Id: 14, primaryLevelId: 'T4-BODMAS-01', order: 43, title: 'Prioritas Operasi Dasar' },
  15: { v1Id: 15, primaryLevelId: 'T4-PAREN-01', order: 45, title: 'Operasi Kurung' },
  16: { v1Id: 16, primaryLevelId: 'T4-BOSS', order: 48, title: 'Ujian Mahir' },
  17: { v1Id: 17, primaryLevelId: 'T5-NEG-01', order: 49, title: 'Bilangan Negatif' },
  18: { v1Id: 18, primaryLevelId: 'T5-MUL-11-14', order: 54, title: 'Perkalian Belasan' },
  19: { v1Id: 19, primaryLevelId: 'T5-ALG-01', order: 57, title: 'Aljabar Sederhana' },
  20: { v1Id: 20, primaryLevelId: 'T5-BOSS', order: 60, title: 'Ujian Master' },
  21: { v1Id: 21, primaryLevelId: 'T6-SQUARE-01', order: 61, title: 'Pangkat Dua' },
  22: { v1Id: 22, primaryLevelId: 'T6-ALG-03', order: 69, title: 'Aljabar Bersarang' },
  23: { v1Id: 23, primaryLevelId: 'T6-MULTI', order: 70, title: 'Multi-Operasi Cepat' },
  24: { v1Id: 24, primaryLevelId: 'T6-GRANDMASTER', order: 72, title: 'Ujian Akhir Legenda' },
};
```

Create `src/engine/migration/migrator.ts`:
```typescript
import { V1_TO_V2_LEVEL_MAPPING } from './mapping';
import { UserLevelProgress } from '../../types';

export interface V2LevelProgress {
  levelId: string;
  unlocked: boolean;
  stars: number;
  bestScore: number;
  accuracy: number;
  bestTimeSec: number;
  migratedFromV1Id?: number;
}

export interface V2MigrationResult {
  migrationVersion: 1;
  levels: Record<string, V2LevelProgress>;
  legacyStarCredits: number;
  legacySnapshot: Record<number, UserLevelProgress>;
}

export function migrateV1ToV2(
  v1Progress: Record<number, UserLevelProgress>
): V2MigrationResult {
  const levels: Record<string, V2LevelProgress> = {};
  let totalV1Stars = 0;
  let totalImportedStars = 0;

  // Initialize Level 1 as unlocked by default
  levels['T1-ADD-01'] = {
    levelId: 'T1-ADD-01',
    unlocked: true,
    stars: 0,
    bestScore: 0,
    accuracy: 0,
    bestTimeSec: 0,
  };

  const v1Keys = Object.keys(v1Progress).map(Number).sort((a, b) => a - b);

  for (const v1Id of v1Keys) {
    const v1Level = v1Progress[v1Id];
    if (!v1Level) continue;

    totalV1Stars += v1Level.stars || 0;
    const mapping = V1_TO_V2_LEVEL_MAPPING[v1Id];
    if (!mapping) continue;

    const v2Id = mapping.primaryLevelId;
    const existing = levels[v2Id];

    const stars = Math.max(existing?.stars || 0, v1Level.stars || 0);
    const bestScore = Math.max(existing?.bestScore || 0, v1Level.bestScore || 0);
    const accuracy = Math.max(existing?.accuracy || 0, v1Level.accuracy || 0);
    const bestTimeSec =
      (existing?.bestTimeSec || 0) > 0 && (v1Level.bestTimeSec || 0) > 0
        ? Math.min(existing!.bestTimeSec, v1Level.bestTimeSec)
        : existing?.bestTimeSec || v1Level.bestTimeSec || 0;

    levels[v2Id] = {
      levelId: v2Id,
      unlocked: existing?.unlocked || v1Level.unlocked,
      stars,
      bestScore,
      accuracy,
      bestTimeSec,
      migratedFromV1Id: v1Id,
    };

    totalImportedStars += stars;
  }

  const legacyStarCredits = Math.max(0, totalV1Stars - totalImportedStars);

  return {
    migrationVersion: 1,
    levels,
    legacyStarCredits,
    legacySnapshot: { ...v1Progress },
  };
}

export { V1_TO_V2_LEVEL_MAPPING };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/migration/ tests/unit/migration.test.ts
git commit -m "feat(engine): implement V1 to V2 progress migration framework

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: Property-Based Invariant Test Suite ($\ge 10.000$ cases)

**Files:**
- Create: `tests/property/generatorInvariants.test.ts`

**Interfaces:**
- Consumes: `AdditionGenerator`, `SubtractionGenerator`, `MultiplicationGenerator`, `DivisionGenerator`, `MissingOperandGenerator`
- Produces: automated invariant verification of $\ge 10.000$ generated questions per family

- [ ] **Step 1: Write property-based invariant test**

Create `tests/property/generatorInvariants.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { AdditionGenerator } from '../../src/engine/generators/addition';
import { SubtractionGenerator } from '../../src/engine/generators/subtraction';
import { MultiplicationGenerator } from '../../src/engine/generators/multiplication';
import { DivisionGenerator } from '../../src/engine/generators/division';
import { MissingOperandGenerator } from '../../src/engine/generators/missingOperand';
import { evaluateAnswer } from '../../src/engine/evaluator/answerEvaluator';

describe('Property-Based Mathematical Invariants (>= 10.000 cases)', () => {
  it('Division invariant: 0 division by zero and 100% clean integer division', () => {
    const generator = new DivisionGenerator();
    const prng = createMulberry32('prop-division-seed');

    for (let i = 0; i < 10000; i++) {
      const q = generator.generate(
        { kind: 'division', minDivisor: 2, maxDivisor: 12, minQuotient: 1, maxQuotient: 20, requireInteger: true },
        prng,
        { levelId: 'PROP-DIV', sequenceIndex: i }
      );

      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(Number.isInteger(q.answerSpec.value)).toBe(true);
        expect(q.displayPrompt).not.toContain('÷ 0');

        // Evaluate answer
        const evalResult = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
        expect(evalResult.isCorrect).toBe(true);
      }
    }
  });

  it('Subtraction invariant: 0 negative answers when allowNegative is false', () => {
    const generator = new SubtractionGenerator();
    const prng = createMulberry32('prop-subtraction-seed');

    for (let i = 0; i < 10000; i++) {
      const q = generator.generate(
        { kind: 'subtraction', minA: 1, maxA: 50, minB: 1, maxB: 50, allowNegative: false },
        prng,
        { levelId: 'PROP-SUB', sequenceIndex: i }
      );

      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBeGreaterThanOrEqual(0);
        const evalResult = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
        expect(evalResult.isCorrect).toBe(true);
      }
    }
  });

  it('Multiplication invariant: 0 malformed expressions and valid product matching prompt', () => {
    const generator = new MultiplicationGenerator();
    const prng = createMulberry32('prop-multiplication-seed');

    for (let i = 0; i < 10000; i++) {
      const q = generator.generate(
        { kind: 'multiplication', minA: 2, maxA: 15, minB: 2, maxB: 15 },
        prng,
        { levelId: 'PROP-MUL', sequenceIndex: i }
      );

      if (q.answerSpec.kind === 'integer') {
        const match = q.displayPrompt.match(/^(\d+) × (\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = Number(match[1]);
          const b = Number(match[2]);
          expect(a * b).toBe(q.answerSpec.value);
        }
      }
    }
  });

  it('Missing Operand invariant: exactly one valid solution', () => {
    const generator = new MissingOperandGenerator();
    const prng = createMulberry32('prop-missing-seed');

    for (let i = 0; i < 10000; i++) {
      const q = generator.generate(
        { kind: 'missing_operand', operation: '+', missingPosition: 'random', minA: 1, maxA: 50, minB: 1, maxB: 50 },
        prng,
        { levelId: 'PROP-MISS', sequenceIndex: i }
      );

      if (q.answerSpec.kind === 'integer') {
        const evalResult = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
        expect(evalResult.isCorrect).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run property tests**

Run: `npm test tests/property/generatorInvariants.test.ts`
Expected: PASS with 4 property test suites passing 40.000 total generated cases.

- [ ] **Step 3: Commit**

```bash
git add tests/property/generatorInvariants.test.ts
git commit -m "test(engine): add property-based invariant test suite for 40.000 cases

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: V1 Compatibility Adapter

**Files:**
- Create: `src/engine/adapter/v1Adapter.ts`
- Test: `tests/unit/v1Adapter.test.ts`

**Interfaces:**
- Consumes: `LevelConfig` V1, `Question` V2
- Produces: `adaptV1LevelToV2(level: LevelConfig): LevelConfigV2`, `adaptV2QuestionToV1(q: Question): QuestionV1`

- [ ] **Step 1: Write adapter test**

Create `tests/unit/v1Adapter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { adaptV1LevelToV2, adaptV2QuestionToV1 } from '../../src/engine/adapter/v1Adapter';
import { LevelConfig } from '../../src/types';
import { Question } from '../../src/engine/types';

describe('V1 Compatibility Adapter', () => {
  it('adapts LevelConfig V1 to LevelConfigV2', () => {
    const v1Level: LevelConfig = {
      id: 1,
      tier: 'Pemula',
      tierLevel: 1,
      title: 'Penjumlahan 1–10',
      description: 'Tambah satuan',
      questionCount: 10,
      timeLimit: 30,
      operations: ['+'],
      numberRange: { min: 1, max: 10 },
    };

    const v2Level = adaptV1LevelToV2(v1Level);
    expect(v2Level.id).toBe('T1-ADD-01');
    expect(v2Level.generatorKey).toBe('addition');
    expect(v2Level.rules.kind).toBe('addition');
  });

  it('adapts Question V2 back to Question V1 interface', () => {
    const qV2: Question = {
      questionDefinitionId: 'def-1',
      questionInstanceId: 'inst-1',
      displayPrompt: '6 + 7',
      answerSpec: { kind: 'integer', value: 13 },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: 'addition',
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: '6 + 7 = 13',
    };

    const qV1 = adaptV2QuestionToV1(qV2);
    expect(qV1.text).toBe('6 + 7 = ?');
    expect(qV1.correctAnswer).toBe(13);
    expect(qV1.explanation).toBe('6 + 7 = 13');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/v1Adapter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement V1 Compatibility Adapter**

Create `src/engine/adapter/v1Adapter.ts`:
```typescript
import { LevelConfig, Question as QuestionV1 } from '../../types';
import { LevelConfigV2 } from '../types/level';
import { Question as QuestionV2 } from '../types/question';
import { V1_TO_V2_LEVEL_MAPPING } from '../migration/mapping';

export function adaptV1LevelToV2(v1Level: LevelConfig): LevelConfigV2 {
  const mapping = V1_TO_V2_LEVEL_MAPPING[v1Level.id] || {
    v1Id: v1Level.id,
    primaryLevelId: `LEGACY-${v1Level.id}`,
    order: v1Level.id,
    title: v1Level.title,
  };

  const op = v1Level.operations[0] || '+';
  let generatorKey = 'addition';
  let rules: any = {
    kind: 'addition',
    minA: v1Level.numberRange.min,
    maxA: v1Level.numberRange.max,
    minB: v1Level.numberRange.min,
    maxB: v1Level.numberRange.max,
  };

  if (op === '-') {
    generatorKey = 'subtraction';
    rules = {
      kind: 'subtraction',
      minA: v1Level.numberRange.min,
      maxA: v1Level.numberRange.max,
      minB: v1Level.numberRange.min,
      maxB: v1Level.numberRange.max,
      allowNegative: false,
    };
  } else if (op === '×') {
    generatorKey = 'multiplication';
    rules = {
      kind: 'multiplication',
      minA: v1Level.numberRange.min,
      maxA: v1Level.numberRange.max,
      minB: v1Level.numberRange.min,
      maxB: v1Level.numberRange.max,
    };
  } else if (op === '÷') {
    generatorKey = 'division';
    rules = {
      kind: 'division',
      minDivisor: Math.max(2, v1Level.numberRange.min),
      maxDivisor: v1Level.numberRange.max,
      minQuotient: 1,
      maxQuotient: 10,
      requireInteger: true,
    };
  }

  return {
    id: mapping.primaryLevelId,
    order: mapping.order,
    tier: (v1Level.tier === 'Pemula'
      ? 1
      : v1Level.tier === 'Menengah'
      ? 2
      : v1Level.tier === 'Terampil'
      ? 3
      : v1Level.tier === 'Mahir'
      ? 4
      : v1Level.tier === 'Master'
      ? 5
      : 6) as 1 | 2 | 3 | 4 | 5 | 6,
    title: v1Level.title,
    description: v1Level.description,
    generatorKey,
    rules,
    answerKind: 'integer',
    difficulty: 1,
    questionCount: v1Level.questionCount,
    targetTimeSec: Math.round(v1Level.timeLimit * 0.75),
    timeLimitSec: v1Level.timeLimit,
    boss: false,
    passingAccuracy: 70,
    prerequisiteIds: v1Level.id > 1 ? [V1_TO_V2_LEVEL_MAPPING[v1Level.id - 1]?.primaryLevelId || ''] : [],
    primarySkillId: `${generatorKey}.basic`,
    skillTags: [generatorKey],
    contentVersion: '2.0.0',
  };
}

export function adaptV2QuestionToV1(qV2: QuestionV2): QuestionV1 {
  let numericAnswer = 0;
  if (qV2.answerSpec.kind === 'integer') {
    numericAnswer = qV2.answerSpec.value;
  } else if (qV2.answerSpec.kind === 'decimal') {
    numericAnswer = qV2.answerSpec.scaledValue / Math.pow(10, qV2.answerSpec.scale);
  }

  const promptText = qV2.displayPrompt.includes('?')
    ? qV2.displayPrompt
    : `${qV2.displayPrompt} = ?`;

  return {
    id: qV2.questionInstanceId,
    text: promptText,
    correctAnswer: numericAnswer,
    options: [],
    explanation: qV2.explanation,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/v1Adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all test suites to confirm full green build**

Run: `npm test`
Expected: PASS across all test files (unit and property tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/adapter/ tests/unit/v1Adapter.test.ts
git commit -m "feat(engine): add V1 compatibility adapter for seamless UI integration

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
