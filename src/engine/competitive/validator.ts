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
  SURVIVAL_MAX_HEARTBEAT_GAP_MS,
} from './modes/survival';
import { DAILY_HARD_DEADLINE_MS } from './modes/daily';
import { sha256 } from './crypto';

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
      serverTimestamps.receivedAnswerTimes?.get(ans.sequence) ??
      (serverTimestamps.startedAt + ans.clientAnsweredAt);
    if (serverReceived > maxAllowedTime + 500) {
      // 500ms grace window for network transit
      reasons.push(`Answer sequence ${ans.sequence} received after server deadline`);
    }
  }

  // 4. Sub-human Latency Anomaly Check
  for (const ans of submittedAnswers) {
    if (ans.inputLatencyMs < 120) {
      reasons.push(
        `Sub-human input latency detected for sequence ${ans.sequence} (${ans.inputLatencyMs}ms < 120ms)`
      );
    }
  }

  // 5. Survival Heartbeat Gap Check (AC-COMP-12)
  if (session.mode === 'survival') {
    let prevTime = serverTimestamps.startedAt;
    for (const ans of submittedAnswers) {
      const arrival =
        serverTimestamps.receivedAnswerTimes?.get(ans.sequence) ??
        (serverTimestamps.startedAt + ans.clientAnsweredAt);
      const gap = arrival - prevTime;
      if (gap > SURVIVAL_MAX_HEARTBEAT_GAP_MS) {
        reasons.push(
          `Survival heartbeat gap exceeded for sequence ${ans.sequence} (${gap}ms > ${SURVIVAL_MAX_HEARTBEAT_GAP_MS}ms)`
        );
      }
      prevTime = arrival;
    }
    const trailingGap = serverTimestamps.finalizedAt - prevTime;
    if (trailingGap > SURVIVAL_MAX_HEARTBEAT_GAP_MS) {
      reasons.push(
        `Survival heartbeat gap exceeded before finalization (${trailingGap}ms > ${SURVIVAL_MAX_HEARTBEAT_GAP_MS}ms)`
      );
    }
  }

  // 6. Non-empty answers check
  if (submittedAnswers.length === 0) {
    reasons.push('Session finalized with zero submitted answers');
  }

  // 6. Authoritative Evaluation & Metrics
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

    if (session.mode === 'survival' && survivalTimerMs <= 0) {
      reasons.push(`Answer sequence ${ans.sequence} submitted after survival timer expired`);
      continue;
    }

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
      const lastAns10 = submittedAnswers.find((a) => a.sequence === 10);
      const lastAnswerTime =
        serverTimestamps.receivedAnswerTimes?.get(10) ??
        (lastAns10
          ? serverTimestamps.startedAt + lastAns10.clientAnsweredAt
          : serverTimestamps.finalizedAt);
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

  const resultId = `res_${sha256(`res:${session.sessionId}`).slice(0, 16)}`;

  const result: CompetitiveResultDoc = {
    resultId,
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
