// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SprintHeader } from '../../src/components/competitive/SprintHeader';
import { SurvivalHeader } from '../../src/components/competitive/SurvivalHeader';

describe('SprintHeader', () => {
  it('renders countdown seconds and combo multiplier, without status role when > 10s', () => {
    render(
      <SprintHeader
        timeRemainingMs={45000}
        comboStreak={8}
        difficultyTier={3}
      />
    );
    expect(screen.getByText('45s')).toBeDefined();
    expect(screen.getByText('Tier 3')).toBeDefined();
    expect(screen.getByText('1.8x')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('triggers critical countdown alert text and status role when time remaining <= 10s', () => {
    const { rerender } = render(
      <SprintHeader
        timeRemainingMs={8000}
        comboStreak={0}
        difficultyTier={1}
      />
    );
    expect(screen.getByText('8s')).toBeDefined();
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(statusEl.getAttribute('aria-live')).toBe('assertive');

    // Test exactly 10s threshold
    rerender(
      <SprintHeader
        timeRemainingMs={10000}
        comboStreak={0}
        difficultyTier={1}
      />
    );
    expect(screen.getByText('10s')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();

    // Test above 10s threshold
    rerender(
      <SprintHeader
        timeRemainingMs={10001}
        comboStreak={0}
        difficultyTier={1}
      />
    );
    expect(screen.getByText('11s')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('SurvivalHeader', () => {
  it('renders dynamic energy time bar, survival duration, and heartbeat pulse', () => {
    render(
      <SurvivalHeader
        timeRemainingMs={40000}
        totalElapsedMs={65000}
        difficultyTier={2}
        feedback="none"
      />
    );
    expect(screen.getByText('01:05')).toBeDefined();
    expect(screen.getByText('Tier 2')).toBeDefined();
    expect(screen.getByText('40.0s')).toBeDefined();

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeDefined();
    expect(progressbar.getAttribute('aria-valuenow')).toBe('67');
  });

  it('renders +2s bonus animation indicator when feedback is correct', () => {
    render(
      <SurvivalHeader
        timeRemainingMs={50000}
        totalElapsedMs={30000}
        difficultyTier={1}
        feedback="correct"
      />
    );
    expect(screen.getByText('+2s')).toBeDefined();
  });

  it('renders -4s penalty animation indicator when feedback is wrong', () => {
    render(
      <SurvivalHeader
        timeRemainingMs={30000}
        totalElapsedMs={30000}
        difficultyTier={1}
        feedback="wrong"
      />
    );
    expect(screen.getByText('-4s')).toBeDefined();
  });
});
