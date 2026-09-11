import { QuestionGenerator } from './base';
import { AdditionRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class AdditionGenerator implements QuestionGenerator<AdditionRule> {
  readonly key = 'addition';
  readonly version = 1;

  validateRule(rule: unknown): AdditionRule {
    const r = rule as AdditionRule;
    if (!r || r.kind !== 'addition') {
      throw new Error('Invalid rule: expected addition');
    }
    if (r.minA > r.maxA || r.minB > r.maxB) {
      throw new Error('Invalid AdditionRule bounds');
    }
    return r;
  }

  generate(rule: AdditionRule, prng: () => number, context: GenerationContext): Question {
    const termsCount = rule.termsCount || 2;

    if (termsCount === 3) {
      const a = randomInt(prng, rule.minA, rule.maxA);
      const b = randomInt(prng, rule.minB, rule.maxB);
      const c = randomInt(prng, rule.minB, rule.maxB);
      const answer = a + b + c;
      const prompt = `${a} + ${b} + ${c}`;
      return {
        questionDefinitionId: `add-3-${a}-${b}-${c}`,
        questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
        displayPrompt: prompt,
        answerSpec: { kind: 'integer', value: answer },
        primarySkillId: 'addition.three_terms',
        skillTags: ['addition'],
        difficulty: 2,
        generatorKey: this.key,
        targetResponseTimeMs: 3500,
        templateFamily: 'addition_chain',
        explanation: `${a} + ${b} + ${c} = ${answer}`,
      };
    }

    const a = randomInt(prng, rule.minA, rule.maxA);
    const b = randomInt(prng, rule.minB, rule.maxB);
    const answer = a + b;
    const prompt = `${a} + ${b}`;

    return {
      questionDefinitionId: `add-2-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: this.key,
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: `${a} + ${b} = ${answer}`,
    };
  }
}
