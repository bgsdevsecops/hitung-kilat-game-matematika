import { describe, it, expect } from 'vitest';
import {
  gameplaySessionReducer,
  createInitialSessionState,
  calculateSessionStars,
} from '../../src/engine/session/reducer';
import { Question, LevelConfigV2 } from '../../src/engine/types';

describe('GameplaySessionReducer', () => {
  const dummyLevel: LevelConfigV2 = {
    id: 'T1-ADD-01',
    order: 1,
    tier: 1,
    title: 'Level 1',
    description: '',
    generatorKey: 'addition',
    rules: { kind: 'addition', minA: 1, maxA: 5, minB: 1, maxB: 5 },
    answerKind: 'integer',
    difficulty: 1,
    questionCount: 2,
    targetTimeSec: 10,
    timeLimitSec: 20,
    boss: false,
    passingAccuracy: 70,
    prerequisiteIds: [],
    primarySkillId: 'addition.basic',
    skillTags: ['addition'],
    contentVersion: '2.0.0',
  };

  const dummyQuestions: Question[] = [
    {
      questionDefinitionId: 'q1',
      questionInstanceId: 'T1-ADD-01:1',
      displayPrompt: '2 + 3',
      answerSpec: { kind: 'integer', value: 5 },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: 'addition',
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: '2 + 3 = 5',
    },
    {
      questionDefinitionId: 'q2',
      questionInstanceId: 'T1-ADD-01:2',
      displayPrompt: '4 + 4',
      answerSpec: { kind: 'integer', value: 8 },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: 'addition',
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: '4 + 4 = 8',
    },
  ];

  it('starts session and transitions from CREATED to ACTIVE', () => {
    let state = createInitialSessionState('sess-1', dummyLevel, dummyQuestions);
    expect(state.lifecycle).toBe('CREATED');

    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);
    expect(state.lifecycle).toBe('ACTIVE');
    expect(state.startedAtMonotonic).toBe(1000);
    expect(state.deadlineMonotonic).toBe(1000 + dummyLevel.timeLimitSec * 1000);
    expect(state.inputLocked).toBe(false);
  });

  it('evaluates answers and transitions to COMPLETED on last answer without undercount', () => {
    let state = createInitialSessionState('sess-1', dummyLevel, dummyQuestions);
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    // Answer Q1 correctly
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '5', responseTimeMs: 1500, monotonicNow: 2500 },
      dummyLevel
    );
    expect(state.score).toBeGreaterThan(0);
    expect(state.streak).toBe(1);
    expect(state.currentIndex).toBe(1);

    // Answer Q2 correctly (final answer)
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '8', responseTimeMs: 1200, monotonicNow: 3700 },
      dummyLevel
    );

    expect(state.lifecycle).toBe('COMPLETED');
    expect(state.result).not.toBeNull();
    expect(state.result?.correctCount).toBe(2);
    expect(state.result?.wrongCount).toBe(0);
    expect(state.result?.unansweredCount).toBe(0);
    expect(state.result?.accuracy).toBe(100);
    expect(state.result?.stars).toBe(3);
    expect(state.result?.perfect).toBe(true);
  });

  it('locks input when deadline is reached and records remaining as unanswered', () => {
    let state = createInitialSessionState('sess-1', dummyLevel, dummyQuestions);
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    // Answer Q1
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '5', responseTimeMs: 1500, monotonicNow: 2500 },
      dummyLevel
    );

    // Timeout before answering Q2
    state = gameplaySessionReducer(
      state,
      { type: 'DEADLINE_REACHED', monotonicNow: 21000 },
      dummyLevel
    );

    expect(state.lifecycle).toBe('FAILED');
    expect(state.inputLocked).toBe(true);
    expect(state.result?.correctCount).toBe(1);
    expect(state.result?.unansweredCount).toBe(1);
    expect(state.result?.stars).toBe(0);
  });

  it('handles wrong answers with streak reset and score calculation', () => {
    let state = createInitialSessionState('sess-2', dummyLevel, dummyQuestions);
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    // Wrong answer on Q1
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '999', responseTimeMs: 1000, monotonicNow: 2000 },
      dummyLevel
    );
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.currentIndex).toBe(1);
    expect(state.lastFeedback?.isCorrect).toBe(false);

    // Correct answer on Q2
    state = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '8', responseTimeMs: 1000, monotonicNow: 3000 },
      dummyLevel
    );
    expect(state.lifecycle).toBe('COMPLETED');
    expect(state.result?.correctCount).toBe(1);
    expect(state.result?.wrongCount).toBe(1);
    expect(state.result?.accuracy).toBe(50);
    expect(state.result?.perfect).toBe(false);
  });

  it('abandons active session properly', () => {
    let state = createInitialSessionState('sess-3', dummyLevel, dummyQuestions);
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    state = gameplaySessionReducer(
      state,
      { type: 'ABANDON_SESSION', monotonicNow: 2000 },
      dummyLevel
    );
    expect(state.lifecycle).toBe('ABANDONED');
    expect(state.inputLocked).toBe(true);
  });

  it('handles UNLOCK_INPUT action', () => {
    let state = createInitialSessionState('sess-4', dummyLevel, dummyQuestions);
    state.inputLocked = true;

    state = gameplaySessionReducer(state, { type: 'UNLOCK_INPUT' }, dummyLevel);
    expect(state.inputLocked).toBe(false);
  });

  it('ignores actions when in invalid lifecycle states or input locked', () => {
    let state = createInitialSessionState('sess-5', dummyLevel, dummyQuestions);

    // Submit before start
    const beforeStart = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '5', responseTimeMs: 1000, monotonicNow: 1000 },
      dummyLevel
    );
    expect(beforeStart).toBe(state);

    // Start session
    state = gameplaySessionReducer(state, { type: 'START_SESSION', monotonicNow: 1000 }, dummyLevel);

    // Start again when already active
    const startAgain = gameplaySessionReducer(
      state,
      { type: 'START_SESSION', monotonicNow: 2000 },
      dummyLevel
    );
    expect(startAgain).toBe(state);

    // Submit when input locked
    state.inputLocked = true;
    const lockedSubmit = gameplaySessionReducer(
      state,
      { type: 'SUBMIT_ANSWER', rawInput: '5', responseTimeMs: 1000, monotonicNow: 2000 },
      dummyLevel
    );
    expect(lockedSubmit).toBe(state);
  });

  describe('calculateSessionStars', () => {
    it('returns 0 if not completed', () => {
      expect(calculateSessionStars(100, 5, 10, false, false)).toBe(0);
    });

    it('returns 3 stars for >=95% accuracy within target time', () => {
      expect(calculateSessionStars(100, 8, 10, true, false)).toBe(3);
      expect(calculateSessionStars(95, 10, 10, true, false)).toBe(3);
    });

    it('returns 2 stars for >=85% accuracy or >=95% taking longer than target time', () => {
      expect(calculateSessionStars(90, 8, 10, true, false)).toBe(2);
      expect(calculateSessionStars(95, 12, 10, true, false)).toBe(2);
    });

    it('returns 1 star for >=70% accuracy', () => {
      expect(calculateSessionStars(70, 8, 10, true, false)).toBe(1);
      expect(calculateSessionStars(84, 15, 10, true, false)).toBe(1);
    });

    it('returns 0 stars for <70% accuracy', () => {
      expect(calculateSessionStars(69, 5, 10, true, false)).toBe(0);
    });

    it('handles boss level star calculations', () => {
      expect(calculateSessionStars(95, 5, 10, true, true)).toBe(3);
      expect(calculateSessionStars(85, 5, 10, true, true)).toBe(2);
      expect(calculateSessionStars(70, 5, 10, true, true)).toBe(1);
      expect(calculateSessionStars(65, 5, 10, true, true)).toBe(0);
    });
  });
});
