import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';
import {
  AdditionGenerator,
  SubtractionGenerator,
  MultiplicationGenerator,
  DivisionGenerator,
  MissingOperandGenerator,
} from '../../src/engine/generators';
import { AdditionGenerator as DirectAdditionGenerator } from '../../src/engine/generators/addition';
import { SubtractionGenerator as DirectSubtractionGenerator } from '../../src/engine/generators/subtraction';
import { MultiplicationGenerator as DirectMultiplicationGenerator } from '../../src/engine/generators/multiplication';
import { DivisionGenerator as DirectDivisionGenerator } from '../../src/engine/generators/division';
import { MissingOperandGenerator as DirectMissingOperandGenerator } from '../../src/engine/generators/missingOperand';
import { GenerationContext } from '../../src/engine/types';

describe('Arithmetic Generators', () => {
  const dummyContext: GenerationContext = {
    levelId: 'TEST-01',
    sequenceIndex: 1,
  };

  describe('Barrel export integrity', () => {
    it('exports all generators from index barrel', () => {
      expect(AdditionGenerator).toBe(DirectAdditionGenerator);
      expect(SubtractionGenerator).toBe(DirectSubtractionGenerator);
      expect(MultiplicationGenerator).toBe(DirectMultiplicationGenerator);
      expect(DivisionGenerator).toBe(DirectDivisionGenerator);
      expect(MissingOperandGenerator).toBe(DirectMissingOperandGenerator);
    });
  });

  describe('AdditionGenerator', () => {
    it('generates valid addition questions within bounds', () => {
      const generator = new AdditionGenerator();
      const prng = createMulberry32(42);
      const q = generator.generate(
        { kind: 'addition', minA: 5, maxA: 10, minB: 1, maxB: 5 },
        prng,
        dummyContext
      );

      expect(q.generatorKey).toBe('addition');
      expect(q.difficulty).toBe(1);
      expect(q.questionInstanceId).toBe('TEST-01:1');
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBeGreaterThanOrEqual(6);
        expect(q.answerSpec.value).toBeLessThanOrEqual(15);
      }
      expect(q.displayPrompt).toMatch(/^\d+ \+ \d+$/);
      expect(q.templateFamily).toBe('addition_basic');
      expect(q.explanation).toContain('=');
    });

    it('generates 3-term addition when termsCount is 3', () => {
      const generator = new AdditionGenerator();
      const prng = createMulberry32(12345);
      const q = generator.generate(
        { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10, termsCount: 3 },
        prng,
        dummyContext
      );

      expect(q.difficulty).toBe(2);
      expect(q.displayPrompt).toMatch(/^\d+ \+ \d+ \+ \d+$/);
      expect(q.primarySkillId).toBe('addition.three_terms');
      expect(q.templateFamily).toBe('addition_chain');
      expect(q.targetResponseTimeMs).toBe(3500);
      if (q.answerSpec.kind === 'integer') {
        const parts = q.displayPrompt.split(' + ').map(Number);
        expect(parts.length).toBe(3);
        expect(parts[0] + parts[1] + parts[2]).toBe(q.answerSpec.value);
      }
    });

    it('validates rule bounds and kind', () => {
      const generator = new AdditionGenerator();
      expect(() => {
        generator.validateRule({ kind: 'addition', minA: 10, maxA: 5, minB: 1, maxB: 5 });
      }).toThrow('Invalid AdditionRule bounds');

      expect(() => {
        generator.validateRule({ kind: 'addition', minA: 1, maxA: 5, minB: 10, maxB: 5 });
      }).toThrow('Invalid AdditionRule bounds');

      expect(() => {
        generator.validateRule({ kind: 'subtraction', minA: 1, maxA: 5, minB: 1, maxB: 5 });
      }).toThrow('Invalid rule: expected addition');
    });

    it('produces deterministic output with same seed', () => {
      const generator = new AdditionGenerator();
      const rule = { kind: 'addition' as const, minA: 10, maxA: 99, minB: 10, maxB: 99 };
      const q1 = generator.generate(rule, createMulberry32('seed-abc'), dummyContext);
      const q2 = generator.generate(rule, createMulberry32('seed-abc'), dummyContext);
      expect(q1).toEqual(q2);
    });
  });

  describe('SubtractionGenerator', () => {
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
        const [a, b] = q.displayPrompt.split(' - ').map(Number);
        expect(a).toBeGreaterThanOrEqual(b);
        expect(q.templateFamily).toBe('subtraction_basic');
      }
    });

    it('allows negative results when allowNegative is true', () => {
      const generator = new SubtractionGenerator();
      const prng = createMulberry32(42);
      let foundNegative = false;
      for (let i = 0; i < 100; i++) {
        const q = generator.generate(
          { kind: 'subtraction', minA: 1, maxA: 5, minB: 15, maxB: 20, allowNegative: true },
          prng,
          dummyContext
        );
        if (q.answerSpec.kind === 'integer' && q.answerSpec.value < 0) {
          foundNegative = true;
          break;
        }
      }
      expect(foundNegative).toBe(true);
    });

    it('validates rule bounds and kind', () => {
      const generator = new SubtractionGenerator();
      expect(() => {
        generator.validateRule({ kind: 'subtraction', minA: 20, maxA: 10, minB: 1, maxB: 5 });
      }).toThrow('Invalid SubtractionRule bounds');

      expect(() => {
        generator.validateRule({ kind: 'addition', minA: 1, maxA: 5, minB: 1, maxB: 5 });
      }).toThrow('Invalid rule: expected subtraction');
    });

    it('produces deterministic output with same seed', () => {
      const generator = new SubtractionGenerator();
      const rule = { kind: 'subtraction' as const, minA: 10, maxA: 50, minB: 1, maxB: 25 };
      const q1 = generator.generate(rule, createMulberry32('sub-seed'), dummyContext);
      const q2 = generator.generate(rule, createMulberry32('sub-seed'), dummyContext);
      expect(q1).toEqual(q2);
    });
  });

  describe('MultiplicationGenerator', () => {
    it('generates multiplication with fixed operand', () => {
      const generator = new MultiplicationGenerator();
      const prng = createMulberry32(100);
      const q = generator.generate(
        { kind: 'multiplication', fixedOperand: 7, minA: 2, maxA: 9, minB: 2, maxB: 9 },
        prng,
        dummyContext
      );
      expect(q.displayPrompt).toContain('7');
      expect(q.primarySkillId).toBe('multiplication.x7');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value % 7).toBe(0);
      }
      expect(q.difficulty).toBe(2);
      expect(q.templateFamily).toBe('multiplication_basic');
    });

    it('generates multiplication with variable operands within bounds', () => {
      const generator = new MultiplicationGenerator();
      const prng = createMulberry32(2026);
      for (let i = 0; i < 20; i++) {
        const q = generator.generate(
          { kind: 'multiplication', minA: 3, maxA: 6, minB: 4, maxB: 8 },
          prng,
          dummyContext
        );
        const [a, b] = q.displayPrompt.split(' × ').map(Number);
        expect(a).toBeGreaterThanOrEqual(3);
        expect(a).toBeLessThanOrEqual(6);
        expect(b).toBeGreaterThanOrEqual(4);
        expect(b).toBeLessThanOrEqual(8);
        if (q.answerSpec.kind === 'integer') {
          expect(q.answerSpec.value).toBe(a * b);
        }
      }
    });

    it('validates rule bounds and kind', () => {
      const generator = new MultiplicationGenerator();
      expect(() => {
        generator.validateRule({ kind: 'multiplication', minA: 10, maxA: 2, minB: 1, maxB: 5 });
      }).toThrow('Invalid MultiplicationRule bounds');

      expect(() => {
        generator.validateRule({ kind: 'division', minA: 1, maxA: 5, minB: 1, maxB: 5 });
      }).toThrow('Invalid rule: expected multiplication');
    });

    it('produces deterministic output with same seed', () => {
      const generator = new MultiplicationGenerator();
      const rule = { kind: 'multiplication' as const, minA: 2, maxA: 9, minB: 2, maxB: 9 };
      const q1 = generator.generate(rule, createMulberry32('mul-seed'), dummyContext);
      const q2 = generator.generate(rule, createMulberry32('mul-seed'), dummyContext);
      expect(q1).toEqual(q2);
    });
  });

  describe('DivisionGenerator', () => {
    it('generates clean division with non-zero divisor', () => {
      const generator = new DivisionGenerator();
      const prng = createMulberry32(777);
      for (let i = 0; i < 50; i++) {
        const q = generator.generate(
          {
            kind: 'division',
            minDivisor: 2,
            maxDivisor: 9,
            minQuotient: 1,
            maxQuotient: 10,
            requireInteger: true,
          },
          prng,
          dummyContext
        );
        expect(q.generatorKey).toBe('division');
        expect(q.difficulty).toBe(2);
        expect(q.templateFamily).toBe('division_clean');
        if (q.answerSpec.kind === 'integer') {
          expect(Number.isInteger(q.answerSpec.value)).toBe(true);
          expect(q.answerSpec.value).toBeGreaterThanOrEqual(1);
          expect(q.answerSpec.value).toBeLessThanOrEqual(10);
        }
        const [dividend, divisor] = q.displayPrompt.split(' ÷ ').map(Number);
        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(divisor).toBeLessThanOrEqual(9);
        expect(dividend % divisor).toBe(0);
        if (q.answerSpec.kind === 'integer') {
          expect(dividend / divisor).toBe(q.answerSpec.value);
        }
      }
    });

    it('validates divisor > 0 and bounds', () => {
      const generator = new DivisionGenerator();
      expect(() => {
        generator.validateRule({
          kind: 'division',
          minDivisor: 0,
          maxDivisor: 5,
          minQuotient: 1,
          maxQuotient: 5,
        });
      }).toThrow('Division divisor must be greater than zero');

      expect(() => {
        generator.validateRule({
          kind: 'division',
          minDivisor: 8,
          maxDivisor: 4,
          minQuotient: 1,
          maxQuotient: 5,
        });
      }).toThrow('Invalid DivisionRule bounds');

      expect(() => {
        generator.validateRule({
          kind: 'addition',
          minDivisor: 1,
          maxDivisor: 5,
          minQuotient: 1,
          maxQuotient: 5,
        });
      }).toThrow('Invalid rule: expected division');
    });

    it('produces deterministic output with same seed', () => {
      const generator = new DivisionGenerator();
      const rule = {
        kind: 'division' as const,
        minDivisor: 2,
        maxDivisor: 9,
        minQuotient: 1,
        maxQuotient: 9,
      };
      const q1 = generator.generate(rule, createMulberry32('div-seed'), dummyContext);
      const q2 = generator.generate(rule, createMulberry32('div-seed'), dummyContext);
      expect(q1).toEqual(q2);
    });
  });

  describe('MissingOperandGenerator', () => {
    it('generates single-solution missing operand questions with multiplication', () => {
      const generator = new MissingOperandGenerator();
      const prng = createMulberry32(555);
      const q = generator.generate(
        {
          kind: 'missing_operand',
          operation: '×',
          missingPosition: 'first',
          minA: 2,
          maxA: 9,
          minB: 2,
          maxB: 9,
        },
        prng,
        dummyContext
      );
      expect(q.displayPrompt).toMatch(/^\? × \d+ = \d+$/);
      expect(q.answerSpec.kind).toBe('integer');
      expect(q.primarySkillId).toBe('missing_operand.×');
      expect(q.templateFamily).toBe('missing_operand_basic');
    });

    it('generates missing first and second position for addition', () => {
      const generator = new MissingOperandGenerator();
      const prng = createMulberry32(42);

      const qFirst = generator.generate(
        {
          kind: 'missing_operand',
          operation: '+',
          missingPosition: 'first',
          minA: 5,
          maxA: 15,
          minB: 5,
          maxB: 15,
        },
        prng,
        dummyContext
      );
      expect(qFirst.displayPrompt).toMatch(/^\? \+ \d+ = \d+$/);

      const qSecond = generator.generate(
        {
          kind: 'missing_operand',
          operation: '+',
          missingPosition: 'second',
          minA: 5,
          maxA: 15,
          minB: 5,
          maxB: 15,
        },
        prng,
        dummyContext
      );
      expect(qSecond.displayPrompt).toMatch(/^\d+ \+ \? = \d+$/);
    });

    it('generates missing position for subtraction correctly', () => {
      const generator = new MissingOperandGenerator();
      const prng = createMulberry32(88);

      const qFirst = generator.generate(
        {
          kind: 'missing_operand',
          operation: '-',
          missingPosition: 'first',
          minA: 10,
          maxA: 20,
          minB: 1,
          maxB: 9,
        },
        prng,
        dummyContext
      );
      expect(qFirst.displayPrompt).toMatch(/^\? - \d+ = \d+$/);

      const qSecond = generator.generate(
        {
          kind: 'missing_operand',
          operation: '-',
          missingPosition: 'second',
          minA: 10,
          maxA: 20,
          minB: 1,
          maxB: 9,
        },
        prng,
        dummyContext
      );
      expect(qSecond.displayPrompt).toMatch(/^\d+ - \? = \d+$/);
    });

    it('generates missing position for division', () => {
      const generator = new MissingOperandGenerator();
      const prng = createMulberry32(999);

      const qFirst = generator.generate(
        {
          kind: 'missing_operand',
          operation: '÷',
          missingPosition: 'first',
          minA: 2,
          maxA: 9,
          minB: 2,
          maxB: 9,
        },
        prng,
        dummyContext
      );
      expect(qFirst.displayPrompt).toMatch(/^\? ÷ \d+ = \d+$/);

      const qSecond = generator.generate(
        {
          kind: 'missing_operand',
          operation: '÷',
          missingPosition: 'second',
          minA: 2,
          maxA: 9,
          minB: 2,
          maxB: 9,
        },
        prng,
        dummyContext
      );
      expect(qSecond.displayPrompt).toMatch(/^\d+ ÷ \? = \d+$/);
    });

    it('supports random missing position', () => {
      const generator = new MissingOperandGenerator();
      const prng = createMulberry32(1234);
      let seenFirst = false;
      let seenSecond = false;

      for (let i = 0; i < 30; i++) {
        const q = generator.generate(
          {
            kind: 'missing_operand',
            operation: '+',
            missingPosition: 'random',
            minA: 1,
            maxA: 10,
            minB: 1,
            maxB: 10,
          },
          prng,
          dummyContext
        );
        if (q.displayPrompt.startsWith('? +')) seenFirst = true;
        if (q.displayPrompt.includes('+ ? =')) seenSecond = true;
      }
      expect(seenFirst).toBe(true);
      expect(seenSecond).toBe(true);
    });

    it('validates rule bounds and kind', () => {
      const generator = new MissingOperandGenerator();
      expect(() => {
        generator.validateRule({
          kind: 'missing_operand',
          operation: '+',
          missingPosition: 'first',
          minA: 10,
          maxA: 5,
          minB: 1,
          maxB: 5,
        });
      }).toThrow('Invalid MissingOperandRule bounds');

      expect(() => {
        generator.validateRule({
          kind: 'addition',
          operation: '+',
          missingPosition: 'first',
          minA: 1,
          maxA: 5,
          minB: 1,
          maxB: 5,
        });
      }).toThrow('Invalid rule: expected missing_operand');
    });

    it('produces deterministic output with same seed', () => {
      const generator = new MissingOperandGenerator();
      const rule = {
        kind: 'missing_operand' as const,
        operation: '×' as const,
        missingPosition: 'second' as const,
        minA: 3,
        maxA: 8,
        minB: 3,
        maxB: 8,
      };
      const q1 = generator.generate(rule, createMulberry32('miss-seed'), dummyContext);
      const q2 = generator.generate(rule, createMulberry32('miss-seed'), dummyContext);
      expect(q1).toEqual(q2);
    });
  });
});
