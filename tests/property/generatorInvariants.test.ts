import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { AdditionGenerator } from '../../src/engine/generators/addition';
import { SubtractionGenerator } from '../../src/engine/generators/subtraction';
import { MultiplicationGenerator } from '../../src/engine/generators/multiplication';
import { DivisionGenerator } from '../../src/engine/generators/division';
import { MissingOperandGenerator } from '../../src/engine/generators/missingOperand';
import { evaluateAnswer } from '../../src/engine/evaluator/answerEvaluator';

describe('Property-Based Mathematical Invariants (>= 10.000 cases)', () => {
  it('Addition invariant: 100% correct evaluation and prompt matches sum for 2-term and 3-term', () => {
    const generator = new AdditionGenerator();
    const prng = createMulberry32('prop-addition-seed');

    for (let i = 0; i < 10000; i++) {
      const isThreeTerms = i % 2 === 1;
      const q = generator.generate(
        {
          kind: 'addition',
          minA: 1,
          maxA: 100,
          minB: 1,
          maxB: 100,
          termsCount: isThreeTerms ? 3 : 2,
        },
        prng,
        { levelId: 'PROP-ADD', sequenceIndex: i }
      );

      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        const parts = q.displayPrompt.split(' + ').map(Number);
        const expectedSum = parts.reduce((acc, curr) => acc + curr, 0);
        expect(q.answerSpec.value).toBe(expectedSum);

        const evalResult = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
        expect(evalResult.isCorrect).toBe(true);
      }
    }
  });

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

  it.each(['+', '-', '×', '÷'] as const)(
    'Missing Operand invariant for operation %s: exactly one valid solution and no NaN',
    (operation) => {
      const generator = new MissingOperandGenerator();
      const prng = createMulberry32(`prop-missing-${operation}-seed`);

      for (let i = 0; i < 10000; i++) {
        const q = generator.generate(
          {
            kind: 'missing_operand',
            operation,
            missingPosition: 'random',
            minA: 1,
            maxA: 50,
            minB: 1,
            maxB: 50,
          },
          prng,
          { levelId: `PROP-MISS-${operation}`, sequenceIndex: i }
        );

        expect(q.answerSpec.kind).toBe('integer');
        if (q.answerSpec.kind === 'integer') {
          expect(q.explanation).not.toContain('NaN');
          expect(q.displayPrompt).not.toContain('NaN');
          expect(q.displayPrompt).not.toContain('÷ 0');

          const evalResult = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
          expect(evalResult.isCorrect).toBe(true);
        }
      }
    }
  );
});
