import { Question, GenerationContext } from '../types/question';
import { GeneratorRule } from '../types/rules';
import { LevelConfigV2 } from '../types/level';
import { LEVEL_MANIFEST_72 } from '../manifest/levels';
import { MasteryRecord } from '../mastery/types';
import { FailedQuestionEvidence } from '../remediation/types';
import { QuestionGeneratorRegistry } from '../registry';
import { createMulberry32 } from '../utils/prng';
import { getSubSkill, getAllSubSkills } from '../taxonomy';
import {
  AdaptiveBucket,
  AdaptiveBuilderOptions,
  AdaptiveRecommendation,
  AdaptiveSelectorPolicy,
  AdaptiveSessionPlan,
  DEFAULT_ADAPTIVE_POLICY,
} from './types';
import {
  classifyMasteryBuckets,
  allocateBucketSlots,
  isSubSkillPrerequisiteSatisfied,
} from './selector';

/**
 * Foundational sub-skill IDs for each arithmetic operation.
 * All mapped IDs are guaranteed to exist in SKILL_TAXONOMY.
 */
const FOUNDATIONAL_SUB_SKILLS: Record<string, string> = {
  addition: 'addition.single_digit',
  subtraction: 'subtraction.single_digit',
  multiplication: 'multiplication.x2',
  division: 'division.basic_235',
};

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm and the provided PRNG.
 */
function shuffleArray<T>(arr: T[], prng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

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
 * Resolves a fallback default rule for a generator key respecting the difficulty ceiling.
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
        maxA: difficultyCeiling >= 3 ? 50 : 15,
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
 * Maps a sub-skill ID to the appropriate QuestionGenerator key.
 */
function mapSubSkillToGeneratorKey(subSkillId: string): string {
  if (subSkillId.startsWith('addition')) return 'addition';
  if (subSkillId.startsWith('subtraction')) return 'subtraction';
  if (subSkillId.startsWith('multiplication')) return 'multiplication';
  if (subSkillId.startsWith('division')) return 'division';
  if (subSkillId.startsWith('missing_operand')) return 'missing_operand';
  if (subSkillId.startsWith('multi_operation') || subSkillId.startsWith('arithmetic.chain')) return 'chain';
  if (subSkillId.startsWith('bodmas')) return 'bodmas';
  if (subSkillId.startsWith('signed')) return 'signed';
  if (subSkillId.startsWith('algebra')) return 'algebra';
  if (subSkillId.startsWith('square') || subSkillId.startsWith('root')) return 'power_root';
  if (subSkillId.startsWith('fraction') || subSkillId.startsWith('percentage') || subSkillId.startsWith('ratio')) {
    return 'fraction_percentage';
  }
  return 'addition';
}

/**
 * Resolves the generator key and rule for a given sub-skill ID and difficulty ceiling.
 */
function resolveSubSkillRule(
  subSkillId: string,
  difficultyCeiling: number,
  registry: QuestionGeneratorRegistry
): { generatorKey: string; rule: GeneratorRule; templateFamily: string; difficulty: 1 | 2 | 3 | 4 | 5 | 6 } {
  // Look in LEVEL_MANIFEST_72 for an exact sub-skill match
  const candidateLevels = LEVEL_MANIFEST_72.filter(
    (l) =>
      l.primarySkillId === subSkillId &&
      l.difficulty <= difficultyCeiling &&
      registry.has(l.generatorKey) &&
      !l.boss
  );

  if (candidateLevels.length > 0) {
    // Pick the candidate closest to the ceiling
    candidateLevels.sort((a, b) => b.difficulty - a.difficulty);
    const chosenLevel = candidateLevels[0];
    return {
      generatorKey: chosenLevel.generatorKey,
      rule: chosenLevel.rules,
      templateFamily: getManifestLevelTemplateFamily(chosenLevel),
      difficulty: Math.min(chosenLevel.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6,
    };
  }

  // Fallback if not found in manifest
  const generatorKey = mapSubSkillToGeneratorKey(subSkillId);
  const rule = getDefaultRule(generatorKey, difficultyCeiling);
  const def = getSubSkill(subSkillId);
  const baseDiff = def ? Math.min(def.difficultyBase, difficultyCeiling) : 1;

  let templateFamily = `${generatorKey}_basic`;
  if (generatorKey === 'division') templateFamily = 'division_clean';
  if (generatorKey === 'chain') templateFamily = 'chain_3_terms';

  return {
    generatorKey,
    rule,
    templateFamily,
    difficulty: Math.max(1, Math.min(6, baseDiff)) as 1 | 2 | 3 | 4 | 5 | 6,
  };
}

/**
 * Solves the non-consecutive templateFamily invariant (AC-E6-02) by ordering questions
 * so that no two adjacent questions share the same templateFamily.
 * Uses backtracking with Most Remaining Value (MRV) heuristic and deterministic pre-shuffle.
 */
function arrangeNonConsecutive(
  questions: Question[],
  prng: () => number,
  difficultyCeiling: number,
  registry: QuestionGeneratorRegistry
): Question[] {
  if (questions.length <= 1) return [...questions];

  const remaining = [...questions];
  const result: Question[] = [];

  function solve(lastFamily: string | null): boolean {
    if (remaining.length === 0) return true;

    // Count remaining frequencies of each templateFamily
    const counts = new Map<string, number>();
    for (const q of remaining) {
      const fam = q.templateFamily || 'default_family';
      counts.set(fam, (counts.get(fam) || 0) + 1);
    }

    // Pigeonhole principle early pruning (Finding 3):
    // If any template family count exceeds ceil(remaining.length / 2), non-consecutive arrangement is impossible
    for (const count of counts.values()) {
      if (count > Math.ceil(remaining.length / 2)) {
        return false;
      }
    }

    // Candidate indices whose family is different from the previous question
    const candidateIndices: number[] = [];
    for (let i = 0; i < remaining.length; i++) {
      const fam = remaining[i].templateFamily || 'default_family';
      if (fam !== lastFamily) {
        candidateIndices.push(i);
      }
    }

    // Deterministic pre-shuffle using Fisher-Yates, then stable sort by frequency descending (MRV)
    shuffleArray(candidateIndices, prng);
    candidateIndices.sort((a, b) => {
      const famA = remaining[a].templateFamily || 'default_family';
      const famB = remaining[b].templateFamily || 'default_family';
      return (counts.get(famB) || 0) - (counts.get(famA) || 0);
    });

    for (const idx of candidateIndices) {
      const [chosen] = remaining.splice(idx, 1);
      result.push(chosen);

      if (solve(chosen.templateFamily || 'default_family')) {
        return true;
      }

      // Backtrack
      result.pop();
      remaining.splice(idx, 0, chosen);
    }

    return false;
  }

  const success = solve(null);
  if (success) {
    return result;
  }

  // Safety fallback: if strict non-consecutive was not reached, resolve collisions
  const adjusted = [...questions];
  for (let i = 1; i < adjusted.length; i++) {
    if (adjusted[i].templateFamily === adjusted[i - 1].templateFamily) {
      let swapped = false;
      for (let j = i + 1; j < adjusted.length; j++) {
        // Verify swapping index i and index j resolves collision without creating a new collision (Finding 2)
        const validAtI =
          adjusted[j].templateFamily !== adjusted[i - 1].templateFamily &&
          (i + 1 >= adjusted.length || j === i + 1 || adjusted[j].templateFamily !== adjusted[i + 1].templateFamily);
        const validAtJ =
          (j === i + 1 || adjusted[i].templateFamily !== adjusted[j - 1].templateFamily) &&
          (j + 1 >= adjusted.length || adjusted[i].templateFamily !== adjusted[j + 1].templateFamily);

        if (validAtI && validAtJ) {
          const tmp = adjusted[i];
          adjusted[i] = adjusted[j];
          adjusted[j] = tmp;
          swapped = true;
          break;
        }
      }
      if (!swapped) {
        // Diversify template family by generating an alternate operation matching difficulty (Finding 1)
        const alternateOps = ['subtraction', 'multiplication', 'division', 'addition'] as const;
        const currentOp = adjusted[i].generatorKey;
        const newOp = alternateOps.find((op) => op !== currentOp && registry.has(op)) || 'subtraction';
        const newSubSkill = FOUNDATIONAL_SUB_SKILLS[newOp] || 'addition.single_digit';
        const resolved = resolveSubSkillRule(newSubSkill, difficultyCeiling, registry);
        const generator = registry.get(resolved.generatorKey);
        const context: GenerationContext = {
          levelId: `diversify:${newSubSkill}`,
          sequenceIndex: i + 1,
          contentVersion: '2.0.0',
        };
        const replacement = generator.generate(resolved.rule, prng, context);
        adjusted[i] = {
          ...replacement,
          primarySkillId: newSubSkill,
          templateFamily: resolved.templateFamily,
          difficulty: Math.min(resolved.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6,
        };
      }
    }
  }

  return adjusted;
}

/**
 * Generates an actionable, user-friendly recommendation based on evaluated mastery and recent errors.
 */
export function generateAdaptiveRecommendation(
  masteryRecords: Record<string, MasteryRecord>,
  recentErrorsCount: number,
  isColdStart: boolean
): AdaptiveRecommendation {
  if (isColdStart) {
    return {
      primarySubSkillId: 'addition.single_digit',
      reason: 'Sesi diagnostik awal untuk memetakan kemampuan dasar matematika kamu.',
      suggestedAction: 'focus_practice',
      alternateSubSkillIds: [
        'subtraction.single_digit',
        'multiplication.x2',
        'division.basic_235',
      ],
    };
  }

  const buckets = classifyMasteryBuckets(masteryRecords);

  // Case 1: Player has weak skills
  if (buckets.WEAK_SKILLS.length > 0) {
    const sortedWeak = [...buckets.WEAK_SKILLS].sort((a, b) => {
      const recA = masteryRecords[a];
      const recB = masteryRecords[b];
      const scoreA = recA?.masteryScore ?? 0;
      const scoreB = recB?.masteryScore ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (recA?.recentAccuracy ?? 0) - (recB?.recentAccuracy ?? 0);
    });

    const primarySubSkillId = sortedWeak[0];
    const rec = masteryRecords[primarySubSkillId];
    const subDef = getSubSkill(primarySubSkillId);
    const label = subDef?.name || primarySubSkillId;
    const statusNote = rec?.statusLabel ? ` (${rec.statusLabel})` : '';

    const alternates = sortedWeak.filter((id) => id !== primarySubSkillId).slice(0, 3);
    if (alternates.length < 3) {
      for (const med of buckets.MEDIUM_SKILLS) {
        if (alternates.length >= 3) break;
        if (!alternates.includes(med) && med !== primarySubSkillId) {
          alternates.push(med);
        }
      }
    }

    return {
      primarySubSkillId,
      reason: `${label}${statusNote} perlu latihan untuk meningkatkan pemahaman dan akurasi berhitung.`,
      suggestedAction: 'focus_practice',
      alternateSubSkillIds: alternates,
    };
  }

  // Case 2: Player has recent errors to remediate
  if (recentErrorsCount > 0) {
    const evaluatedIds = Object.keys(masteryRecords).filter(
      (id) => masteryRecords[id]?.status !== 'INSUFFICIENT_DATA'
    );
    const primarySubSkillId = evaluatedIds[0] || 'addition.single_digit';
    const alternates = evaluatedIds.filter((id) => id !== primarySubSkillId).slice(0, 3);

    return {
      primarySubSkillId,
      reason: `Terdapat ${recentErrorsCount} kesalahan terbaru yang perlu diperbaiki agar pemahaman makin mantap.`,
      suggestedAction: 'remediate_errors',
      alternateSubSkillIds: alternates,
    };
  }

  // Case 3: Maintain strengths
  const evaluatedList = Object.keys(masteryRecords)
    .filter((id) => masteryRecords[id]?.status !== 'INSUFFICIENT_DATA')
    .sort(
      (a, b) => (masteryRecords[b]?.masteryScore ?? 0) - (masteryRecords[a]?.masteryScore ?? 0)
    );

  const primarySubSkillId = evaluatedList[0] || 'addition.single_digit';
  const subDef = getSubSkill(primarySubSkillId);
  const label = subDef?.name || primarySubSkillId;
  const alternates = evaluatedList.filter((id) => id !== primarySubSkillId).slice(0, 3);

  return {
    primarySubSkillId,
    reason: `Pertahankan kelancaran berhitung ${label} dengan latihan penguatan secara teratur.`,
    suggestedAction: 'maintain_strength',
    alternateSubSkillIds: alternates,
  };
}

/**
 * Builds a deterministic, personalized adaptive practice session.
 * Enforces AC-E6-01 (distribution bounds), AC-E6-02 (sub-skill share <= 40%, non-consecutive templates),
 * AC-E6-03 (prerequisites & difficulty ceiling), and AC-E6-04 (reproducible seed).
 */
export function buildAdaptiveSession(options: AdaptiveBuilderOptions): AdaptiveSessionPlan {
  if (!options.registry) {
    throw new Error('QuestionGeneratorRegistry is required to build an adaptive session');
  }

  const policy: AdaptiveSelectorPolicy = {
    ...DEFAULT_ADAPTIVE_POLICY,
    ...options.policy,
  };

  // Guard sessionSize with Math.floor and clamp to minSessionSize (10)
  const rawSessionSize = options.sessionSize ?? policy.minSessionSize;
  const sessionSize = Number.isFinite(rawSessionSize)
    ? Math.max(policy.minSessionSize, Math.floor(rawSessionSize))
    : policy.minSessionSize;

  const difficultyCeiling = (options.playerDifficultyCeiling ?? 6) as 1 | 2 | 3 | 4 | 5 | 6;
  const seed = options.seed ?? Date.now();
  const prng = createMulberry32(seed);

  // Cold-start detection: fewer than 2 evaluated sub-skills beyond INSUFFICIENT_DATA
  const evaluatedRecords = Object.values(options.masteryRecords || {}).filter(
    (r) => r && r.status !== 'INSUFFICIENT_DATA'
  );
  const isColdStart = evaluatedRecords.length < 2;

  const recommendation = generateAdaptiveRecommendation(
    options.masteryRecords || {},
    options.recentErrors?.length || 0,
    isColdStart
  );

  let rawQuestions: Question[] = [];
  const bucketAssignments: Record<AdaptiveBucket, number> = {
    WEAK_SKILLS: 0,
    MEDIUM_SKILLS: 0,
    RECENT_ERRORS: 0,
    STRONG_MAINTENANCE: 0,
    COLD_START_DIAGNOSTIC: 0,
  };

  if (isColdStart) {
    bucketAssignments.COLD_START_DIAGNOSTIC = sessionSize;

    // Composition for cold start: 30% add, 30% sub, 20% mul, 20% div
    const addCount = Math.round(sessionSize * 0.3);
    const subCount = Math.round(sessionSize * 0.3);
    const mulCount = Math.round(sessionSize * 0.2);
    const divCount = sessionSize - (addCount + subCount + mulCount);

    const diagnosticSlots: { generatorKey: string; subSkillId: string; templateFamily: string; rule: GeneratorRule; difficulty: 1 | 2 }[] = [];

    for (let i = 0; i < addCount; i++) {
      diagnosticSlots.push({
        generatorKey: 'addition',
        subSkillId: 'addition.single_digit',
        templateFamily: 'addition_basic',
        rule: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
        difficulty: 1,
      });
    }

    for (let i = 0; i < subCount; i++) {
      diagnosticSlots.push({
        generatorKey: 'subtraction',
        subSkillId: 'subtraction.single_digit',
        templateFamily: 'subtraction_basic',
        rule: { kind: 'subtraction', minA: 1, maxA: 15, minB: 1, maxB: 15, allowNegative: false },
        difficulty: 1,
      });
    }

    for (let i = 0; i < mulCount; i++) {
      diagnosticSlots.push({
        generatorKey: 'multiplication',
        subSkillId: i % 2 === 0 ? 'multiplication.x2' : 'multiplication.x5',
        templateFamily: 'multiplication_basic',
        rule: {
          kind: 'multiplication',
          fixedOperand: i % 2 === 0 ? 2 : 5,
          minA: i % 2 === 0 ? 2 : 5,
          maxA: i % 2 === 0 ? 2 : 5,
          minB: 1,
          maxB: 10,
        },
        difficulty: 2,
      });
    }

    for (let i = 0; i < divCount; i++) {
      diagnosticSlots.push({
        generatorKey: 'division',
        subSkillId: 'division.basic_235',
        templateFamily: 'division_clean',
        rule: { kind: 'division', minDivisor: 2, maxDivisor: 5, minQuotient: 1, maxQuotient: 10, requireInteger: true },
        difficulty: 2,
      });
    }

    // Interleave operation order to ensure non-consecutive templates
    const pool = {
      addition: diagnosticSlots.filter((s) => s.generatorKey === 'addition'),
      subtraction: diagnosticSlots.filter((s) => s.generatorKey === 'subtraction'),
      multiplication: diagnosticSlots.filter((s) => s.generatorKey === 'multiplication'),
      division: diagnosticSlots.filter((s) => s.generatorKey === 'division'),
    };

    const orderedSlots: typeof diagnosticSlots = [];
    const sequence = ['addition', 'subtraction', 'multiplication', 'addition', 'subtraction', 'division'];
    let seqIdx = 0;

    while (orderedSlots.length < sessionSize) {
      const op = sequence[seqIdx % sequence.length];
      if (pool[op as keyof typeof pool].length > 0) {
        orderedSlots.push(pool[op as keyof typeof pool].shift()!);
      } else {
        const lastOp = orderedSlots[orderedSlots.length - 1]?.generatorKey;
        const availableOp = (['addition', 'subtraction', 'multiplication', 'division'] as const).find(
          (cand) => cand !== lastOp && pool[cand].length > 0
        );
        if (availableOp) {
          orderedSlots.push(pool[availableOp].shift()!);
        } else {
          const remainingAny = Object.values(pool).find((p) => p.length > 0);
          if (remainingAny && remainingAny.length > 0) {
            orderedSlots.push(remainingAny.shift()!);
          }
        }
      }
      seqIdx++;
    }

    const seenSignatures = new Set<string>();
    for (let i = 0; i < orderedSlots.length; i++) {
      const slot = orderedSlots[i];
      const generator = options.registry.get(slot.generatorKey);
      const effectiveDiff = Math.min(slot.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6;

      let candidate: Question | null = null;
      for (let attempt = 0; attempt < 25; attempt++) {
        const context: GenerationContext = {
          levelId: `cold_start:${slot.subSkillId}`,
          sequenceIndex: i + 1,
          contentVersion: '2.0.0',
          existingSignatures: seenSignatures,
        };

        const q = generator.generate(slot.rule, prng, context);
        if (!seenSignatures.has(q.displayPrompt)) {
          candidate = q;
          seenSignatures.add(q.displayPrompt);
          break;
        }
      }

      if (!candidate) {
        candidate = generator.generate(slot.rule, prng, {
          levelId: `cold_start:${slot.subSkillId}`,
          sequenceIndex: i + 1,
          contentVersion: '2.0.0',
          existingSignatures: seenSignatures,
        });
      }

      rawQuestions.push({
        ...candidate,
        questionInstanceId: `adaptive:${seed}:${i + 1}`,
        primarySkillId: slot.subSkillId,
        templateFamily: slot.templateFamily,
        difficulty: effectiveDiff,
        skillTags: Array.from(new Set([...(candidate.skillTags || []), slot.subSkillId, slot.generatorKey])),
      });
    }
  } else {
    // Mastery-driven session
    const classified = classifyMasteryBuckets(options.masteryRecords || {}, options.recentErrors);

    // Filter candidate skills by prerequisite satisfaction (AC-E6-03) and difficulty ceiling (Finding 3)
    const eligibleWeak = classified.WEAK_SKILLS.filter(
      (id) =>
        isSubSkillPrerequisiteSatisfied(id, options.masteryRecords || {}) &&
        (getSubSkill(id)?.difficultyBase ?? 1) <= difficultyCeiling
    );
    const eligibleMedium = classified.MEDIUM_SKILLS.filter(
      (id) =>
        isSubSkillPrerequisiteSatisfied(id, options.masteryRecords || {}) &&
        (getSubSkill(id)?.difficultyBase ?? 1) <= difficultyCeiling
    );
    const eligibleStrong = classified.STRONG_MAINTENANCE.filter(
      (id) =>
        isSubSkillPrerequisiteSatisfied(id, options.masteryRecords || {}) &&
        (getSubSkill(id)?.difficultyBase ?? 1) <= difficultyCeiling
    );

    // Filter recent errors by prerequisite satisfaction (Finding 2) and difficulty ceiling (Finding 3)
    const eligibleRecentErrors = (options.recentErrors || []).filter((err) => {
      const skillId = err.primarySkillId || ('generatorKey' in err ? err.generatorKey : '');
      const diff = err.difficulty ?? getSubSkill(skillId)?.difficultyBase ?? 1;
      const prereqSatisfied = !skillId || isSubSkillPrerequisiteSatisfied(skillId, options.masteryRecords || {});
      return prereqSatisfied && diff <= difficultyCeiling;
    });

    const availableBuckets = new Set<AdaptiveBucket>();
    if (eligibleWeak.length > 0) availableBuckets.add('WEAK_SKILLS');
    if (eligibleMedium.length > 0) availableBuckets.add('MEDIUM_SKILLS');
    if (eligibleRecentErrors.length > 0) availableBuckets.add('RECENT_ERRORS');
    if (eligibleStrong.length > 0) availableBuckets.add('STRONG_MAINTENANCE');

    if (availableBuckets.size === 0) {
      availableBuckets.add('WEAK_SKILLS');
      eligibleWeak.push('addition.single_digit');
    }

    const allocated = allocateBucketSlots(sessionSize, policy, availableBuckets);
    Object.assign(bucketAssignments, allocated);

    // Maximum questions for any single sub-skill (AC-E6-02: <= 40%)
    const maxPerSubSkill = Math.floor(sessionSize * policy.maxSubSkillShare);
    // Maximum questions for any single template family (Finding 1: <= 50% to prevent consecutive pigeonhole impossibility)
    const maxPerTemplateFamily = Math.floor(sessionSize / 2);

    const subSkillUsage = new Map<string, number>();
    const templateFamilyUsage = new Map<string, number>();

    function getTemplateFamilyForSubSkill(subSkillId: string): string {
      return resolveSubSkillRule(subSkillId, difficultyCeiling, options.registry).templateFamily;
    }

    // Helper to find a complementary sub-skill respecting caps, prerequisites, and difficulty ceiling (Findings 1 & 3)
    function findComplementarySubSkill(
      preferredCategory: string,
      records: Record<string, MasteryRecord>
    ): string {
      const all = getAllSubSkills();
      const eligible = all.filter(
        (s) =>
          (s.difficultyBase ?? 1) <= difficultyCeiling &&
          isSubSkillPrerequisiteSatisfied(s.id, records)
      );

      // 1. Same category respecting both subSkill cap and templateFamily cap
      for (const s of eligible) {
        if (s.skillId === preferredCategory) {
          const used = subSkillUsage.get(s.id) || 0;
          const fam = getTemplateFamilyForSubSkill(s.id);
          const famUsed = templateFamilyUsage.get(fam) || 0;
          if (used < maxPerSubSkill && famUsed < maxPerTemplateFamily) {
            return s.id;
          }
        }
      }

      // 2. Any category respecting both caps
      for (const s of eligible) {
        const used = subSkillUsage.get(s.id) || 0;
        const fam = getTemplateFamilyForSubSkill(s.id);
        const famUsed = templateFamilyUsage.get(fam) || 0;
        if (used < maxPerSubSkill && famUsed < maxPerTemplateFamily) {
          return s.id;
        }
      }

      // 3. Fallback: respecting subSkill cap
      for (const s of eligible) {
        const used = subSkillUsage.get(s.id) || 0;
        if (used < maxPerSubSkill) {
          return s.id;
        }
      }

      return 'addition.single_digit';
    }

    // Helper to select an eligible sub-skill respecting caps
    function pickSubSkillForSlot(
      candidates: string[],
      records: Record<string, MasteryRecord>
    ): string {
      for (const cand of candidates) {
        const used = subSkillUsage.get(cand) || 0;
        const fam = getTemplateFamilyForSubSkill(cand);
        const famUsed = templateFamilyUsage.get(fam) || 0;

        if (used < maxPerSubSkill && famUsed < maxPerTemplateFamily) {
          subSkillUsage.set(cand, used + 1);
          templateFamilyUsage.set(fam, famUsed + 1);
          return cand;
        }
      }

      // If all candidates in this bucket reached cap or family cap, supplement with complementary sub-skill
      const preferredCategory = candidates[0] ? candidates[0].split('.')[0] : 'addition';
      const complementary = findComplementarySubSkill(preferredCategory, records);
      subSkillUsage.set(complementary, (subSkillUsage.get(complementary) || 0) + 1);
      const compFam = getTemplateFamilyForSubSkill(complementary);
      templateFamilyUsage.set(compFam, (templateFamilyUsage.get(compFam) || 0) + 1);
      return complementary;
    }

    const plannedSlots: { bucket: AdaptiveBucket; subSkillId: string; errorEvidence?: Question | FailedQuestionEvidence }[] = [];

    // 1. Weak skills
    for (let i = 0; i < bucketAssignments.WEAK_SKILLS; i++) {
      const pool = eligibleWeak.length > 0 ? eligibleWeak : ['addition.single_digit'];
      const subSkillId = pickSubSkillForSlot(pool, options.masteryRecords || {});
      plannedSlots.push({ bucket: 'WEAK_SKILLS', subSkillId });
    }

    // 2. Medium skills
    for (let i = 0; i < bucketAssignments.MEDIUM_SKILLS; i++) {
      const pool = eligibleMedium.length > 0 ? eligibleMedium : ['subtraction.single_digit'];
      const subSkillId = pickSubSkillForSlot(pool, options.masteryRecords || {});
      plannedSlots.push({ bucket: 'MEDIUM_SKILLS', subSkillId });
    }

    // 3. Recent errors
    if (eligibleRecentErrors.length > 0) {
      for (let i = 0; i < bucketAssignments.RECENT_ERRORS; i++) {
        const err = eligibleRecentErrors[i % eligibleRecentErrors.length];
        const rawSubSkill = err.primarySkillId || ('generatorKey' in err ? err.generatorKey : 'addition.single_digit');
        const count = subSkillUsage.get(rawSubSkill) || 0;
        const fam = err.templateFamily || getTemplateFamilyForSubSkill(rawSubSkill);
        const famCount = templateFamilyUsage.get(fam) || 0;

        let subSkillId = rawSubSkill;
        let errorEvidence: FailedQuestionEvidence | undefined = err;

        if (count >= maxPerSubSkill || famCount >= maxPerTemplateFamily) {
          subSkillId = findComplementarySubSkill('addition', options.masteryRecords || {});
          // When redirected to a complementary sub-skill, clear errorEvidence so the slot uses
          // the complementary sub-skill's own generator and template family (Finding 4)
          errorEvidence = undefined;
        }

        subSkillUsage.set(subSkillId, (subSkillUsage.get(subSkillId) || 0) + 1);
        const effectiveFam = getTemplateFamilyForSubSkill(subSkillId);
        templateFamilyUsage.set(effectiveFam, (templateFamilyUsage.get(effectiveFam) || 0) + 1);
        plannedSlots.push({ bucket: 'RECENT_ERRORS', subSkillId, errorEvidence });
      }
    }

    // 4. Strong maintenance
    for (let i = 0; i < bucketAssignments.STRONG_MAINTENANCE; i++) {
      const pool = eligibleStrong.length > 0 ? eligibleStrong : ['multiplication.x2'];
      const subSkillId = pickSubSkillForSlot(pool, options.masteryRecords || {});
      plannedSlots.push({ bucket: 'STRONG_MAINTENANCE', subSkillId });
    }

    // Generate questions for all planned slots
    const seenSignatures = new Set<string>();
    for (let i = 0; i < plannedSlots.length; i++) {
      const slot = plannedSlots[i];
      const resolved = resolveSubSkillRule(slot.subSkillId, difficultyCeiling, options.registry);

      let genKey = resolved.generatorKey;
      let rule = resolved.rule;
      let templateFamily = resolved.templateFamily;
      let diff = resolved.difficulty;

      if (slot.errorEvidence) {
        if (slot.errorEvidence.generatorKey && options.registry.has(slot.errorEvidence.generatorKey)) {
          genKey = slot.errorEvidence.generatorKey;
        }
        if (slot.errorEvidence.templateFamily) {
          templateFamily = slot.errorEvidence.templateFamily;
        }
        if (slot.errorEvidence.difficulty) {
          diff = Math.min(slot.errorEvidence.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6;
        }
      }

      const generator = options.registry.get(genKey);
      let candidate: Question | null = null;

      for (let attempt = 0; attempt < 25; attempt++) {
        const context: GenerationContext = {
          levelId: `adaptive:${slot.subSkillId}`,
          sequenceIndex: i + 1,
          contentVersion: '2.0.0',
          existingSignatures: seenSignatures,
        };

        const q = generator.generate(rule, prng, context);
        if (!seenSignatures.has(q.displayPrompt)) {
          candidate = q;
          seenSignatures.add(q.displayPrompt);
          break;
        }
      }

      if (!candidate) {
        candidate = generator.generate(rule, prng, {
          levelId: `adaptive:${slot.subSkillId}`,
          sequenceIndex: i + 1,
          contentVersion: '2.0.0',
          existingSignatures: seenSignatures,
        });
      }

      const clampedDiff = Math.min(diff, candidate.difficulty, difficultyCeiling) as 1 | 2 | 3 | 4 | 5 | 6;
      rawQuestions.push({
        ...candidate,
        questionInstanceId: `adaptive:${seed}:${i + 1}`,
        primarySkillId: slot.subSkillId,
        templateFamily: templateFamily || candidate.templateFamily,
        difficulty: clampedDiff,
        skillTags: Array.from(new Set([...(candidate.skillTags || []), slot.subSkillId, genKey])),
      });
    }
  }

  // Permute questions to enforce AC-E6-02: zero consecutive identical template families
  const questions = arrangeNonConsecutive(rawQuestions, prng, difficultyCeiling, options.registry).map((q, idx) => ({
    ...q,
    questionInstanceId: `adaptive:${seed}:${idx + 1}`,
  }));

  return {
    questions,
    bucketAssignments,
    recommendation,
    isColdStart,
    metadata: {
      sessionSize: questions.length,
      seed,
      policyVersion: policy.version,
      generatedAt: Date.now(),
      difficultyCeiling,
      untimed: options.untimed ?? false,
    },
  };
}
