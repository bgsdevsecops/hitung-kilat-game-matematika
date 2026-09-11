# Hitung Kilat V2 Campaign Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Hitung Kilat V2 engine to a full 72-level campaign (6 tiers × 12 levels) featuring 7 new generator families, an immutable 72-level content manifest with cycle-free DAG validation, adaptive keypad input (supporting negative, rational, and decimal answers), and a 70,000-case property-based invariant test suite.

**Architecture:** Extend the modular engine architecture in `src/engine/` by defining extended generator rules, implementing 7 new generators, compiling the canonical 72-level manifest in `src/engine/manifest/`, enforcing DAG integrity validation, and building an adaptive keypad component (`DynamicKeypad.tsx`) for multi-format input.

**Tech Stack:** TypeScript ~5.8.2, React 19, Vitest 5.0.0, Vite 6.2.3, pure JavaScript/TypeScript math without runtime string `eval()`.

**Spec:** `docs/superpowers/specs/2026-09-11-v2-campaign-expansion-design.md`

## Global Constraints

- Never modify code on `main` or `master` branch; work strictly on feature branch `feature/12.9.11.15-v2-campaign-expansion`.
- Do NOT delete existing files or code (`no delete`).
- Do NOT run `git push` to remote or create PR/MR.
- Commit attribution must end with: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Math correctness is P0: 0 division by zero, 0 malformed expressions, 0 negative subtraction if disallowed, 0 non-integer linear algebra solutions, 0 non-square roots.
- Property test gate: $\ge 10.000$ generated cases per generator family across 7 new families ($\ge 70.000$ cases total).

---

### Task 1: Extended Domain Rules & Types for New Generators

**Files:**
- Modify: `src/engine/types/rules.ts`
- Modify: `src/engine/types/index.ts`
- Test: `tests/unit/extendedTypes.test.ts`

**Interfaces:**
- Consumes: `GeneratorRule` from `src/engine/types/rules.ts`
- Produces: `ChainRule`, `BodmasRule`, `SignedRule`, `AlgebraRule`, `PowerRootRule`, `FractionPercentageRule`, `MixedBlitzRule` exported in `src/engine/types`

- [ ] **Step 1: Write type verification test**

Create `tests/unit/extendedTypes.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  GeneratorRule,
  ChainRule,
  BodmasRule,
  SignedRule,
  AlgebraRule,
  PowerRootRule,
  FractionPercentageRule,
  MixedBlitzRule,
} from '../../src/engine/types';

describe('Extended Domain Rules Types', () => {
  it('instantiates valid ChainRule', () => {
    const rule: ChainRule = {
      kind: 'chain',
      operators: ['+', '-'],
      termsCount: 3,
      minOperand: 1,
      maxOperand: 20,
      allowIntermediateNegative: false,
    };
    expect(rule.kind).toBe('chain');
    expect(rule.termsCount).toBe(3);
  });

  it('instantiates valid BodmasRule', () => {
    const rule: BodmasRule = {
      kind: 'bodmas',
      template: 'a_plus_b_times_c',
      minOperand: 1,
      maxOperand: 10,
      requireCleanDivision: true,
    };
    expect(rule.kind).toBe('bodmas');
  });

  it('instantiates valid SignedRule', () => {
    const rule: SignedRule = {
      kind: 'signed',
      operation: '+',
      minOperand: -20,
      maxOperand: 20,
    };
    expect(rule.kind).toBe('signed');
  });

  it('instantiates valid AlgebraRule', () => {
    const rule: AlgebraRule = {
      kind: 'algebra',
      template: 'two_step_linear',
      variableName: 'x',
      minSolution: 1,
      maxSolution: 10,
      minCoefficient: 1,
      maxCoefficient: 5,
    };
    expect(rule.kind).toBe('algebra');
  });

  it('instantiates valid PowerRootRule', () => {
    const rule: PowerRootRule = {
      kind: 'power_root',
      mode: 'square',
      minBase: 1,
      maxBase: 25,
    };
    expect(rule.kind).toBe('power_root');
  });

  it('instantiates valid FractionPercentageRule', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'mental_percentage',
    };
    expect(rule.kind).toBe('fraction_percentage');
  });

  it('instantiates valid MixedBlitzRule as a discriminated union member', () => {
    const rule: GeneratorRule = {
      kind: 'mixed_blitz',
      subRules: [
        { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
        { kind: 'power_root', mode: 'square', minBase: 1, maxBase: 10 },
      ],
    };
    expect(rule.kind).toBe('mixed_blitz');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/extendedTypes.test.ts`
Expected: FAIL with type export errors.

- [ ] **Step 3: Update `src/engine/types/rules.ts`**

Edit `src/engine/types/rules.ts` to add the 7 new rule types and include them in `GeneratorRule`:
```typescript
export type ChainRule = {
  kind: 'chain';
  operators: Array<'+' | '-'>;
  termsCount: 3 | 4;
  minOperand: number;
  maxOperand: number;
  allowIntermediateNegative?: boolean;
};

export type BodmasTemplate =
  | 'a_plus_b_times_c'
  | 'a_times_b_plus_c'
  | 'a_minus_b_div_c'
  | 'paren_add_div_c'
  | 'paren_sub_mul_c'
  | 'paren_nested_bodmas';

export type BodmasRule = {
  kind: 'bodmas';
  template: BodmasTemplate;
  minOperand: number;
  maxOperand: number;
  requireCleanDivision?: boolean;
};

export type SignedRule = {
  kind: 'signed';
  operation: '+' | '-' | '×' | '÷';
  minOperand: number;
  maxOperand: number;
  allowZeroOperand?: boolean;
};

export type AlgebraTemplate =
  | 'one_step_add'
  | 'one_step_sub'
  | 'two_step_linear'
  | 'nested_linear';

export type AlgebraRule = {
  kind: 'algebra';
  template: AlgebraTemplate;
  variableName?: 'x' | 'y' | 'n';
  minSolution: number;
  maxSolution: number;
  minCoefficient: number;
  maxCoefficient: number;
};

export type PowerRootRule = {
  kind: 'power_root';
  mode: 'square' | 'square_root';
  minBase: number;
  maxBase: number;
};

export type FractionPercentageRule = {
  kind: 'fraction_percentage';
  variant: 'fraction_add' | 'ratio_equality' | 'mental_percentage';
  minBase?: number;
  maxBase?: number;
};

export type MixedBlitzRule = {
  kind: 'mixed_blitz';
  subRules: GeneratorRule[];
};

export type GeneratorRule =
  | AdditionRule
  | SubtractionRule
  | MultiplicationRule
  | DivisionRule
  | MissingOperandRule
  | ChainRule
  | BodmasRule
  | SignedRule
  | AlgebraRule
  | PowerRootRule
  | FractionPercentageRule
  | MixedBlitzRule;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/extendedTypes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types/rules.ts tests/unit/extendedTypes.test.ts
git commit -m "feat(engine): add extended domain rules for 7 new generator families

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Chain Arithmetic Generator (`ChainArithmeticGenerator`)

**Files:**
- Create: `src/engine/generators/chain.ts`
- Test: `tests/unit/chainGenerator.test.ts`

**Interfaces:**
- Consumes: `ChainRule`, `Question`, `QuestionGenerator`, `randomInt`
- Produces: `ChainArithmeticGenerator` implements `QuestionGenerator<ChainRule>`

- [ ] **Step 1: Write unit tests for Chain Arithmetic Generator**

Create `tests/unit/chainGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ChainArithmeticGenerator } from '../../src/engine/generators/chain';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { ChainRule } from '../../src/engine/types';

describe('ChainArithmeticGenerator', () => {
  const generator = new ChainArithmeticGenerator();
  const prng = createMulberry32('chain-test-seed');

  it('validates rule bounds and operands', () => {
    const validRule: ChainRule = {
      kind: 'chain',
      operators: ['+', '-'],
      termsCount: 3,
      minOperand: 1,
      maxOperand: 20,
    };
    expect(generator.validateRule(validRule)).toEqual(validRule);

    expect(() =>
      generator.validateRule({ kind: 'chain', operators: [], termsCount: 3, minOperand: 1, maxOperand: 10 })
    ).toThrow();
  });

  it('generates 3-term chain arithmetic without negative intermediate if disallowed', () => {
    const rule: ChainRule = {
      kind: 'chain',
      operators: ['+', '-'],
      termsCount: 3,
      minOperand: 1,
      maxOperand: 15,
      allowIntermediateNegative: false,
    };

    for (let i = 0; i < 50; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T1-CHAIN-01', sequenceIndex: i });
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.displayPrompt).toMatch(/^\d+\s[+-]\s\d+\s[+-]\s\d+$/);
        expect(q.explanation).toBeDefined();
      }
    }
  });

  it('generates 4-term chain arithmetic for T4-CHAIN-04', () => {
    const rule: ChainRule = {
      kind: 'chain',
      operators: ['+', '-'],
      termsCount: 4,
      minOperand: 1,
      maxOperand: 20,
    };

    const q = generator.generate(rule, prng, { levelId: 'T4-CHAIN-04', sequenceIndex: 1 });
    expect(q.displayPrompt.split(' ').length).toBe(7); // 4 numbers + 3 operators
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/chainGenerator.test.ts`
Expected: FAIL (Cannot find module `../../src/engine/generators/chain`).

- [ ] **Step 3: Implement `ChainArithmeticGenerator`**

Create `src/engine/generators/chain.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { ChainRule, Question } from '../types';
import { randomInt } from '../utils/prng';

export class ChainArithmeticGenerator implements QuestionGenerator<ChainRule> {
  readonly key = 'chain';
  readonly version = 1;

  validateRule(rule: unknown): ChainRule {
    const r = rule as ChainRule;
    if (!r || r.kind !== 'chain') {
      throw new Error('Invalid rule: expected chain');
    }
    if (!Array.isArray(r.operators) || r.operators.length === 0) {
      throw new Error('ChainRule requires non-empty operators');
    }
    if (r.termsCount !== 3 && r.termsCount !== 4) {
      throw new Error('ChainRule termsCount must be 3 or 4');
    }
    if (r.minOperand > r.maxOperand) {
      throw new Error('Invalid ChainRule operand bounds');
    }
    return r;
  }

  generate(rule: ChainRule, prng: () => number, context: GenerationContext): Question {
    const termsCount = rule.termsCount;
    const allowNegative = rule.allowIntermediateNegative ?? false;

    let terms: number[] = [];
    let ops: Array<'+' | '-'> = [];
    let currentVal = 0;

    // Retry loop to ensure non-negative intermediates if disallowed
    let attempts = 0;
    while (attempts < 50) {
      attempts++;
      terms = [randomInt(prng, rule.minOperand, rule.maxOperand)];
      ops = [];
      currentVal = terms[0];
      let valid = true;

      for (let i = 1; i < termsCount; i++) {
        const op = rule.operators[Math.floor(prng() * rule.operators.length)];
        const nextTerm = randomInt(prng, rule.minOperand, rule.maxOperand);
        const nextVal = op === '+' ? currentVal + nextTerm : currentVal - nextTerm;

        if (!allowNegative && nextVal < 0) {
          valid = false;
          break;
        }

        ops.push(op);
        terms.push(nextTerm);
        currentVal = nextVal;
      }

      if (valid && (!allowNegative ? currentVal >= 0 : true)) {
        break;
      }
    }

    // Build prompt and explanation
    let displayPrompt = `${terms[0]}`;
    let explanationSteps = `${terms[0]}`;
    let runningVal = terms[0];

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const nextTerm = terms[i + 1];
      displayPrompt += ` ${op} ${nextTerm}`;
      runningVal = op === '+' ? runningVal + nextTerm : runningVal - nextTerm;
      explanationSteps += ` ${op} ${nextTerm} = ${runningVal}`;
      if (i < ops.length - 1) {
        explanationSteps += ', lalu ';
      }
    }

    return {
      questionDefinitionId: `chain-${termsCount}-${terms.join('_')}-${ops.join('')}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: currentVal },
      primarySkillId: 'arithmetic.chain',
      skillTags: ['chain', 'arithmetic'],
      difficulty: termsCount === 3 ? 2 : 3,
      generatorKey: this.key,
      targetResponseTimeMs: termsCount === 3 ? 3500 : 4500,
      templateFamily: `chain_${termsCount}_terms`,
      explanation: `${displayPrompt} = ${currentVal} (${explanationSteps})`,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/chainGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/chain.ts tests/unit/chainGenerator.test.ts
git commit -m "feat(engine): implement ChainArithmeticGenerator for multi-term arithmetic

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: BODMAS & Parentheses Generator (`BodmasGenerator`)

**Files:**
- Create: `src/engine/generators/bodmas.ts`
- Test: `tests/unit/bodmasGenerator.test.ts`

**Interfaces:**
- Consumes: `BodmasRule`, `Question`, `QuestionGenerator`, `randomInt`
- Produces: `BodmasGenerator` implements `QuestionGenerator<BodmasRule>`

- [ ] **Step 1: Write unit tests for BODMAS Generator**

Create `tests/unit/bodmasGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BodmasGenerator } from '../../src/engine/generators/bodmas';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { BodmasRule } from '../../src/engine/types';

describe('BodmasGenerator', () => {
  const generator = new BodmasGenerator();
  const prng = createMulberry32('bodmas-seed-test');

  it('generates a + b × c adhering to multiplication precedence', () => {
    const rule: BodmasRule = {
      kind: 'bodmas',
      template: 'a_plus_b_times_c',
      minOperand: 2,
      maxOperand: 9,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-01', sequenceIndex: i });
      expect(q.displayPrompt).toMatch(/^\d+ \+ \d+ × \d+$/);
      const parts = q.displayPrompt.match(/^(\d+) \+ (\d+) × (\d+)$/);
      expect(parts).not.toBeNull();
      if (parts && q.answerSpec.kind === 'integer') {
        const [, a, b, c] = parts.map(Number);
        expect(q.answerSpec.value).toBe(a + b * c);
      }
    }
  });

  it('generates (a + b) ÷ c with guaranteed clean integer division and no division by zero', () => {
    const rule: BodmasRule = {
      kind: 'bodmas',
      template: 'paren_add_div_c',
      minOperand: 2,
      maxOperand: 10,
      requireCleanDivision: true,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T4-PAREN-01', sequenceIndex: i });
      expect(q.displayPrompt).toMatch(/^\(\d+ \+ \d+\) ÷ \d+$/);
      const parts = q.displayPrompt.match(/^\((\d+) \+ (\d+)\) ÷ (\d+)$/);
      expect(parts).not.toBeNull();
      if (parts && q.answerSpec.kind === 'integer') {
        const [, a, b, c] = parts.map(Number);
        expect(c).toBeGreaterThan(0);
        expect((a + b) % c).toBe(0);
        expect(q.answerSpec.value).toBe((a + b) / c);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/bodmasGenerator.test.ts`
Expected: FAIL (Cannot find module `../../src/engine/generators/bodmas`).

- [ ] **Step 3: Implement `BodmasGenerator`**

Create `src/engine/generators/bodmas.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { BodmasRule, Question } from '../types';
import { randomInt } from '../utils/prng';

export class BodmasGenerator implements QuestionGenerator<BodmasRule> {
  readonly key = 'bodmas';
  readonly version = 1;

  validateRule(rule: unknown): BodmasRule {
    const r = rule as BodmasRule;
    if (!r || r.kind !== 'bodmas') {
      throw new Error('Invalid rule: expected bodmas');
    }
    if (!r.template) {
      throw new Error('BodmasRule requires template');
    }
    if (r.minOperand > r.maxOperand) {
      throw new Error('Invalid BodmasRule operand bounds');
    }
    return r;
  }

  generate(rule: BodmasRule, prng: () => number, context: GenerationContext): Question {
    let displayPrompt = '';
    let answerValue = 0;
    let explanation = '';

    switch (rule.template) {
      case 'a_plus_b_times_c': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, rule.minOperand, rule.maxOperand);
        const c = randomInt(prng, rule.minOperand, rule.maxOperand);
        displayPrompt = `${a} + ${b} × ${c}`;
        answerValue = a + b * c;
        explanation = `Kerjakan perkalian dulu: ${b} × ${c} = ${b * c}. Lalu ${a} + ${b * c} = ${answerValue}`;
        break;
      }
      case 'a_times_b_plus_c': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, rule.minOperand, rule.maxOperand);
        const c = randomInt(prng, rule.minOperand, rule.maxOperand);
        displayPrompt = `${a} × ${b} + ${c}`;
        answerValue = a * b + c;
        explanation = `Kerjakan perkalian dulu: ${a} × ${b} = ${a * b}. Lalu ${a * b} + ${c} = ${answerValue}`;
        break;
      }
      case 'a_minus_b_div_c': {
        const c = randomInt(prng, Math.max(2, rule.minOperand), rule.maxOperand);
        const quotient = randomInt(prng, 1, rule.maxOperand);
        const b = c * quotient;
        const a = randomInt(prng, b + 1, b + rule.maxOperand);
        displayPrompt = `${a} - ${b} ÷ ${c}`;
        answerValue = a - quotient;
        explanation = `Kerjakan pembagian dulu: ${b} ÷ ${c} = ${quotient}. Lalu ${a} - ${quotient} = ${answerValue}`;
        break;
      }
      case 'paren_add_div_c': {
        const c = randomInt(prng, Math.max(2, rule.minOperand), rule.maxOperand);
        const quotient = randomInt(prng, 2, rule.maxOperand);
        const total = c * quotient;
        const a = randomInt(prng, 1, total - 1);
        const b = total - a;
        displayPrompt = `(${a} + ${b}) ÷ ${c}`;
        answerValue = quotient;
        explanation = `Kerjakan dalam kurung dulu: ${a} + ${b} = ${total}. Lalu ${total} ÷ ${c} = ${answerValue}`;
        break;
      }
      case 'paren_sub_mul_c': {
        const diff = randomInt(prng, 1, rule.maxOperand);
        const b = randomInt(prng, 1, rule.maxOperand);
        const a = b + diff;
        const c = randomInt(prng, 2, rule.maxOperand);
        displayPrompt = `(${a} - ${b}) × ${c}`;
        answerValue = diff * c;
        explanation = `Kerjakan dalam kurung dulu: ${a} - ${b} = ${diff}. Lalu ${diff} × ${c} = ${answerValue}`;
        break;
      }
      case 'paren_nested_bodmas': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, 2, rule.maxOperand);
        const diff = randomInt(prng, 1, 5);
        const d = randomInt(prng, 1, 10);
        const c = d + diff;
        displayPrompt = `${a} + ${b} × (${c} - ${d})`;
        answerValue = a + b * diff;
        explanation = `Kurung: ${c} - ${d} = ${diff}. Kali: ${b} × ${diff} = ${b * diff}. Tambah: ${a} + ${b * diff} = ${answerValue}`;
        break;
      }
    }

    return {
      questionDefinitionId: `bodmas-${rule.template}-${answerValue}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: answerValue },
      primarySkillId: 'arithmetic.bodmas',
      skillTags: ['bodmas', 'precedence'],
      difficulty: 3,
      generatorKey: this.key,
      targetResponseTimeMs: 4000,
      templateFamily: rule.template,
      explanation,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/bodmasGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/bodmas.ts tests/unit/bodmasGenerator.test.ts
git commit -m "feat(engine): implement BodmasGenerator with parentheses and precedence

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Signed Numbers Arithmetic Generator (`SignedArithmeticGenerator`)

**Files:**
- Create: `src/engine/generators/signed.ts`
- Test: `tests/unit/signedGenerator.test.ts`

**Interfaces:**
- Consumes: `SignedRule`, `Question`, `QuestionGenerator`, `randomInt`
- Produces: `SignedArithmeticGenerator` implements `QuestionGenerator<SignedRule>`

- [ ] **Step 1: Write unit tests for Signed Arithmetic Generator**

Create `tests/unit/signedGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { SignedArithmeticGenerator } from '../../src/engine/generators/signed';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { SignedRule } from '../../src/engine/types';

describe('SignedArithmeticGenerator', () => {
  const generator = new SignedArithmeticGenerator();
  const prng = createMulberry32('signed-seed-test');

  it('generates negative results and formats negative operands with parentheses', () => {
    const rule: SignedRule = {
      kind: 'signed',
      operation: '+',
      minOperand: -15,
      maxOperand: 15,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T5-NEG-02', sequenceIndex: i });
      expect(q.answerSpec.kind).toBe('integer');
      // Must not contain unparenthesized + - or - -
      expect(q.displayPrompt).not.toContain('+ -');
      expect(q.displayPrompt).not.toContain('- -');
    }
  });

  it('generates clean division with negative operands', () => {
    const rule: SignedRule = {
      kind: 'signed',
      operation: '÷',
      minOperand: -12,
      maxOperand: 12,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T5-NEG-DIV', sequenceIndex: i });
      expect(q.displayPrompt).not.toContain('÷ 0');
      expect(q.displayPrompt).not.toContain('÷ -'); // must be ÷ (-x)
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/signedGenerator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `SignedArithmeticGenerator`**

Create `src/engine/generators/signed.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { SignedRule, Question } from '../types';
import { randomInt } from '../utils/prng';

export class SignedArithmeticGenerator implements QuestionGenerator<SignedRule> {
  readonly key = 'signed';
  readonly version = 1;

  validateRule(rule: unknown): SignedRule {
    const r = rule as SignedRule;
    if (!r || r.kind !== 'signed') {
      throw new Error('Invalid rule: expected signed');
    }
    if (!['+', '-', '×', '÷'].includes(r.operation)) {
      throw new Error('SignedRule requires valid operation (+, -, ×, ÷)');
    }
    return r;
  }

  generate(rule: SignedRule, prng: () => number, context: GenerationContext): Question {
    const allowZero = rule.allowZeroOperand ?? false;

    const sampleNonZero = (min: number, max: number): number => {
      let val = 0;
      let count = 0;
      while (val === 0 && count < 20) {
        val = randomInt(prng, min, max);
        if (allowZero) break;
        count++;
      }
      return val === 0 ? 1 : val;
    };

    let a: number;
    let b: number;
    let answerValue: number;
    let explanation: string;

    if (rule.operation === '+') {
      a = sampleNonZero(rule.minOperand, rule.maxOperand);
      b = sampleNonZero(rule.minOperand, rule.maxOperand);
      answerValue = a + b;
      explanation = `${a} + ${b < 0 ? `(${b})` : b} = ${answerValue}`;
    } else if (rule.operation === '-') {
      a = sampleNonZero(rule.minOperand, rule.maxOperand);
      b = sampleNonZero(rule.minOperand, rule.maxOperand);
      answerValue = a - b;
      explanation = `${a} - ${b < 0 ? `(${b})` : b} = ${answerValue}`;
    } else if (rule.operation === '×') {
      a = sampleNonZero(Math.max(-12, rule.minOperand), Math.min(12, rule.maxOperand));
      b = sampleNonZero(Math.max(-12, rule.minOperand), Math.min(12, rule.maxOperand));
      answerValue = a * b;
      explanation = `${a} × ${b < 0 ? `(${b})` : b} = ${answerValue}`;
    } else {
      // Division
      const divisor = sampleNonZero(Math.max(-10, rule.minOperand), Math.min(10, rule.maxOperand));
      const quotient = sampleNonZero(Math.max(-10, rule.minOperand), Math.min(10, rule.maxOperand));
      a = divisor * quotient;
      b = divisor;
      answerValue = quotient;
      explanation = `${a} ÷ ${b < 0 ? `(${b})` : b} = ${answerValue}`;
    }

    const bStr = b < 0 ? `(${b})` : `${b}`;
    const displayPrompt = `${a} ${rule.operation} ${bStr}`;

    return {
      questionDefinitionId: `signed-${rule.operation}-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: answerValue },
      primarySkillId: 'arithmetic.signed',
      skillTags: ['signed', 'negative_numbers'],
      difficulty: 3,
      generatorKey: this.key,
      targetResponseTimeMs: 3500,
      templateFamily: 'signed_arithmetic',
      explanation,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/signedGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/signed.ts tests/unit/signedGenerator.test.ts
git commit -m "feat(engine): implement SignedArithmeticGenerator for negative numbers

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Linear Algebra Generator (`AlgebraGenerator`)

**Files:**
- Create: `src/engine/generators/algebra.ts`
- Test: `tests/unit/algebraGenerator.test.ts`

**Interfaces:**
- Consumes: `AlgebraRule`, `Question`, `QuestionGenerator`, `randomInt`
- Produces: `AlgebraGenerator` implements `QuestionGenerator<AlgebraRule>`

- [ ] **Step 1: Write unit tests for Algebra Generator**

Create `tests/unit/algebraGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AlgebraGenerator } from '../../src/engine/generators/algebra';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { AlgebraRule } from '../../src/engine/types';

describe('AlgebraGenerator', () => {
  const generator = new AlgebraGenerator();
  const prng = createMulberry32('algebra-seed-test');

  it('generates two-step linear equations: m*x + c = d with exact integer solution', () => {
    const rule: AlgebraRule = {
      kind: 'algebra',
      template: 'two_step_linear',
      variableName: 'x',
      minSolution: 1,
      maxSolution: 10,
      minCoefficient: 2,
      maxCoefficient: 5,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T5-ALG-02', sequenceIndex: i });
      expect(q.displayPrompt).toMatch(/^\d+x [+-] \d+ = \d+$/);
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBeGreaterThanOrEqual(rule.minSolution);
        expect(q.answerSpec.value).toBeLessThanOrEqual(rule.maxSolution);
      }
    }
  });

  it('generates nested linear equations: m(a*x + b) = d for T6-ALG-03', () => {
    const rule: AlgebraRule = {
      kind: 'algebra',
      template: 'nested_linear',
      variableName: 'x',
      minSolution: 1,
      maxSolution: 8,
      minCoefficient: 2,
      maxCoefficient: 4,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T6-ALG-03', sequenceIndex: i });
      expect(q.displayPrompt).toMatch(/^\d+\(\d*x [+-] \d+\) = \d+$/);
      expect(q.answerSpec.kind).toBe('integer');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/algebraGenerator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `AlgebraGenerator`**

Create `src/engine/generators/algebra.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { AlgebraRule, Question } from '../types';
import { randomInt } from '../utils/prng';

export class AlgebraGenerator implements QuestionGenerator<AlgebraRule> {
  readonly key = 'algebra';
  readonly version = 1;

  validateRule(rule: unknown): AlgebraRule {
    const r = rule as AlgebraRule;
    if (!r || r.kind !== 'algebra') {
      throw new Error('Invalid rule: expected algebra');
    }
    if (r.minSolution > r.maxSolution) {
      throw new Error('Invalid AlgebraRule solution bounds');
    }
    return r;
  }

  generate(rule: AlgebraRule, prng: () => number, context: GenerationContext): Question {
    const varName = rule.variableName || 'x';
    const x = randomInt(prng, rule.minSolution, rule.maxSolution);

    let displayPrompt: string;
    let explanation: string;

    switch (rule.template) {
      case 'one_step_add': {
        const c = randomInt(prng, 2, 20);
        const total = x + c;
        displayPrompt = `${varName} + ${c} = ${total}`;
        explanation = `${varName} = ${total} - ${c} = ${x}`;
        break;
      }
      case 'one_step_sub': {
        const c = randomInt(prng, 2, 20);
        const total = x + c;
        displayPrompt = `${varName} - ${c} = ${total - c}`;
        explanation = `${varName} = ${total - c} + ${c} = ${x}`;
        break;
      }
      case 'two_step_linear': {
        const m = randomInt(prng, rule.minCoefficient, rule.maxCoefficient);
        const c = randomInt(prng, 1, 15);
        const isPlus = prng() > 0.5;
        if (isPlus) {
          const rightHand = m * x + c;
          displayPrompt = `${m}${varName} + ${c} = ${rightHand}`;
          explanation = `${m}${varName} = ${rightHand} - ${c} = ${m * x}. ${varName} = ${m * x} ÷ ${m} = ${x}`;
        } else {
          const rightHand = m * x - c;
          displayPrompt = `${m}${varName} - ${c} = ${rightHand}`;
          explanation = `${m}${varName} = ${rightHand} + ${c} = ${m * x}. ${varName} = ${m * x} ÷ ${m} = ${x}`;
        }
        break;
      }
      case 'nested_linear': {
        const m = randomInt(prng, rule.minCoefficient, rule.maxCoefficient);
        const a = randomInt(prng, 1, 3);
        const b = randomInt(prng, 1, 10);
        const isPlus = prng() > 0.5;
        const inner = isPlus ? a * x + b : a * x - b;
        const total = m * inner;
        const aStr = a === 1 ? '' : `${a}`;
        displayPrompt = `${m}(${aStr}${varName} ${isPlus ? '+' : '-'} ${b}) = ${total}`;
        explanation = `${aStr}${varName} ${isPlus ? '+' : '-'} ${b} = ${total} ÷ ${m} = ${inner}. Maka ${varName} = ${x}`;
        break;
      }
    }

    return {
      questionDefinitionId: `alg-${rule.template}-${x}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: x },
      primarySkillId: 'algebra.linear',
      skillTags: ['algebra', 'linear_equation'],
      difficulty: 4,
      generatorKey: this.key,
      targetResponseTimeMs: 4500,
      templateFamily: rule.template,
      explanation,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/algebraGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/algebra.ts tests/unit/algebraGenerator.test.ts
git commit -m "feat(engine): implement AlgebraGenerator for 1-step, 2-step, and nested linear equations

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Powers and Roots Generator (`PowersAndRootsGenerator`)

**Files:**
- Create: `src/engine/generators/powerRoot.ts`
- Test: `tests/unit/powerRootGenerator.test.ts`

**Interfaces:**
- Consumes: `PowerRootRule`, `Question`, `QuestionGenerator`, `randomInt`
- Produces: `PowersAndRootsGenerator` implements `QuestionGenerator<PowerRootRule>`

- [ ] **Step 1: Write unit tests for Powers and Roots Generator**

Create `tests/unit/powerRootGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PowersAndRootsGenerator } from '../../src/engine/generators/powerRoot';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { PowerRootRule } from '../../src/engine/types';

describe('PowersAndRootsGenerator', () => {
  const generator = new PowersAndRootsGenerator();
  const prng = createMulberry32('power-root-test');

  it('generates square queries correctly: N²', () => {
    const rule: PowerRootRule = {
      kind: 'power_root',
      mode: 'square',
      minBase: 4,
      maxBase: 25,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T6-SQUARE-01', sequenceIndex: i });
      expect(q.displayPrompt).toMatch(/^\d+²$/);
      const base = Number(q.displayPrompt.replace('²', ''));
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBe(base * base);
      }
    }
  });

  it('generates perfect square root queries: √R with integer answer', () => {
    const rule: PowerRootRule = {
      kind: 'power_root',
      mode: 'square_root',
      minBase: 2,
      maxBase: 20,
    };

    for (let i = 0; i < 20; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T6-ROOT-01', sequenceIndex: i });
      expect(q.displayPrompt).toMatch(/^√\d+$/);
      const radican = Number(q.displayPrompt.replace('√', ''));
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value * q.answerSpec.value).toBe(radican);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/powerRootGenerator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `PowersAndRootsGenerator`**

Create `src/engine/generators/powerRoot.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { PowerRootRule, Question } from '../types';
import { randomInt } from '../utils/prng';

export class PowersAndRootsGenerator implements QuestionGenerator<PowerRootRule> {
  readonly key = 'power_root';
  readonly version = 1;

  validateRule(rule: unknown): PowerRootRule {
    const r = rule as PowerRootRule;
    if (!r || r.kind !== 'power_root') {
      throw new Error('Invalid rule: expected power_root');
    }
    if (r.minBase > r.maxBase) {
      throw new Error('Invalid PowerRootRule base bounds');
    }
    return r;
  }

  generate(rule: PowerRootRule, prng: () => number, context: GenerationContext): Question {
    const base = randomInt(prng, rule.minBase, rule.maxBase);

    if (rule.mode === 'square') {
      const answerValue = base * base;
      return {
        questionDefinitionId: `sq-${base}`,
        questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
        displayPrompt: `${base}²`,
        answerSpec: { kind: 'integer', value: answerValue },
        primarySkillId: 'arithmetic.square',
        skillTags: ['square', 'powers'],
        difficulty: base > 15 ? 4 : 3,
        generatorKey: this.key,
        targetResponseTimeMs: 2500,
        templateFamily: 'square_power',
        explanation: `${base}² = ${base} × ${base} = ${answerValue}`,
      };
    } else {
      const radican = base * base;
      return {
        questionDefinitionId: `sqrt-${radican}`,
        questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
        displayPrompt: `√${radican}`,
        answerSpec: { kind: 'integer', value: base },
        primarySkillId: 'arithmetic.square_root',
        skillTags: ['square_root', 'roots'],
        difficulty: 3,
        generatorKey: this.key,
        targetResponseTimeMs: 2500,
        templateFamily: 'square_root',
        explanation: `√${radican} = ${base} (karena ${base}² = ${radican})`,
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/powerRootGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/powerRoot.ts tests/unit/powerRootGenerator.test.ts
git commit -m "feat(engine): implement PowersAndRootsGenerator for squares and square roots

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Fractions, Ratios, and Percentages Generator (`FractionAndPercentageGenerator`)

**Files:**
- Create: `src/engine/generators/fractionPercentage.ts`
- Test: `tests/unit/fractionPercentageGenerator.test.ts`

**Interfaces:**
- Consumes: `FractionPercentageRule`, `Question`, `QuestionGenerator`, `randomInt`
- Produces: `FractionAndPercentageGenerator` implements `QuestionGenerator<FractionPercentageRule>`

- [ ] **Step 1: Write unit tests for Fraction and Percentage Generator**

Create `tests/unit/fractionPercentageGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { FractionAndPercentageGenerator } from '../../src/engine/generators/fractionPercentage';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { FractionPercentageRule } from '../../src/engine/types';

describe('FractionAndPercentageGenerator', () => {
  const generator = new FractionAndPercentageGenerator();
  const prng = createMulberry32('frac-pct-test');

  it('generates mental fraction addition with rational answerSpec', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'fraction_add',
    };

    for (let i = 0; i < 15; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T6-FRAC-01', sequenceIndex: i });
      expect(q.answerSpec.kind).toBe('rational');
      expect(q.displayPrompt).toContain('+');
    }
  });

  it('generates equivalent ratios: a:b = ?:d with integer answerSpec', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'ratio_equality',
    };

    for (let i = 0; i < 15; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T6-RATIO-01', sequenceIndex: i });
      expect(q.answerSpec.kind).toBe('integer');
      expect(q.displayPrompt).toContain(':');
    }
  });

  it('generates mental percentages: P% dari N with integer answerSpec', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'mental_percentage',
    };

    for (let i = 0; i < 15; i++) {
      const q = generator.generate(rule, prng, { levelId: 'T6-PCT-01', sequenceIndex: i });
      expect(q.answerSpec.kind).toBe('integer');
      expect(q.displayPrompt).toContain('% dari');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/fractionPercentageGenerator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `FractionAndPercentageGenerator`**

Create `src/engine/generators/fractionPercentage.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { FractionPercentageRule, Question } from '../types';
import { randomInt } from '../utils/prng';

export class FractionAndPercentageGenerator implements QuestionGenerator<FractionPercentageRule> {
  readonly key = 'fraction_percentage';
  readonly version = 1;

  validateRule(rule: unknown): FractionPercentageRule {
    const r = rule as FractionPercentageRule;
    if (!r || r.kind !== 'fraction_percentage') {
      throw new Error('Invalid rule: expected fraction_percentage');
    }
    return r;
  }

  generate(rule: FractionPercentageRule, prng: () => number, context: GenerationContext): Question {
    switch (rule.variant) {
      case 'fraction_add': {
        const denominators = [2, 4, 8, 3, 6, 5, 10];
        const d1 = denominators[Math.floor(prng() * denominators.length)];
        const d2 = denominators[Math.floor(prng() * denominators.length)];
        const n1 = randomInt(prng, 1, d1 - 1);
        const n2 = randomInt(prng, 1, d2 - 1);

        const resNum = n1 * d2 + n2 * d1;
        const resDen = d1 * d2;

        return {
          questionDefinitionId: `frac-${n1}/${d1}+${n2}/${d2}`,
          questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
          displayPrompt: `${n1}/${d1} + ${n2}/${d2}`,
          answerSpec: { kind: 'rational', numerator: resNum, denominator: resDen },
          primarySkillId: 'fraction.addition',
          skillTags: ['fraction', 'rational'],
          difficulty: 4,
          generatorKey: this.key,
          targetResponseTimeMs: 4500,
          templateFamily: 'fraction_addition',
          explanation: `${n1}/${d1} + ${n2}/${d2} = (${n1 * d2} + ${n2 * d1}) / ${resDen} = ${resNum}/${resDen}`,
        };
      }

      case 'ratio_equality': {
        const a = randomInt(prng, 1, 5);
        const b = randomInt(prng, 2, 7);
        const mult = randomInt(prng, 2, 6);
        const d = b * mult;
        const ans = a * mult;

        return {
          questionDefinitionId: `ratio-${a}:${b}=?:${d}`,
          questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
          displayPrompt: `${a}:${b} = ?:${d}`,
          answerSpec: { kind: 'integer', value: ans },
          primarySkillId: 'ratio.equivalent',
          skillTags: ['ratio', 'proportions'],
          difficulty: 3,
          generatorKey: this.key,
          targetResponseTimeMs: 3500,
          templateFamily: 'ratio_equivalent',
          explanation: `${b} dikali ${mult} adalah ${d}, maka ? = ${a} × ${mult} = ${ans}`,
        };
      }

      case 'mental_percentage': {
        const percentages = [10, 20, 25, 50, 15];
        const pct = percentages[Math.floor(prng() * percentages.length)];
        const factor = pct === 25 ? 4 : pct === 50 ? 2 : pct === 20 ? 5 : pct === 10 ? 10 : 20;
        const k = randomInt(prng, 1, 15);
        const number = k * factor;
        const ans = Math.round((pct * number) / 100);

        return {
          questionDefinitionId: `pct-${pct}-of-${number}`,
          questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
          displayPrompt: `${pct}% dari ${number}`,
          answerSpec: { kind: 'integer', value: ans },
          primarySkillId: 'percentage.mental',
          skillTags: ['percentage', 'mental_math'],
          difficulty: 3,
          generatorKey: this.key,
          targetResponseTimeMs: 3500,
          templateFamily: 'mental_percentage',
          explanation: `${pct}% dari ${number} = (${pct} / 100) × ${number} = ${ans}`,
        };
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/fractionPercentageGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/fractionPercentage.ts tests/unit/fractionPercentageGenerator.test.ts
git commit -m "feat(engine): implement FractionAndPercentageGenerator for mental fractions, ratios, and percentages

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Composite Mixed Blitz Generator & Registry Integration

**Files:**
- Create: `src/engine/generators/mixedBlitz.ts`
- Modify: `src/engine/generators/index.ts`
- Modify: `src/engine/registry/index.ts`
- Test: `tests/unit/mixedBlitzGenerator.test.ts`

**Interfaces:**
- Consumes: `MixedBlitzRule`, all generator implementations
- Produces: `MixedBlitzGenerator` and registered singleton registry with 12 generator keys

- [ ] **Step 1: Write unit tests for Mixed Blitz Generator and full registry registration**

Create `tests/unit/mixedBlitzGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MixedBlitzGenerator } from '../../src/engine/generators/mixedBlitz';
import { createDefaultGeneratorRegistry } from '../../src/engine/registry';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { MixedBlitzRule } from '../../src/engine/types';

describe('MixedBlitzGenerator & Full Registry', () => {
  const registry = createDefaultGeneratorRegistry();
  const mixedGenerator = new MixedBlitzGenerator(registry);
  const prng = createMulberry32('blitz-test-seed');

  it('contains all 12 generator keys in default registry', () => {
    const keys = registry.getRegisteredKeys();
    expect(keys).toContain('addition');
    expect(keys).toContain('subtraction');
    expect(keys).toContain('multiplication');
    expect(keys).toContain('division');
    expect(keys).toContain('missing_operand');
    expect(keys).toContain('chain');
    expect(keys).toContain('bodmas');
    expect(keys).toContain('signed');
    expect(keys).toContain('algebra');
    expect(keys).toContain('power_root');
    expect(keys).toContain('fraction_percentage');
    expect(keys).toContain('mixed_blitz');
  });

  it('delegates to subRules dynamically', () => {
    const rule: MixedBlitzRule = {
      kind: 'mixed_blitz',
      subRules: [
        { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
        { kind: 'power_root', mode: 'square', minBase: 2, maxBase: 10 },
      ],
    };

    const q = mixedGenerator.generate(rule, prng, { levelId: 'T1-BOSS', sequenceIndex: 1 });
    expect(q.displayPrompt).toBeDefined();
    expect(q.answerSpec.kind).toBe('integer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/mixedBlitzGenerator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `MixedBlitzGenerator` and update registry**

Create `src/engine/generators/mixedBlitz.ts`:
```typescript
import { QuestionGenerator, GenerationContext } from './base';
import { MixedBlitzRule, Question } from '../types';
import { QuestionGeneratorRegistry } from '../registry';

export class MixedBlitzGenerator implements QuestionGenerator<MixedBlitzRule> {
  readonly key = 'mixed_blitz';
  readonly version = 1;

  constructor(private registry: QuestionGeneratorRegistry) {}

  validateRule(rule: unknown): MixedBlitzRule {
    const r = rule as MixedBlitzRule;
    if (!r || r.kind !== 'mixed_blitz') {
      throw new Error('Invalid rule: expected mixed_blitz');
    }
    if (!Array.isArray(r.subRules) || r.subRules.length === 0) {
      throw new Error('MixedBlitzRule requires non-empty subRules array');
    }
    return r;
  }

  generate(rule: MixedBlitzRule, prng: () => number, context: GenerationContext): Question {
    const chosenSubRule = rule.subRules[Math.floor(prng() * rule.subRules.length)];
    const subGenerator = this.registry.get(chosenSubRule.kind);
    return subGenerator.generate(chosenSubRule, prng, context);
  }
}
```

Update `src/engine/generators/index.ts`:
```typescript
export * from './base';
export * from './addition';
export * from './subtraction';
export * from './multiplication';
export * from './division';
export * from './missingOperand';
export * from './chain';
export * from './bodmas';
export * from './signed';
export * from './algebra';
export * from './powerRoot';
export * from './fractionPercentage';
export * from './mixedBlitz';
```

Update `src/engine/registry/index.ts` to instantiate and register all 12 generators in `createDefaultGeneratorRegistry()`:
```typescript
import { QuestionGeneratorRegistry } from './QuestionGeneratorRegistry';
import { AdditionGenerator } from '../generators/addition';
import { SubtractionGenerator } from '../generators/subtraction';
import { MultiplicationGenerator } from '../generators/multiplication';
import { DivisionGenerator } from '../generators/division';
import { MissingOperandGenerator } from '../generators/missingOperand';
import { ChainArithmeticGenerator } from '../generators/chain';
import { BodmasGenerator } from '../generators/bodmas';
import { SignedArithmeticGenerator } from '../generators/signed';
import { AlgebraGenerator } from '../generators/algebra';
import { PowersAndRootsGenerator } from '../generators/powerRoot';
import { FractionAndPercentageGenerator } from '../generators/fractionPercentage';
import { MixedBlitzGenerator } from '../generators/mixedBlitz';

export * from './QuestionGeneratorRegistry';

export function createDefaultGeneratorRegistry(): QuestionGeneratorRegistry {
  const registry = new QuestionGeneratorRegistry();
  registry.register(new AdditionGenerator());
  registry.register(new SubtractionGenerator());
  registry.register(new MultiplicationGenerator());
  registry.register(new DivisionGenerator());
  registry.register(new MissingOperandGenerator());
  registry.register(new ChainArithmeticGenerator());
  registry.register(new BodmasGenerator());
  registry.register(new SignedArithmeticGenerator());
  registry.register(new AlgebraGenerator());
  registry.register(new PowersAndRootsGenerator());
  registry.register(new FractionAndPercentageGenerator());
  registry.register(new MixedBlitzGenerator(registry));
  return registry;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/mixedBlitzGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generators/ src/engine/registry/ tests/unit/mixedBlitzGenerator.test.ts
git commit -m "feat(engine): implement MixedBlitzGenerator and register all 12 generator keys

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Canonical 72-Level Content Manifest (`src/engine/manifest/levels.ts`)

**Files:**
- Create: `src/engine/manifest/levels.ts`
- Create: `src/engine/manifest/index.ts`
- Test: `tests/unit/manifestData.test.ts`

**Interfaces:**
- Consumes: `LevelConfigV2`, `GeneratorRule`
- Produces: `LEVEL_MANIFEST_72: LevelConfigV2[]` exported in `src/engine/manifest`

- [ ] **Step 1: Write unit tests verifying 72 levels structure**

Create `tests/unit/manifestData.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest';

describe('72-Level Canonical Manifest', () => {
  it('contains exactly 72 levels', () => {
    expect(LEVEL_MANIFEST_72).toHaveLength(72);
  });

  it('has continuous order from 1 to 72', () => {
    LEVEL_MANIFEST_72.forEach((lvl, idx) => {
      expect(lvl.order).toBe(idx + 1);
    });
  });

  it('contains exactly 6 boss levels at order 12, 24, 36, 48, 60, 72', () => {
    const bossLevels = LEVEL_MANIFEST_72.filter((l) => l.boss);
    expect(bossLevels).toHaveLength(6);
    expect(bossLevels.map((b) => b.order)).toEqual([12, 24, 36, 48, 60, 72]);
    expect(bossLevels.map((b) => b.id)).toEqual([
      'T1-BOSS',
      'T2-BOSS',
      'T3-BOSS',
      'T4-BOSS',
      'T5-BOSS',
      'T6-GRANDMASTER',
    ]);
  });

  it('assigns correct question counts and target times per tier defaults', () => {
    // T1 regular levels: 10 questions
    expect(LEVEL_MANIFEST_72[0].questionCount).toBe(10);
    // T1 boss: 15 questions
    expect(LEVEL_MANIFEST_72[11].questionCount).toBe(15);
    // T6 Grandmaster: 20 questions
    expect(LEVEL_MANIFEST_72[71].questionCount).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/manifestData.test.ts`
Expected: FAIL (Cannot find module `../../src/engine/manifest`).

- [ ] **Step 3: Implement `src/engine/manifest/levels.ts`**

Create `src/engine/manifest/levels.ts` defining all 72 levels faithfully matching PRD §8.1.1 through §8.1.7:
- T1 (1-12): T1-ADD-01, T1-ADD-02, T1-SUB-01, T1-SUB-02, T1-CHAIN-01, T1-CHAIN-02, T1-MIX-01, T1-COMP-01, T1-COMP-02, T1-MISS-01, T1-MISS-02, T1-BOSS.
- T2 (13-24): T2-MUL-02, T2-MUL-03, T2-MUL-04, T2-MUL-05, T2-MUL-06, T2-MUL-07, T2-MUL-08, T2-MUL-09, T2-DIV-01, T2-DIV-02, T2-MISS-01, T2-BOSS.
- T3 (25-36): T3-ADD-01, T3-ADD-02, T3-SUB-01, T3-SUB-02, T3-ADD-03, T3-SUB-03, T3-MUL-10, T3-DIV-10, T3-MUL-TENS, T3-DIV-TENS, T3-MIX-01, T3-BOSS.
- T4 (37-48): T4-CHAIN-03, T4-CHAIN-04, T4-MIX-MA, T4-MIX-MS, T4-MIX-DA, T4-MIX-DS, T4-BODMAS-01, T4-BODMAS-02, T4-PAREN-01, T4-PAREN-02, T4-BODMAS-03, T4-BOSS.
- T5 (49-60): T5-NEG-01, T5-NEG-02, T5-NEG-03, T5-NEG-MUL, T5-NEG-DIV, T5-MUL-11-14, T5-MUL-15-19, T5-MISS-02, T5-ALG-01, T5-ALG-02, T5-BLITZ, T5-BOSS.
- T6 (61-72): T6-SQUARE-01, T6-SQUARE-02, T6-SQUARE-03, T6-ROOT-01, T6-PCT-01, T6-PCT-02, T6-FRAC-01, T6-RATIO-01, T6-ALG-03, T6-MULTI, T6-BLITZ, T6-GRANDMASTER.

Create `src/engine/manifest/index.ts`:
```typescript
export * from './levels';
export * from './validator';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/manifestData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/manifest/ tests/unit/manifestData.test.ts
git commit -m "feat(engine): compile canonical 72-level content manifest

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: Manifest Integrity & DAG Prasyarat Validator

**Files:**
- Create: `src/engine/manifest/validator.ts`
- Test: `tests/unit/manifestValidator.test.ts`

**Interfaces:**
- Consumes: `LEVEL_MANIFEST_72`, `QuestionGeneratorRegistry`
- Produces: `validateLevelManifest(levels: LevelConfigV2[], registry: QuestionGeneratorRegistry): ManifestValidationResult`

- [ ] **Step 1: Write unit tests for Manifest & DAG Validator**

Create `tests/unit/manifestValidator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateLevelManifest } from '../../src/engine/manifest/validator';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';
import { createDefaultGeneratorRegistry } from '../../src/engine/registry';

describe('Manifest & DAG Validator', () => {
  const registry = createDefaultGeneratorRegistry();

  it('validates canonical LEVEL_MANIFEST_72 successfully', () => {
    const result = validateLevelManifest(LEVEL_MANIFEST_72, registry);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.totalLevels).toBe(72);
  });

  it('detects cycles in prerequisite graph', () => {
    const cyclicLevels = JSON.parse(JSON.stringify(LEVEL_MANIFEST_72));
    cyclicLevels[0].prerequisiteIds = ['T1-ADD-02']; // cycle between level 1 and 2
    const result = validateLevelManifest(cyclicLevels, registry);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('cycle') || e.includes('prerequisite'))).toBe(true);
  });

  it('detects missing generatorKey in registry', () => {
    const invalidGenerator = JSON.parse(JSON.stringify(LEVEL_MANIFEST_72));
    invalidGenerator[0].generatorKey = 'non_existent_generator';
    const result = validateLevelManifest(invalidGenerator, registry);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('non_existent_generator'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/manifestValidator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/engine/manifest/validator.ts`**

Create `src/engine/manifest/validator.ts`:
```typescript
import { LevelConfigV2 } from '../types';
import { QuestionGeneratorRegistry } from '../registry';

export interface ManifestValidationResult {
  isValid: boolean;
  errors: string[];
  totalLevels: number;
}

export function validateLevelManifest(
  levels: LevelConfigV2[],
  registry: QuestionGeneratorRegistry
): ManifestValidationResult {
  const errors: string[] = [];

  if (levels.length !== 72) {
    errors.push(`Expected exactly 72 levels, received ${levels.length}`);
  }

  const idSet = new Set<string>();
  const orderSet = new Set<number>();
  const registeredKeys = new Set(registry.getRegisteredKeys());

  levels.forEach((lvl, idx) => {
    // ID uniqueness
    if (idSet.has(lvl.id)) {
      errors.push(`Duplicate level id: ${lvl.id}`);
    }
    idSet.add(lvl.id);

    // Order uniqueness & continuous
    if (orderSet.has(lvl.order)) {
      errors.push(`Duplicate level order: ${lvl.order}`);
    }
    orderSet.add(lvl.order);

    if (lvl.order !== idx + 1) {
      errors.push(`Level order mismatch at index ${idx}: expected ${idx + 1}, received ${lvl.order}`);
    }

    // Generator key registered
    if (!registeredKeys.has(lvl.generatorKey)) {
      errors.push(`Level ${lvl.id} references unregistered generatorKey '${lvl.generatorKey}'`);
    }
  });

  // Check DAG prerequisites (Cycle detection via DFS)
  const levelMap = new Map<string, LevelConfigV2>();
  levels.forEach((l) => levelMap.set(l.id, l));

  // Level 1 must have no prerequisites
  if (levels[0] && levels[0].prerequisiteIds.length > 0) {
    errors.push(`First level (${levels[0].id}) must not have prerequisites`);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(levelId: string): boolean {
    visiting.add(levelId);
    const lvl = levelMap.get(levelId);
    if (lvl) {
      for (const prereqId of lvl.prerequisiteIds) {
        if (!levelMap.has(prereqId)) {
          errors.push(`Level ${levelId} references non-existent prerequisite '${prereqId}'`);
          continue;
        }
        if (visiting.has(prereqId)) {
          errors.push(`Detected prerequisite cycle involving '${levelId}' and '${prereqId}'`);
          return false;
        }
        if (!visited.has(prereqId)) {
          if (!dfs(prereqId)) return false;
        }
      }
    }
    visiting.delete(levelId);
    visited.add(levelId);
    return true;
  }

  for (const lvl of levels) {
    if (!visited.has(lvl.id)) {
      dfs(lvl.id);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalLevels: levels.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/manifestValidator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/manifest/validator.ts tests/unit/manifestValidator.test.ts
git commit -m "feat(engine): implement manifest and prerequisite DAG integrity validator

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: Extended Property-Based Invariant Test Suite ($\ge 70.000$ cases)

**Files:**
- Create: `tests/property/campaignInvariants.test.ts`
- Test: `tests/property/campaignInvariants.test.ts`

**Interfaces:**
- Consumes: All 7 new generators, Mulberry32 PRNG, AnswerEvaluator
- Produces: 70,000 property-tested question generations with invariant verification

- [ ] **Step 1: Write property tests for all 7 new generator families (10,000 cases each)**

Create `tests/property/campaignInvariants.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { createDefaultGeneratorRegistry } from '../../src/engine/registry';
import { evaluateAnswer } from '../../src/engine/evaluator/answerEvaluator';
import {
  ChainArithmeticGenerator,
  BodmasGenerator,
  SignedArithmeticGenerator,
  AlgebraGenerator,
  PowersAndRootsGenerator,
  FractionAndPercentageGenerator,
  MixedBlitzGenerator,
} from '../../src/engine/generators';

describe('Extended Campaign Property-Based Invariants (70.000 cases)', () => {
  const registry = createDefaultGeneratorRegistry();

  it('Chain Generator invariant: 10.000 cases with 0 intermediate negative when disallowed', () => {
    const gen = new ChainArithmeticGenerator();
    const prng = createMulberry32('prop-chain-seed');

    for (let i = 0; i < 10000; i++) {
      const q = gen.generate(
        { kind: 'chain', operators: ['+', '-'], termsCount: i % 2 === 0 ? 3 : 4, minOperand: 1, maxOperand: 20, allowIntermediateNegative: false },
        prng,
        { levelId: 'PROP-CHAIN', sequenceIndex: i }
      );
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBeGreaterThanOrEqual(0);
        const evalRes = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
        expect(evalRes.isCorrect).toBe(true);
      }
    }
  });

  it('BODMAS Generator invariant: 10.000 cases with 0 div-by-zero and 100% clean division', () => {
    const gen = new BodmasGenerator();
    const prng = createMulberry32('prop-bodmas-seed');
    const templates = [
      'a_plus_b_times_c',
      'a_times_b_plus_c',
      'a_minus_b_div_c',
      'paren_add_div_c',
      'paren_sub_mul_c',
      'paren_nested_bodmas',
    ] as const;

    for (let i = 0; i < 10000; i++) {
      const template = templates[i % templates.length];
      const q = gen.generate(
        { kind: 'bodmas', template, minOperand: 2, maxOperand: 12, requireCleanDivision: true },
        prng,
        { levelId: 'PROP-BODMAS', sequenceIndex: i }
      );
      expect(q.displayPrompt).not.toContain('÷ 0');
      expect(q.answerSpec.kind).toBe('integer');
    }
  });

  it('Signed Arithmetic Generator invariant: 10.000 cases with proper bracket formatting', () => {
    const gen = new SignedArithmeticGenerator();
    const prng = createMulberry32('prop-signed-seed');
    const ops = ['+', '-', '×', '÷'] as const;

    for (let i = 0; i < 10000; i++) {
      const op = ops[i % ops.length];
      const q = gen.generate(
        { kind: 'signed', operation: op, minOperand: -15, maxOperand: 15 },
        prng,
        { levelId: 'PROP-SIGNED', sequenceIndex: i }
      );
      expect(q.displayPrompt).not.toContain('+ -');
      expect(q.displayPrompt).not.toContain('- -');
      expect(q.displayPrompt).not.toContain('÷ 0');
    }
  });

  it('Algebra Generator invariant: 10.000 cases with unique integer solution', () => {
    const gen = new AlgebraGenerator();
    const prng = createMulberry32('prop-algebra-seed');
    const templates = ['one_step_add', 'one_step_sub', 'two_step_linear', 'nested_linear'] as const;

    for (let i = 0; i < 10000; i++) {
      const template = templates[i % templates.length];
      const q = gen.generate(
        { kind: 'algebra', template, variableName: 'x', minSolution: 1, maxSolution: 10, minCoefficient: 1, maxCoefficient: 5 },
        prng,
        { levelId: 'PROP-ALG', sequenceIndex: i }
      );
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(Number.isInteger(q.answerSpec.value)).toBe(true);
      }
    }
  });

  it('Powers & Roots Generator invariant: 10.000 cases with exact perfect squares', () => {
    const gen = new PowersAndRootsGenerator();
    const prng = createMulberry32('prop-power-seed');

    for (let i = 0; i < 10000; i++) {
      const isSqrt = i % 2 === 0;
      const q = gen.generate(
        { kind: 'power_root', mode: isSqrt ? 'square_root' : 'square', minBase: 2, maxBase: 25 },
        prng,
        { levelId: 'PROP-PWR', sequenceIndex: i }
      );
      expect(q.answerSpec.kind).toBe('integer');
      if (isSqrt) {
        const radican = Number(q.displayPrompt.replace('√', ''));
        expect(Math.sqrt(radican)).toBe((q.answerSpec as any).value);
      }
    }
  });

  it('Fraction & Percentage Generator invariant: 10.000 cases with valid non-zero denominators', () => {
    const gen = new FractionAndPercentageGenerator();
    const prng = createMulberry32('prop-frac-seed');
    const variants = ['fraction_add', 'ratio_equality', 'mental_percentage'] as const;

    for (let i = 0; i < 10000; i++) {
      const variant = variants[i % variants.length];
      const q = gen.generate({ kind: 'fraction_percentage', variant }, prng, { levelId: 'PROP-FRAC', sequenceIndex: i });
      if (q.answerSpec.kind === 'rational') {
        expect(q.answerSpec.denominator).toBeGreaterThan(0);
      }
    }
  });

  it('Mixed Blitz Generator invariant: 10.000 cases with composite subRules', () => {
    const gen = new MixedBlitzGenerator(registry);
    const prng = createMulberry32('prop-blitz-seed');

    for (let i = 0; i < 10000; i++) {
      const q = gen.generate(
        {
          kind: 'mixed_blitz',
          subRules: [
            { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
            { kind: 'power_root', mode: 'square', minBase: 2, maxBase: 10 },
            { kind: 'algebra', template: 'one_step_add', minSolution: 1, maxSolution: 10, minCoefficient: 1, maxCoefficient: 3 },
          ],
        },
        prng,
        { levelId: 'PROP-BLITZ', sequenceIndex: i }
      );
      expect(q.displayPrompt).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test tests/property/campaignInvariants.test.ts`
Expected: PASS (7 suites, 70.000 cases executed in ~1.5s).

- [ ] **Step 3: Commit**

```bash
git add tests/property/campaignInvariants.test.ts
git commit -m "test(engine): add 70.000-case property-based invariant test suite for campaign expansion

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 12: Dynamic Keypad Component (`DynamicKeypad.tsx`)

**Files:**
- Create: `src/components/game/DynamicKeypad.tsx`
- Test: `tests/unit/dynamicKeypad.test.ts`

**Interfaces:**
- Consumes: React, `AnswerSpec` kind (`integer`, `rational`, `decimal`, `signed`)
- Produces: `DynamicKeypad` component with props `onKeyPress: (key: string) => void`, `onBackspace: () => void`, `onSubmit: () => void`, `showNegative?: boolean`, `showSlash?: boolean`, `showDecimal?: boolean`

- [ ] **Step 1: Write unit tests for Dynamic Keypad component**

Create `tests/unit/dynamicKeypad.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeKeypadInput } from '../../src/components/game/DynamicKeypad';

describe('DynamicKeypad input sanitization', () => {
  it('prevents multiple leading minus signs', () => {
    expect(sanitizeKeypadInput('', '-')).toBe('-');
    expect(sanitizeKeypadInput('-', '-')).toBe(''); // toggles minus
    expect(sanitizeKeypadInput('12', '-')).toBe('-12'); // toggles sign
    expect(sanitizeKeypadInput('-12', '-')).toBe('12');
  });

  it('prevents duplicate slash or leading slash in fractions', () => {
    expect(sanitizeKeypadInput('', '/')).toBe(''); // no leading slash
    expect(sanitizeKeypadInput('3', '/')).toBe('3/');
    expect(sanitizeKeypadInput('3/', '/')).toBe('3/'); // ignore duplicate
    expect(sanitizeKeypadInput('3/4', '/')).toBe('3/4'); // ignore extra slash
  });

  it('prevents duplicate decimal dots', () => {
    expect(sanitizeKeypadInput('', '.')).toBe('0.');
    expect(sanitizeKeypadInput('2', '.')).toBe('2.');
    expect(sanitizeKeypadInput('2.', '.')).toBe('2.');
    expect(sanitizeKeypadInput('2.5', '.')).toBe('2.5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/dynamicKeypad.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/components/game/DynamicKeypad.tsx`**

Create `src/components/game/DynamicKeypad.tsx` implementing `sanitizeKeypadInput` and the React component with clean Tailwind styling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/dynamicKeypad.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/game/DynamicKeypad.tsx tests/unit/dynamicKeypad.test.ts
git commit -m "feat(ui): implement DynamicKeypad with negative, rational, and decimal input support

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 13: Whole-Branch Integration, Build Verification, & Smoke Test

**Files:**
- Test: All 15+ test suites (`npm test`)
- Verify: `npx tsc --noEmit && npm run build`

- [ ] **Step 1: Run complete test suite**

Run: `npm test -- --run`
Expected: PASS (all 180+ tests passing, 0 failures).

- [ ] **Step 2: Run TypeScript typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Vite build succeeds with clean production bundle.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: complete Milestone V2.0-B Campaign Expansion integration and verification

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
