import { describe, it, expect } from 'vitest';
import { ChainArithmeticGenerator } from '../../src/engine/generators/chain';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { ChainRule } from '../../src/engine/types';

describe('ChainArithmeticGenerator', () => {
  const generator = new ChainArithmeticGenerator();
  const prng = createMulberry32('chain-test-seed');

  describe('validateRule', () => {
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
        generator.validateRule({
          kind: 'chain',
          operators: [],
          termsCount: 3,
          minOperand: 1,
          maxOperand: 10,
        })
      ).toThrow();
    });

    it('rejects invalid kind or missing rule', () => {
      expect(() => generator.validateRule(null)).toThrow(/Invalid rule/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(/Invalid rule/);
    });

    it('rejects invalid termsCount', () => {
      expect(() =>
        generator.validateRule({
          kind: 'chain',
          operators: ['+'],
          termsCount: 2 as unknown as 3,
          minOperand: 1,
          maxOperand: 10,
        })
      ).toThrow(/termsCount must be 3 or 4/);

      expect(() =>
        generator.validateRule({
          kind: 'chain',
          operators: ['+'],
          termsCount: 5 as unknown as 3,
          minOperand: 1,
          maxOperand: 10,
        })
      ).toThrow(/termsCount must be 3 or 4/);
    });

    it('rejects minOperand > maxOperand', () => {
      expect(() =>
        generator.validateRule({
          kind: 'chain',
          operators: ['+'],
          termsCount: 3,
          minOperand: 20,
          maxOperand: 10,
        })
      ).toThrow(/Invalid ChainRule operand bounds/);
    });

    it('rejects unsupported operators', () => {
      expect(() =>
        generator.validateRule({
          kind: 'chain',
          operators: ['*' as unknown as '+'],
          termsCount: 3,
          minOperand: 1,
          maxOperand: 10,
        })
      ).toThrow(/operators/);
    });
  });

  describe('generate 3 terms', () => {
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

          // Verify question metadata
          expect(q.primarySkillId).toBe('arithmetic.chain');
          expect(q.skillTags).toEqual(['chain', 'arithmetic']);
          expect(q.difficulty).toBe(2);
          expect(q.targetResponseTimeMs).toBe(3500);
          expect(q.templateFamily).toBe('chain_3_terms');
          expect(q.generatorKey).toBe('chain');

          // Verify left-to-right evaluation matches answerSpec.value
          const tokens = q.displayPrompt.split(' ');
          let evalVal = parseInt(tokens[0], 10);
          for (let t = 1; t < tokens.length; t += 2) {
            const op = tokens[t];
            const operand = parseInt(tokens[t + 1], 10);
            evalVal = op === '+' ? evalVal + operand : evalVal - operand;
            expect(evalVal).toBeGreaterThanOrEqual(0);
          }
          expect(evalVal).toBe(q.answerSpec.value);
        }
      }
    });

    it('handles chain with addition only', () => {
      const rule: ChainRule = {
        kind: 'chain',
        operators: ['+'],
        termsCount: 3,
        minOperand: 1,
        maxOperand: 10,
      };

      for (let i = 0; i < 20; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T1-CHAIN-01', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+\s\+\s\d+\s\+\s\d+$/);
        const tokens = q.displayPrompt.split(' ');
        const a = parseInt(tokens[0], 10);
        const b = parseInt(tokens[2], 10);
        const c = parseInt(tokens[4], 10);
        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind === 'integer') {
          expect(q.answerSpec.value).toBe(a + b + c);
        }
      }
    });

    it('handles chain with subtraction only and non-negative intermediate', () => {
      const rule: ChainRule = {
        kind: 'chain',
        operators: ['-'],
        termsCount: 3,
        minOperand: 1,
        maxOperand: 20,
        allowIntermediateNegative: false,
      };

      for (let i = 0; i < 20; i++) {
        const q = generator.generate(rule, prng, { levelId: 'T1-CHAIN-02', sequenceIndex: i });
        expect(q.displayPrompt).toMatch(/^\d+\s-\s\d+\s-\s\d+$/);
        const tokens = q.displayPrompt.split(' ');
        const a = parseInt(tokens[0], 10);
        const b = parseInt(tokens[2], 10);
        const c = parseInt(tokens[4], 10);
        expect(a - b).toBeGreaterThanOrEqual(0);
        expect(a - b - c).toBeGreaterThanOrEqual(0);
        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind === 'integer') {
          expect(q.answerSpec.value).toBe(a - b - c);
        }
      }
    });
  });

  describe('generate 4 terms', () => {
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
      expect(q.difficulty).toBe(3);
      expect(q.targetResponseTimeMs).toBe(4500);
      expect(q.templateFamily).toBe('chain_4_terms');

      // Verify left-to-right evaluation matches answerSpec.value
      const tokens = q.displayPrompt.split(' ');
      let evalVal = parseInt(tokens[0], 10);
      for (let t = 1; t < tokens.length; t += 2) {
        const op = tokens[t];
        const operand = parseInt(tokens[t + 1], 10);
        evalVal = op === '+' ? evalVal + operand : evalVal - operand;
      }
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(evalVal).toBe(q.answerSpec.value);
      }
    });

    it('generates deterministic output for same seed and context', () => {
      const rule: ChainRule = {
        kind: 'chain',
        operators: ['+', '-'],
        termsCount: 4,
        minOperand: 5,
        maxOperand: 25,
      };

      const prng1 = createMulberry32('deterministic-seed');
      const prng2 = createMulberry32('deterministic-seed');

      const q1 = generator.generate(rule, prng1, { levelId: 'T4-CHAIN-04', sequenceIndex: 1 });
      const q2 = generator.generate(rule, prng2, { levelId: 'T4-CHAIN-04', sequenceIndex: 1 });

      expect(q1.displayPrompt).toBe(q2.displayPrompt);
      expect(q1.answerSpec.kind).toBe('integer');
      expect(q2.answerSpec.kind).toBe('integer');
      if (q1.answerSpec.kind === 'integer' && q2.answerSpec.kind === 'integer') {
        expect(q1.answerSpec.value).toBe(q2.answerSpec.value);
      }
      expect(q1.questionDefinitionId).toBe(q2.questionDefinitionId);
      expect(q1.explanation).toBe(q2.explanation);
    });
  });
});
