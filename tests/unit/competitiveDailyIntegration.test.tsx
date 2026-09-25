// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DailyHubView } from '../../src/components/daily/DailyHubView';
import { DailyChallengeScreen } from '../../src/components/DailyChallengeScreen';
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

describe('DailyHubView leaderboard integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT fetch or show bot leaderboard for under-13 users', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    const mockApiClient = {
      getLeaderboard: vi.fn(),
    } as any;

    render(
      <DailyHubView
        selectedDate="2026-09-26"
        onSelectDate={vi.fn()}
        todayDateStr="2026-09-26"
        countdown={{ hours: 5, minutes: 0, seconds: 0, ms: 0 }}
        userState={{ history: {}, currentStreak: 0, bestStreak: 0, lastCompletedDate: null }}
        onStartChallenge={vi.fn()}
        onExit={vi.fn()}
        onOpenStats={vi.fn()}
        apiClient={mockApiClient}
      />
    );

    // Should NOT show bot names as real players
    expect(screen.queryByText(/Budi Kilat/i)).toBeNull();
    expect(
      screen.getByText(/Papan peringkat hanya tersedia untuk pemain terverifikasi/i)
    ).toBeInTheDocument();
    expect(mockApiClient.getLeaderboard).not.toHaveBeenCalled();
  });

  it('fetches and displays server leaderboard when user is eligible', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: true,
      executionMode: 'ranked',
    });

    const mockApiClient = {
      getLeaderboard: vi.fn().mockResolvedValue({
        periodKey: '2026-09-26',
        mode: 'daily',
        entries: [
          {
            rank: 1,
            pseudonym: 'KilatMaster',
            score: 1000,
            durationMs: 45000,
            accuracy: 100,
            countryFlag: '🇮🇩',
          },
        ],
      }),
    } as any;

    render(
      <DailyHubView
        selectedDate="2026-09-26"
        onSelectDate={vi.fn()}
        todayDateStr="2026-09-26"
        countdown={{ hours: 5, minutes: 0, seconds: 0, ms: 0 }}
        userState={{ history: {}, currentStreak: 0, bestStreak: 0, lastCompletedDate: null }}
        onStartChallenge={vi.fn()}
        onExit={vi.fn()}
        onOpenStats={vi.fn()}
        apiClient={mockApiClient}
      />
    );

    await waitFor(() => {
      expect(mockApiClient.getLeaderboard).toHaveBeenCalledWith('2026-09-26', 'daily');
    });

    expect(await screen.findByText('KilatMaster')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });
});

describe('DailyChallengeScreen start flow integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts practice arena without calling createSession for under-13 users', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    const mockApiClient = {
      createSession: vi.fn(),
      getLeaderboard: vi.fn(),
    } as any;

    render(
      <DailyChallengeScreen
        onExit={vi.fn()}
        onOpenStats={vi.fn()}
        apiClient={mockApiClient}
      />
    );

    const startBtn = screen.getByRole('button', { name: /Mulai Tantangan/i });
    fireEvent.click(startBtn);

    // Arena should display question prompt and keypad
    expect(await screen.findByLabelText(/Jawaban Anda/i)).toBeInTheDocument();
    expect(mockApiClient.createSession).not.toHaveBeenCalled();
  });

  it('creates ranked session on server for eligible users', async () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: true,
      executionMode: 'ranked',
    });

    const mockApiClient = {
      createSession: vi.fn().mockResolvedValue({
        session: {
          sessionId: 'sess_daily_123',
          mode: 'daily',
          rulesVersion: '2.0.0',
          contentVersion: '72L-v1',
          serverStartedAt: 1000,
          serverDeadlineAt: 91000,
          isRanked: true,
        },
        questions: [
          {
            questionInstanceId: 'q1',
            sequence: 1,
            renderedPrompt: '45 + 55',
            answerInputKind: 'numeric',
            questionToken: 'tok_daily_1',
          },
        ],
      }),
      getLeaderboard: vi.fn().mockResolvedValue({ entries: [] }),
    } as any;

    render(
      <DailyChallengeScreen
        onExit={vi.fn()}
        onOpenStats={vi.fn()}
        apiClient={mockApiClient}
      />
    );

    const startBtn = screen.getByRole('button', { name: /Mulai Tantangan/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockApiClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'daily' })
      );
    });

    expect(await screen.findByText('45 + 55')).toBeInTheDocument();
  });
});
