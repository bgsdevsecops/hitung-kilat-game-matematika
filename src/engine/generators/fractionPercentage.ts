import { QuestionGenerator } from './base';
import { FractionPercentageRule, Question, GenerationContext } from '../types';
import { randomInt } from '../utils/prng';

export class FractionAndPercentageGenerator implements QuestionGenerator<FractionPercentageRule> {
  readonly key = 'fraction_percentage';
  readonly version = 1;

  validateRule(rule: unknown): FractionPercentageRule {
    const r = rule as FractionPercentageRule;
    if (!r || typeof r !== 'object' || r.kind !== 'fraction_percentage') {
      throw new Error('Invalid rule: expected fraction_percentage');
    }
    const validVariants = ['fraction_add', 'ratio_equality', 'mental_percentage'];
    if (!r.variant || !validVariants.includes(r.variant)) {
      throw new Error(
        `Invalid FractionPercentageRule variant: expected one of ${validVariants.join(', ')}`
      );
    }
    if (r.minBase !== undefined && (typeof r.minBase !== 'number' || Number.isNaN(r.minBase))) {
      throw new Error('Invalid FractionPercentageRule base bounds: minBase must be a number');
    }
    if (r.maxBase !== undefined && (typeof r.maxBase !== 'number' || Number.isNaN(r.maxBase))) {
      throw new Error('Invalid FractionPercentageRule base bounds: maxBase must be a number');
    }
    if (
      r.minBase !== undefined &&
      r.maxBase !== undefined &&
      r.minBase > r.maxBase
    ) {
      throw new Error(
        'Invalid FractionPercentageRule base bounds: minBase must be <= maxBase'
      );
    }
    return r;
  }

  generate(rule: FractionPercentageRule, prng: () => number, context: GenerationContext): Question {
    switch (rule.variant) {
      case 'fraction_add': {
        const friendlyDenominators = [2, 4, 8, 3, 6, 5, 10];
        const d1 = friendlyDenominators[Math.floor(prng() * friendlyDenominators.length)];
        const d2 = friendlyDenominators[Math.floor(prng() * friendlyDenominators.length)];
        const n1 = randomInt(prng, 1, d1 - 1);
        const n2 = randomInt(prng, 1, d2 - 1);

        const resNum = n1 * d2 + n2 * d1;
        const resDen = d1 * d2;

        return {
          questionDefinitionId: `frac-${n1}/${d1}+${n2}/${d2}`,
          questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
          displayPrompt: `${n1}/${d1} + ${n2}/${d2}`,
          answerSpec: { kind: 'rational', numerator: resNum, denominator: resDen },
          primarySkillId: 'fraction.addition',
          skillTags: ['fraction', 'rational'],
          difficulty: 4,
          generatorKey: this.key,
          targetResponseTimeMs: 4500,
          templateFamily: 'fraction_addition',
          explanation: `${n1}/${d1} + ${n2}/${d2} = (${n1 * d2} + ${n2 * d1}) / ${resDen} = ${resNum}/${resDen}`,
        };
      }

      case 'ratio_equality': {
        const a = randomInt(prng, 1, 5);
        const b = randomInt(prng, 2, 7);
        const mult = randomInt(prng, 2, 6);
        const d = b * mult;
        const ans = a * mult;

        return {
          questionDefinitionId: `ratio-${a}:${b}=?:${d}`,
          questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
          displayPrompt: `${a}:${b} = ?:${d}`,
          answerSpec: { kind: 'integer', value: ans },
          primarySkillId: 'ratio.equivalent',
          skillTags: ['ratio', 'proportions'],
          difficulty: 3,
          generatorKey: this.key,
          targetResponseTimeMs: 3500,
          templateFamily: 'ratio_equivalent',
          explanation: `${b} dikali ${mult} adalah ${d}, maka ? = ${a} × ${mult} = ${ans}`,
        };
      }

      case 'mental_percentage': {
        const percentages = [10, 20, 25, 50, 15];
        const pct = percentages[Math.floor(prng() * percentages.length)];
        const factorMap: Record<number, number> = {
          25: 4,
          50: 2,
          20: 5,
          10: 10,
          15: 20,
        };
        const factor = factorMap[pct];

        const defaultMin = 1;
        const defaultMax = 15;
        let minK = typeof rule.minBase === 'number' ? rule.minBase : defaultMin;
        let maxK = typeof rule.maxBase === 'number' ? rule.maxBase : defaultMax;
        if (typeof rule.minBase !== 'number' && typeof rule.maxBase === 'number') {
          minK = Math.min(minK, maxK);
        }
        if (typeof rule.minBase === 'number' && typeof rule.maxBase !== 'number') {
          maxK = Math.max(maxK, minK);
        }

        const k = randomInt(prng, minK, maxK);
        const number = k * factor;
        const ans = Math.round((pct * number) / 100);

        return {
          questionDefinitionId: `pct-${pct}-of-${number}`,
          questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
          displayPrompt: `${pct}% dari ${number}`,
          answerSpec: { kind: 'integer', value: ans },
          primarySkillId: 'percentage.mental',
          skillTags: ['percentage', 'mental_math'],
          difficulty: 3,
          generatorKey: this.key,
          targetResponseTimeMs: 3500,
          templateFamily: 'mental_percentage',
          explanation: `${pct}% dari ${number} = (${pct} / 100) × ${number} = ${ans}`,
        };
      }
    }
  }
}
