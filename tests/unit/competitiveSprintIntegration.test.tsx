// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('CompetitivePlayScreen Sprint integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts local practice for under-13 with zero API calls', async () => {
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
        mode="sprint"
        secret="test_sec"
        apiClient={mockApiClient}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Lokal Aman/i)).toBeInTheDocument();
    expect(mockApiClient.createSession).not.toHaveBeenCalled();
  });

  it('initializes ranked session and displays server prompt when eligible', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: true,
      executionMode: 'ranked',
    });

    const mockApiClient = {
      createSession: vi.fn().mockResolvedValue({
        session: {
          sessionId: 'sess_sprint_123',
          mode: 'sprint',
          rulesVersion: '2.0.0',
          contentVersion: '72L-v1',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000,
          isRanked: true,
        },
        questions: [
          {
            questionInstanceId: 'q1',
            sequence: 1,
            renderedPrompt: '12 + 13',
            answerInputKind: 'numeric',
            questionToken: 'tok_sprint_1',
          },
        ],
      }),
      submitAnswer: vi.fn(),
      submitSession: vi.fn(),
    } as any;

    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret="test_sec"
        apiClient={mockApiClient}
        onExit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockApiClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'sprint' })
      );
    });

    expect(await screen.findByText('12 + 13')).toBeInTheDocument();
    expect(screen.getByText(/Ranked/i)).toBeInTheDocument();
  });

  it('falls back to local practice when createSession fails', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: true,
      executionMode: 'ranked',
    });

    const mockApiClient = {
      createSession: vi.fn().mockRejectedValue(new Error('Network unavailable')),
      submitAnswer: vi.fn(),
      submitSession: vi.fn(),
    } as any;

    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret="test_sec"
        apiClient={mockApiClient}
        onExit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockApiClient.createSession).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Mode Lokal Aman/i)).toBeInTheDocument();
  });
});
