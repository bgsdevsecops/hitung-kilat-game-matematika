import { describe, it, expect } from 'vitest';
import { SignedArithmeticGenerator } from '../../src/engine/generators/signed';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { SignedRule } from '../../src/engine/types';

describe('SignedArithmeticGenerator', () => {
  const generator = new SignedArithmeticGenerator();
  const prng = createMulberry32('signed-seed-test');

  describe('validateRule', () => {
    it('accepts valid rules for all 4 operations (+, -, ×, ÷)', () => {
      const operations: SignedRule['operation'][] = ['+', '-', '×', '÷'];
      for (const operation of operations) {
        const rule: SignedRule = {
          kind: 'signed',
          operation,
          minOperand: -15,
          maxOperand: 15,
        };
        expect(generator.validateRule(rule)).toEqual(rule);
      }
    });

    it('rejects null, undefined, non-object, or invalid kind', () => {
      expect(() => generator.validateRule(null)).toThrow(/Invalid rule: expected signed/);
      expect(() => generator.validateRule(undefined)).toThrow(/Invalid rule: expected signed/);
      expect(() => generator.validateRule('signed')).toThrow(/Invalid rule: expected signed/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(/Invalid rule: expected signed/);
    });

    it('rejects invalid or missing operation', () => {
      expect(() =>
        generator.validateRule({
          kind: 'signed',
          minOperand: -10,
          maxOperand: 10,
        } as unknown as SignedRule)
      ).toThrow(/SignedRule requires valid operation/);

      expect(() =>
        generator.validateRule({
          kind: 'signed',
          operation: '*' as unknown as '+',
          minOperand: -10,
          maxOperand: 10,
        })
      ).toThrow(/SignedRule requires valid operation/);

      expect(() =>
        generator.validateRule({
          kind: 'signed',
          operation: '/' as unknown as '÷',
          minOperand: -10,
          maxOperand: 10,
        })
      ).toThrow(/SignedRule requires valid operation/);
    });

    it('rejects invalid operand bounds where minOperand > maxOperand', () => {
      expect(() =>
        generator.validateRule({
          kind: 'signed',
          operation: '+',
          minOperand: 10,
          maxOperand: -10,
        })
      ).toThrow(/operand bounds/);
    });

    it('rejects non-numeric operand bounds', () => {
      expect(() =>
        generator.validateRule({
          kind: 'signed',
          operation: '+',
          minOperand: NaN,
          maxOperand: 10,
        })
      ).toThrow(/operand bounds/);

      expect(() =>
        generator.validateRule({
          kind: 'signed',
          operation: '+',
          minOperand: -10,
          maxOperand: '10' as unknown as number,
        })
      ).toThrow(/operand bounds/);
    });
  });

  describe('operation: + (addition)', () => {
    it('generates addition with signed numbers and formats negative operands with parentheses', () => {
      const rule: SignedRule = {
        kind: 'signed',
        operation: '+',
        minOperand: -15,
        maxOperand: 15,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T5-NEG-ADD', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        expect(q.displayPrompt).not.toContain('+ -');
        expect(q.primarySkillId).toBe('arithmetic.signed');
        expect(q.skillTags).toEqual(['signed', 'negative_numbers']);
        expect(q.difficulty).toBe(3);
        expect(q.generatorKey).toBe('signed');
        expect(q.targetResponseTimeMs).toBe(3500);
        expect(q.templateFamily).toBe('signed_arithmetic');

        // Extract operands and verify answer
        const match = q.displayPrompt.match(/^(-?\d+)\s\+\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = parseInt(match[1], 10);
          const bRaw = match[2].replace(/[()]/g, '');
          const b = parseInt(bRaw, 10);

          if (b < 0) {
            expect(match[2]).toBe(`(${b})`);
          } else {
            expect(match[2]).toBe(`${b}`);
          }

          if (q.answerSpec.kind === 'integer') {
            expect(q.answerSpec.value).toBe(a + b);
          }
          expect(q.explanation).toBe(`${q.displayPrompt} = ${a + b}`);
        }
      }
    });
  });

  describe('operation: - (subtraction)', () => {
    it('generates subtraction with signed numbers without unparenthesized minus-minus', () => {
      const rule: SignedRule = {
        kind: 'signed',
        operation: '-',
        minOperand: -15,
        maxOperand: 15,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T5-NEG-SUB', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        expect(q.displayPrompt).not.toContain('- -');

        const match = q.displayPrompt.match(/^(-?\d+)\s-\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = parseInt(match[1], 10);
          const bRaw = match[2].replace(/[()]/g, '');
          const b = parseInt(bRaw, 10);

          if (b < 0) {
            expect(match[2]).toBe(`(${b})`);
          } else {
            expect(match[2]).toBe(`${b}`);
          }

          if (q.answerSpec.kind === 'integer') {
            expect(q.answerSpec.value).toBe(a - b);
          }
          expect(q.explanation).toBe(`${q.displayPrompt} = ${a - b}`);
        }
      }
    });
  });

  describe('operation: × (multiplication)', () => {
    it('generates multiplication with signed numbers and parenthesized negative right operand', () => {
      const rule: SignedRule = {
        kind: 'signed',
        operation: '×',
        minOperand: -12,
        maxOperand: 12,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T5-NEG-MUL', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        expect(q.displayPrompt).not.toContain('× -');

        const match = q.displayPrompt.match(/^(-?\d+)\s×\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = parseInt(match[1], 10);
          const bRaw = match[2].replace(/[()]/g, '');
          const b = parseInt(bRaw, 10);

          if (b < 0) {
            expect(match[2]).toBe(`(${b})`);
          } else {
            expect(match[2]).toBe(`${b}`);
          }

          if (q.answerSpec.kind === 'integer') {
            expect(q.answerSpec.value).toBe(a * b);
          }
          expect(q.explanation).toBe(`${q.displayPrompt} = ${a * b}`);
        }
      }
    });
  });

  describe('operation: ÷ (clean division)', () => {
    it('generates clean division with negative operands and no division by zero', () => {
      const rule: SignedRule = {
        kind: 'signed',
        operation: '÷',
        minOperand: -12,
        maxOperand: 12,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T5-NEG-DIV', sequenceIndex: i });
        expect(q.answerSpec.kind).toBe('integer');
        expect(q.displayPrompt).not.toContain('÷ 0');
        expect(q.displayPrompt).not.toContain('÷ -'); // must be ÷ (-x)

        const match = q.displayPrompt.match(/^(-?\d+)\s÷\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = parseInt(match[1], 10);
          const bRaw = match[2].replace(/[()]/g, '');
          const b = parseInt(bRaw, 10);

          expect(b).not.toBe(0);
          if (b < 0) {
            expect(match[2]).toBe(`(${b})`);
          } else {
            expect(match[2]).toBe(`${b}`);
          }

          // Must be clean integer division
          expect(a % b === 0).toBe(true);
          if (q.answerSpec.kind === 'integer') {
            expect(q.answerSpec.value).toBe(Math.trunc(a / b));
          }
          expect(q.explanation).toBe(`${q.displayPrompt} = ${Math.trunc(a / b)}`);
        }
      }
    });
  });

  describe('allowZeroOperand handling', () => {
    it('does not generate zero operands by default (allowZeroOperand: false)', () => {
      const testPrng = createMulberry32('zero-check-seed');
      const rule: SignedRule = {
        kind: 'signed',
        operation: '+',
        minOperand: -5,
        maxOperand: 5,
        allowZeroOperand: false,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, testPrng, { levelId: 'T5-NEG-ZERO', sequenceIndex: i });
        const match = q.displayPrompt.match(/^(-?\d+)\s\+\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = parseInt(match[1], 10);
          const b = parseInt(match[2].replace(/[()]/g, ''), 10);
          expect(a).not.toBe(0);
          expect(b).not.toBe(0);
        }
      }
    });

    it('generates zero operands when allowZeroOperand is true', () => {
      const testPrng = createMulberry32('zero-allowed-seed');
      const rule: SignedRule = {
        kind: 'signed',
        operation: '+',
        minOperand: -2,
        maxOperand: 2,
        allowZeroOperand: true,
      };

      let hasZeroOperand = false;
      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, testPrng, { levelId: 'T5-NEG-ZERO-ALLOW', sequenceIndex: i });
        const match = q.displayPrompt.match(/^(-?\d+)\s\+\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const a = parseInt(match[1], 10);
          const b = parseInt(match[2].replace(/[()]/g, ''), 10);
          if (a === 0 || b === 0) {
            hasZeroOperand = true;
            break;
          }
        }
      }
      expect(hasZeroOperand).toBe(true);
    });

    it('never divides by zero even if allowZeroOperand is true', () => {
      const testPrng = createMulberry32('zero-div-seed');
      const rule: SignedRule = {
        kind: 'signed',
        operation: '÷',
        minOperand: -10,
        maxOperand: 10,
        allowZeroOperand: true,
      };

      for (let i = 0; i < 50; i++) {
        const q = generator.generate(rule, testPrng, { levelId: 'T5-NEG-DIV-ZERO', sequenceIndex: i });
        expect(q.displayPrompt).not.toContain('÷ 0');
        const match = q.displayPrompt.match(/^(-?\d+)\s÷\s(\(-?\d+\)|\d+)$/);
        expect(match).not.toBeNull();
        if (match) {
          const b = parseInt(match[2].replace(/[()]/g, ''), 10);
          expect(b).not.toBe(0);
        }
      }
    });
  });

  describe('PRNG reproducibility', () => {
    it('generates deterministic output for same seed and context', () => {
      const rule: SignedRule = {
        kind: 'signed',
        operation: '-',
        minOperand: -15,
        maxOperand: 15,
      };

      const prng1 = createMulberry32('deterministic-signed-seed');
      const prng2 = createMulberry32('deterministic-signed-seed');

      for (let i = 0; i < 10; i++) {
        const q1 = generator.generate(rule, prng1, { levelId: 'T5-NEG-REPRO', sequenceIndex: i });
        const q2 = generator.generate(rule, prng2, { levelId: 'T5-NEG-REPRO', sequenceIndex: i });

        expect(q1.displayPrompt).toBe(q2.displayPrompt);
        expect(q1.answerSpec).toEqual(q2.answerSpec);
        expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
        expect(q1.explanation).toBe(q2.explanation);
      }
    });
  });
});
