// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompetitiveResultView } from '../../src/components/competitive/CompetitiveResultView';
import { CompetitiveModeSelectModal } from '../../src/components/competitive/CompetitiveModeSelectModal';
import { ValidationOutput } from '../../src/engine/competitive/validator';

describe('CompetitiveResultView', () => {
  const mockValidatedOutput: ValidationOutput = {
    status: 'VALIDATED',
    rejectionReasons: [],
    canonicalMetrics: {
      score: 1850,
      accuracy: 92.5,
      correctCount: 22,
      wrongCount: 2,
      questionsAnswered: 24,
      rankedActiveDurationMs: 58000,
      maxStreak: 12,
      difficultyReached: 5,
    },
    leaderboardEligible: true,
    result: {
      resultId: 'res_12345678',
      sessionId: 'sess_123',
      userId: 'user_1',
      mode: 'sprint',
      status: 'VALIDATED',
      isRanked: true,
      score: 1850,
      accuracy: 92.5,
      correctCount: 22,
      wrongCount: 2,
      questionsAnswered: 24,
      rankedActiveDurationMs: 58000,
      maxStreak: 12,
      difficultyReached: 5,
      rejectionReasons: [],
      finalizedAt: 1710000000000,
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
    },
  };

  const mockUnrankedOutput: ValidationOutput = {
    status: 'REJECTED',
    rejectionReasons: ['SPEED_ANOMALY'],
    canonicalMetrics: {
      score: 600,
      accuracy: 60.0,
      correctCount: 6,
      wrongCount: 4,
      questionsAnswered: 10,
      rankedActiveDurationMs: 30000,
      maxStreak: 3,
      difficultyReached: 2,
    },
    leaderboardEligible: false,
    result: {
      resultId: 'res_rejected_01',
      sessionId: 'sess_unranked',
      userId: 'user_1',
      mode: 'survival',
      status: 'REJECTED',
      isRanked: false,
      score: 600,
      accuracy: 60.0,
      correctCount: 6,
      wrongCount: 4,
      questionsAnswered: 10,
      rankedActiveDurationMs: 30000,
      maxStreak: 3,
      difficultyReached: 2,
      rejectionReasons: ['SPEED_ANOMALY'],
      finalizedAt: 1710000050000,
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
    },
  };

  it('renders canonical score, accuracy, questions answered, streak, duration, and tier', () => {
    render(
      <CompetitiveResultView
        output={mockValidatedOutput}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(screen.getByText('1850')).toBeDefined();
    expect(screen.getByText('92.5%')).toBeDefined();
    expect(screen.getByText('22 / 24')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('58s')).toBeDefined();
    expect(screen.getByText('Tier 5')).toBeDefined();
    expect(screen.getByText('Peringkat Sah')).toBeDefined();
  });

  it('renders unranked practice indicator when leaderboardEligible is false', () => {
    render(
      <CompetitiveResultView
        output={mockUnrankedOutput}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(screen.getByText('Latihan Tidak Berperingkat')).toBeDefined();
    expect(screen.getByText('600')).toBeDefined();
    expect(screen.getByText('Tier 2')).toBeDefined();
    expect(screen.getByText('30s')).toBeDefined();
  });

  it('calls onPlayAgain and onExit when action buttons are clicked', () => {
    const onPlayAgain = vi.fn();
    const onExit = vi.fn();
    render(
      <CompetitiveResultView
        output={mockValidatedOutput}
        onPlayAgain={onPlayAgain}
        onExit={onExit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /main lagi/i }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /kembali ke menu/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('CompetitiveModeSelectModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CompetitiveModeSelectModal
        isOpen={false}
        onSelectMode={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Sprint and Survival options and selects mode on click', () => {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();
    render(
      <CompetitiveModeSelectModal
        isOpen={true}
        onSelectMode={onSelectMode}
        onClose={onClose}
      />
    );
    expect(screen.getByText('Mode Kompetitif')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /sprint 60s/i }));
    expect(onSelectMode).toHaveBeenCalledWith('sprint');
    fireEvent.click(screen.getByRole('button', { name: /survival kilat/i }));
    expect(onSelectMode).toHaveBeenCalledWith('survival');
  });

  it('calls onClose when X button or backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <CompetitiveModeSelectModal
        isOpen={true}
        onSelectMode={vi.fn()}
        onClose={onClose}
      />
    );

    // Close button click
    const closeBtn = screen.getByRole('button', { name: /tutup/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop click
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);

    // Clicking inside modal content should NOT trigger onClose
    const modalContent = screen.getByText('Mode Kompetitif');
    fireEvent.click(modalContent);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <CompetitiveModeSelectModal
        isOpen={true}
        onSelectMode={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Other keys do not trigger onClose
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Cleanup removes event listener
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
