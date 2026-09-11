import { describe, it, expect } from 'vitest';
import { evaluateAnswer, gcd } from '../../src/engine/evaluator/answerEvaluator';
import { evaluateAnswer as evaluateAnswerBarrel, gcd as gcdBarrel } from '../../src/engine/evaluator';
import { AnswerSpec } from '../../src/engine/types';

describe('answerEvaluator exports', () => {
  it('exports evaluateAnswer and gcd from both module and index barrel', () => {
    expect(typeof evaluateAnswer).toBe('function');
    expect(typeof gcd).toBe('function');
    expect(evaluateAnswer).toBe(evaluateAnswerBarrel);
    expect(gcd).toBe(gcdBarrel);
  });
});

describe('gcd utility', () => {
  it('computes greatest common divisor for positive integers', () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(54, 24)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });

  it('computes gcd for negative numbers using absolute values', () => {
    expect(gcd(-12, 8)).toBe(4);
    expect(gcd(12, -8)).toBe(4);
    expect(gcd(-12, -8)).toBe(4);
  });

  it('handles zero in gcd computation', () => {
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(7, 0)).toBe(7);
    expect(gcd(0, 0)).toBe(0);
  });
});

describe('evaluateAnswer', () => {
  describe('Integer Answer', () => {
    const spec: AnswerSpec = { kind: 'integer', value: 42 };

    it('accepts correct positive integer and ignores whitespace', () => {
      expect(evaluateAnswer(spec, '42').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '  42 ').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '42').expectedDisplay).toBe('42');
      expect(evaluateAnswer(spec, '42').normalizedUserAnswer).toBe('42');
    });

    it('rejects incorrect integer', () => {
      expect(evaluateAnswer(spec, '41').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, 'abc').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '').isCorrect).toBe(false);
    });

    it('handles negative integers correctly', () => {
      const negSpec: AnswerSpec = { kind: 'integer', value: -15 };
      expect(evaluateAnswer(negSpec, '-15').isCorrect).toBe(true);
      expect(evaluateAnswer(negSpec, '15').isCorrect).toBe(false);
      expect(evaluateAnswer(negSpec, '-15').expectedDisplay).toBe('-15');
    });
  });

  describe('Rational Answer', () => {
    const spec: AnswerSpec = { kind: 'rational', numerator: 1, denominator: 2 };

    it('accepts exact fraction', () => {
      const res = evaluateAnswer(spec, '1/2');
      expect(res.isCorrect).toBe(true);
      expect(res.normalizedUserAnswer).toBe('1/2');
      expect(res.expectedDisplay).toBe('1/2');
    });

    it('accepts equivalent unsimplified fraction when requireSimplified is false', () => {
      expect(evaluateAnswer(spec, '2/4').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '4/8').isCorrect).toBe(true);
    });

    it('rejects unsimplified fraction when requireSimplified is true', () => {
      const strictSpec: AnswerSpec = { kind: 'rational', numerator: 1, denominator: 2, requireSimplified: true };
      expect(evaluateAnswer(strictSpec, '1/2').isCorrect).toBe(true);
      expect(evaluateAnswer(strictSpec, '2/4').isCorrect).toBe(false);
      expect(evaluateAnswer(strictSpec, '2/4').normalizedUserAnswer).toBe('2/4');
    });

    it('rejects division by zero in user input', () => {
      expect(evaluateAnswer(spec, '1/0').isCorrect).toBe(false);
    });

    it('accepts fractions with whitespace around slash', () => {
      expect(evaluateAnswer(spec, ' 1 / 2 ').isCorrect).toBe(true);
    });

    it('rejects invalid fraction format', () => {
      expect(evaluateAnswer(spec, 'invalid').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '1//2').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '1/2/3').isCorrect).toBe(false);
    });
  });

  describe('Decimal Answer', () => {
    // 0.25 (scaledValue: 25, scale: 2)
    const spec: AnswerSpec = { kind: 'decimal', scaledValue: 25, scale: 2 };

    it('accepts decimal with dot or comma', () => {
      expect(evaluateAnswer(spec, '0.25').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '0,25').isCorrect).toBe(true);
      expect(evaluateAnswer(spec, '0.25').normalizedUserAnswer).toBe('0.25');
      expect(evaluateAnswer(spec, '0,25').normalizedUserAnswer).toBe('0.25');
    });

    it('rejects decimal with wrong value', () => {
      expect(evaluateAnswer(spec, '0.24').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '0.255').isCorrect).toBe(false);
    });

    it('accepts decimal with trailing zeros', () => {
      expect(evaluateAnswer(spec, '0.250').isCorrect).toBe(true);
    });

    it('handles negative decimals correctly', () => {
      const negSpec: AnswerSpec = { kind: 'decimal', scaledValue: -25, scale: 2 };
      expect(evaluateAnswer(negSpec, '-0.25').isCorrect).toBe(true);
      expect(evaluateAnswer(negSpec, '-0,25').isCorrect).toBe(true);
      expect(evaluateAnswer(negSpec, '0.25').isCorrect).toBe(false);
    });

    it('respects acceptedTolerance when provided', () => {
      const tolSpec: AnswerSpec = { kind: 'decimal', scaledValue: 25, scale: 2, acceptedTolerance: 1 };
      // scaledValue 25 with scale 2 represents 0.25; tolerance 1 in scaled units is +/- 0.01 (0.24 to 0.26)
      expect(evaluateAnswer(tolSpec, '0.25').isCorrect).toBe(true);
      expect(evaluateAnswer(tolSpec, '0.26').isCorrect).toBe(true);
      expect(evaluateAnswer(tolSpec, '0.24').isCorrect).toBe(true);
      expect(evaluateAnswer(tolSpec, '0.27').isCorrect).toBe(false);
      expect(evaluateAnswer(tolSpec, '0.23').isCorrect).toBe(false);
    });

    it('rejects invalid decimal strings', () => {
      expect(evaluateAnswer(spec, 'abc').isCorrect).toBe(false);
      expect(evaluateAnswer(spec, '0.2.5').isCorrect).toBe(false);
    });
  });

  describe('Choice Answer', () => {
    const spec: AnswerSpec = {
      kind: 'choice',
      optionId: 'b',
      options: [
        { id: 'a', label: '10' },
        { id: 'b', label: '20' },
      ],
    };

    it('evaluates choice option ID correctly', () => {
      const correctRes = evaluateAnswer(spec, 'b');
      expect(correctRes.isCorrect).toBe(true);
      expect(correctRes.expectedDisplay).toBe('20');
      expect(correctRes.normalizedUserAnswer).toBe('b');

      const incorrectRes = evaluateAnswer(spec, 'a');
      expect(incorrectRes.isCorrect).toBe(false);
      expect(incorrectRes.expectedDisplay).toBe('20');
    });

    it('falls back to optionId if label not found in options', () => {
      const fallbackSpec: AnswerSpec = {
        kind: 'choice',
        optionId: 'unknown',
        options: [{ id: 'a', label: '10' }],
      };
      expect(evaluateAnswer(fallbackSpec, 'unknown').expectedDisplay).toBe('unknown');
    });
  });
});
