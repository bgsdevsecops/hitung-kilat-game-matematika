import { QuestionGenerator } from './base';
import { MissingOperandRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class MissingOperandGenerator implements QuestionGenerator<MissingOperandRule> {
  readonly key = 'missing_operand';
  readonly version = 1;

  validateRule(rule: unknown): MissingOperandRule {
    const r = rule as MissingOperandRule;
    if (!r || r.kind !== 'missing_operand') {
      throw new Error('Invalid rule: expected missing_operand');
    }
    if (r.minA > r.maxA || r.minB > r.maxB) {
      throw new Error('Invalid MissingOperandRule bounds');
    }
    if (r.operation === '÷' || r.operation === '×') {
      if (r.minA < 1 || r.minB < 1) {
        throw new Error(`MissingOperandRule for ${r.operation} requires minA >= 1 and minB >= 1 to prevent indeterminate solutions`);
      }
    }
    return r;
  }

  generate(rule: MissingOperandRule, prng: () => number, context: GenerationContext): Question {
    const a = randomInt(prng, rule.minA, rule.maxA);
    const b = randomInt(prng, rule.minB, rule.maxB);
    const isFirstMissing =
      rule.missingPosition === 'first' || (rule.missingPosition === 'random' && prng() > 0.5);

    let displayPrompt: string;
    let answerValue: number;
    let explanation: string;

    if (rule.operation === '+') {
      const total = a + b;
      if (isFirstMissing) {
        displayPrompt = `? + ${b} = ${total}`;
        answerValue = a;
        explanation = `? = ${total} - ${b} = ${a}`;
      } else {
        displayPrompt = `${a} + ? = ${total}`;
        answerValue = b;
        explanation = `? = ${total} - ${a} = ${b}`;
      }
    } else if (rule.operation === '-') {
      const diff = Math.abs(a - b);
      const larger = Math.max(a, b);
      const smaller = Math.min(a, b);
      if (isFirstMissing) {
        displayPrompt = `? - ${smaller} = ${diff}`;
        answerValue = larger;
        explanation = `? = ${diff} + ${smaller} = ${larger}`;
      } else {
        displayPrompt = `${larger} - ? = ${diff}`;
        answerValue = smaller;
        explanation = `? = ${larger} - ${diff} = ${smaller}`;
      }
    } else if (rule.operation === '÷') {
      const divisor = Math.max(1, b);
      const quotient = Math.max(1, a);
      const dividend = divisor * quotient;
      if (isFirstMissing) {
        displayPrompt = `? ÷ ${divisor} = ${quotient}`;
        answerValue = dividend;
        explanation = `? = ${quotient} × ${divisor} = ${dividend}`;
      } else {
        displayPrompt = `${dividend} ÷ ? = ${quotient}`;
        answerValue = divisor;
        explanation = `? = ${dividend} ÷ ${quotient} = ${divisor}`;
      }
    } else {
      // Multiplication ('×')
      const factorA = Math.max(1, a);
      const factorB = Math.max(1, b);
      const product = factorA * factorB;
      if (isFirstMissing) {
        displayPrompt = `? × ${factorB} = ${product}`;
        answerValue = factorA;
        explanation = `? = ${product} ÷ ${factorB} = ${factorA}`;
      } else {
        displayPrompt = `${factorA} × ? = ${product}`;
        answerValue = factorB;
        explanation = `? = ${product} ÷ ${factorA} = ${factorB}`;
      }
    }

    return {
      questionDefinitionId: `missing-${rule.operation}-${a}-${b}-${isFirstMissing ? '1' : '2'}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: answerValue },
      primarySkillId: `missing_operand.${rule.operation}`,
      skillTags: ['missing_operand'],
      difficulty: 2,
      generatorKey: this.key,
      targetResponseTimeMs: 3500,
      templateFamily: 'missing_operand_basic',
      explanation,
    };
  }
}
