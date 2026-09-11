import { GeneratorRule } from '../types/rules';
import { Question, GenerationContext } from '../types/question';

export interface QuestionGenerator<TRule extends GeneratorRule = GeneratorRule> {
  readonly key: string;
  readonly version: number;
  validateRule(rule: unknown): TRule;
  generate(rule: TRule, prng: () => number, context: GenerationContext): Question;
}
