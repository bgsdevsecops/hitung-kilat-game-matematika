import { QuestionGenerator } from './base';
import { SignedRule, Question, GenerationContext } from '../types';
import { randomInt } from '../utils/prng';

export class SignedArithmeticGenerator implements QuestionGenerator<SignedRule> {
  readonly key = 'signed';
  readonly version = 1;

  validateRule(rule: unknown): SignedRule {
    const r = rule as SignedRule;
    if (!r || r.kind !== 'signed') {
      throw new Error('Invalid rule: expected signed');
    }
    if (!r.operation || !['+', '-', '×', '÷'].includes(r.operation)) {
      throw new Error('SignedRule requires valid operation (+, -, ×, ÷)');
    }
    if (
      typeof r.minOperand !== 'number' ||
      typeof r.maxOperand !== 'number' ||
      Number.isNaN(r.minOperand) ||
      Number.isNaN(r.maxOperand) ||
      r.minOperand > r.maxOperand
    ) {
      throw new Error('Invalid SignedRule operand bounds: minOperand must be <= maxOperand');
    }
    return r;
  }

  generate(rule: SignedRule, prng: () => number, context: GenerationContext): Question {
    const allowZero = rule.allowZeroOperand ?? false;

    const sampleOperand = (min: number, max: number): number => {
      if (allowZero) {
        return randomInt(prng, min, max);
      }
      let val = 0;
      let count = 0;
      while (val === 0 && count < 20) {
        val = randomInt(prng, min, max);
        count++;
      }
      return val === 0 ? (max >= 1 ? 1 : (min <= -1 ? -1 : 1)) : val;
    };

    const clampBounds = (min: number, max: number, limit: number): [number, number] => {
      const lower = Math.max(-limit, min);
      const upper = Math.min(limit, max);
      if (lower <= upper) {
        return [lower, upper];
      }
      return [min, max];
    };

    let a: number;
    let b: number;
    let answerValue: number;

    if (rule.operation === '+') {
      a = sampleOperand(rule.minOperand, rule.maxOperand);
      b = sampleOperand(rule.minOperand, rule.maxOperand);
      if (rule.minOperand < 0 && a > 0 && b > 0) {
        if (randomInt(prng, 0, 1) === 0) {
          a = -a;
        } else {
          b = -b;
        }
      }
      answerValue = a + b;
    } else if (rule.operation === '-') {
      a = sampleOperand(rule.minOperand, rule.maxOperand);
      b = sampleOperand(rule.minOperand, rule.maxOperand);
      if (rule.minOperand >= 0 && a >= b) {
        // Guarantee negative result when subtracting positive integers on signed generator
        if (a === b) {
          b = Math.min(rule.maxOperand, a + 1);
          if (a === b) a = Math.max(rule.minOperand, b - 1);
        } else {
          const temp = a;
          a = b;
          b = temp;
        }
      } else if (rule.minOperand < 0 && a > 0 && b > 0) {
        if (randomInt(prng, 0, 1) === 0) {
          a = -a;
        } else {
          b = -b;
        }
      }
      answerValue = a - b;
    } else if (rule.operation === '×') {
      const [minM, maxM] = clampBounds(rule.minOperand, rule.maxOperand, 12);
      a = sampleOperand(minM, maxM);
      b = sampleOperand(minM, maxM);
      if (rule.minOperand < 0 && a > 0 && b > 0) {
        if (randomInt(prng, 0, 1) === 0) {
          a = -a;
        } else {
          b = -b;
        }
      }
      answerValue = a * b;
    } else {
      // Division: clean integer division, divisor (b) can never be zero
      const [minD, maxD] = clampBounds(rule.minOperand, rule.maxOperand, 10);
      let divisor = 0;
      let divAttempts = 0;
      while (divisor === 0 && divAttempts < 20) {
        divisor = randomInt(prng, minD, maxD);
        divAttempts++;
      }
      if (divisor === 0) {
        divisor = maxD >= 1 ? 1 : (minD <= -1 ? -1 : 1);
      }
      let quotient = sampleOperand(minD, maxD);
      if (rule.minOperand < 0 && divisor > 0 && quotient > 0) {
        if (randomInt(prng, 0, 1) === 0) {
          quotient = -quotient;
        } else {
          divisor = -divisor;
        }
      }
      a = divisor * quotient;
      b = divisor;
      answerValue = quotient;
    }

    // Normalize possible -0 to +0
    a = a === 0 ? 0 : a;
    b = b === 0 ? 0 : b;
    answerValue = answerValue === 0 ? 0 : answerValue;

    const bStr = b < 0 ? `(${b})` : `${b}`;
    const displayPrompt = `${a} ${rule.operation} ${bStr}`;
    const explanation = `${displayPrompt} = ${answerValue}`;

    return {
      questionDefinitionId: `signed-${rule.operation}-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: answerValue },
      primarySkillId: 'arithmetic.signed',
      skillTags: ['signed', 'negative_numbers'],
      difficulty: 3,
      generatorKey: this.key,
      targetResponseTimeMs: 3500,
      templateFamily: 'signed_arithmetic',
      explanation,
    };
  }
}
