import { describe, it, expect } from 'vitest';
import { createMulberry32, randomInt } from '../../src/engine/utils/prng';
import type { QuestionGenerator } from '../../src/engine/generators/base';
import type { AdditionRule } from '../../src/engine/types/rules';
import type { Question, GenerationContext } from '../../src/engine/types/question';

describe('Mulberry32 PRNG', () => {
  it('produces identical sequences for identical string seeds', () => {
    const prng1 = createMulberry32('daily-challenge-2026-09-11');
    const prng2 = createMulberry32('daily-challenge-2026-09-11');

    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());

    expect(seq1).toEqual(seq2);
  });

  it('produces identical sequences for identical number seeds', () => {
    const prng1 = createMulberry32(42);
    const prng2 = createMulberry32(42);

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

  it('handles seed 0 correctly', () => {
    const prng = createMulberry32(0);
    for (let i = 0; i < 100; i++) {
      const val = prng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  it('produces different sequences for different seeds', () => {
    const prng1 = createMulberry32('seed-a');
    const prng2 = createMulberry32('seed-b');

    expect(prng1()).not.toEqual(prng2());
  });

  it('produces different sequences for different number seeds', () => {
    const prng1 = createMulberry32(100);
    const prng2 = createMulberry32(200);

    expect(prng1()).not.toEqual(prng2());
  });

  describe('randomInt', () => {
    it('picks integers strictly within [min, max] inclusive', () => {
      const prng = createMulberry32('random-int-test');
      const min = 1;
      const max = 6;
      const seen = new Set<number>();

      for (let i = 0; i < 500; i++) {
        const val = randomInt(prng, min, max);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThanOrEqual(max);
        seen.add(val);
      }

      // Over 500 rolls on a 6-sided range, all values 1..6 should be covered
      for (let expected = min; expected <= max; expected++) {
        expect(seen.has(expected)).toBe(true);
      }
    });

    it('handles inverted bounds where min > max', () => {
      const prng = createMulberry32('inverted-bounds');
      for (let i = 0; i < 100; i++) {
        const val = randomInt(prng, 10, 5);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(10);
      }
    });

    it('handles negative integers', () => {
      const prng = createMulberry32('negative-bounds');
      for (let i = 0; i < 100; i++) {
        const val = randomInt(prng, -10, -2);
        expect(val).toBeGreaterThanOrEqual(-10);
        expect(val).toBeLessThanOrEqual(-2);
      }
    });

    it('is deterministic given the same prng seed', () => {
      const prng1 = createMulberry32('deterministic-int');
      const prng2 = createMulberry32('deterministic-int');

      const seq1 = Array.from({ length: 20 }, () => randomInt(prng1, 0, 100));
      const seq2 = Array.from({ length: 20 }, () => randomInt(prng2, 0, 100));

      expect(seq1).toEqual(seq2);
    });
  });

  describe('QuestionGenerator contract', () => {
    it('allows implementation of QuestionGenerator interface', () => {
      class MockAdditionGenerator implements QuestionGenerator<AdditionRule> {
        readonly key = 'addition_v1';
        readonly version = 1;

        validateRule(rule: unknown): AdditionRule {
          return rule as AdditionRule;
        }

        generate(rule: AdditionRule, prng: () => number, context: GenerationContext): Question {
          const a = randomInt(prng, rule.minA, rule.maxA);
          const b = randomInt(prng, rule.minB, rule.maxB);
          return {
            questionDefinitionId: 'mock-q-def-1',
            questionInstanceId: `mock-inst-${context.sequenceIndex}`,
            displayPrompt: `${a} + ${b} = ?`,
            answerSpec: { kind: 'integer', value: a + b },
            primarySkillId: 'addition',
            skillTags: ['addition', 'basic'],
            difficulty: 1,
            generatorKey: this.key,
            targetResponseTimeMs: 5000,
            templateFamily: 'two_term_addition',
            explanation: `${a} plus ${b} equals ${a + b}`,
          };
        }
      }

      const gen = new MockAdditionGenerator();
      expect(gen.key).toBe('addition_v1');
      expect(gen.version).toBe(1);

      const prng = createMulberry32('test-contract');
      const q = gen.generate(
        { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
        prng,
        { levelId: 'level_1', sequenceIndex: 0 }
      );

      expect(q.displayPrompt).toMatch(/\d+ \+ \d+ = \?/);
      expect(q.difficulty).toBe(1);
    });
  });
});
