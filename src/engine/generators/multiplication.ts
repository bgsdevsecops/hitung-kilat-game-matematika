import { QuestionGenerator } from './base';
import { MultiplicationRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class MultiplicationGenerator implements QuestionGenerator<MultiplicationRule> {
  readonly key = 'multiplication';
  readonly version = 1;

  validateRule(rule: unknown): MultiplicationRule {
    const r = rule as MultiplicationRule;
    if (!r || r.kind !== 'multiplication') {
      throw new Error('Invalid rule: expected multiplication');
    }
    if (r.minA > r.maxA || r.minB > r.maxB) {
      throw new Error('Invalid MultiplicationRule bounds');
    }
    return r;
  }

  generate(rule: MultiplicationRule, prng: () => number, context: GenerationContext): Question {
    let a: number;
    let b: number;

    if (rule.fixedOperand !== undefined) {
      a = rule.fixedOperand;
      b = randomInt(prng, rule.minB, rule.maxB);
    } else {
      a = randomInt(prng, rule.minA, rule.maxA);
      b = randomInt(prng, rule.minB, rule.maxB);
    }

    const answer = a * b;
    const prompt = `${a} × ${b}`;

    return {
      questionDefinitionId: `mul-2-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      primarySkillId: `multiplication.x${a}`,
      skillTags: ['multiplication'],
      difficulty: 2,
      generatorKey: this.key,
      targetResponseTimeMs: 3000,
      templateFamily: 'multiplication_basic',
      explanation: `${a} × ${b} = ${answer}`,
    };
  }
}
