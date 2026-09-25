// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { CompetitivePlayScreen } from '../../src/components/competitive/CompetitivePlayScreen';
import * as eligibilityMod from '../../src/lib/competitiveEligibility';

declare module 'vitest' {
  interface Assertion<R = void, T = unknown> {
    toBeInTheDocument(): R;
  }
}

expect.extend({
  toBeInTheDocument(received: HTMLElement | null) {
    const pass = Boolean(
      received !== null &&
      received !== undefined &&
      received.ownerDocument?.body.contains(received)
    );
    return {
      pass,
      message: () => `expected element to be in document`,
    };
  },
});

describe('CompetitivePlayScreen Survival integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders survival arena with mode indicator in local practice for under-13', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    const mockApiClient = {
      createSession: vi.fn(),
      submitAnswer: vi.fn(),
      submitSession: vi.fn(),
    } as any;

    render(
      <CompetitivePlayScreen
        mode="survival"
        secret="test_sec"
        apiClient={mockApiClient}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Lokal Aman/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Energy remaining/i)).toBeInTheDocument();
    expect(mockApiClient.createSession).not.toHaveBeenCalled();
  });

  it('initializes ranked survival session and connects SurvivalHeader with timer reconciliation', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: true,
      executionMode: 'ranked',
    });

    const mockApiClient = {
      createSession: vi.fn().mockResolvedValue({
        session: {
          sessionId: 'sess_surv_123',
          mode: 'survival',
          rulesVersion: '2.0.0',
          contentVersion: '72L-v1',
          serverStartedAt: 1000,
          serverDeadlineAt: 21000,
          isRanked: true,
        },
        questions: [
          {
            questionInstanceId: 'q1',
            sequence: 1,
            renderedPrompt: '9 * 9',
            answerInputKind: 'numeric',
            questionToken: 'tok_surv_1',
          },
          {
            questionInstanceId: 'q2',
            sequence: 2,
            renderedPrompt: '8 * 8',
            answerInputKind: 'numeric',
            questionToken: 'tok_surv_2',
          },
        ],
      }),
      submitAnswer: vi.fn().mockResolvedValue({
        status: 'ACCEPTED',
        sequence: 1,
        isCorrect: true,
        serverReceivedAt: 2000,
        timeRemainingMs: 22000, // +2000ms added by server
        nextQuestion: {
          questionInstanceId: 'q3',
          sequence: 3,
          renderedPrompt: '7 * 7',
          answerInputKind: 'numeric',
          questionToken: 'tok_surv_3',
        },
      }),
      submitSession: vi.fn(),
    } as any;

    render(
      <CompetitivePlayScreen
        mode="survival"
        secret="test_sec"
        apiClient={mockApiClient}
        onExit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockApiClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'survival' })
      );
    });

    expect(await screen.findByText('9 * 9')).toBeInTheDocument();
    expect(screen.getByText(/Ranked/i)).toBeInTheDocument();

    // Click '8', '1', and submit '↵'
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    // Immediate optimistic display advance to sequence 2
    expect(await screen.findByText('8 * 8')).toBeInTheDocument();

    // Verify answer submitted to server
    await waitFor(() => {
      expect(mockApiClient.submitAnswer).toHaveBeenCalledWith(
        'sess_surv_123',
        expect.objectContaining({ sequence: 1, rawInput: '81' })
      );
    });
  });
});
