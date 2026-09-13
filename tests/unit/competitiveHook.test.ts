// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';

describe('useCompetitiveSession', () => {
  const secret = 'test-secret-12345';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
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
      result.current.submitAnswer('5');
    });

    act(() => {
      vi.advanceTimersByTime(60500);
    });

    expect(result.current.status).toBe('VALIDATED');
    expect(result.current.isGameOver).toBe(true);
    expect(onFinish).toHaveBeenCalled();
    expect(result.current.resultOutput).not.toBeNull();
  });

  it('updates survival timer dynamically on answers and caps at 60000ms', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({ mode: 'survival', secret })
    );

    expect(result.current.timeRemainingMs).toBe(60000);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timeRemainingMs).toBe(55000);

    act(() => {
      result.current.submitAnswer('12');
    });

    // Submitting answer updates timer and caps at 60000ms
    expect(result.current.timeRemainingMs).toBeLessThanOrEqual(60000);
  });
});
