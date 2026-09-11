import { describe, it, expect } from 'vitest';
import { BodmasGenerator } from '../../src/engine/generators/bodmas';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { BodmasRule } from '../../src/engine/types';

describe('BodmasGenerator', () => {
  const generator = new BodmasGenerator();
  const prng = createMulberry32('bodmas-seed-test');

  describe('validateRule', () => {
    it('accepts valid rules for all 8 templates', () => {
      const templates: BodmasRule['template'][] = [
        'a_plus_b_times_c',
        'a_times_b_plus_c',
        'a_times_b_minus_c',
        'a_minus_b_div_c',
        'a_div_b_plus_c',
        'paren_add_div_c',
        'paren_sub_mul_c',
        'paren_nested_bodmas',
      ];

      for (const template of templates) {
        const rule: BodmasRule = {
          kind: 'bodmas',
          template,
          minOperand: 2,
          maxOperand: 10,
        };
        expect(generator.validateRule(rule)).toEqual(rule);
      }
    });

    it('rejects null, non-object, or incorrect kind', () => {
      expect(() => generator.validateRule(null)).toThrow(/Invalid rule: expected bodmas/);
      expect(() => generator.validateRule(undefined)).toThrow(/Invalid rule: expected bodmas/);
      expect(() => generator.validateRule('bodmas')).toThrow(/Invalid rule: expected bodmas/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(/Invalid rule: expected bodmas/);
    });

    it('rejects missing or invalid template', () => {
      expect(() =>
        generator.validateRule({
          kind: 'bodmas',
          minOperand: 2,
          maxOperand: 10,
        } as unknown as BodmasRule)
      ).toThrow(/requires template/);

      expect(() =>
        generator.validateRule({
          kind: 'bodmas',
          template: 'invalid_template' as unknown as BodmasRule['template'],
          minOperand: 2,
          maxOperand: 10,
        })
      ).toThrow(/Invalid BodmasRule template/);
    });

    it('rejects invalid operand bounds where minOperand > maxOperand', () => {
      expect(() =>
        generator.validateRule({
          kind: 'bodmas',
          template: 'a_plus_b_times_c',
          minOperand: 10,
          maxOperand: 2,
        })
      ).toThrow(/Invalid BodmasRule operand bounds/);
    });
  });

  describe('template: a_plus_b_times_c', () => {
    it('generates a + b × c adhering to multiplication precedence', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'a_plus_b_times_c',
        minOperand: 2,
        maxOperand: 9,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-01', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+ \+ \d+ × \d+$/);
        const parts = q.displayPrompt.match(/^(\d+) \+ (\d+) × (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(q.answerSpec.value).toBe(a + b * c);
          expect(q.explanation).toContain(`${b} × ${c} = ${b * c}`);
          expect(q.explanation).toContain(`${a} + ${b * c} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: a_times_b_plus_c', () => {
    it('generates a × b + c adhering to multiplication precedence', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'a_times_b_plus_c',
        minOperand: 2,
        maxOperand: 9,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-02', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+ × \d+ \+ \d+$/);
        const parts = q.displayPrompt.match(/^(\d+) × (\d+) \+ (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(q.answerSpec.value).toBe(a * b + c);
          expect(q.explanation).toContain(`${a} × ${b} = ${a * b}`);
          expect(q.explanation).toContain(`${a * b} + ${c} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: a_times_b_minus_c', () => {
    it('generates a × b - c adhering to multiplication precedence and positive result', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'a_times_b_minus_c',
        minOperand: 2,
        maxOperand: 9,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-MS', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+ × \d+ - \d+$/);
        const parts = q.displayPrompt.match(/^(\d+) × (\d+) - (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(q.answerSpec.value).toBe(a * b - c);
          expect(q.answerSpec.value).toBeGreaterThan(0);
          expect(q.explanation).toContain(`${a} × ${b} = ${a * b}`);
          expect(q.explanation).toContain(`${a * b} - ${c} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: a_minus_b_div_c', () => {
    it('generates a - b ÷ c with division precedence, non-zero divisor, and clean integer division', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'a_minus_b_div_c',
        minOperand: 2,
        maxOperand: 10,
        requireCleanDivision: true,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-03', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+ - \d+ ÷ \d+$/);
        const parts = q.displayPrompt.match(/^(\d+) - (\d+) ÷ (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(c).toBeGreaterThanOrEqual(2);
          expect(b % c).toBe(0);
          const quotient = b / c;
          expect(a - quotient).toBe(q.answerSpec.value);
          expect(q.answerSpec.value).toBeGreaterThan(0);
          expect(q.explanation).toContain(`${b} ÷ ${c} = ${quotient}`);
          expect(q.explanation).toContain(`${a} - ${quotient} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: a_div_b_plus_c', () => {
    it('generates a ÷ b + c with division precedence, non-zero divisor, and clean integer division', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'a_div_b_plus_c',
        minOperand: 2,
        maxOperand: 10,
        requireCleanDivision: true,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-DA', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+ ÷ \d+ \+ \d+$/);
        const parts = q.displayPrompt.match(/^(\d+) ÷ (\d+) \+ (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(b).toBeGreaterThanOrEqual(2);
          expect(a % b).toBe(0);
          const quotient = a / b;
          expect(quotient + c).toBe(q.answerSpec.value);
          expect(q.explanation).toContain(`${a} ÷ ${b} = ${quotient}`);
          expect(q.explanation).toContain(`${quotient} + ${c} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: paren_add_div_c', () => {
    it('generates (a + b) ÷ c with guaranteed clean integer division and no division by zero', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'paren_add_div_c',
        minOperand: 2,
        maxOperand: 10,
        requireCleanDivision: true,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-PAREN-01', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\(\d+ \+ \d+\) ÷ \d+$/);
        const parts = q.displayPrompt.match(/^\((\d+) \+ (\d+)\) ÷ (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(c).toBeGreaterThanOrEqual(2);
          expect((a + b) % c).toBe(0);
          const total = a + b;
          expect(q.answerSpec.value).toBe(total / c);
          expect(q.explanation).toContain(`${a} + ${b} = ${total}`);
          expect(q.explanation).toContain(`${total} ÷ ${c} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: paren_sub_mul_c', () => {
    it('generates (a - b) × c prioritizing parentheses evaluation with non-negative diff', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'paren_sub_mul_c',
        minOperand: 2,
        maxOperand: 10,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-PAREN-02', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\(\d+ - \d+\) × \d+$/);
        const parts = q.displayPrompt.match(/^\((\d+) - (\d+)\) × (\d+)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c] = parts.map(Number);
          expect(a).toBeGreaterThan(b);
          const diff = a - b;
          expect(q.answerSpec.value).toBe(diff * c);
          expect(q.explanation).toContain(`${a} - ${b} = ${diff}`);
          expect(q.explanation).toContain(`${diff} × ${c} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('template: paren_nested_bodmas', () => {
    it('generates a + b × (c - d) evaluating parentheses first, then multiplication, then addition', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'paren_nested_bodmas',
        minOperand: 2,
        maxOperand: 9,
      };

      for (let i = 0; i < 25; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T4-BODMAS-NESTED', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+ \+ \d+ × \(\d+ - \d+\)$/);
        const parts = q.displayPrompt.match(/^(\d+) \+ (\d+) × \((\d+) - (\d+)\)$/);
        expect(parts).not.toBeNull();
        if (parts && q.answerSpec.kind === 'integer') {
          const [, a, b, c, d] = parts.map(Number);
          expect(c).toBeGreaterThan(d);
          const diff = c - d;
          expect(q.answerSpec.value).toBe(a + b * diff);
          expect(q.explanation).toContain(`${c} - ${d} = ${diff}`);
          expect(q.explanation).toContain(`${b} × ${diff} = ${b * diff}`);
          expect(q.explanation).toContain(`${a} + ${b * diff} = ${q.answerSpec.value}`);
        }
      }
    });
  });

  describe('metadata and context integrity', () => {
    it('populates correct metadata and question identifiers', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'a_plus_b_times_c',
        minOperand: 2,
        maxOperand: 9,
      };

      const context = { levelId: 'T4-BODMAS-01', sequenceIndex: 7 };
      const q = generator.generate(rule, prng, context);

      expect(generator.key).toBe('bodmas');
      expect(generator.version).toBe(1);
      expect(q.generatorKey).toBe('bodmas');
      expect(q.questionInstanceId).toBe('T4-BODMAS-01:7');
      expect(q.questionDefinitionId).toMatch(/^bodmas-a_plus_b_times_c-\d+$/);
      expect(q.primarySkillId).toBe('arithmetic.bodmas');
      expect(q.skillTags).toEqual(['bodmas', 'precedence']);
      expect(q.difficulty).toBe(3);
      expect(q.targetResponseTimeMs).toBe(4000);
      expect(q.templateFamily).toBe('a_plus_b_times_c');
    });

    it('produces deterministic output for the same seed and context', () => {
      const rule: BodmasRule = {
        kind: 'bodmas',
        template: 'paren_nested_bodmas',
        minOperand: 2,
        maxOperand: 9,
      };

      const prng1 = createMulberry32('deterministic-bodmas-seed');
      const prng2 = createMulberry32('deterministic-bodmas-seed');

      const q1 = generator.generate(rule, prng1, { levelId: 'T4-BODMAS-01', sequenceIndex: 1 });
      const q2 = generator.generate(rule, prng2, { levelId: 'T4-BODMAS-01', sequenceIndex: 1 });

      expect(q1.displayPrompt).toBe(q2.displayPrompt);
      expect(q1.answerSpec).toEqual(q2.answerSpec);
      expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
      expect(q1.explanation).toBe(q2.explanation);
    });
  });
});
