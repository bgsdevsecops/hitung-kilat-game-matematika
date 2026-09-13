import {
  CompetitiveSessionContract,
  SubmittedAnswerPayload,
  CompetitiveResultDoc,
} from './types';
import { Question } from '../types/question';
import { evaluateAnswer } from '../evaluator';
import { generateQuestionToken } from './stateMachine';
import { calculateSprintScore, calculateDailyScore } from './scoring';
import { getSprintDifficulty } from './modes/sprint';
import {
  getSurvivalDifficulty,
  applySurvivalTimerStep,
  SURVIVAL_INITIAL_TIMER_MS,
  SURVIVAL_HARD_CAP_MS,
} from './modes/survival';
import { DAILY_HARD_DEADLINE_MS } from './modes/daily';

export interface ValidationInput {
  session: CompetitiveSessionContract;
  serverQuestions: Map<number, Question>;
  submittedAnswers: SubmittedAnswerPayload[];
  serverTimestamps: {
    startedAt: number;
    finalizedAt: number;
    receivedAnswerTimes: Map<number, number>;
  };
}

export interface ValidationOutput {
  status: 'VALIDATED' | 'REJECTED';
  rejectionReasons: string[];
  canonicalMetrics: {
    score: number;
    accuracy: number;
    correctCount: number;
    wrongCount: number;
    questionsAnswered: number;
    rankedActiveDurationMs: number;
    maxStreak: number;
    difficultyReached: number;
  };
  leaderboardEligible: boolean;
  result: CompetitiveResultDoc;
}

function isAnswerCorrect(rawInput: string, answerSpec: any): boolean {
  if (!answerSpec) return false;
  const spec =
    answerSpec.kind === 'numeric'
      ? { ...answerSpec, kind: 'integer' }
      : answerSpec;

  try {
    const res = evaluateAnswer(spec, rawInput);
    if (res && typeof res === 'object') {
      if ('isCorrect' in res) return Boolean(res.isCorrect);
      if ('status' in res) return (res as any).status === 'CORRECT';
    }
  } catch {
    // Fallback if parameter order is inverted
  }

  try {
    const res = (evaluateAnswer as any)(rawInput, spec);
    if (res && typeof res === 'object') {
      if ('isCorrect' in res) return Boolean(res.isCorrect);
      if ('status' in res) return (res as any).status === 'CORRECT';
    }
  } catch {
    // Ignore
  }

  return false;
}

export function validateCompetitiveSession(
  input: ValidationInput,
  secret: string
): ValidationOutput {
  const reasons: string[] = [];
  const { session, serverQuestions, submittedAnswers, serverTimestamps } = input;

  // 1. Sequence Contiguity Check
  for (let i = 0; i < submittedAnswers.length; i++) {
    const expectedSeq = i + 1;
    const ans = submittedAnswers[i];
    if (ans.sequence !== expectedSeq) {
      reasons.push(`Sequence non-contiguous: expected ${expectedSeq}, got ${ans.sequence}`);
      break;
    }
  }

  // 2. Token Integrity & Server Question Existence
  for (const ans of submittedAnswers) {
    const q = serverQuestions.get(ans.sequence);
    if (!q) {
      reasons.push(`Unknown question sequence ${ans.sequence}`);
      continue;
    }
    const instanceId = ((q as any).id || (q as any).questionInstanceId || '') as string;
    const expectedToken = generateQuestionToken(session.sessionId, ans.sequence, instanceId, secret);
    if (ans.questionToken !== expectedToken) {
      reasons.push(`Invalid question token for sequence ${ans.sequence}`);
    }
  }

  // 3. Deadline Check
  const maxAllowedTime = session.serverDeadlineAt;
  for (const ans of submittedAnswers) {
    const serverReceived =
      serverTimestamps.receivedAnswerTimes?.get(ans.sequence) ?? serverTimestamps.finalizedAt;
    if (serverReceived > maxAllowedTime + 500) {
      // 500ms grace window for network transit
      reasons.push(`Answer sequence ${ans.sequence} received after server deadline`);
    }
  }

  // 4. Authoritative Evaluation & Metrics
  let correctCount = 0;
  let wrongCount = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  let totalScore = 0;
  let survivalTimerMs = SURVIVAL_INITIAL_TIMER_MS;
  let difficultyReached = 1;

  for (const ans of submittedAnswers) {
    const q = serverQuestions.get(ans.sequence);
    if (!q) continue;

    const isCorrect = isAnswerCorrect(ans.rawInput, q.answerSpec);

    if (isCorrect) {
      correctCount++;
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);

      if (session.mode === 'sprint') {
        const diff = getSprintDifficulty(correctCount);
        difficultyReached = Math.max(difficultyReached, diff);
        totalScore += calculateSprintScore(diff, currentStreak);
      } else if (session.mode === 'survival') {
        const diff = getSurvivalDifficulty(correctCount);
        difficultyReached = Math.max(difficultyReached, diff);
        totalScore += calculateSprintScore(diff, currentStreak);
        survivalTimerMs = applySurvivalTimerStep(survivalTimerMs, true);
      }
    } else {
      wrongCount++;
      currentStreak = 0;
      if (session.mode === 'survival') {
        survivalTimerMs = applySurvivalTimerStep(survivalTimerMs, false);
      }
    }
  }

  const questionsAnswered = correctCount + wrongCount;
  const accuracy = questionsAnswered > 0 ? (correctCount / questionsAnswered) * 100 : 0;

  // Active duration calculation
  let rankedActiveDurationMs = serverTimestamps.finalizedAt - serverTimestamps.startedAt;
  if (session.mode === 'daily') {
    if (questionsAnswered === 10) {
      const lastAnswerTime =
        serverTimestamps.receivedAnswerTimes?.get(10) ?? serverTimestamps.finalizedAt;
      rankedActiveDurationMs = Math.min(
        DAILY_HARD_DEADLINE_MS,
        Math.max(0, lastAnswerTime - serverTimestamps.startedAt)
      );
    } else {
      rankedActiveDurationMs = DAILY_HARD_DEADLINE_MS;
    }
    const dailyScoreRes = calculateDailyScore(correctCount, maxStreak, rankedActiveDurationMs);
    totalScore = dailyScoreRes.score;
  } else if (session.mode === 'sprint') {
    rankedActiveDurationMs = Math.min(60000, Math.max(0, rankedActiveDurationMs));
  } else if (session.mode === 'survival') {
    rankedActiveDurationMs = Math.min(SURVIVAL_HARD_CAP_MS, Math.max(0, rankedActiveDurationMs));
  }

  const isValid = reasons.length === 0;
  const status = isValid ? 'VALIDATED' : 'REJECTED';

  const result: CompetitiveResultDoc = {
    resultId: `res_${session.sessionId}`,
    sessionId: session.sessionId,
    userId: session.userId,
    mode: session.mode,
    status,
    isRanked: session.isRanked && isValid,
    score: totalScore,
    accuracy,
    correctCount,
    wrongCount,
    questionsAnswered,
    rankedActiveDurationMs,
    maxStreak,
    difficultyReached,
    rejectionReasons: reasons,
    finalizedAt: serverTimestamps.finalizedAt,
    rulesVersion: session.rulesVersion,
    contentVersion: session.contentVersion,
    challengeId: session.challengeId,
  };

  return {
    status,
    rejectionReasons: reasons,
    canonicalMetrics: {
      score: totalScore,
      accuracy,
      correctCount,
      wrongCount,
      questionsAnswered,
      rankedActiveDurationMs,
      maxStreak,
      difficultyReached,
    },
    leaderboardEligible: isValid && session.isRanked,
    result,
  };
}
