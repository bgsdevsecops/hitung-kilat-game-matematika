import { SessionState, SessionResult, AnswerEvent } from '../types/session';
import { LevelConfigV2 } from '../types/level';
import { Question } from '../types/question';
import { evaluateAnswer } from '../evaluator/answerEvaluator';

export type SessionAction =
  | { type: 'START_SESSION'; monotonicNow: number }
  | { type: 'SUBMIT_ANSWER'; rawInput: string; responseTimeMs: number; monotonicNow: number }
  | { type: 'DEADLINE_REACHED'; monotonicNow: number }
  | { type: 'ABANDON_SESSION'; monotonicNow: number }
  | { type: 'UNLOCK_INPUT' };

export function createInitialSessionState(
  sessionId: string,
  levelConfig: LevelConfigV2,
  questions: Question[]
): SessionState {
  return {
    sessionId,
    lifecycle: 'CREATED',
    levelId: levelConfig.id,
    questions,
    currentIndex: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    inputLocked: false,
    answerHistory: [],
    startedAtMonotonic: 0,
    deadlineMonotonic: 0,
    lastFeedback: null,
    result: null,
  };
}

export function calculateSessionStars(
  accuracy: number,
  totalTimeSec: number,
  targetTimeSec: number,
  isCompleted: boolean,
  boss: boolean
): 0 | 1 | 2 | 3 {
  if (!isCompleted) return 0;
  if (boss) {
    if (accuracy >= 95 && totalTimeSec <= targetTimeSec) return 3;
    if (accuracy >= 85) return 2;
    if (accuracy >= 70) return 1;
    return 0;
  }

  if (accuracy >= 95 && totalTimeSec <= targetTimeSec) return 3;
  if (accuracy >= 85) return 2;
  if (accuracy >= 70) return 1;
  return 0;
}

export function gameplaySessionReducer(
  state: SessionState,
  action: SessionAction,
  levelConfig: LevelConfigV2
): SessionState {
  switch (action.type) {
    case 'START_SESSION': {
      if (state.lifecycle !== 'CREATED') return state;
      return {
        ...state,
        lifecycle: 'ACTIVE',
        startedAtMonotonic: action.monotonicNow,
        deadlineMonotonic: action.monotonicNow + levelConfig.timeLimitSec * 1000,
        inputLocked: false,
      };
    }

    case 'UNLOCK_INPUT': {
      return { ...state, inputLocked: false };
    }

    case 'SUBMIT_ANSWER': {
      if (state.lifecycle !== 'ACTIVE' || state.inputLocked) return state;

      const currentQ = state.questions[state.currentIndex];
      if (!currentQ) return state;

      const evalResult = evaluateAnswer(currentQ.answerSpec, action.rawInput);
      const isCorrect = evalResult.isCorrect;

      const newStreak = isCorrect ? state.streak + 1 : 0;
      const newMaxStreak = Math.max(state.maxStreak, newStreak);
      const points = isCorrect ? 100 + Math.min(newStreak * 10, 50) : 0;
      const newScore = state.score + points;

      const event: AnswerEvent = {
        eventId: `${state.sessionId}:${state.currentIndex + 1}`,
        questionInstanceId: currentQ.questionInstanceId,
        questionDefinitionId: currentQ.questionDefinitionId,
        submittedAnswer: action.rawInput,
        isCorrect,
        responseTimeMs: action.responseTimeMs,
        primarySkillId: currentQ.primarySkillId,
        skillTags: currentQ.skillTags,
        submittedAtMonotonic: action.monotonicNow,
      };

      const updatedHistory = [...state.answerHistory, event];
      const isLastQuestion = state.currentIndex + 1 >= state.questions.length;

      if (isLastQuestion) {
        // Finalize immediately
        const correctCount = updatedHistory.filter((h) => h.isCorrect).length;
        const wrongCount = updatedHistory.length - correctCount;
        const unansweredCount = 0;
        const accuracy = Math.round((correctCount / updatedHistory.length) * 100);
        const totalTimeSec = Math.max(
          1,
          Math.round((action.monotonicNow - state.startedAtMonotonic) / 1000)
        );
        const avgResponseTimeMs = Math.round(
          updatedHistory.reduce((acc, h) => acc + h.responseTimeMs, 0) / updatedHistory.length
        );
        const stars = calculateSessionStars(
          accuracy,
          totalTimeSec,
          levelConfig.targetTimeSec,
          true,
          levelConfig.boss
        );
        const perfect = correctCount === updatedHistory.length && totalTimeSec <= levelConfig.targetTimeSec;

        const result: SessionResult = {
          sessionId: state.sessionId,
          levelId: state.levelId,
          sessionStatus: 'COMPLETED',
          questionsPresented: state.questions.length,
          questionsAnswered: updatedHistory.length,
          correctCount,
          wrongCount,
          unansweredCount,
          accuracy,
          score: newScore,
          totalTimeSec,
          avgResponseTimeMs,
          maxCombo: newMaxStreak,
          stars,
          perfect,
          history: updatedHistory,
        };

        return {
          ...state,
          lifecycle: 'COMPLETED',
          score: newScore,
          streak: newStreak,
          maxStreak: newMaxStreak,
          inputLocked: true,
          answerHistory: updatedHistory,
          lastFeedback: { isCorrect, explanation: currentQ.explanation },
          result,
        };
      }

      return {
        ...state,
        currentIndex: state.currentIndex + 1,
        score: newScore,
        streak: newStreak,
        maxStreak: newMaxStreak,
        inputLocked: false,
        answerHistory: updatedHistory,
        lastFeedback: { isCorrect, explanation: currentQ.explanation },
      };
    }

    case 'DEADLINE_REACHED': {
      if (state.lifecycle !== 'ACTIVE') return state;

      const correctCount = state.answerHistory.filter((h) => h.isCorrect).length;
      const wrongCount = state.answerHistory.length - correctCount;
      const unansweredCount = state.questions.length - state.answerHistory.length;
      const answeredTotal = state.answerHistory.length;
      const accuracy = answeredTotal > 0 ? Math.round((correctCount / answeredTotal) * 100) : 0;
      const totalTimeSec = levelConfig.timeLimitSec;
      const avgResponseTimeMs =
        answeredTotal > 0
          ? Math.round(state.answerHistory.reduce((acc, h) => acc + h.responseTimeMs, 0) / answeredTotal)
          : 0;

      const result: SessionResult = {
        sessionId: state.sessionId,
        levelId: state.levelId,
        sessionStatus: 'FAILED',
        questionsPresented: state.questions.length,
        questionsAnswered: answeredTotal,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
        score: state.score,
        totalTimeSec,
        avgResponseTimeMs,
        maxCombo: state.maxStreak,
        stars: 0,
        perfect: false,
        history: state.answerHistory,
      };

      return {
        ...state,
        lifecycle: 'FAILED',
        inputLocked: true,
        result,
      };
    }

    case 'ABANDON_SESSION': {
      if (state.lifecycle !== 'ACTIVE') return state;

      return {
        ...state,
        lifecycle: 'ABANDONED',
        inputLocked: true,
      };
    }
  }
}
