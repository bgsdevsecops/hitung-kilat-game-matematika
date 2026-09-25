// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompetitiveSession } from '../../src/hooks/useCompetitiveSession';

describe('useCompetitiveSession adapter', () => {
  it('defaults to practice mode when executionMode is not specified', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'sprint',
        secret: 'test_sec',
      })
    );
    expect(result.current.integrationStatus).toBe('practice_active');
    expect(result.current.isRankedSession).toBe(false);
  });

  it('initializes in ranked_active when executionMode is ranked with server questions', () => {
    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'sprint',
        secret: 'test_sec',
        executionMode: 'ranked',
        serverSessionId: 'sess_123',
        initialServerQuestions: [
          { questionInstanceId: 'q1', sequence: 1, renderedPrompt: '3 + 4', answerInputKind: 'numeric', questionToken: 'tok_1' },
          { questionInstanceId: 'q2', sequence: 2, renderedPrompt: '5 + 5', answerInputKind: 'numeric', questionToken: 'tok_2' },
        ],
      })
    );
    expect(result.current.integrationStatus).toBe('ranked_active');
    expect(result.current.isRankedSession).toBe(true);
    expect(result.current.currentQuestion?.renderedPrompt).toBe('3 + 4');
  });

  it('enqueues answer receipt and advances buffer seamlessly in ranked mode', async () => {
    const mockApiClient = {
      submitAnswer: vi.fn().mockResolvedValue({
        status: 'ACCEPTED',
        sequence: 1,
        isCorrect: true,
        serverReceivedAt: 2000,
        timeRemainingMs: 58000,
        nextQuestion: { questionInstanceId: 'q3', sequence: 3, renderedPrompt: '6 + 6', answerInputKind: 'numeric', questionToken: 'tok_3' },
      }),
      submitSession: vi.fn(),
    } as any;

    const { result } = renderHook(() =>
      useCompetitiveSession({
        mode: 'sprint',
        secret: 'test_sec',
        executionMode: 'ranked',
        serverSessionId: 'sess_123',
        apiClient: mockApiClient,
        initialServerQuestions: [
          { questionInstanceId: 'q1', sequence: 1, renderedPrompt: '3 + 4', answerInputKind: 'numeric', questionToken: 'tok_1' },
          { questionInstanceId: 'q2', sequence: 2, renderedPrompt: '5 + 5', answerInputKind: 'numeric', questionToken: 'tok_2' },
        ],
      })
    );

    act(() => {
      result.current.submitAnswer('7');
    });

    // Display immediately advances to sequence 2
    expect(result.current.currentQuestion?.sequence).toBe(2);

    // Wait for receipt queue to settle
    await vi.waitFor(() => {
      expect(mockApiClient.submitAnswer).toHaveBeenCalledWith(
        'sess_123',
        expect.objectContaining({ sequence: 1, rawInput: '7' })
      );
    });
  });
});
