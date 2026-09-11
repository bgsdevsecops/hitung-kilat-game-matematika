import { describe, it, expect } from 'vitest';
import { AlgebraGenerator } from '../../src/engine/generators/algebra';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { AlgebraRule } from '../../src/engine/types';

describe('AlgebraGenerator', () => {
  const generator = new AlgebraGenerator();
  const prng = createMulberry32('algebra-seed-test');

  describe('validateRule', () => {
    it('accepts valid rules for all 4 templates', () => {
      const templates: AlgebraRule['template'][] = [
        'one_step_add',
        'one_step_sub',
        'two_step_linear',
        'nested_linear',
      ];

      for (const template of templates) {
        const rule: AlgebraRule = {
          kind: 'algebra',
          template,
          variableName: 'x',
          minSolution: 1,
          maxSolution: 10,
          minCoefficient: 1,
          maxCoefficient: 5,
        };
        expect(generator.validateRule(rule)).toEqual(rule);
      }
    });

    it('accepts valid variable names (x, y, n) or omitted variableName', () => {
      const varNames: Array<'x' | 'y' | 'n' | undefined> = ['x', 'y', 'n', undefined];
      for (const variableName of varNames) {
        const rule: AlgebraRule = {
          kind: 'algebra',
          template: 'one_step_add',
          ...(variableName ? { variableName } : {}),
          minSolution: 1,
          maxSolution: 10,
          minCoefficient: 1,
          maxCoefficient: 5,
        };
        expect(generator.validateRule(rule)).toEqual(rule);
      }
    });

    it('rejects null, undefined, non-object, or invalid kind', () => {
      expect(() => generator.validateRule(null)).toThrow(/Invalid rule: expected algebra/);
      expect(() => generator.validateRule(undefined)).toThrow(/Invalid rule: expected algebra/);
      expect(() => generator.validateRule('algebra')).toThrow(/Invalid rule: expected algebra/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(/Invalid rule: expected algebra/);
    });

    it('rejects missing or invalid template', () => {
      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          minSolution: 1,
          maxSolution: 10,
          minCoefficient: 1,
          maxCoefficient: 5,
        } as unknown as AlgebraRule)
      ).toThrow(/Invalid AlgebraRule template/);

      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          template: 'three_step_linear' as unknown as AlgebraRule['template'],
          minSolution: 1,
          maxSolution: 10,
          minCoefficient: 1,
          maxCoefficient: 5,
        })
      ).toThrow(/Invalid AlgebraRule template/);
    });

    it('rejects inverted solution bounds (minSolution > maxSolution)', () => {
      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          template: 'one_step_add',
          minSolution: 10,
          maxSolution: 2,
          minCoefficient: 1,
          maxCoefficient: 5,
        })
      ).toThrow(/Invalid AlgebraRule bounds/);
    });

    it('rejects inverted coefficient bounds (minCoefficient > maxCoefficient)', () => {
      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          template: 'two_step_linear',
          minSolution: 1,
          maxSolution: 10,
          minCoefficient: 5,
          maxCoefficient: 2,
        })
      ).toThrow(/Invalid AlgebraRule bounds/);
    });

    it('rejects non-numeric bounds (NaN or wrong types)', () => {
      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          template: 'one_step_add',
          minSolution: NaN,
          maxSolution: 10,
          minCoefficient: 1,
          maxCoefficient: 5,
        })
      ).toThrow(/Invalid AlgebraRule bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          template: 'one_step_add',
          minSolution: 1,
          maxSolution: '10' as unknown as number,
          minCoefficient: 1,
          maxCoefficient: 5,
        })
      ).toThrow(/Invalid AlgebraRule bounds/);
    });

    it('rejects invalid variableName', () => {
      expect(() =>
        generator.validateRule({
          kind: 'algebra',
          template: 'one_step_add',
          variableName: 'z' as unknown as 'x',
          minSolution: 1,
          maxSolution: 10,
          minCoefficient: 1,
          maxCoefficient: 5,
        })
      ).toThrow(/Invalid AlgebraRule variableName/);
    });
  });

  describe('template: one_step_add', () => {
    it('generates x + c = d and satisfies exact integer solution x = d - c', () => {
      const rule: AlgebraRule = {
        kind: 'algebra',
        template: 'one_step_add',
        variableName: 'x',
        minSolution: 1,
        maxSolution: 15,
        minCoefficient: 1,
        maxCoefficient: 5,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T3-ALG-01', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind !== 'integer') continue;
        const x = q.answerSpec.value;
        expect(x).toBeGreaterThanOrEqual(rule.minSolution);
        expect(x).toBeLessThanOrEqual(rule.maxSolution);

        // Matches format: x + c = d
        const match = q.displayPrompt.match(/^x \+ (\d+) = (\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const c = parseInt(match[1], 10);
          const d = parseInt(match[2], 10);
          expect(c).toBeGreaterThanOrEqual(1);
          expect(d).toBe(x + c);
          expect(x).toBe(d - c);
        }

        expect(q.explanation).toContain(`x = `);
        expect(q.primarySkillId).toBe('algebra.linear');
        expect(q.skillTags).toEqual(['algebra', 'linear_equation']);
        expect(q.difficulty).toBe(4);
        expect(q.generatorKey).toBe('algebra');
        expect(q.targetResponseTimeMs).toBe(4500);
        expect(q.templateFamily).toBe('one_step_add');
        expect(q.questionDefinitionId).toBe(`alg-one_step_add-${q.displayPrompt.replace(/\s+/g, '')}`);
        expect(q.questionInstanceId).toBe(`T3-ALG-01:${i}`);
      }
    });
  });

  describe('template: one_step_sub', () => {
    it('generates x - c = d and satisfies exact integer solution x = d + c (never x - c = x)', () => {
      const rule: AlgebraRule = {
        kind: 'algebra',
        template: 'one_step_sub',
        variableName: 'x',
        minSolution: 1,
        maxSolution: 20,
        minCoefficient: 1,
        maxCoefficient: 5,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T3-ALG-02', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind !== 'integer') continue;
        const x = q.answerSpec.value;
        expect(x).toBeGreaterThanOrEqual(rule.minSolution);
        expect(x).toBeLessThanOrEqual(rule.maxSolution);

        // Matches format: x - c = d
        const match = q.displayPrompt.match(/^x - (\d+) = (-?\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const c = parseInt(match[1], 10);
          const d = parseInt(match[2], 10);
          expect(c).toBeGreaterThanOrEqual(1);
          expect(d).toBe(x - c);
          expect(x).toBe(d + c);
          // Invariant: Never have x - c = x
          expect(d).not.toBe(x);
        }

        expect(q.explanation).toContain(`x = `);
        expect(q.templateFamily).toBe('one_step_sub');
      }
    });
  });

  describe('template: two_step_linear', () => {
    it('generates mx + c = d or mx - c = d with exact integer solution satisfying the equation', () => {
      const rule: AlgebraRule = {
        kind: 'algebra',
        template: 'two_step_linear',
        variableName: 'x',
        minSolution: 1,
        maxSolution: 10,
        minCoefficient: 2,
        maxCoefficient: 5,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T5-ALG-02', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind !== 'integer') continue;
        const x = q.answerSpec.value;
        expect(x).toBeGreaterThanOrEqual(rule.minSolution);
        expect(x).toBeLessThanOrEqual(rule.maxSolution);

        // Matches format: mx + c = d or mx - c = d
        expect(q.displayPrompt).toMatch(/^\d+x [+-] \d+ = \d+$/);

        const plusMatch = q.displayPrompt.match(/^(\d+)x \+ (\d+) = (\d+)$/);
        const minusMatch = q.displayPrompt.match(/^(\d+)x - (\d+) = (\d+)$/);

        if (plusMatch) {
          const m = parseInt(plusMatch[1], 10);
          const c = parseInt(plusMatch[2], 10);
          const d = parseInt(plusMatch[3], 10);
          expect(m).toBeGreaterThanOrEqual(rule.minCoefficient);
          expect(m).toBeLessThanOrEqual(rule.maxCoefficient);
          expect(m * x + c).toBe(d);
          expect(q.explanation).toBe(`${m}x = ${d} - ${c} = ${m * x}. x = ${m * x} ÷ ${m} = ${x}`);
        } else if (minusMatch) {
          const m = parseInt(minusMatch[1], 10);
          const c = parseInt(minusMatch[2], 10);
          const d = parseInt(minusMatch[3], 10);
          expect(m).toBeGreaterThanOrEqual(rule.minCoefficient);
          expect(m).toBeLessThanOrEqual(rule.maxCoefficient);
          expect(m * x - c).toBe(d);
          expect(q.explanation).toBe(`${m}x = ${d} + ${c} = ${m * x}. x = ${m * x} ÷ ${m} = ${x}`);
        } else {
          throw new Error(`Unexpected prompt format: ${q.displayPrompt}`);
        }
      }
    });
  });

  describe('template: nested_linear', () => {
    it('generates m(ax + b) = total or m(ax - b) = total where a=1 renders as x', () => {
      const rule: AlgebraRule = {
        kind: 'algebra',
        template: 'nested_linear',
        variableName: 'x',
        minSolution: 1,
        maxSolution: 8,
        minCoefficient: 2,
        maxCoefficient: 4,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T6-ALG-03', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind !== 'integer') continue;
        const x = q.answerSpec.value;
        expect(x).toBeGreaterThanOrEqual(rule.minSolution);
        expect(x).toBeLessThanOrEqual(rule.maxSolution);

        // Prompt format: m(ax + b) = total or m(ax - b) = total
        expect(q.displayPrompt).toMatch(/^\d+\((\d*)?x [+-] \d+\) = \d+$/);

        // When a=1, it must NOT render as 1x
        expect(q.displayPrompt).not.toMatch(/\(1x/);

        const match = q.displayPrompt.match(/^(\d+)\((\d*)?x ([+-]) (\d+)\) = (\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const m = parseInt(match[1], 10);
          const a = match[2] ? parseInt(match[2], 10) : 1;
          const op = match[3];
          const b = parseInt(match[4], 10);
          const total = parseInt(match[5], 10);

          expect(m).toBeGreaterThanOrEqual(2);
          expect(a).toBeGreaterThanOrEqual(1);
          expect(a).toBeLessThanOrEqual(3);

          const inner = op === '+' ? a * x + b : a * x - b;
          expect(inner).toBeGreaterThan(0);
          expect(m * inner).toBe(total);
        }
      }
    });
  });

  describe('variable name customization', () => {
    it('supports custom variable names y and n', () => {
      for (const varName of ['y', 'n'] as const) {
        const rule: AlgebraRule = {
          kind: 'algebra',
          template: 'two_step_linear',
          variableName: varName,
          minSolution: 2,
          maxSolution: 6,
          minCoefficient: 2,
          maxCoefficient: 3,
        };

        const q = generator.generate(rule, prng, { levelId: 'T5-CUSTOM', sequenceIndex: 1 });
        expect(q.displayPrompt).toContain(varName);
        expect(q.displayPrompt).not.toContain('x');
        expect(q.explanation).toContain(varName);
      }
    });
  });

  describe('PRNG determinism', () => {
    it('generates identical questions given identical PRNG seed', () => {
      const rule: AlgebraRule = {
        kind: 'algebra',
        template: 'nested_linear',
        variableName: 'x',
        minSolution: 1,
        maxSolution: 8,
        minCoefficient: 2,
        maxCoefficient: 4,
      };

      const prng1 = createMulberry32('seed-determinism-algebra');
      const prng2 = createMulberry32('seed-determinism-algebra');

      for (let i = 0; i < 20; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'T6-ALG-03', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'T6-ALG-03', sequenceIndex: i });
        expect(q1).toEqual(q2);
      }
    });
  });
});
