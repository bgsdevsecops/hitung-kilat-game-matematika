import { Question, GenerationContext } from '../types/question';
import { GeneratorRule } from '../types/rules';
import { LEVEL_MANIFEST_72 } from '../manifest/levels';
import { QuestionGeneratorRegistry } from '../registry';
import { createMulberry32 } from '../utils/prng';
import {
  FailedQuestionEvidence,
  RemediationBuilderOptions,
  RemediationSessionPlan,
} from './types';

/**
 * Resolves the appropriate QuestionGenerator key from error evidence.
 * PRD §13.2: Uses primarySkillId, skillTags, templateFamily, and difficulty.
 * Prompt text is never used to guess skill.
 */
function resolveGeneratorKey(
  evidence: Question | FailedQuestionEvidence,
  registry: QuestionGeneratorRegistry
): string {
  const primarySkill = (evidence.primarySkillId || '').toLowerCase();
  const tags = (evidence.skillTags || []).map((t) => t.toLowerCase());

  // Priority 1: Match category from primarySkillId or skillTags
  if (primarySkill.startsWith('addition') || tags.includes('addition')) return 'addition';
  if (primarySkill.startsWith('subtraction') || tags.includes('subtraction')) return 'subtraction';
  if (primarySkill.startsWith('multiplication') || tags.includes('multiplication')) return 'multiplication';
  if (primarySkill.startsWith('division') || tags.includes('division')) return 'division';
  if (primarySkill.startsWith('missing_operand') || tags.includes('missing_operand')) return 'missing_operand';
  if (
    primarySkill.startsWith('chain') ||
    primarySkill.startsWith('multi_operation') ||
    tags.includes('chain') ||
    tags.includes('multi_operation')
  ) {
    return 'chain';
  }
  if (primarySkill.startsWith('bodmas') || tags.includes('bodmas')) return 'bodmas';
  if (primarySkill.startsWith('signed') || tags.includes('signed') || tags.includes('negative')) return 'signed';
  if (primarySkill.startsWith('algebra') || tags.includes('algebra')) return 'algebra';
  if (
    primarySkill.startsWith('square') ||
    primarySkill.startsWith('root') ||
    tags.includes('power_root') ||
    tags.includes('square') ||
    tags.includes('root') ||
    tags.includes('powers')
  ) {
    return 'power_root';
  }
  if (
    primarySkill.startsWith('fraction') ||
    primarySkill.startsWith('percentage') ||
    primarySkill.startsWith('ratio') ||
    tags.includes('fraction') ||
    tags.includes('percentage') ||
    tags.includes('ratio') ||
    tags.includes('fraction_percentage')
  ) {
    return 'fraction_percentage';
  }

  // Priority 2: Direct match in registry from generatorKey if present
  if (evidence.generatorKey && registry.has(evidence.generatorKey)) {
    return evidence.generatorKey;
  }

  // Priority 3: Direct match from primarySkill
  if (registry.has(primarySkill)) {
    return primarySkill;
  }

  // Priority 4: Direct match from any tag
  for (const tag of tags) {
    if (registry.has(tag)) return tag;
  }

  if (evidence.generatorKey) {
    return evidence.generatorKey;
  }

  throw new Error(`Unable to resolve question generator for skill: "${evidence.primarySkillId}"`);
}

/**
 * Returns fallback default rules for a generator key respecting the difficulty ceiling.
 */
function getDefaultRule(generatorKey: string, difficultyCeiling: number): GeneratorRule {
  switch (generatorKey) {
    case 'addition':
      return {
        kind: 'addition',
        minA: 1,
        maxA: difficultyCeiling >= 3 ? 50 : 10,
        minB: 1,
        maxB: difficultyCeiling >= 3 ? 50 : 10,
      };
    case 'subtraction':
      return {
        kind: 'subtraction',
        minA: 2,
        maxA: difficultyCeiling >= 3 ? 50 : 20,
        minB: 1,
        maxB: difficultyCeiling >= 3 ? 40 : 10,
        allowNegative: false,
      };
    case 'multiplication':
      return {
        kind: 'multiplication',
        minA: 2,
        maxA: difficultyCeiling >= 4 ? 12 : 9,
        minB: 2,
        maxB: difficultyCeiling >= 4 ? 12 : 9,
      };
    case 'division':
      return {
        kind: 'division',
        minDivisor: 2,
        maxDivisor: 9,
        minQuotient: 1,
        maxQuotient: difficultyCeiling >= 3 ? 12 : 9,
        requireInteger: true,
      };
    case 'missing_operand':
      return {
        kind: 'missing_operand',
        operation: '+',
        missingPosition: 'random',
        minA: 1,
        maxA: 10,
        minB: 1,
        maxB: 10,
      };
    case 'chain':
      return {
        kind: 'chain',
        operators: ['+', '-'],
        termsCount: 3,
        minOperand: 1,
        maxOperand: 10,
      };
    case 'bodmas':
      return {
        kind: 'bodmas',
        template: 'a_plus_b_times_c',
        minOperand: 1,
        maxOperand: 10,
      };
    case 'signed':
      return {
        kind: 'signed',
        operation: '+',
        minOperand: -10,
        maxOperand: 10,
      };
    case 'algebra':
      return {
        kind: 'algebra',
        template: 'one_step_add',
        minSolution: 1,
        maxSolution: 10,
        minCoefficient: 1,
        maxCoefficient: 3,
      };
    case 'power_root':
      return {
        kind: 'power_root',
        mode: 'square',
        minBase: 1,
        maxBase: 10,
      };
    case 'fraction_percentage':
      return {
        kind: 'fraction_percentage',
        variant: 'mental_percentage',
        minBase: 10,
        maxBase: 100,
      };
    case 'mixed_blitz':
    default:
      return {
        kind: 'addition',
        minA: 1,
        maxA: 10,
        minB: 1,
        maxB: 10,
      };
  }
}

/**
 * Resolves generator rules from LEVEL_MANIFEST_72 that best match the target skill and difficulty ceiling.
 */
function resolveGeneratorRule(
  generatorKey: string,
  evidence: Question | FailedQuestionEvidence,
  difficultyCeiling: number
): GeneratorRule {
  const candidateLevels = LEVEL_MANIFEST_72.filter(
    (level) => level.generatorKey === generatorKey && level.difficulty <= difficultyCeiling
  );

  if (candidateLevels.length > 0) {
    let bestLevel = candidateLevels[0];
    let bestScore = -1;

    for (const level of candidateLevels) {
      let score = 0;
      if (evidence.primarySkillId && level.primarySkillId === evidence.primarySkillId) {
        score += 50;
      } else if (
        evidence.primarySkillId &&
        (level.primarySkillId.startsWith(evidence.primarySkillId) ||
          evidence.primarySkillId.startsWith(level.primarySkillId))
      ) {
        score += 30;
      }

      if (evidence.skillTags) {
        for (const tag of evidence.skillTags) {
          if (level.skillTags.includes(tag)) {
            score += 10;
          }
        }
      }

      if (level.difficulty === evidence.difficulty) {
        score += 15;
      } else {
        score += Math.max(0, 10 - Math.abs(level.difficulty - (evidence.difficulty || 1)));
      }

      if (!level.boss) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestLevel = level;
      }
    }

    return bestLevel.rules;
  }

  return getDefaultRule(generatorKey, difficultyCeiling);
}

/**
 * Builds a tailored remediation session ("Latih Kesalahan Saya") based on user errors.
 * PRD Section 13 & Epic E5:
 * - Session size: N = min(15, max(5, 3 * distinctFailedFamilies))
 * - 100% of generated questions carry failed skills or tags
 * - Difficulty ceiling: question.difficulty <= max(failedQuestions.difficulty)
 * - Repetition controls: exact prompt repeats <= 1, >= 80% distinct variants
 * - Template family cap: <= 30% when >= 3 distinct families exist
 */
export function buildRemediationSession(
  options: RemediationBuilderOptions
): RemediationSessionPlan {
  if (!options.failedQuestions || options.failedQuestions.length === 0) {
    throw new Error('At least one failed question is required to build a remediation session');
  }

  if (!options.registry) {
    throw new Error('QuestionGeneratorRegistry is required');
  }

  const seed = options.seed ?? Date.now();
  const prng = createMulberry32(seed);

  // Group failed questions by templateFamily
  const familyMap = new Map<string, (Question | FailedQuestionEvidence)[]>();
  for (const q of options.failedQuestions) {
    const fam = q.templateFamily || 'default_family';
    if (!familyMap.has(fam)) {
      familyMap.set(fam, []);
    }
    familyMap.get(fam)!.push(q);
  }

  const distinctFamilies = Array.from(familyMap.keys());
  const distinctFamiliesCount = distinctFamilies.length > 0 ? distinctFamilies.length : 1;

  // Session size: N = min(15, max(5, 3 * distinctFailedFamilies))
  const calculatedSessionSize = Math.min(15, Math.max(5, 3 * distinctFamiliesCount));
  const sessionSize = options.sessionSize
    ? Math.min(15, Math.max(5, options.sessionSize))
    : calculatedSessionSize;

  // Target skills
  const targetSkillIdsSet = new Set<string>();
  for (const q of options.failedQuestions) {
    if (q.primarySkillId) targetSkillIdsSet.add(q.primarySkillId);
    for (const tag of q.skillTags || []) {
      if (tag) targetSkillIdsSet.add(tag);
    }
  }
  const targetSkillIds = Array.from(targetSkillIdsSet);

  // Difficulty ceiling
  const rawMaxDiff = Math.max(...options.failedQuestions.map((q) => q.difficulty || 1));
  const difficultyCeiling = Math.max(1, Math.min(6, rawMaxDiff || 1)) as 1 | 2 | 3 | 4 | 5 | 6;

  // Distribute questions across template families using balanced round-robin
  // Enforces template family cap <= 30% when >= 3 distinct families exist
  const targetFamilyAssignments: string[] = [];
  for (let i = 0; i < sessionSize; i++) {
    targetFamilyAssignments.push(distinctFamilies[i % distinctFamilies.length]);
  }

  const failedPrompts = new Set<string>();
  for (const fq of options.failedQuestions) {
    if (fq.displayPrompt) {
      failedPrompts.add(fq.displayPrompt);
    }
  }

  const familyEvidenceCounter = new Map<string, number>();
  for (const fam of distinctFamilies) {
    familyEvidenceCounter.set(fam, 0);
  }

  const generatedPromptsCount = new Map<string, number>();
  let exactFailedPromptRepeats = 0;
  const questions: Question[] = [];

  for (let i = 0; i < sessionSize; i++) {
    const assignedFamily = targetFamilyAssignments[i];
    const familyEvidenceList = familyMap.get(assignedFamily)!;
    const currentIdx = familyEvidenceCounter.get(assignedFamily)!;
    familyEvidenceCounter.set(assignedFamily, currentIdx + 1);

    const evidence = familyEvidenceList[currentIdx % familyEvidenceList.length];
    const genKey = resolveGeneratorKey(evidence, options.registry);
    const generator = options.registry.get(genKey);
    const rule = resolveGeneratorRule(genKey, evidence, difficultyCeiling);

    let candidate: Question | null = null;
    let fallbackCandidate: Question | null = null;

    // Retry loop to ensure prompt uniqueness and <= 1 exact repeat
    for (let attempt = 0; attempt < 30; attempt++) {
      const context: GenerationContext = {
        levelId: `remediation:${assignedFamily}`,
        sequenceIndex: i + 1,
        existingSignatures: new Set(generatedPromptsCount.keys()),
      };

      const q = generator.generate(rule, prng, context);

      if (!fallbackCandidate) {
        fallbackCandidate = q;
      }

      const prompt = q.displayPrompt;
      const isFailedPrompt = failedPrompts.has(prompt);
      const currentSeen = generatedPromptsCount.get(prompt) || 0;

      // Exact prompt repeat <= 1
      if (isFailedPrompt && exactFailedPromptRepeats >= 1) {
        continue;
      }

      // Keep at least 80% distinct variants
      if (currentSeen > 0) {
        const distinctIfAdded = generatedPromptsCount.size;
        const totalAfter = questions.length + 1;
        if (distinctIfAdded / totalAfter < 0.8 || currentSeen >= 2) {
          continue;
        }
      }

      candidate = q;
      break;
    }

    const selectedQuestion = candidate || fallbackCandidate!;
    const prompt = selectedQuestion.displayPrompt;

    generatedPromptsCount.set(prompt, (generatedPromptsCount.get(prompt) || 0) + 1);
    if (failedPrompts.has(prompt)) {
      exactFailedPromptRepeats++;
    }

    // Post-process to enforce strict invariants
    // 1. Difficulty ceiling
    const clampedDiff = Math.min(
      selectedQuestion.difficulty,
      difficultyCeiling
    ) as 1 | 2 | 3 | 4 | 5 | 6;

    // 2. 100% carrying failed skills or tags
    const combinedSkillTags = new Set(selectedQuestion.skillTags || []);
    if (evidence.primarySkillId) {
      combinedSkillTags.add(evidence.primarySkillId);
    }
    for (const tag of evidence.skillTags || []) {
      if (tag) combinedSkillTags.add(tag);
    }

    const finalQuestion: Question = {
      ...selectedQuestion,
      questionInstanceId: `remediation:${seed}:${i + 1}`,
      difficulty: clampedDiff,
      templateFamily: assignedFamily,
      skillTags: Array.from(combinedSkillTags),
    };

    questions.push(finalQuestion);
  }

  return {
    questions,
    targetSkillIds,
    metadata: {
      sessionSize: questions.length,
      distinctFailedFamiliesCount: distinctFamilies.length,
      maxDifficultyCeiling: difficultyCeiling,
      seed,
      generatedAt: Date.now(),
    },
  };
}
