// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeAttackLeaderboardTab } from '../../src/components/TimeAttackLeaderboardTab';
import { UserStats } from '../../src/types';
import * as firebaseLib from '../../src/lib/firebase';

vi.mock('../../src/lib/firebase', () => ({
  fetchTopTimeAttackScores: vi.fn().mockResolvedValue([]),
  submitTimeAttackScore: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/utils/sound', () => ({
  soundManager: {
    playClick: vi.fn(),
    playFanfare: vi.fn(),
  },
}));

const mockStats: UserStats = {
  totalSolved: 50,
  totalCorrect: 45,
  totalTimePlayedSec: 600,
  bestStreak: 12,
  highestTimeAttackScore: 500,
  highestSPM: 25,
  starsTotal: 20,
};

const mockUser: any = {
  uid: 'user-789',
  displayName: 'Test User',
};

describe('TimeAttackLeaderboardTab privacy guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders submission disabled badge and suppresses submit button when isSubmissionAllowed is false', () => {
    render(
      <TimeAttackLeaderboardTab
        stats={mockStats}
        currentUser={mockUser}
        playerName="Pemain Kilat"
        playerFlag="🇮🇩"
        onOpenSyncModal={vi.fn()}
        isSubmissionAllowed={false}
      />
    );

    expect(screen.getByText(/Pengiriman Dinonaktifkan \(Privasi\)/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Kirim \/ Perbarui Skor/i })).toBeNull();
  });

  it('renders submit button and allows submission when isSubmissionAllowed is true', async () => {
    render(
      <TimeAttackLeaderboardTab
        stats={mockStats}
        currentUser={mockUser}
        playerName="Pemain Kilat"
        playerFlag="🇮🇩"
        onOpenSyncModal={vi.fn()}
        isSubmissionAllowed={true}
      />
    );

    expect(screen.queryByText(/Pengiriman Dinonaktifkan \(Privasi\)/i)).toBeNull();
    const submitBtn = screen.getByRole('button', { name: /Kirim \/ Perbarui Skor/i });
    expect(submitBtn).toBeDefined();

    fireEvent.click(submitBtn);
    expect(firebaseLib.submitTimeAttackScore).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-789',
        score: 500,
      })
    );
  });
});
