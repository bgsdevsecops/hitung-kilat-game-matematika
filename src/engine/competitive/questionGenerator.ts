import { Question } from '../types/question';
import { LEVEL_MANIFEST_72 } from '../manifest/levels';
import { generatorRegistry } from '../registry/index';

export interface CompetitiveQuestion extends Question {
  id: string;
  prompt: string;
}

export function generateCompetitiveQuestions(
  tier: number,
  count: number,
  prng: () => number = Math.random
): CompetitiveQuestion[] {
  const normalizedTier = Number.isFinite(tier) ? Math.floor(tier) : 1;
  const safeTier = Math.max(1, Math.min(6, normalizedTier));
  const matchingLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === safeTier);
  const levels = matchingLevels.length > 0 ? matchingLevels : LEVEL_MANIFEST_72.slice(0, 12);

  const questions: CompetitiveQuestion[] = [];
  const seenPrompts = new Set<string>();

  for (let i = 0; i < count; i++) {
    const levelIndex = Math.floor(prng() * levels.length);
    const chosenLevel = levels[levelIndex];

    let question: CompetitiveQuestion | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generatorRegistry.generateQuestion(chosenLevel, prng, {
        levelId: chosenLevel.id,
        sequenceIndex: i + 1,
        contentVersion: chosenLevel.contentVersion,
        existingSignatures: seenPrompts,
      });
      const prompt = candidate.displayPrompt || (candidate as any).prompt;
      if (!seenPrompts.has(prompt)) {
        const id = candidate.questionInstanceId || (candidate as any).id;
        question = {
          ...candidate,
          id,
          prompt,
        };
        seenPrompts.add(prompt);
        break;
      }
    }

    if (!question) {
      const candidate = generatorRegistry.generateQuestion(chosenLevel, prng, {
        levelId: chosenLevel.id,
        sequenceIndex: i + 1,
        contentVersion: chosenLevel.contentVersion,
        existingSignatures: seenPrompts,
      });
      const prompt = candidate.displayPrompt || (candidate as any).prompt;
      const id = candidate.questionInstanceId || (candidate as any).id;
      question = {
        ...candidate,
        id,
        prompt,
      };
      seenPrompts.add(prompt);
    }

    questions.push(question);
  }

  return questions;
}
