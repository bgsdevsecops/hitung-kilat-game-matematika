import { CompetitiveResultDoc, LeaderboardEntryDoc } from './types';
import {
  compareSprintRecords,
  compareSurvivalRecords,
  compareDailyRecords,
} from './scoring';
import { sha256 } from './crypto';

export function generateLeaderboardSubjectId(userId: string, secret: string): string {
  return sha256(`subj:${userId}:${secret}`).slice(0, 8);
}

export function generateLeaderboardEntryId(
  mode: string,
  periodKey: string,
  rulesVersion: string,
  contentVersion: string,
  subjectId: string
): string {
  return `${mode}_${periodKey}_${rulesVersion}_${contentVersion}_${subjectId}`;
}

export function projectToLeaderboardEntry(
  result: CompetitiveResultDoc,
  pseudonym: string,
  periodKey: string,
  secret: string
): LeaderboardEntryDoc {
  const subjectId = generateLeaderboardSubjectId(result.userId, secret);
  const entryId = generateLeaderboardEntryId(
    result.mode,
    periodKey,
    result.rulesVersion,
    result.contentVersion,
    subjectId
  );

  return {
    entryId,
    mode: result.mode,
    periodKey,
    rulesVersion: result.rulesVersion,
    contentVersion: result.contentVersion,
    pseudonym: pseudonym.trim() || 'Pemain Kilat',
    score: result.score,
    accuracy: result.accuracy,
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    durationMs: result.rankedActiveDurationMs,
    finalizedAt: result.finalizedAt,
    resultId: result.resultId,
  };
}

function entryToStubResult(e: LeaderboardEntryDoc): CompetitiveResultDoc {
  return {
    resultId: e.resultId,
    sessionId: '',
    userId: '',
    mode: e.mode,
    status: 'VALIDATED',
    isRanked: true,
    score: e.score,
    accuracy: e.accuracy,
    correctCount: e.correctCount,
    wrongCount: e.wrongCount,
    questionsAnswered: e.correctCount + e.wrongCount,
    rankedActiveDurationMs: e.durationMs,
    maxStreak: 0,
    difficultyReached: 1,
    rejectionReasons: [],
    finalizedAt: e.finalizedAt,
    rulesVersion: e.rulesVersion,
    contentVersion: e.contentVersion,
  };
}

export function shouldReplaceLeaderboardEntry(
  existing: LeaderboardEntryDoc | null,
  candidate: LeaderboardEntryDoc
): boolean {
  if (!existing) return true;
  const resExisting = entryToStubResult(existing);
  const resCandidate = entryToStubResult(candidate);

  if (candidate.mode === 'sprint') {
    return compareSprintRecords(resCandidate, resExisting) < 0;
  }
  if (candidate.mode === 'survival') {
    return compareSurvivalRecords(resCandidate, resExisting) < 0;
  }
  return compareDailyRecords(resCandidate, resExisting) < 0;
}
