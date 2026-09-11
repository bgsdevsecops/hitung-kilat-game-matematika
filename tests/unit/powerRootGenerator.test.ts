import { describe, it, expect } from 'vitest';
import { PowersAndRootsGenerator } from '../../src/engine/generators/powerRoot';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { PowerRootRule } from '../../src/engine/types';

describe('PowersAndRootsGenerator', () => {
  const generator = new PowersAndRootsGenerator();
  const prng = createMulberry32('power-root-seed-test');

  describe('generator metadata', () => {
    it('has correct key and version', () => {
      expect(generator.key).toBe('power_root');
      expect(generator.version).toBe(1);
    });
  });

  describe('validateRule', () => {
    it('accepts valid rules for mode square and square_root', () => {
      const squareRule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square',
        minBase: 4,
        maxBase: 25,
      };
      expect(generator.validateRule(squareRule)).toEqual(squareRule);

      const sqrtRule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square_root',
        minBase: 1,
        maxBase: 20,
      };
      expect(generator.validateRule(sqrtRule)).toEqual(sqrtRule);
    });

    it('accepts valid rule when minBase equals maxBase', () => {
      const singleBaseRule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square',
        minBase: 5,
        maxBase: 5,
      };
      expect(generator.validateRule(singleBaseRule)).toEqual(singleBaseRule);
    });

    it('rejects null, undefined, non-object, or invalid kind', () => {
      expect(() => generator.validateRule(null)).toThrow(/Invalid rule: expected power_root/);
      expect(() => generator.validateRule(undefined)).toThrow(/Invalid rule: expected power_root/);
      expect(() => generator.validateRule('power_root')).toThrow(/Invalid rule: expected power_root/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(/Invalid rule: expected power_root/);
    });

    it('rejects invalid or missing mode', () => {
      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          minBase: 2,
          maxBase: 10,
        } as unknown as PowerRootRule)
      ).toThrow(/Invalid PowerRootRule mode/);

      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'cube' as unknown as 'square',
          minBase: 2,
          maxBase: 10,
        })
      ).toThrow(/Invalid PowerRootRule mode/);

      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'nth_root' as unknown as 'square_root',
          minBase: 2,
          maxBase: 10,
        })
      ).toThrow(/Invalid PowerRootRule mode/);
    });

    it('rejects inverted base bounds where minBase > maxBase', () => {
      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'square',
          minBase: 20,
          maxBase: 10,
        })
      ).toThrow(/Invalid PowerRootRule base bounds/);
    });

    it('rejects non-numeric base bounds', () => {
      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'square',
          minBase: NaN,
          maxBase: 10,
        })
      ).toThrow(/Invalid PowerRootRule base bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'square',
          minBase: 2,
          maxBase: NaN,
        })
      ).toThrow(/Invalid PowerRootRule base bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'square',
          minBase: 2,
          maxBase: '10' as unknown as number,
        })
      ).toThrow(/Invalid PowerRootRule base bounds/);
    });

    it('rejects base bounds where minBase < 1', () => {
      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'square',
          minBase: 0,
          maxBase: 10,
        })
      ).toThrow(/minBase must be >= 1/);

      expect(() =>
        generator.validateRule({
          kind: 'power_root',
          mode: 'square_root',
          minBase: -5,
          maxBase: 10,
        })
      ).toThrow(/minBase must be >= 1/);
    });
  });

  describe('mode: square', () => {
    it('generates square questions with prompt N², answer N², and correct explanation', () => {
      const rule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square',
        minBase: 4,
        maxBase: 25,
      };

      for (let i = 0; i < 60; i++) {
        const context = { levelId: 'T6-SQUARE-TEST', sequenceIndex: i };
        const q = generator.generate(rule, prng, context);

        expect(q.answerSpec.kind).toBe('integer');
        expect(q.primarySkillId).toBe('arithmetic.square');
        expect(q.skillTags).toEqual(['square', 'powers']);
        expect(q.generatorKey).toBe('power_root');
        expect(q.targetResponseTimeMs).toBe(2500);
        expect(q.templateFamily).toBe('square_power');
        expect(q.questionInstanceId).toBe(`T6-SQUARE-TEST:${i}`);

        // Format is `${base}²`
        const match = q.displayPrompt.match(/^(\d+)²$/);
        expect(match).not.toBeNull();
        if (match) {
          const base = parseInt(match[1], 10);
          expect(base).toBeGreaterThanOrEqual(rule.minBase);
          expect(base).toBeLessThanOrEqual(rule.maxBase);

          const expectedAnswer = base * base;
          if (q.answerSpec.kind === 'integer') {
            expect(q.answerSpec.value).toBe(expectedAnswer);
          }

          expect(q.questionDefinitionId).toBe(`sq-${base}`);
          expect(q.explanation).toBe(`${base}² = ${base} × ${base} = ${expectedAnswer}`);

          // Difficulty check: base > 15 ? 4 : 3
          if (base > 15) {
            expect(q.difficulty).toBe(4);
          } else {
            expect(q.difficulty).toBe(3);
          }
        }
      }
    });

    it('assigns difficulty 3 when base <= 15 and difficulty 4 when base > 15', () => {
      const lowBaseRule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square',
        minBase: 2,
        maxBase: 15,
      };
      for (let i = 0; i < 20; i++) {
        const q = generator.generate(ruleOrBase(lowBaseRule), prng, { levelId: 'L-LOW', sequenceIndex: i });
        expect(q.difficulty).toBe(3);
      }

      const highBaseRule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square',
        minBase: 16,
        maxBase: 25,
      };
      for (let i = 0; i < 20; i++) {
        const q = generator.generate(highBaseRule, prng, { levelId: 'L-HIGH', sequenceIndex: i });
        expect(q.difficulty).toBe(4);
      }
    });
  });

  describe('mode: square_root', () => {
    it('generates square_root questions with prompt √R, exact integer answer N, and correct explanation', () => {
      const rule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square_root',
        minBase: 2,
        maxBase: 20,
      };

      for (let i = 0; i < 60; i++) {
        const context = { levelId: 'T6-SQRT-TEST', sequenceIndex: i };
        const q = generator.generate(rule, prng, context);

        expect(q.answerSpec.kind).toBe('integer');
        expect(q.primarySkillId).toBe('arithmetic.square_root');
        expect(q.skillTags).toEqual(['square_root', 'roots']);
        expect(q.difficulty).toBe(3);
        expect(q.generatorKey).toBe('power_root');
        expect(q.targetResponseTimeMs).toBe(2500);
        expect(q.templateFamily).toBe('square_root');
        expect(q.questionInstanceId).toBe(`T6-SQRT-TEST:${i}`);

        // Format is `√${radican}`
        const match = q.displayPrompt.match(/^√(\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const radican = parseInt(match[1], 10);
          const sqrtVal = Math.round(Math.sqrt(radican));

          // Invariant: Radicand MUST always be a perfect square
          expect(sqrtVal * sqrtVal).toBe(radican);
          expect(sqrtVal).toBeGreaterThanOrEqual(rule.minBase);
          expect(sqrtVal).toBeLessThanOrEqual(rule.maxBase);

          if (q.answerSpec.kind === 'integer') {
            expect(q.answerSpec.value).toBe(sqrtVal);
          }

          expect(q.questionDefinitionId).toBe(`sqrt-${radican}`);
          expect(q.explanation).toBe(`√${radican} = ${sqrtVal} (karena ${sqrtVal}² = ${radican})`);
        }
      }
    });

    it('works for minBase = 1 (boundary check √1 = 1)', () => {
      const boundaryRule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square_root',
        minBase: 1,
        maxBase: 1,
      };
      const q = generator.generate(boundaryRule, prng, { levelId: 'T6-SQRT-ONE', sequenceIndex: 0 });
      expect(q.displayPrompt).toBe('√1');
      expect(q.answerSpec).toEqual({ kind: 'integer', value: 1 });
      expect(q.questionDefinitionId).toBe('sqrt-1');
      expect(q.explanation).toBe('√1 = 1 (karena 1² = 1)');
    });
  });

  describe('PRNG determinism and reproducibility', () => {
    it('produces identical output given the same PRNG seed and context for square mode', () => {
      const rule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square',
        minBase: 5,
        maxBase: 30,
      };
      const prng1 = createMulberry32('reproducibility-seed-sq');
      const prng2 = createMulberry32('reproducibility-seed-sq');

      for (let i = 0; i < 20; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'DET-SQ', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'DET-SQ', sequenceIndex: i });

        expect(q1.displayPrompt).toBe(q2.displayPrompt);
        expect(q1.answerSpec).toEqual(q2.answerSpec);
        expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
        expect(q1.questionInstanceId).toBe(q2.questionInstanceId);
        expect(q1.explanation).toBe(q2.explanation);
        expect(q1.difficulty).toBe(q2.difficulty);
      }
    });

    it('produces identical output given the same PRNG seed and context for square_root mode', () => {
      const rule: PowerRootRule = {
        kind: 'power_root',
        mode: 'square_root',
        minBase: 2,
        maxBase: 25,
      };
      const prng1 = createMulberry32('reproducibility-seed-sqrt');
      const prng2 = createMulberry32('reproducibility-seed-sqrt');

      for (let i = 0; i < 20; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'DET-SQRT', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'DET-SQRT', sequenceIndex: i });

        expect(q1.displayPrompt).toBe(q2.displayPrompt);
        expect(q1.answerSpec).toEqual(q2.answerSpec);
        expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
        expect(q1.questionInstanceId).toBe(q2.questionInstanceId);
        expect(q1.explanation).toBe(q2.explanation);
      }
    });
  });
});

function ruleOrBase(rule: PowerRootRule): PowerRootRule {
  return rule;
}
