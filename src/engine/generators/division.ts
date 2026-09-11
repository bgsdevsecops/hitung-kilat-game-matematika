import { QuestionGenerator } from './base';
import { DivisionRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';
import { randomInt } from '../utils/prng';

export class DivisionGenerator implements QuestionGenerator<DivisionRule> {
  readonly key = 'division';
  readonly version = 1;

  validateRule(rule: unknown): DivisionRule {
    const r = rule as DivisionRule;
    if (!r || r.kind !== 'division') {
      throw new Error('Invalid rule: expected division');
    }
    if (r.minDivisor <= 0) {
      throw new Error('Division divisor must be greater than zero');
    }
    if (r.minDivisor > r.maxDivisor || r.minQuotient > r.maxQuotient) {
      throw new Error('Invalid DivisionRule bounds');
    }
    return r;
  }

  generate(rule: DivisionRule, prng: () => number, context: GenerationContext): Question {
    const divisor = randomInt(prng, Math.max(1, rule.minDivisor), rule.maxDivisor);
    const quotient = randomInt(prng, rule.minQuotient, rule.maxQuotient);
    const dividend = divisor * quotient;

    const prompt = `${dividend} ÷ ${divisor}`;

    return {
      questionDefinitionId: `div-2-${dividend}-${divisor}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: quotient },
      primarySkillId: `division.by_${divisor}`,
      skillTags: ['division'],
      difficulty: 2,
      generatorKey: this.key,
      targetResponseTimeMs: 3500,
      templateFamily: 'division_clean',
      explanation: `${dividend} ÷ ${divisor} = ${quotient} (karena ${divisor} × ${quotient} = ${dividend})`,
    };
  }
}
