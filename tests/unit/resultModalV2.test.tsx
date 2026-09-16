// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultModal } from '../../src/components/ResultModal';
import { GameSummary, Achievement } from '../../src/types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('ResultModal V2 Enhancements (Spec §5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseSummary: GameSummary = {
    mode: 'campaign',
    levelId: 1,
    score: 1500,
    questionsTotal: 10,
    correctCount: 10,
    wrongCount: 0,
    accuracy: 100,
    timeSpentSec: 22,
    avgTimePerQuestionSec: 2.2,
    questionsPerMinute: 27,
    maxStreak: 10,
    starsEarned: 3,
    history: [],
    isNewRecord: true,
  };

  it('renders Perfect Badge when isPerfect is true', () => {
    const perfectSummary: GameSummary = {
      ...baseSummary,
      isPerfect: true,
      targetTimeSec: 30,
    };

    render(
      <ResultModal
        summary={perfectSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/PERFECT RUN/i)).toBeDefined();
  });

  it('does not render Perfect Badge when isPerfect is false or undefined', () => {
    render(
      <ResultModal
        summary={baseSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.queryByText(/PERFECT RUN/i)).toBeNull();
  });

  it('renders Boss victory banner when isBoss is true and starsEarned >= 1', () => {
    const bossSummary: GameSummary = {
      ...baseSummary,
      isBoss: true,
      starsEarned: 2,
    };

    render(
      <ResultModal
        summary={bossSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/TIER BOSS DITAKLUKKAN!/i)).toBeDefined();
  });

  it('does not render Boss victory banner when isBoss is true but starsEarned is 0', () => {
    const failedBossSummary: GameSummary = {
      ...baseSummary,
      isBoss: true,
      starsEarned: 0,
    };

    render(
      <ResultModal
        summary={failedBossSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.queryByText(/TIER BOSS DITAKLUKKAN!/i)).toBeNull();
  });

  it('renders Achievement Unlocked card when newly unlocked achievements are present', () => {
    const mockAchievement: Achievement = {
      id: 'boss_t1',
      title: 'Penakluk Pemula',
      description: 'Kalahkan Boss Tier 1 (Level 12)',
      category: 'milestone',
      tier: 'bronze',
      icon: 'Trophy',
      targetValue: 1,
      currentValue: 1,
      unlocked: true,
    };

    const summaryWithAch: GameSummary = {
      ...baseSummary,
      unlockedAchievements: [mockAchievement],
    };

    render(
      <ResultModal
        summary={summaryWithAch}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/Pencapaian Terbuka!/i)).toBeDefined();
    expect(screen.getByText(/Penakluk Pemula/i)).toBeDefined();
    expect(screen.getByText(/Kalahkan Boss Tier 1 \(Level 12\)/i)).toBeDefined();
    expect(screen.getByText(/Bronze/i)).toBeDefined();
  });

  it('does not render Achievement Unlocked card when unlockedAchievements is empty or undefined', () => {
    render(
      <ResultModal
        summary={baseSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.queryByText(/Pencapaian Terbuka!/i)).toBeNull();
  });

  it('renders Target vs Actual speed comparison card when targetTimeSec is present', () => {
    const targetSummary: GameSummary = {
      ...baseSummary,
      timeSpentSec: 22,
      targetTimeSec: 30,
    };

    render(
      <ResultModal
        summary={targetSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/Target/i)).toBeDefined();
    expect(screen.getByText(/22s/i)).toBeDefined();
    expect(screen.getByText(/30s/i)).toBeDefined();
    expect(screen.getByText(/Tercapai/i)).toBeDefined();
  });

  it('does not render speed comparison card when targetTimeSec is undefined', () => {
    render(
      <ResultModal
        summary={baseSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.queryByText(/Perbandingan Kecepatan/i)).toBeNull();
  });
});
