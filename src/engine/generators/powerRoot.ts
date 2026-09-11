import { QuestionGenerator } from './base';
import { PowerRootRule, Question, GenerationContext } from '../types';
import { randomInt } from '../utils/prng';

export class PowersAndRootsGenerator implements QuestionGenerator<PowerRootRule> {
  readonly key = 'power_root';
  readonly version = 1;

  validateRule(rule: unknown): PowerRootRule {
    const r = rule as PowerRootRule;
    if (!r || r.kind !== 'power_root') {
      throw new Error('Invalid rule: expected power_root');
    }
    if (!r.mode || (r.mode !== 'square' && r.mode !== 'square_root')) {
      throw new Error("Invalid PowerRootRule mode: expected 'square' or 'square_root'");
    }
    if (
      typeof r.minBase !== 'number' ||
      typeof r.maxBase !== 'number' ||
      Number.isNaN(r.minBase) ||
      Number.isNaN(r.maxBase) ||
      r.minBase > r.maxBase
    ) {
      throw new Error(
        'Invalid PowerRootRule base bounds: minBase must be <= maxBase and both must be numbers'
      );
    }
    if (r.minBase < 1) {
      throw new Error('Invalid PowerRootRule base bounds: minBase must be >= 1');
    }
    return r;
  }

  generate(rule: PowerRootRule, prng: () => number, context: GenerationContext): Question {
    const base = randomInt(prng, rule.minBase, rule.maxBase);

    if (rule.mode === 'square') {
      const square = base * base;
      return {
        questionDefinitionId: `sq-${base}`,
        questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
        displayPrompt: `${base}²`,
        answerSpec: { kind: 'integer', value: square },
        primarySkillId: 'arithmetic.square',
        skillTags: ['square', 'powers'],
        difficulty: base > 15 ? 4 : 3,
        generatorKey: this.key,
        targetResponseTimeMs: 2500,
        templateFamily: 'square_power',
        explanation: `${base}² = ${base} × ${base} = ${square}`,
      };
    }

    const radican = base * base;
    return {
      questionDefinitionId: `sqrt-${radican}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt: `√${radican}`,
      answerSpec: { kind: 'integer', value: base },
      primarySkillId: 'arithmetic.square_root',
      skillTags: ['square_root', 'roots'],
      difficulty: 3,
      generatorKey: this.key,
      targetResponseTimeMs: 2500,
      templateFamily: 'square_root',
      explanation: `√${radican} = ${base} (karena ${base}² = ${radican})`,
    };
  }
}
