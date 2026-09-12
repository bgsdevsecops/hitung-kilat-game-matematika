import { AdaptiveBucket, AdaptiveSelectorPolicy } from './types';
import { MasteryRecord } from '../mastery/types';
import { Question } from '../types/question';
import { FailedQuestionEvidence } from '../remediation/types';
import { getSubSkill } from '../taxonomy';

/**
 * Bucket priority order for deterministic tie-breaking during proportional slot allocation.
 * Lower number = higher priority.
 */
const BUCKET_PRIORITY: Record<AdaptiveBucket, number> = {
  WEAK_SKILLS: 1,
  RECENT_ERRORS: 2,
  MEDIUM_SKILLS: 3,
  STRONG_MAINTENANCE: 4,
  COLD_START_DIAGNOSTIC: 5,
};

/**
 * Checks whether all prerequisites for a sub-skill are satisfied based on the player's mastery records.
 * A prerequisite is satisfied if the player has a record with status !== 'INSUFFICIENT_DATA'
 * and masteryScore >= 60 (Competent or higher).
 */
export function isSubSkillPrerequisiteSatisfied(
  subSkillId: string,
  records: Record<string, MasteryRecord>
): boolean {
  const def = getSubSkill(subSkillId);
  if (!def || !def.prerequisiteSubSkillIds || def.prerequisiteSubSkillIds.length === 0) {
    return true;
  }
  return def.prerequisiteSubSkillIds.every((preId) => {
    const rec = records[preId];
    return rec && rec.status !== 'INSUFFICIENT_DATA' && rec.masteryScore >= 60;
  });
}

/**
 * Classifies the player's mastery records and recent errors into adaptive practice buckets:
 * - WEAK_SKILLS: isWeakSkill || score < 60 || recentAccuracy < 70 || status NEEDS_PRACTICE / DEVELOPING
 * - STRONG_MAINTENANCE: isStrongSkill || (score >= 80 && recentAccuracy >= 85)
 * - MEDIUM_SKILLS: score >= 60 (or COMPETENT / developing skills not marked weak or strong)
 * - RECENT_ERRORS: Unique sub-skill IDs extracted from recentErrors
 */
export function classifyMasteryBuckets(
  records: Record<string, MasteryRecord>,
  recentErrors?: (Question | FailedQuestionEvidence)[]
): Record<AdaptiveBucket, string[]> {
  const buckets: Record<AdaptiveBucket, string[]> = {
    WEAK_SKILLS: [],
    MEDIUM_SKILLS: [],
    RECENT_ERRORS: [],
    STRONG_MAINTENANCE: [],
    COLD_START_DIAGNOSTIC: [],
  };

  for (const [id, rec] of Object.entries(records)) {
    if (!rec || rec.status === 'INSUFFICIENT_DATA') continue;
    if (
      rec.isWeakSkill ||
      rec.masteryScore < 60 ||
      rec.recentAccuracy < 70 ||
      rec.status === 'NEEDS_PRACTICE' ||
      rec.status === 'DEVELOPING'
    ) {
      buckets.WEAK_SKILLS.push(id);
    } else if (
      rec.isStrongSkill ||
      (rec.masteryScore >= 80 && rec.recentAccuracy >= 85)
    ) {
      buckets.STRONG_MAINTENANCE.push(id);
    } else if (rec.masteryScore >= 60) {
      buckets.MEDIUM_SKILLS.push(id);
    }
  }

  if (recentErrors && recentErrors.length > 0) {
    const errorSkillIds = new Set<string>();
    for (const err of recentErrors) {
      if ('subSkillId' in err && (err as { subSkillId?: string }).subSkillId) {
        errorSkillIds.add((err as { subSkillId: string }).subSkillId);
      }
      if (err.primarySkillId) errorSkillIds.add(err.primarySkillId);
      for (const tag of err.skillTags || []) {
        if (tag) errorSkillIds.add(tag);
      }
    }
    buckets.RECENT_ERRORS = Array.from(errorSkillIds);
  }

  return buckets;
}

/**
 * Allocates session question slots across available buckets using the Hare-Niemeyer
 * (Largest Remainder) method with proportional redistribution when buckets are unavailable.
 */
export function allocateBucketSlots(
  sessionSize: number,
  policy: AdaptiveSelectorPolicy,
  availableBuckets: Set<AdaptiveBucket>
): Record<AdaptiveBucket, number> {
  const slots: Record<AdaptiveBucket, number> = {
    WEAK_SKILLS: 0,
    MEDIUM_SKILLS: 0,
    RECENT_ERRORS: 0,
    STRONG_MAINTENANCE: 0,
    COLD_START_DIAGNOSTIC: 0,
  };

  if (sessionSize <= 0) {
    return slots;
  }

  const activeRatios: { bucket: AdaptiveBucket; ratio: number }[] = [];
  if (availableBuckets.has('WEAK_SKILLS') && policy.weakSkillsRatio > 0) {
    activeRatios.push({ bucket: 'WEAK_SKILLS', ratio: policy.weakSkillsRatio });
  }
  if (availableBuckets.has('MEDIUM_SKILLS') && policy.mediumSkillsRatio > 0) {
    activeRatios.push({ bucket: 'MEDIUM_SKILLS', ratio: policy.mediumSkillsRatio });
  }
  if (availableBuckets.has('RECENT_ERRORS') && policy.recentErrorsRatio > 0) {
    activeRatios.push({ bucket: 'RECENT_ERRORS', ratio: policy.recentErrorsRatio });
  }
  if (availableBuckets.has('STRONG_MAINTENANCE') && policy.strongMaintenanceRatio > 0) {
    activeRatios.push({ bucket: 'STRONG_MAINTENANCE', ratio: policy.strongMaintenanceRatio });
  }

  if (activeRatios.length === 0) {
    if (availableBuckets.has('COLD_START_DIAGNOSTIC')) {
      slots.COLD_START_DIAGNOSTIC = sessionSize;
    } else {
      slots.WEAK_SKILLS = sessionSize;
    }
    return slots;
  }

  const totalActiveRatio = activeRatios.reduce((sum, r) => sum + r.ratio, 0);
  const normalized = activeRatios.map((r) => ({
    bucket: r.bucket,
    exactSlots: (r.ratio / totalActiveRatio) * sessionSize,
  }));

  let allocated = 0;
  const remainders: { bucket: AdaptiveBucket; remainder: number }[] = [];

  for (const item of normalized) {
    const floorSlots = Math.floor(item.exactSlots);
    slots[item.bucket] = floorSlots;
    allocated += floorSlots;
    remainders.push({ bucket: item.bucket, remainder: item.exactSlots - floorSlots });
  }

  remainders.sort((a, b) => {
    const diff = b.remainder - a.remainder;
    if (Math.abs(diff) > 1e-6) {
      return diff;
    }
    return (BUCKET_PRIORITY[a.bucket] ?? 99) - (BUCKET_PRIORITY[b.bucket] ?? 99);
  });

  let remaining = sessionSize - allocated;
  let idx = 0;
  while (remaining > 0 && idx < remainders.length) {
    slots[remainders[idx].bucket] += 1;
    remaining--;
    idx++;
  }

  return slots;
}
