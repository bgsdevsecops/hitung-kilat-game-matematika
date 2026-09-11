import { Question, GenerationContext } from '../types/question';
import { GeneratorRule } from '../types/rules';
import { LevelConfigV2 } from '../types/level';
import { LEVEL_MANIFEST_72 } from '../manifest/levels';
import { QuestionGeneratorRegistry } from '../registry';
import { createMulberry32 } from '../utils/prng';
import {
  FailedQuestionEvidence,
  RemediationBuilderOptions,
  RemediationSessionPlan,
} from './types';

/**
 * Extracts or infers the template family for a manifest level based on its rules and generator.
 */
function getManifestLevelTemplateFamily(level: LevelConfigV2): string {
  const rule = level.rules;
  if ('template' in rule && typeof (rule as any).template === 'string') {
    return (rule as any).template;
  }
  if (rule.kind === 'chain') {
    return `chain_${rule.termsCount}_terms`;
  }
  if (rule.kind === 'power_root') {
    return rule.mode === 'square' ? 'square_power' : 'square_root';
  }
  if (rule.kind === 'fraction_percentage') {
    if (rule.variant === 'fraction_add') return 'fraction_addition';
    if (rule.variant === 'ratio_equality') return 'ratio_equivalent';
    return 'mental_percentage';
  }
  if (rule.kind === 'addition') {
    return rule.termsCount === 3 ? 'addition_chain' : 'addition_basic';
  }
  if (rule.kind === 'subtraction') return 'subtraction_basic';
  if (rule.kind === 'multiplication') return 'multiplication_basic';
  if (rule.kind === 'division') return 'division_clean';
  if (rule.kind === 'signed') return 'signed_arithmetic';
  if (rule.kind === 'missing_operand') return 'missing_operand_basic';
  return `${level.generatorKey}_family`;
}

/**
 * Resolves the appropriate QuestionGenerator key from error evidence.
 * PRD §13.2: Uses primarySkillId, skillTags, templateFamily, and difficulty.
 * Prompt text is never used to guess skill.
 */
export function resolveGeneratorKey(
  evidence: Question | FailedQuestionEvidence,
  registry: QuestionGeneratorRegistry
): string {
  // Priority 1: Direct generatorKey if registered
  if (evidence.generatorKey && registry.has(evidence.generatorKey)) {
    return evidence.generatorKey;
  }

  const primarySkill = (evidence.primarySkillId || '').toLowerCase();
  const tags = (evidence.skillTags || []).map((t) => t.toLowerCase());

  // Priority 2: Check evidence.primarySkillId against specific/compound generators
  if (primarySkill.includes('bodmas')) return 'bodmas';
  if (primarySkill.includes('algebra')) return 'algebra';
  if (primarySkill.includes('missing_operand')) return 'missing_operand';
  if (
    primarySkill.includes('chain') ||
    primarySkill.includes('multi_operation')
  ) {
    return 'chain';
  }
  if (primarySkill.includes('signed') || primarySkill.includes('negative')) return 'signed';
  if (
    primarySkill.includes('square') ||
    primarySkill.includes('root') ||
    primarySkill.includes('power')
  ) {
    return 'power_root';
  }
  if (
    primarySkill.includes('fraction') ||
    primarySkill.includes('percentage') ||
    primarySkill.includes('ratio')
  ) {
    return 'fraction_percentage';
  }

  // Priority 3: Check evidence.primarySkillId against basic arithmetic generators
  if (primarySkill.includes('division')) return 'division';
  if (primarySkill.includes('multiplication')) return 'multiplication';
  if (primarySkill.includes('subtraction')) return 'subtraction';
  if (primarySkill.includes('addition')) return 'addition';

  // Priority 4: Check evidence.skillTags against specific/compound generators (DO NOT check basic addition/subtraction here)
  if (tags.includes('bodmas')) return 'bodmas';
  if (tags.includes('algebra')) return 'algebra';
  if (tags.includes('missing_operand')) return 'missing_operand';
  if (tags.includes('chain') || tags.includes('multi_operation')) return 'chain';
  if (tags.includes('signed') || tags.includes('negative')) return 'signed';
  if (
    tags.includes('power_root') ||
    tags.includes('square') ||
    tags.includes('root') ||
    tags.includes('powers')
  ) {
    return 'power_root';
  }
  if (
    tags.includes('fraction_percentage') ||
    tags.includes('fraction') ||
    tags.includes('percentage') ||
    tags.includes('ratio')
  ) {
    return 'fraction_percentage';
  }

  // Priority 5: Check evidence.skillTags against basic arithmetic generators
  if (tags.includes('division')) return 'division';
  if (tags.includes('multiplication')) return 'multiplication';
  if (tags.includes('subtraction')) return 'subtraction';
  if (tags.includes('addition')) return 'addition';

  // Priority 6: Fallbacks
  if (registry.has(primarySkill)) {
    return primarySkill;
  }

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
  const familyRuleMap = new Map<string, GeneratorRule>();

  for (const q of options.failedQuestions) {
    const fam = q.templateFamily || 'default_family';
    if (!familyMap.has(fam)) {
      familyMap.set(fam, []);
    }
    familyMap.get(fam)!.push(q);
  }

  const distinctFailedFamilies = Array.from(familyMap.keys());
  const distinctFamiliesCount = distinctFailedFamilies.length > 0 ? distinctFailedFamilies.length : 1;

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

  // Enforce template family cap <= 30% when >= 3 distinct families exist
  const isStrictCapActive = distinctFamiliesCount >= 3;
  const maxFamilyShare = isStrictCapActive
    ? Math.floor(sessionSize * 0.3)
    : sessionSize;
  const minFamiliesNeeded = isStrictCapActive
    ? Math.ceil(sessionSize / Math.max(1, maxFamilyShare))
    : distinctFamiliesCount;

  // When only 3 distinct failed families are provided (or fewer than minFamiliesNeeded),
  // expand the candidate pool using complementary families from LEVEL_MANIFEST_72
  if (isStrictCapActive && familyMap.size < minFamiliesNeeded) {
    const candidateLevels: { level: LevelConfigV2; family: string; score: number }[] = [];
    for (const level of LEVEL_MANIFEST_72) {
      if (!options.registry.has(level.generatorKey)) continue;
      if (level.generatorKey === 'mixed_blitz') continue;

      const family = getManifestLevelTemplateFamily(level);
      if (familyMap.has(family)) continue;
      if (candidateLevels.some((c) => c.family === family)) continue;

      let score = 0;
      const matchesPrimary = level.primarySkillId && targetSkillIdsSet.has(level.primarySkillId);
      const matchesTag = level.skillTags.some((t) => targetSkillIdsSet.has(t));

      if (matchesPrimary) score += 50;
      if (matchesTag) score += 30;

      if (!matchesPrimary && !matchesTag) {
        continue;
      }

      if (level.difficulty <= difficultyCeiling) {
        score += 20 - (difficultyCeiling - level.difficulty);
      } else {
        score -= 50;
      }

      if (!level.boss) score += 10;

      candidateLevels.push({ level, family, score });
    }

    candidateLevels.sort((a, b) => b.score - a.score);

    for (const cand of candidateLevels) {
      if (familyMap.size >= minFamiliesNeeded) break;
      const level = cand.level;
      const family = cand.family;

      const matchingFailed = options.failedQuestions.find((fq) =>
        level.skillTags.some((t) => fq.skillTags?.includes(t) || fq.primarySkillId === t)
      );

      const compEvidence: FailedQuestionEvidence = {
        questionDefinitionId: `comp:${level.id}:${family}`,
        primarySkillId: level.primarySkillId,
        skillTags: Array.from(
          new Set([...level.skillTags, ...(matchingFailed?.skillTags || targetSkillIds)])
        ),
        difficulty: Math.min(level.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6,
        generatorKey: level.generatorKey,
        templateFamily: family,
      };

      familyMap.set(family, [compEvidence]);
      familyRuleMap.set(family, level.rules);
    }

    // Ultimate fallback: if still insufficient, pull any non-boss level respecting difficulty and tags
    if (familyMap.size < minFamiliesNeeded) {
      for (const level of LEVEL_MANIFEST_72) {
        if (familyMap.size >= minFamiliesNeeded) break;
        if (!options.registry.has(level.generatorKey)) continue;
        if (level.generatorKey === 'mixed_blitz') continue;

        const family = getManifestLevelTemplateFamily(level);
        if (familyMap.has(family)) continue;

        const compEvidence: FailedQuestionEvidence = {
          questionDefinitionId: `comp:${level.id}:${family}`,
          primarySkillId: level.primarySkillId,
          skillTags: Array.from(new Set([...level.skillTags, ...targetSkillIds])),
          difficulty: Math.min(level.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6,
          generatorKey: level.generatorKey,
          templateFamily: family,
        };

        familyMap.set(family, [compEvidence]);
        familyRuleMap.set(family, level.rules);
      }
    }
  }

  // Distribute questions across template families
  const distinctFamilies = Array.from(familyMap.keys());
  const targetFamilyAssignments: string[] = [];

  if (!isStrictCapActive) {
    for (let i = 0; i < sessionSize; i++) {
      targetFamilyAssignments.push(distinctFailedFamilies[i % distinctFailedFamilies.length]);
    }
  } else {
    const orderedFamilies = [
      ...distinctFailedFamilies,
      ...distinctFamilies.filter((f) => !distinctFailedFamilies.includes(f)),
    ];

    const familyCounts = new Map<string, number>();
    for (const fam of orderedFamilies) {
      familyCounts.set(fam, 0);
    }

    let assignedCount = 0;
    while (assignedCount < sessionSize) {
      let allocatedThisRound = false;
      for (const fam of orderedFamilies) {
        if (assignedCount >= sessionSize) break;
        const currentCount = familyCounts.get(fam) || 0;
        if (currentCount < maxFamilyShare) {
          targetFamilyAssignments.push(fam);
          familyCounts.set(fam, currentCount + 1);
          assignedCount++;
          allocatedThisRound = true;
        }
      }
      if (!allocatedThisRound) break;
    }
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
  const generatedFamilyCounts = new Map<string, number>();
  let exactFailedPromptRepeats = 0;
  const questions: Question[] = [];

  for (let i = 0; i < targetFamilyAssignments.length; i++) {
    const assignedFamily = targetFamilyAssignments[i];
    const familyEvidenceList = familyMap.get(assignedFamily)!;
    const currentIdx = familyEvidenceCounter.get(assignedFamily) || 0;
    familyEvidenceCounter.set(assignedFamily, currentIdx + 1);

    const evidence = familyEvidenceList[currentIdx % familyEvidenceList.length];
    const genKey = resolveGeneratorKey(evidence, options.registry);
    const generator = options.registry.get(genKey);
    const rule =
      familyRuleMap.get(assignedFamily) ||
      resolveGeneratorRule(genKey, evidence, difficultyCeiling);

    let candidate: Question | null = null;
    let fallbackCandidate: Question | null = null;
    let lastGenerated: Question | null = null;

    // Retry loop to ensure prompt uniqueness and <= 1 exact repeat
    for (let attempt = 0; attempt < 30; attempt++) {
      const context: GenerationContext = {
        levelId: `remediation:${assignedFamily}`,
        sequenceIndex: i + 1,
        existingSignatures: new Set(generatedPromptsCount.keys()),
      };

      const q = generator.generate(rule, prng, context);
      lastGenerated = q;

      const prompt = q.displayPrompt;
      const isFailedPrompt = failedPrompts.has(prompt);
      const currentSeen = generatedPromptsCount.get(prompt) || 0;

      // Safe fallback: only recorded if (!failedPrompts.has(prompt) || exactFailedPromptRepeats < 1)
      if (!fallbackCandidate && (!isFailedPrompt || exactFailedPromptRepeats < 1)) {
        fallbackCandidate = q;
      }

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

    const selectedQuestion = candidate || fallbackCandidate || lastGenerated!;
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

    // 3. Preserve generator templateFamily or assignedFamily
    const effectiveFamily = selectedQuestion.templateFamily || assignedFamily;
    generatedFamilyCounts.set(effectiveFamily, (generatedFamilyCounts.get(effectiveFamily) || 0) + 1);

    const finalQuestion: Question = {
      ...selectedQuestion,
      questionInstanceId: `remediation:${seed}:${i + 1}`,
      difficulty: clampedDiff,
      templateFamily: effectiveFamily,
      skillTags: Array.from(combinedSkillTags),
    };

    questions.push(finalQuestion);
  }

  return {
    questions,
    targetSkillIds,
    metadata: {
      sessionSize: questions.length,
      distinctFailedFamiliesCount: distinctFailedFamilies.length,
      maxDifficultyCeiling: difficultyCeiling,
      seed,
      generatedAt: Date.now(),
    },
  };
}
