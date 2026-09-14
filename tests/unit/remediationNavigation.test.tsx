// tests/unit/remediationNavigation.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultModal } from '../../src/components/ResultModal';
import { GameSummary } from '../../src/types';
import { soundManager } from '../../src/utils/sound';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('ResultModal Remediation Fast-Launch Button', () => {
  const mockSummaryWithErrors: GameSummary = {
    mode: 'campaign',
    levelId: 4,
    score: 850,
    questionsTotal: 10,
    correctCount: 7,
    wrongCount: 3,
    accuracy: 70,
    timeSpentSec: 25,
    avgTimePerQuestionSec: 2.5,
    questionsPerMinute: 24,
    maxStreak: 5,
    starsEarned: 1,
    history: [],
    isNewRecord: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders Latih Kesalahan button when wrongCount > 0 and onStartRemediation is provided', () => {
    const handleRemediation = vi.fn();
    render(
      <ResultModal
        summary={mockSummaryWithErrors}
        onRetry={vi.fn()}
        onHome={vi.fn()}
        onStartRemediation={handleRemediation}
      />
    );

    const remBtn = screen.getByRole('button', { name: /latih kesalahan/i });
    expect(remBtn).toBeDefined();
    expect(remBtn.id).toBe('result-remediation-button');
    expect(remBtn.className).toContain('min-h-[48px]');
    expect(remBtn.textContent).toContain('Latih Kesalahan (3)');
    expect(remBtn.querySelector('svg')).toBeDefined();

    fireEvent.click(remBtn);
    expect(soundManager.playClick).toHaveBeenCalledTimes(1);
    expect(handleRemediation).toHaveBeenCalledTimes(1);
  });

  it('does not render Latih Kesalahan button when wrongCount === 0', () => {
    const perfectSummary: GameSummary = {
      ...mockSummaryWithErrors,
      correctCount: 10,
      wrongCount: 0,
      accuracy: 100,
    };

    render(
      <ResultModal
        summary={perfectSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
        onStartRemediation={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /latih kesalahan/i })).toBeNull();
    expect(document.getElementById('result-remediation-button')).toBeNull();
  });

  it('does not render Latih Kesalahan button when onStartRemediation is undefined', () => {
    render(
      <ResultModal
        summary={mockSummaryWithErrors}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /latih kesalahan/i })).toBeNull();
    expect(document.getElementById('result-remediation-button')).toBeNull();
  });
});
