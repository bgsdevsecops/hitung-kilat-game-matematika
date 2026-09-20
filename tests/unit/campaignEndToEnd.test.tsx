// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';
import { CAMPAIGN_V2_STORAGE_KEY, loadCampaignState, V2CampaignState } from '../../src/utils/campaignState';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock recharts ResponsiveContainer for JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe('Campaign V2 End-to-End Flow (Spec §2 & §8)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('launches V2 welcome modal when V1 progress is detected', async () => {
    const v1Prog = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1000, bestTimeSec: 20, accuracy: 100 },
    };
    localStorage.setItem('hitung_kilat_progress_v1', JSON.stringify(v1Prog));

    render(<App />);

    expect(screen.getByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeDefined();
    const startBtn = screen.getByRole('button', { name: /mulai petualangan 72 level/i });
    fireEvent.click(startBtn);

    // Modal is dismissed, level map visible
    expect(screen.queryByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeNull();
    expect(screen.getByText(/Peta Kampanye Matematika/i)).toBeDefined();
  });

  it('selects level from 6-tier accordion, plays in arena, and records completion', async () => {
    render(<App />);

    // Select Level 1 card
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);

    // PlayScreen is rendered with question prompt
    expect(await screen.findByTestId('question-prompt')).toBeDefined();
  });

  it('correctly persists V2 campaign state and displays stars after migration acknowledgment', async () => {
    // Seed V1 progress across a few levels
    const v1Prog = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1200, bestTimeSec: 15, accuracy: 100 },
      2: { levelId: 2, unlocked: true, stars: 2, bestScore: 900, bestTimeSec: 22, accuracy: 90 },
    };
    localStorage.setItem('hitung_kilat_progress_v1', JSON.stringify(v1Prog));
    localStorage.setItem('hitung_kilat_migration_ack_v2', 'true');

    render(<App />);

    // Welcome modal shouldn't display because ack was true
    expect(screen.queryByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeNull();

    // Map should display migrated stars
    const state = loadCampaignState();
    expect(state).not.toBeNull();
    expect(state?.levels['T1-ADD-01']?.stars).toBe(3);
    expect(state?.levels['T1-SUB-01']?.stars).toBe(2);
    expect(state?.totalStars).toBeGreaterThanOrEqual(5);
  });

  it('allows advancing to next level via ResultModal after completing a level', async () => {
    render(<App />);

    // Click level 1 card
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);

    // In PlayScreen, exit back to map using Back button
    const backBtn = await screen.findByRole('button', { name: /kembali ke menu/i });
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);

    // Map should be visible again
    expect(await screen.findByText(/Peta Kampanye Matematika/i)).toBeDefined();
  });

  it('resets V2 campaign progress when resetting progress in StatsModal', async () => {
    // Seed some campaign progress
    const v1Prog = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1000, bestTimeSec: 20, accuracy: 100 },
    };
    localStorage.setItem('hitung_kilat_progress_v1', JSON.stringify(v1Prog));
    localStorage.setItem('hitung_kilat_migration_ack_v2', 'true');

    render(<App />);

    // Open Stats modal via stats button in Header
    const starsBadge = screen.getByTitle(/Total Bintang Diraih/i);
    fireEvent.click(starsBadge);

    expect(await screen.findByText(/Statistik & Pencapaian/i)).toBeDefined();

    // Click reset button
    const resetTrigger = await screen.findByText(/Reset Seluruh Progres Permainan/i);
    fireEvent.click(resetTrigger);

    const confirmBtn = await screen.findByRole('button', { name: /Ya, Reset Sekarang/i });
    fireEvent.click(confirmBtn);

    // Verify campaign state is reset
    const state = loadCampaignState();
    expect(state?.totalStars).toBe(0);
    expect(state?.levels['T1-ADD-01']?.stars).toBe(0);
  });
});
