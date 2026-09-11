import { QuestionGenerator } from './base';
import { SubtractionRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class SubtractionGenerator implements QuestionGenerator<SubtractionRule> {
  readonly key = 'subtraction';
  readonly version = 1;

  validateRule(rule: unknown): SubtractionRule {
    const r = rule as SubtractionRule;
    if (!r || r.kind !== 'subtraction') {
      throw new Error('Invalid rule: expected subtraction');
    }
    if (r.minA > r.maxA || r.minB > r.maxB) {
      throw new Error('Invalid SubtractionRule bounds');
    }
    return r;
  }

  generate(rule: SubtractionRule, prng: () => number, context: GenerationContext): Question {
    let a = randomInt(prng, rule.minA, rule.maxA);
    let b = randomInt(prng, rule.minB, rule.maxB);

    if (!rule.allowNegative && a < b) {
      const temp = a;
      a = b;
      b = temp;
    }

    const answer = a - b;
    const prompt = `${a} - ${b}`;

    return {
      questionDefinitionId: `sub-2-${a}-${b}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      primarySkillId: 'subtraction.basic',
      skillTags: ['subtraction'],
      difficulty: 1,
      generatorKey: this.key,
      targetResponseTimeMs: 3000,
      templateFamily: 'subtraction_basic',
      explanation: `${a} - ${b} = ${answer}`,
    };
  }
}
