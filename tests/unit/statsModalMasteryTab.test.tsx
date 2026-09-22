// tests/unit/statsModalMasteryTab.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsModal } from '../../src/components/StatsModal';
import { soundManager } from '../../src/utils/sound';
import { UserStats } from '../../src/types';

// Mock recharts ResponsiveContainer to avoid size computation issues in jsdom
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

// Mock firebase calls to prevent network queries
vi.mock('../../src/lib/firebase', () => ({
  fetchTopTimeAttackScores: vi.fn().mockResolvedValue([]),
  submitTimeAttackScore: vi.fn().mockResolvedValue(true),
}));

const mockStats: UserStats = {
  totalSolved: 100,
  totalCorrect: 85,
  totalTimePlayedSec: 1200,
  bestStreak: 15,
  highestTimeAttackScore: 42,
  highestSPM: 30,
  starsTotal: 25,
};

describe('StatsModal Mastery Tab Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the 4th tab button with id="tab-mastery", label "Peta Keahlian", Sparkles icon, and min-h-[48px]', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
      />
    );

    const masteryTab = screen.getByRole('button', { name: /peta keahlian/i });
    expect(masteryTab).toBeDefined();
    expect(masteryTab.id).toBe('tab-mastery');
    expect(masteryTab.className).toContain('min-h-[48px]');

    // Check Sparkles icon presence inside tab-mastery (lucide-react renders svg with lucide-sparkles class)
    const icon = masteryTab.querySelector('svg');
    expect(icon).toBeDefined();
    expect(icon?.classList.contains('lucide-sparkles')).toBe(true);
  });

  it('ensures all tab buttons meet the 48px touch target height (min-h-[48px])', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
      />
    );

    const personalTab = screen.getByRole('button', { name: /statistik/i });
    const achievementsTab = screen.getByRole('button', { name: /pencapaian/i });
    const timeAttackTab = screen.getByRole('button', { name: /top 10 ta/i });
    const masteryTab = screen.getByRole('button', { name: /peta keahlian/i });

    expect(personalTab.className).toContain('min-h-[48px]');
    expect(achievementsTab.className).toContain('min-h-[48px]');
    expect(timeAttackTab.className).toContain('min-h-[48px]');
    expect(masteryTab.className).toContain('min-h-[48px]');
  });

  it('plays click sound and switches to mastery tab when tab-mastery is clicked', () => {
    const playClickSpy = vi.spyOn(soundManager, 'playClick');

    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
      />
    );

    const masteryTab = screen.getByRole('button', { name: /peta keahlian/i });
    fireEvent.click(masteryTab);

    expect(playClickSpy).toHaveBeenCalled();
    // SkillMasteryHeatmap content should be visible
    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
    expect(screen.getByText(/Cakupan Penguasaan Global/i)).toBeDefined();
  });

  it('respects defaultTab="mastery" on initial open', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
        defaultTab="mastery"
      />
    );

    // SkillMasteryHeatmap should be rendered immediately
    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
    expect(screen.getByText(/Cakupan Penguasaan Global/i)).toBeDefined();
  });

  it('passes onStartPractice callback to SkillMasteryHeatmap and triggers when practice is started', () => {
    const onStartPractice = vi.fn();

    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
        defaultTab="mastery"
        onStartPractice={onStartPractice}
      />
    );

    // Click a sub-skill to open detail modal
    const subSkillChip = screen.getByText('Penjumlahan Satu Digit');
    fireEvent.click(subSkillChip);

    // Click "Latih Sub-Skill Ini Sekarang"
    const practiceBtn = screen.getByRole('button', { name: /latih sub-skill ini/i });
    fireEvent.click(practiceBtn);

    expect(onStartPractice).toHaveBeenCalledWith('addition.single_digit');
  });

  it('allows switching between all tabs cleanly', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
        defaultTab="mastery"
      />
    );

    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();

    // Switch to personal
    const personalTab = screen.getByRole('button', { name: /statistik/i });
    fireEvent.click(personalTab);
    expect(screen.getByText(/Tren Akurasi 7 Hari Terakhir/i)).toBeDefined();

    // Switch to achievements
    const achievementsTab = screen.getByRole('button', { name: /pencapaian/i });
    fireEvent.click(achievementsTab);
    expect(screen.getByText(/Pencapaian & Lencana Prestasi/i)).toBeDefined();

    // Switch back to mastery
    const masteryTab = screen.getByRole('button', { name: /peta keahlian/i });
    fireEvent.click(masteryTab);
    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
  });

  it('forwards isLeaderboardSubmissionAllowed={false} to TimeAttackLeaderboardTab', () => {
    const mockUser: any = { uid: 'u123', displayName: 'Player' };
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={mockStats}
        totalStars={25}
        unlockedLevelsCount={10}
        onResetProgress={vi.fn()}
        defaultTab="timeAttack"
        currentUser={mockUser}
        isLeaderboardSubmissionAllowed={false}
      />
    );

    expect(screen.getByText(/Pengiriman Dinonaktifkan \(Privasi\)/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Kirim \/ Perbarui Skor/i })).toBeNull();
  });
});
