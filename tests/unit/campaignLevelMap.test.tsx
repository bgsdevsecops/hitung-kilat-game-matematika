// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LevelMap } from '../../src/components/LevelMap';
import { createDefaultCampaignState, updateLevelProgress } from '../../src/utils/campaignState';

describe('LevelMap 6-Tier Accordion (Spec §3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders global star progress bar with 216 max stars', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/Peta Kampanye Matematika/i)).toBeDefined();
    expect(screen.getByText(/0 \/ 216 ★/i)).toBeDefined();
  });

  it('renders 6 accordion tiers and expands active tier by default', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/Tier 1 — Pemula/i)).toBeDefined();
    expect(screen.getByText(/Tier 2 — Menengah/i)).toBeDefined();
    expect(screen.getByText(/Tier 3 — Terampil/i)).toBeDefined();
    expect(screen.getByText(/Tier 4 — Mahir/i)).toBeDefined();
    expect(screen.getByText(/Tier 5 — Master/i)).toBeDefined();
    expect(screen.getByText(/Tier 6 — Legenda/i)).toBeDefined();

    // Level 1 card is visible by default
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
  });

  it('toggles accordion tier collapse when clicking header', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    const tier2Header = screen.getByRole('button', { name: /tier 2/i });
    expect(tier2Header.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(tier2Header);
    expect(tier2Header.getAttribute('aria-expanded')).toBe('true');
  });

  it('triggers onSelectLevel when clicking an unlocked level card', () => {
    const state = createDefaultCampaignState();
    const handleSelectLevel = vi.fn();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={handleSelectLevel}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);
    expect(handleSelectLevel).toHaveBeenCalledTimes(1);
    expect(handleSelectLevel.mock.calls[0][0].id).toBe('T1-ADD-01');
  });

  it('renders legacy star credits badge if legacyStarCredits > 0', () => {
    let state = createDefaultCampaignState();
    state = { ...state, legacyStarCredits: 8 };

    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/\+8 Bintang Warisan V1/i)).toBeDefined();
  });

  it('renders boss status chips (Terkunci, Siap Ditantang, Ditaklukkan)', () => {
    let state = createDefaultCampaignState();
    // In default state, T1-BOSS is locked
    const { rerender } = render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    // Boss chip on Tier 1 when locked
    expect(screen.getAllByText(/Terkunci/i).length).toBeGreaterThan(0);

    // Unlock T1-BOSS
    state = {
      ...state,
      levels: {
        ...state.levels,
        'T1-BOSS': {
          levelId: 'T1-BOSS',
          unlocked: true,
          stars: 0,
          bestScore: 0,
          accuracy: 0,
          bestTimeSec: 0,
        },
      },
    };

    rerender(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );
    expect(screen.getAllByText(/Siap Ditantang/i).length).toBeGreaterThan(0);

    // Complete T1-BOSS with stars >= 1
    state = {
      ...state,
      levels: {
        ...state.levels,
        'T1-BOSS': {
          levelId: 'T1-BOSS',
          unlocked: true,
          stars: 2,
          bestScore: 1200,
          accuracy: 90,
          bestTimeSec: 32,
        },
      },
    };

    rerender(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );
    expect(screen.getAllByText(/Ditaklukkan/i).length).toBeGreaterThan(0);
  });

  it('renders tier star meters (X / 36 ★) for each tier', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    // All 6 tiers show 0 / 36 ★
    const starCounters = screen.getAllByText(/0 \/ 36 ★/i);
    expect(starCounters.length).toBe(6);
  });

  it('supports backwards compatibility with legacy progress prop', () => {
    const legacyProgress = {
      1: {
        levelId: 1,
        unlocked: true,
        stars: 3,
        bestScore: 1500,
        bestTimeSec: 18,
        accuracy: 100,
      },
    };

    render(
      <LevelMap
        progress={legacyProgress}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/Peta Kampanye Matematika/i)).toBeDefined();
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
  });
});
