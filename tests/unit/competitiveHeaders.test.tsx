// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SprintHeader } from '../../src/components/competitive/SprintHeader';
import { SurvivalHeader } from '../../src/components/competitive/SurvivalHeader';

describe('SprintHeader', () => {
  it('renders countdown seconds and combo multiplier', () => {
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
  });

  it('triggers critical countdown alert text when time remaining < 10s', () => {
    render(
      <SprintHeader
        timeRemainingMs={8000}
        comboStreak={0}
        difficultyTier={1}
      />
    );
    expect(screen.getByText('8s')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
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
