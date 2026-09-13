// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DailyResultView } from '../../src/components/daily/DailyResultView';
import { ValidationOutput } from '../../src/engine/competitive/validator';

describe('DailyResultView Component', () => {
  const mockOutput: ValidationOutput = {
    status: 'VALIDATED',
    canonicalMetrics: {
      score: 2150,
      accuracy: 100,
      correctCount: 10,
      wrongCount: 0,
      questionsAnswered: 10,
      rankedActiveDurationMs: 35000,
      maxStreak: 10,
      difficultyReached: 5,
    },
    leaderboardEligible: true,
    result: {
      resultId: 'res_123',
      sessionId: 'sess_123',
      userId: 'user_1',
      mode: 'daily',
      status: 'VALIDATED',
      isRanked: true,
      score: 2150,
      accuracy: 100,
      correctCount: 10,
      wrongCount: 0,
      questionsAnswered: 10,
      rankedActiveDurationMs: 35000,
      maxStreak: 10,
      difficultyReached: 5,
      rejectionReasons: [],
      finalizedAt: Date.now(),
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
      challengeId: '2026-09-13@Asia/Jakarta:2.0.0',
    },
    rejectionReasons: [],
  };

  it('renders 4-tier score breakdown cards, total score, and streak flame', () => {
    render(
      <DailyResultView
        output={mockOutput}
        isRanked={true}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={true}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Total Score
    expect(screen.getByText('2150')).toBeDefined();
    expect(screen.getByText(/Skor Resmi Tercatat/i)).toBeDefined();

    // 4 Score Tiers
    expect(screen.getByText(/Skor Dasar/i)).toBeDefined();
    expect(screen.getByText('+1200')).toBeDefined(); // 10 * 120

    expect(screen.getByText(/Bonus Kombo/i)).toBeDefined();
    expect(screen.getByText('+300')).toBeDefined(); // min(300, 10 * 30)

    expect(screen.getByText(/Bonus Kecepatan/i)).toBeDefined();

    expect(screen.getByText(/Bonus Sempurna/i)).toBeDefined();
    expect(screen.getByText('+200')).toBeDefined();
    expect(screen.getByText(/10\/10 Sempurna!/i)).toBeDefined();

    // Daily Streak Flame Indicator
    expect(screen.getByText(/Streak: 5 Hari/i)).toBeDefined();
    expect(screen.getByText(/\(\+1 Hari Ini!\)/i)).toBeDefined();
  });

  it('displays Mode Latihan badge when played as unranked replay', () => {
    const replayOutput: ValidationOutput = {
      ...mockOutput,
      result: {
        ...mockOutput.result,
        isRanked: false,
      },
    };

    render(
      <DailyResultView
        output={replayOutput}
        isRanked={false}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={false}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode Latihan/i)).toBeDefined();
    expect(screen.getByText(/Tidak Mengubah Rekor Resmi/i)).toBeDefined();
    expect(screen.queryByText(/\(\+1 Hari Ini!\)/i)).toBeNull();
  });

  it('copies shareable summary text on share button click', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    render(
      <DailyResultView
        output={mockOutput}
        isRanked={true}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={true}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const shareBtn = screen.getByRole('button', { name: /bagikan/i });
    fireEvent.click(shareBtn);
    expect(writeTextSpy).toHaveBeenCalledTimes(1);
    const copiedText = writeTextSpy.mock.calls[0][0];
    expect(copiedText).toContain('Tantangan Harian');
    expect(copiedText).toContain('2026-09-13');
    expect(copiedText).toContain('Skor: 2150');

    await waitFor(() => {
      expect(screen.getByText(/Tersalin ke Clipboard!/i)).toBeDefined();
    });
  });

  it('invokes onPlayAgain and onExit handlers and verifies touch target sizes', () => {
    const onPlayAgainMock = vi.fn();
    const onExitMock = vi.fn();

    render(
      <DailyResultView
        output={mockOutput}
        isRanked={true}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={true}
        onPlayAgain={onPlayAgainMock}
        onExit={onExitMock}
      />
    );

    const playAgainBtn = screen.getByRole('button', { name: /main ulang/i });
    expect(playAgainBtn.className).toContain('min-h-[48px]');
    fireEvent.click(playAgainBtn);
    expect(onPlayAgainMock).toHaveBeenCalledTimes(1);

    const exitBtn = screen.getByRole('button', { name: /menu|kembali/i });
    expect(exitBtn.className).toContain('min-h-[48px]');
    fireEvent.click(exitBtn);
    expect(onExitMock).toHaveBeenCalledTimes(1);
  });

  it('displays non-perfect bonus text when correctCount < 10', () => {
    const imperfectOutput: ValidationOutput = {
      ...mockOutput,
      result: {
        ...mockOutput.result,
        correctCount: 8,
        questionsAnswered: 10,
        score: 1350,
      },
    };

    render(
      <DailyResultView
        output={imperfectOutput}
        isRanked={true}
        challengeId="2026-09-13@Asia/Jakarta:2.0.0"
        currentStreak={5}
        isStreakIncremented={true}
        onPlayAgain={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/0 \(Perlu 10\/10\)/i)).toBeDefined();
  });
});
