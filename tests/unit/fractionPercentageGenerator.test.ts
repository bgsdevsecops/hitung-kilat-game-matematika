import { describe, it, expect } from 'vitest';
import { FractionAndPercentageGenerator } from '../../src/engine/generators/fractionPercentage';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { FractionPercentageRule } from '../../src/engine/types';
import { evaluateAnswer } from '../../src/engine/evaluator';

describe('FractionAndPercentageGenerator', () => {
  const generator = new FractionAndPercentageGenerator();
  const prng = createMulberry32('frac-pct-test-seed');

  describe('generator metadata', () => {
    it('has correct key and version', () => {
      expect(generator.key).toBe('fraction_percentage');
      expect(generator.version).toBe(1);
    });
  });

  describe('validateRule', () => {
    it('accepts valid rules for all variants', () => {
      const fracRule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'fraction_add',
      };
      expect(generator.validateRule(fracRule)).toEqual(fracRule);

      const ratioRule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'ratio_equality',
      };
      expect(generator.validateRule(ratioRule)).toEqual(ratioRule);

      const pctRule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'mental_percentage',
        minBase: 1,
        maxBase: 10,
      };
      expect(generator.validateRule(pctRule)).toEqual(pctRule);
    });

    it('rejects null, undefined, non-object, or invalid kind', () => {
      expect(() => generator.validateRule(null)).toThrow(/Invalid rule: expected fraction_percentage/);
      expect(() => generator.validateRule(undefined)).toThrow(/Invalid rule: expected fraction_percentage/);
      expect(() => generator.validateRule('fraction_percentage')).toThrow(/Invalid rule: expected fraction_percentage/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(/Invalid rule: expected fraction_percentage/);
    });

    it('rejects missing or invalid variant', () => {
      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
        } as unknown as FractionPercentageRule)
      ).toThrow(/Invalid FractionPercentageRule variant/);

      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
          variant: 'unknown_variant' as unknown as 'fraction_add',
        })
      ).toThrow(/Invalid FractionPercentageRule variant/);
    });

    it('rejects inverted base bounds where minBase > maxBase', () => {
      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
          variant: 'mental_percentage',
          minBase: 20,
          maxBase: 10,
        })
      ).toThrow(/Invalid FractionPercentageRule base bounds/);
    });

    it('rejects non-numeric base bounds', () => {
      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
          variant: 'mental_percentage',
          minBase: NaN,
          maxBase: 10,
        })
      ).toThrow(/Invalid FractionPercentageRule base bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
          variant: 'mental_percentage',
          minBase: 1,
          maxBase: NaN,
        })
      ).toThrow(/Invalid FractionPercentageRule base bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
          variant: 'mental_percentage',
          minBase: '1' as unknown as number,
          maxBase: 10,
        })
      ).toThrow(/Invalid FractionPercentageRule base bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'fraction_percentage',
          variant: 'mental_percentage',
          minBase: 1,
          maxBase: '10' as unknown as number,
        })
      ).toThrow(/Invalid FractionPercentageRule base bounds/);
    });
  });

  describe('variant: fraction_add', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'fraction_add',
    };
    const friendlyDenominators = [2, 4, 8, 3, 6, 5, 10];

    it('generates mental fraction addition with rational answerSpec and correct metadata', () => {
      const q = generator.generate(rule, prng, {
        levelId: 'T6-FRAC-01',
        sequenceIndex: 1,
      });

      expect(q.generatorKey).toBe('fraction_percentage');
      expect(q.primarySkillId).toBe('fraction.addition');
      expect(q.skillTags).toEqual(['fraction', 'rational']);
      expect(q.difficulty).toBe(4);
      expect(q.targetResponseTimeMs).toBe(4500);
      expect(q.templateFamily).toBe('fraction_addition');
      expect(q.questionInstanceId).toBe('T6-FRAC-01:1');
      expect(q.answerSpec.kind).toBe('rational');
    });

    it('generates valid fractions and mathematically exact sums across 50 questions', () => {
      const testPrng = createMulberry32('fraction-add-invariants');

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, testPrng, {
          levelId: 'T6-FRAC-01',
          sequenceIndex: i,
        });

        // Prompt format: `${n1}/${d1} + ${n2}/${d2}`
        const match = q.displayPrompt.match(/^(\d+)\/(\d+)\s*\+\s*(\d+)\/(\d+)$/);
        expect(match).not.toBeNull();
        if (!match) continue;

        const n1 = parseInt(match[1], 10);
        const d1 = parseInt(match[2], 10);
        const n2 = parseInt(match[3], 10);
        const d2 = parseInt(match[4], 10);

        // Denominators from friendly set
        expect(friendlyDenominators).toContain(d1);
        expect(friendlyDenominators).toContain(d2);

        // Numerators in range [1, d - 1]
        expect(n1).toBeGreaterThanOrEqual(1);
        expect(n1).toBeLessThan(d1);
        expect(n2).toBeGreaterThanOrEqual(1);
        expect(n2).toBeLessThan(d2);

        // Result calculation: resNum = n1 * d2 + n2 * d1, resDen = d1 * d2
        const expectedResNum = n1 * d2 + n2 * d1;
        const expectedResDen = d1 * d2;

        expect(q.answerSpec).toEqual({
          kind: 'rational',
          numerator: expectedResNum,
          denominator: expectedResDen,
        });

        expect(q.questionDefinitionId).toBe(`frac-${n1}/${d1}+${n2}/${d2}`);
        expect(q.explanation).toBe(
          `${n1}/${d1} + ${n2}/${d2} = (${n1 * d2} + ${n2 * d1}) / ${expectedResDen} = ${expectedResNum}/${expectedResDen}`
        );

        // Invariant: evaluateAnswer validates raw form and cross-multiplication equivalence
        const evalResult = evaluateAnswer(q.answerSpec, `${expectedResNum}/${expectedResDen}`);
        expect(evalResult.isCorrect).toBe(true);
      }
    });
  });

  describe('variant: ratio_equality', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'ratio_equality',
    };

    it('generates ratio questions with integer answerSpec and correct metadata', () => {
      const q = generator.generate(rule, prng, {
        levelId: 'T6-RATIO-01',
        sequenceIndex: 1,
      });

      expect(q.generatorKey).toBe('fraction_percentage');
      expect(q.primarySkillId).toBe('ratio.equivalent');
      expect(q.skillTags).toEqual(['ratio', 'proportions']);
      expect(q.difficulty).toBe(3);
      expect(q.targetResponseTimeMs).toBe(3500);
      expect(q.templateFamily).toBe('ratio_equivalent');
      expect(q.questionInstanceId).toBe('T6-RATIO-01:1');
      expect(q.answerSpec.kind).toBe('integer');
    });

    it('generates mathematically equivalent ratios across 50 questions', () => {
      const testPrng = createMulberry32('ratio-equality-invariants');

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, testPrng, {
          levelId: 'T6-RATIO-01',
          sequenceIndex: i,
        });

        // Prompt format: `${a}:${b} = ?:${d}`
        const match = q.displayPrompt.match(/^(\d+):(\d+)\s*=\s*\?:(\d+)$/);
        expect(match).not.toBeNull();
        if (!match) continue;

        const a = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);
        const d = parseInt(match[3], 10);

        expect(a).toBeGreaterThanOrEqual(1);
        expect(a).toBeLessThanOrEqual(5);
        expect(b).toBeGreaterThanOrEqual(2);
        expect(b).toBeLessThanOrEqual(7);

        // d must be a multiple of b
        expect(d % b).toBe(0);
        const mult = d / b;
        expect(mult).toBeGreaterThanOrEqual(2);
        expect(mult).toBeLessThanOrEqual(6);

        const expectedAns = a * mult;
        expect(q.answerSpec).toEqual({ kind: 'integer', value: expectedAns });
        expect(q.questionDefinitionId).toBe(`ratio-${a}:${b}=?:${d}`);
        expect(q.explanation).toBe(`${b} dikali ${mult} adalah ${d}, maka ? = ${a} × ${mult} = ${expectedAns}`);

        // Exact ratio equivalence: a / b === ans / d <=> a * d === b * ans
        expect(a * d).toBe(b * expectedAns);

        const evalResult = evaluateAnswer(q.answerSpec, `${expectedAns}`);
        expect(evalResult.isCorrect).toBe(true);
      }
    });
  });

  describe('variant: mental_percentage', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'mental_percentage',
    };
    const allowedPercentages = [10, 20, 25, 50, 15];

    it('generates mental percentage questions with integer answerSpec and correct metadata', () => {
      const q = generator.generate(rule, prng, {
        levelId: 'T6-PCT-01',
        sequenceIndex: 1,
      });

      expect(q.generatorKey).toBe('fraction_percentage');
      expect(q.primarySkillId).toBe('percentage.mental');
      expect(q.skillTags).toEqual(['percentage', 'mental_math']);
      expect(q.difficulty).toBe(3);
      expect(q.targetResponseTimeMs).toBe(3500);
      expect(q.templateFamily).toBe('mental_percentage');
      expect(q.questionInstanceId).toBe('T6-PCT-01:1');
      expect(q.answerSpec.kind).toBe('integer');
    });

    it('generates strictly integer percentage results across 50 questions', () => {
      const testPrng = createMulberry32('mental-pct-invariants');

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, testPrng, {
          levelId: 'T6-PCT-01',
          sequenceIndex: i,
        });

        // Prompt format: `${pct}% dari ${number}`
        const match = q.displayPrompt.match(/^(\d+)%\s*dari\s*(\d+)$/);
        expect(match).not.toBeNull();
        if (!match) continue;

        const pct = parseInt(match[1], 10);
        const number = parseInt(match[2], 10);

        expect(allowedPercentages).toContain(pct);

        const factorMap: Record<number, number> = {
          25: 4,
          50: 2,
          20: 5,
          10: 10,
          15: 20,
        };
        const expectedFactor = factorMap[pct];
        expect(number % expectedFactor).toBe(0);

        const expectedAns = (pct * number) / 100;
        expect(Number.isInteger(expectedAns)).toBe(true);

        expect(q.answerSpec).toEqual({ kind: 'integer', value: expectedAns });
        expect(q.questionDefinitionId).toBe(`pct-${pct}-of-${number}`);
        expect(q.explanation).toBe(`${pct}% dari ${number} = (${pct} / 100) × ${number} = ${expectedAns}`);

        const evalResult = evaluateAnswer(q.answerSpec, `${expectedAns}`);
        expect(evalResult.isCorrect).toBe(true);
      }
    });

    it('respects minBase and maxBase when provided', () => {
      const customRule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'mental_percentage',
        minBase: 5,
        maxBase: 8,
      };
      const testPrng = createMulberry32('mental-pct-custom-bounds');

      for (let i = 0; i < 30; i++) {
        const q = generator.generate(customRule, testPrng, {
          levelId: 'T6-PCT-BOUNDS',
          sequenceIndex: i,
        });

        const match = q.displayPrompt.match(/^(\d+)%\s*dari\s*(\d+)$/);
        expect(match).not.toBeNull();
        if (!match) continue;

        const pct = parseInt(match[1], 10);
        const number = parseInt(match[2], 10);
        const factorMap: Record<number, number> = {
          25: 4,
          50: 2,
          20: 5,
          10: 10,
          15: 20,
        };
        const k = number / factorMap[pct];
        expect(k).toBeGreaterThanOrEqual(5);
        expect(k).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('PRNG determinism and reproducibility', () => {
    it('produces identical output given the same PRNG seed and context for fraction_add', () => {
      const rule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'fraction_add',
      };
      const prng1 = createMulberry32('frac-det-seed');
      const prng2 = createMulberry32('frac-det-seed');

      for (let i = 0; i < 20; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'DET-FRAC', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'DET-FRAC', sequenceIndex: i });

        expect(q1.displayPrompt).toBe(q2.displayPrompt);
        expect(q1.answerSpec).toEqual(q2.answerSpec);
        expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
        expect(q1.questionInstanceId).toBe(q2.questionInstanceId);
        expect(q1.explanation).toBe(q2.explanation);
        expect(q1.difficulty).toBe(q2.difficulty);
      }
    });

    it('produces identical output given the same PRNG seed and context for ratio_equality', () => {
      const rule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'ratio_equality',
      };
      const prng1 = createMulberry32('ratio-det-seed');
      const prng2 = createMulberry32('ratio-det-seed');

      for (let i = 0; i < 20; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'DET-RATIO', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'DET-RATIO', sequenceIndex: i });

        expect(q1.displayPrompt).toBe(q2.displayPrompt);
        expect(q1.answerSpec).toEqual(q2.answerSpec);
        expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
        expect(q1.questionInstanceId).toBe(q2.questionInstanceId);
        expect(q1.explanation).toBe(q2.explanation);
      }
    });

    it('produces identical output given the same PRNG seed and context for mental_percentage', () => {
      const rule: FractionPercentageRule = {
        kind: 'fraction_percentage',
        variant: 'mental_percentage',
      };
      const prng1 = createMulberry32('pct-det-seed');
      const prng2 = createMulberry32('pct-det-seed');

      for (let i = 0; i < 20; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'DET-PCT', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'DET-PCT', sequenceIndex: i });

        expect(q1.displayPrompt).toBe(q2.displayPrompt);
        expect(q1.answerSpec).toEqual(q2.answerSpec);
        expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
        expect(q1.questionInstanceId).toBe(q2.questionInstanceId);
        expect(q1.explanation).toBe(q2.explanation);
      }
    });
  });
});
