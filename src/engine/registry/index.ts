import { QuestionGenerator } from '../generators/base';
import { LevelConfigV2 } from '../types/level';
import { Question, GenerationContext } from '../types/question';
import { createMulberry32 } from '../utils/prng';
import { AdditionGenerator } from '../generators/addition';
import { SubtractionGenerator } from '../generators/subtraction';
import { MultiplicationGenerator } from '../generators/multiplication';
import { DivisionGenerator } from '../generators/division';
import { MissingOperandGenerator } from '../generators/missingOperand';

export class QuestionGeneratorRegistry {
  private generators = new Map<string, QuestionGenerator>();

  register(generator: QuestionGenerator): void {
    this.generators.set(generator.key, generator);
  }

  get(key: string): QuestionGenerator {
    const gen = this.generators.get(key);
    if (!gen) {
      throw new Error(`Question generator for key "${key}" is not registered`);
    }
    return gen;
  }

  has(key: string): boolean {
    return this.generators.has(key);
  }

  generateQuestion(
    levelConfig: LevelConfigV2,
    prng: () => number,
    context: GenerationContext
  ): Question {
    const generator = this.get(levelConfig.generatorKey);
    const validatedRule = generator.validateRule(levelConfig.rules);
    return generator.generate(validatedRule, prng, context);
  }

  generateSessionQuestions(
    levelConfig: LevelConfigV2,
    seed: string | number
  ): Question[] {
    const prng = createMulberry32(seed);
    const questions: Question[] = [];
    const seenSignatures = new Set<string>();

    for (let i = 0; i < levelConfig.questionCount; i++) {
      let candidate: Question | null = null;
      let attempts = 0;

      while (attempts < 25) {
        attempts++;
        const context: GenerationContext = {
          levelId: levelConfig.id,
          sequenceIndex: i + 1,
          contentVersion: levelConfig.contentVersion,
          existingSignatures: seenSignatures,
        };

        const q = this.generateQuestion(levelConfig, prng, context);
        if (!seenSignatures.has(q.displayPrompt)) {
          candidate = q;
          seenSignatures.add(q.displayPrompt);
          break;
        }
      }

      // If attempts exhausted (small range), fall back to candidate
      if (!candidate) {
        candidate = this.generateQuestion(levelConfig, prng, {
          levelId: levelConfig.id,
          sequenceIndex: i + 1,
          contentVersion: levelConfig.contentVersion,
          existingSignatures: seenSignatures,
        });
      }

      questions.push(candidate);
    }

    return questions;
  }
}

// Default pre-populated singleton registry
export const generatorRegistry = new QuestionGeneratorRegistry();
generatorRegistry.register(new AdditionGenerator());
generatorRegistry.register(new SubtractionGenerator());
generatorRegistry.register(new MultiplicationGenerator());
generatorRegistry.register(new DivisionGenerator());
generatorRegistry.register(new MissingOperandGenerator());
