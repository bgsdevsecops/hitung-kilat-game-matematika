// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';
import * as questionGenModule from '../../src/engine/competitive/questionGenerator';

describe('useCompetitiveSession', () => {
  const secret = 'test-secret-12345';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with active status and 5 pre-buffered question views', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret })
    );

    expect(result.current.status).toBe('ACTIVE');
    expect(result.current.bufferedCount).toBe(5);
    expect(result.current.currentQuestion).not.toBeNull();
    expect(result.current.currentQuestion?.sequence).toBe(1);
    expect(result.current.comboStreak).toBe(0);
    expect(result.current.difficultyReached).toBe(1);
    expect(result.current.isGameOver).toBe(false);
  });

  it('advances question buffer optimistically on answer submission maintaining 5 views', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret })
    );

    const firstQuestion = result.current.currentQuestion;
    expect(firstQuestion).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('10');
    });

    expect(result.current.currentQuestion?.sequence).toBe(2);
    expect(result.current.bufferedCount).toBe(5);
  });

  it('finalizes sprint session automatically when timer reaches 0', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret, onFinish })
    );

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('5');
    });

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.status).toBe('VALIDATED');
    expect(result.current.isGameOver).toBe(true);
    expect(onFinish).toHaveBeenCalled();
    expect(result.current.resultOutput).not.toBeNull();
  });

  it('updates survival timer dynamically on answers and caps at 60000ms', () => {
    // Spy question generator to return answerSpec with known value
    vi.spyOn(questionGenModule, 'generateCompetitiveQuestions').mockImplementation((tier, count) => {
      return Array.from({ length: count }, (_, idx) => ({
        id: `q_known_${idx + 1}`,
        prompt: '6+6',
        displayPrompt: '6+6',
        difficulty: tier,
        skillId: 'add',
        subSkillId: 'add.1',
        answerSpec: { kind: 'integer', value: 12 },
      } as any));
    });

    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'survival', secret })
    );

    expect(result.current.timeRemainingMs).toBe(60000);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timeRemainingMs).toBe(55000);

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('12');
    });

    // Submitting correct answer adds +2000ms (55000 - 500 + 2000 = 56500) and caps at 60000ms
    expect(result.current.timeRemainingMs).toBe(56500);
    expect(result.current.timeRemainingMs).toBeLessThanOrEqual(60000);
  });

  it('applies wrong answer penalty (-4s) and decrements survival timer', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'survival', secret })
    );

    expect(result.current.timeRemainingMs).toBe(60000);

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('invalid_wrong_answer_99999');
    });

    // 60000 - 500 - 4000 = 55500
    expect(result.current.timeRemainingMs).toBe(55500);
  });

  it('increments combo streak on correct answer and resets to 0 on wrong answer', () => {
    vi.spyOn(questionGenModule, 'generateCompetitiveQuestions').mockImplementation((tier, count) => {
      return Array.from({ length: count }, (_, idx) => ({
        id: `q_test_${idx + 1}`,
        prompt: '1+1',
        displayPrompt: '1+1',
        difficulty: tier,
        skillId: 'add',
        subSkillId: 'add.1',
        answerSpec: { kind: 'integer', value: 2 },
      } as any));
    });

    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret })
    );

    expect(result.current.comboStreak).toBe(0);

    // Answer 1: correct ('2')
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('2');
    });

    expect(result.current.comboStreak).toBe(1);

    // Answer 2: wrong ('999')
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('999');
    });

    expect(result.current.comboStreak).toBe(0);
  });

  it('finalizes survival session automatically when timer reaches 0 from countdown', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'survival', secret, onFinish })
    );

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('wrong');
    });

    // Advance until timer hits 0 (55500ms remaining)
    act(() => {
      vi.advanceTimersByTime(56000);
    });

    expect(result.current.isGameOver).toBe(true);
    expect(result.current.status).toBe('VALIDATED');
    expect(onFinish).toHaveBeenCalled();
    expect(result.current.resultOutput).not.toBeNull();
  });

  it('immediately finalizes survival session if timer drops to 0 on penalty', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'survival', secret, onFinish })
    );

    // Advance until 3000ms remaining (advance by 57000ms)
    act(() => {
      vi.advanceTimersByTime(57000);
    });
    expect(result.current.timeRemainingMs).toBe(3000);

    // Wrong answer incurs -4000ms penalty, timer drops to 0 immediately
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.submitAnswer('wrong');
    });

    expect(result.current.timeRemainingMs).toBe(0);
    expect(result.current.isGameOver).toBe(true);
    expect(onFinish).toHaveBeenCalled();
  });

  it('calls onFinish and marks session rejected when abandonSession is triggered', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'sprint', secret, onFinish })
    );

    expect(result.current.isGameOver).toBe(false);

    act(() => {
      result.current.abandonSession();
    });

    expect(result.current.status).toBe('REJECTED');
    expect(result.current.isGameOver).toBe(true);
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'REJECTED' }));
    expect(result.current.resultOutput).not.toBeNull();
  });
});
