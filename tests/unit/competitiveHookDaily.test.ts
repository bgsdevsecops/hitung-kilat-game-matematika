// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';
import { generateDailyQuestions } from '../../src/utils/dailyWib';

describe('useCompetitiveSession - Daily Mode', () => {
  const secret = 'test-secret-daily-123';
  const challengeId = '2026-09-13@Asia/Jakarta:2.0.0';
  const questions = generateDailyQuestions(challengeId);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes daily session with 90,000ms countdown and 5 pre-buffered questions', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'daily',
        secret,
        challengeId,
        dailyQuestions: questions,
        isRanked: true,
      })
    );

    expect(result.current.status).toBe('ACTIVE');
    expect(result.current.timeRemainingMs).toBe(90000);
    expect(result.current.bufferedCount).toBe(5);
    expect(result.current.currentQuestion?.sequence).toBe(1);
    expect(result.current.currentQuestion?.renderedPrompt).toBe(questions[0].prompt);
  });

  it('auto-finalizes session and calculates 4-tier score upon completing 10th question', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'daily',
        secret,
        challengeId,
        dailyQuestions: questions,
        isRanked: true,
        onFinish,
      })
    );

    // Answer all 10 questions correctly
    for (let seq = 1; seq <= 10; seq++) {
      const currentQ = questions[seq - 1];
      act(() => {
        vi.advanceTimersByTime(2000); // 2s per question -> total active duration ~20s
        const isCorrect = result.current.submitAnswer(String(currentQ.answerSpec.value));
        expect(isCorrect).toBe(true);
      });
    }

    expect(result.current.isGameOver).toBe(true);
    expect(result.current.status).toBe('VALIDATED');
    expect(result.current.resultOutput).toBeDefined();

    const output = result.current.resultOutput!;
    expect(output.status).toBe('VALIDATED');
    expect(output.result.correctCount).toBe(10);
    expect(output.result.questionsAnswered).toBe(10);
    expect(output.result.maxStreak).toBe(10);
    expect(output.result.isRanked).toBe(true);
    // 10 correct: base 1200, streak 300, perfect 200, plus speed bonus
    expect(output.result.score).toBeGreaterThan(1700);
    expect(onFinish).toHaveBeenCalledWith(output);
  });

  it('finalizes session when 90s hard deadline expires', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'daily',
        secret,
        challengeId,
        dailyQuestions: questions,
        isRanked: true,
      })
    );

    // Answer 3 questions
    for (let seq = 1; seq <= 3; seq++) {
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.submitAnswer(String(questions[seq - 1].answerSpec.value));
      });
    }

    // Advance remaining time past 90s
    act(() => {
      vi.advanceTimersByTime(90000);
    });

    expect(result.current.isGameOver).toBe(true);
    expect(result.current.timeRemainingMs).toBe(0);
    expect(result.current.resultOutput?.result.questionsAnswered).toBe(3);
  });
});
