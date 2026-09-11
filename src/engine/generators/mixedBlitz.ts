import { QuestionGenerator } from './base';
import { MixedBlitzRule, Question, GenerationContext } from '../types';
import type { QuestionGeneratorRegistry } from '../registry';

export class MixedBlitzGenerator implements QuestionGenerator<MixedBlitzRule> {
  readonly key = 'mixed_blitz';
  readonly version = 1;

  constructor(private registry: QuestionGeneratorRegistry) {}

  validateRule(rule: unknown): MixedBlitzRule {
    const r = rule as MixedBlitzRule;
    if (!r || typeof r !== 'object' || r.kind !== 'mixed_blitz') {
      throw new Error('Invalid rule: expected mixed_blitz');
    }
    if (!Array.isArray(r.subRules) || r.subRules.length === 0) {
      throw new Error('MixedBlitzRule requires non-empty subRules');
    }
    for (const subRule of r.subRules) {
      if (
        !subRule ||
        typeof subRule !== 'object' ||
        !('kind' in subRule) ||
        typeof subRule.kind !== 'string'
      ) {
        throw new Error('Invalid subRule in MixedBlitzRule: missing or invalid kind');
      }
      if (!this.registry.has(subRule.kind)) {
        throw new Error(`Unregistered subRule kind in MixedBlitzRule: ${subRule.kind}`);
      }
      const generator = this.registry.get(subRule.kind);
      generator.validateRule(subRule);
    }
    return r;
  }

  generate(rule: MixedBlitzRule, prng: () => number, context: GenerationContext): Question {
    const index = Math.floor(prng() * rule.subRules.length);
    const chosenSubRule = rule.subRules[index];
    const subGenerator = this.registry.get(chosenSubRule.kind);
    return subGenerator.generate(chosenSubRule, prng, context);
  }
}
