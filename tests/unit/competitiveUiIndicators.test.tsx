// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompetitiveResultView } from '../../src/components/competitive/CompetitiveResultView';
import { CompetitiveModeSelectModal } from '../../src/components/competitive/CompetitiveModeSelectModal';
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

describe('CompetitiveResultView states', () => {
  it('renders unvalidated server status badge when isUnvalidatedServerResult is true', () => {
    const output = {
      status: 'REJECTED',
      rejectionReasons: ['Server submit timeout'],
      canonicalMetrics: {
        score: 10,
        accuracy: 100,
        correctCount: 10,
        wrongCount: 0,
        questionsAnswered: 10,
        rankedActiveDurationMs: 60000,
        maxStreak: 10,
        difficultyReached: 2,
      },
      leaderboardEligible: false,
      result: {} as any,
    } as any;

    render(
      <CompetitiveResultView
        output={output}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
        isUnvalidatedServerResult={true}
      />
    );

    expect(screen.getByText(/Hasil belum tervalidasi server/i)).toBeInTheDocument();
  });

  it('renders validated ranked badge when status is VALIDATED and leaderboardEligible is true', () => {
    const output = {
      status: 'VALIDATED',
      canonicalMetrics: {
        score: 100,
        accuracy: 100,
        correctCount: 10,
        wrongCount: 0,
        questionsAnswered: 10,
        rankedActiveDurationMs: 60000,
        maxStreak: 10,
        difficultyReached: 3,
      },
      leaderboardEligible: true,
      result: {} as any,
    } as any;

    render(
      <CompetitiveResultView
        output={output}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
        isUnvalidatedServerResult={false}
      />
    );

    expect(screen.getByText(/Peringkat Sah/i)).toBeInTheDocument();
  });
});

describe('CompetitiveModeSelectModal eligibility badge', () => {
  it('renders Mode Latihan Lokal badge for under-13 users', () => {
    vi.spyOn(eligibilityMod, 'evaluateCompetitiveEligibility').mockReturnValue({
      isEligibleForRanked: false,
      reason: 'under13',
      executionMode: 'practice',
    });

    render(
      <CompetitiveModeSelectModal
        isOpen={true}
        onSelectMode={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Latihan Lokal/i)).toBeInTheDocument();
  });
});
