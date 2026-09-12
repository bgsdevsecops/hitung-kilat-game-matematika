/**
 * Mastery Calculator V2.0
 * Implementation of the pure mathematical mastery algorithm adhering to PRD §8.3.3 and Milestone V2.1 Spec.
 */

import {
  StoredAnswerEvent,
  MasteryComputeOptions,
  MasteryRecord,
  MasteryStatus
} from './types';

export const MASTERY_ALGORITHM_VERSION = '2.0.0';

export const TARGET_RESPONSE_TIMES_MS: Record<number, number> = {
  1: 2500,
  2: 3000,
  3: 3500,
  4: 4000,
  5: 5000,
  6: 6000
};

const HALF_LIFE_MS = 30 * 86_400_000; // 30 days
const RETENTION_WINDOW_MS = 90 * 86_400_000; // 90 days
const MAX_EVALUATION_WINDOW = 30; // 30 eligible answers
const RECENT_ACCURACY_WINDOW = 10;
const MAX_CONSISTENCY_SESSIONS = 5;
const MIN_ELIGIBLE_ANSWERS = 10;
const MIN_DISTINCT_SESSIONS = 2;

const STATUS_LABELS: Record<MasteryStatus, string> = {
  INSUFFICIENT_DATA: 'Belum Cukup Data',
  NEEDS_PRACTICE: 'Perlu Latihan',
  DEVELOPING: 'Berkembang',
  COMPETENT: 'Cukup',
  PROFICIENT: 'Mahir',
  MASTERED: 'Dikuasai'
};

/**
 * Computes evidence weight:
 * Primary skill receives 1.0; supporting skill in skillTags receives 0.5.
 */
function resolveEvidenceWeight(event: StoredAnswerEvent, targetSubSkillId: string): number {
  if (typeof event.evidenceWeight === 'number') {
    return event.evidenceWeight;
  }
  if (!targetSubSkillId) {
    return 1.0;
  }
  if (event.subSkillId === targetSubSkillId || event.primarySkillId === targetSubSkillId) {
    return 1.0;
  }
  if (Array.isArray(event.skillTags) && event.skillTags.includes(targetSubSkillId)) {
    return 0.5;
  }
  return 1.0;
}

/**
 * Checks if an event is eligible for the target sub-skill.
 */
function isEventEligibleForSkill(event: StoredAnswerEvent, targetSubSkillId: string): boolean {
  if (!targetSubSkillId) {
    return false;
  }
  return (
    event.subSkillId === targetSubSkillId ||
    event.primarySkillId === targetSubSkillId ||
    (Array.isArray(event.skillTags) && event.skillTags.includes(targetSubSkillId))
  );
}

/**
 * Resolves mastery status band based on 0..100 score.
 */
function resolveStatusBand(score: number): MasteryStatus {
  if (score >= 95) return 'MASTERED';
  if (score >= 80) return 'PROFICIENT';
  if (score >= 60) return 'COMPETENT';
  if (score >= 40) return 'DEVELOPING';
  return 'NEEDS_PRACTICE';
}

/**
 * Pure evaluation function computing mastery metrics for a sub-skill.
 */
export function computeSubSkillMastery(
  events: StoredAnswerEvent[],
  options?: MasteryComputeOptions
): MasteryRecord {
  const evalTime = options?.evaluationTimeMs ?? Date.now();
  const untimed = Boolean(options?.untimed);
  const targetSubSkillId =
    options?.targetSubSkillId ?? (events.length > 0 ? events[0].subSkillId : '');

  // Guardrail: Empty target sub-skill identifier
  if (!targetSubSkillId) {
    return {
      subSkillId: '',
      status: 'INSUFFICIENT_DATA',
      statusLabel: STATUS_LABELS.INSUFFICIENT_DATA,
      masteryScore: 0,
      accuracyComponent: 0,
      speedComponent: null,
      consistencyComponent: 0,
      recentAccuracy: 0,
      totalAnswers: 0,
      distinctSessions: 0,
      isStrongSkill: false,
      isWeakSkill: false,
      lastEvaluatedAt: evalTime,
      algorithmVersion: MASTERY_ALGORITHM_VERSION,
    };
  }

  // 1. Filter events within the 90-day retention window and eligible for sub-skill
  const cutoffTime = evalTime - RETENTION_WINDOW_MS;
  const eligibleEvents = events.filter((evt) => {
    if (evt.timestamp < cutoffTime || evt.timestamp > evalTime + 60_000) {
      return false;
    }
    return isEventEligibleForSkill(evt, targetSubSkillId);
  });

  // 2. Sort by (timestamp ASC, eventId ASC)
  eligibleEvents.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  // 3. Select up to 30 most recent eligible answers
  const windowEvents = eligibleEvents.slice(-MAX_EVALUATION_WINDOW);
  const totalAnswers = windowEvents.length;
  const distinctSessions = new Set(windowEvents.map((e) => e.sessionId)).size;

  // 4. Guardrail: Insufficient data check
  if (totalAnswers < MIN_ELIGIBLE_ANSWERS || distinctSessions < MIN_DISTINCT_SESSIONS) {
    return {
      subSkillId: targetSubSkillId,
      status: 'INSUFFICIENT_DATA',
      statusLabel: STATUS_LABELS.INSUFFICIENT_DATA,
      masteryScore: 0,
      accuracyComponent: 0,
      speedComponent: null,
      consistencyComponent: 0,
      recentAccuracy: 0,
      totalAnswers,
      distinctSessions,
      isStrongSkill: false,
      isWeakSkill: false,
      lastEvaluatedAt: evalTime,
      algorithmVersion: MASTERY_ALGORITHM_VERSION
    };
  }

  // 5. Component 1: Recency-weighted Accuracy (0..100)
  // 6. Component 2: Recency-weighted Speed (0..100)
  let totalWeight = 0;
  let weightedAccuracySum = 0;
  let weightedSpeedSum = 0;

  for (const evt of windowEvents) {
    const deltaMs = Math.max(0, evalTime - evt.timestamp);
    const recencyWeight = Math.pow(2, -deltaMs / HALF_LIFE_MS);
    const evidenceWeight = resolveEvidenceWeight(evt, targetSubSkillId);
    const combinedWeight = recencyWeight * evidenceWeight;

    totalWeight += combinedWeight;

    if (evt.isCorrect) {
      weightedAccuracySum += combinedWeight * 1.0;

      const targetMs =
        evt.targetResponseTimeMs > 0
          ? evt.targetResponseTimeMs
          : TARGET_RESPONSE_TIMES_MS[evt.difficulty] ?? 3000;

      const rawSpeedScore = 100 * (2 - evt.responseTimeMs / targetMs);
      const clampedSpeedScore = Math.max(0, Math.min(100, rawSpeedScore));
      weightedSpeedSum += combinedWeight * clampedSpeedScore;
    } else {
      // Incorrect answers contribute 0 to accuracy and 0 to speed
    }
  }

  const accuracyComponent =
    totalWeight > 0 ? Math.round((weightedAccuracySum / totalWeight) * 10000) / 100 : 0;

  const speedComponent = untimed
    ? null
    : totalWeight > 0
      ? Math.round((weightedSpeedSum / totalWeight) * 100) / 100
      : 0;

  // 7. Component 3: Consistency across up to 5 most recent sessions with accuracy >= 80%
  const sessionMap = new Map<string, { total: number; correct: number; latestTimestamp: number }>();
  for (const evt of windowEvents) {
    const sess = sessionMap.get(evt.sessionId) ?? { total: 0, correct: 0, latestTimestamp: 0 };
    sess.total += 1;
    if (evt.isCorrect) sess.correct += 1;
    if (evt.timestamp > sess.latestTimestamp) sess.latestTimestamp = evt.timestamp;
    sessionMap.set(evt.sessionId, sess);
  }

  const sortedSessions = Array.from(sessionMap.values()).sort(
    (a, b) => b.latestTimestamp - a.latestTimestamp
  );
  const evaluationSessions = sortedSessions.slice(0, MAX_CONSISTENCY_SESSIONS);

  let passingSessions = 0;
  for (const s of evaluationSessions) {
    const sessionAccuracy = (s.correct / s.total) * 100;
    if (sessionAccuracy >= 80) {
      passingSessions += 1;
    }
  }

  const consistencyComponent =
    evaluationSessions.length > 0
      ? Math.round((passingSessions / evaluationSessions.length) * 10000) / 100
      : 0;

  // 8. Recent Accuracy (up to 10 latest answers)
  const recentEvents = windowEvents.slice(-RECENT_ACCURACY_WINDOW);
  const recentCorrectCount = recentEvents.filter((e) => e.isCorrect).length;
  const recentAccuracy =
    recentEvents.length > 0
      ? Math.round((recentCorrectCount / recentEvents.length) * 10000) / 100
      : 0;

  // 9. Mastery Score calculation
  let rawMasteryScore: number;
  if (untimed) {
    rawMasteryScore = Math.round(0.8 * accuracyComponent + 0.2 * consistencyComponent);
  } else {
    rawMasteryScore = Math.round(
      0.65 * accuracyComponent + 0.2 * (speedComponent ?? 0) + 0.15 * consistencyComponent
    );
  }
  const masteryScore = Math.max(0, Math.min(100, rawMasteryScore));

  // 10. Status and Classification
  const status = resolveStatusBand(masteryScore);
  const statusLabel = STATUS_LABELS[status];
  const isWeakSkill = masteryScore < 60 || recentAccuracy < 70;
  const isStrongSkill = masteryScore >= 80 && recentAccuracy >= 85;

  return {
    subSkillId: targetSubSkillId,
    status,
    statusLabel,
    masteryScore,
    accuracyComponent,
    speedComponent,
    consistencyComponent,
    recentAccuracy,
    totalAnswers,
    distinctSessions,
    isStrongSkill,
    isWeakSkill,
    lastEvaluatedAt: evalTime,
    algorithmVersion: MASTERY_ALGORITHM_VERSION
  };
}
