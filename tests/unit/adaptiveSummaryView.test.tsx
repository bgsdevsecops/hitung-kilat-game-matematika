// tests/unit/adaptiveSummaryView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdaptiveSummaryView } from '../../src/components/practice/AdaptiveSummaryView';
import { Question } from '../../src/engine/types/question';
import { getMasteryStore } from '../../src/utils/masteryBridge';
import { soundManager } from '../../src/utils/sound';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('AdaptiveSummaryView Component', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  const mockAnswers: Question[] = [
    {
      id: 'q1',
      displayPrompt: '7 × 8',
      prompt: '7 × 8',
      answerSpec: { kind: 'integer', value: 56 },
      difficulty: 3,
      isCorrect: true,
      timeSpentMs: 2200,
      primarySkillId: 'multiplication.x7',
    },
    {
      id: 'q2',
      displayPrompt: '9 × 6',
      prompt: '9 × 6',
      answerSpec: { kind: 'integer', value: 54 },
      difficulty: 3,
      isCorrect: true,
      timeSpentMs: 2500,
      primarySkillId: 'multiplication.x7',
    },
  ];

  it('renders accuracy, total questions, correct count, and milestone progression card', () => {
    render(
      <AdaptiveSummaryView
        answers={mockAnswers}
        durationMs={4700}
        onPlayAgain={vi.fn()}
        onOpenMasteryMap={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Sesi Selesai/i)).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText(/2 dari 2 Soal Benar/i)).toBeDefined();
    expect(screen.getByText('2/2')).toBeDefined();
    expect(screen.getByText('0:05')).toBeDefined();
    expect(screen.getByText('Perkalian ×7')).toBeDefined();
  });

  it('invokes onPlayAgain, onOpenMasteryMap, and onExit action handlers with sound and touch compliance', () => {
    const handlePlayAgain = vi.fn();
    const handleOpenMap = vi.fn();
    const handleExit = vi.fn();

    render(
      <AdaptiveSummaryView
        answers={mockAnswers}
        durationMs={4700}
        onPlayAgain={handlePlayAgain}
        onOpenMasteryMap={handleOpenMap}
        onExit={handleExit}
      />
    );

    const playAgainBtn = screen.getByRole('button', { name: /lanjut latihan/i });
    expect(playAgainBtn.className).toContain('min-h-[48px]');
    fireEvent.click(playAgainBtn);
    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handlePlayAgain).toHaveBeenCalledTimes(1);

    const mapBtn = screen.getByRole('button', { name: /peta keahlian/i });
    expect(mapBtn.className).toContain('min-h-[48px]');
    fireEvent.click(mapBtn);
    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleOpenMap).toHaveBeenCalledTimes(1);

    const exitBtn = screen.getByRole('button', { name: /menu utama/i });
    expect(exitBtn.className).toContain('min-h-[48px]');
    fireEvent.click(exitBtn);
    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleExit).toHaveBeenCalledTimes(1);
  });

  it('calculates partial accuracy correctly (50% for 1 correct out of 2)', () => {
    const partialAnswers: Question[] = [
      {
        id: 'q1',
        displayPrompt: '7 × 8',
        isCorrect: true,
        answerSpec: { kind: 'integer', value: 56 },
        difficulty: 3,
        primarySkillId: 'multiplication.x7',
      },
      {
        id: 'q2',
        displayPrompt: '8 × 8',
        isCorrect: false,
        answerSpec: { kind: 'integer', value: 64 },
        difficulty: 3,
        primarySkillId: 'multiplication.x8',
      },
    ];

    render(
      <AdaptiveSummaryView
        answers={partialAnswers}
        durationMs={10000}
        onPlayAgain={vi.fn()}
        onOpenMasteryMap={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('50%')).toBeDefined();
    expect(screen.getByText(/1 dari 2 Soal Benar/i)).toBeDefined();
    expect(screen.getByText('1/2')).toBeDefined();
    expect(screen.getByText('0:10')).toBeDefined();
    expect(screen.getByText('Perkalian ×7')).toBeDefined();
    expect(screen.getByText('Perkalian ×8')).toBeDefined();
  });

  it('displays updated mastery score and status label from MasteryStore', () => {
    const store = getMasteryStore();
    const now = Date.now();
    // Record events into MasteryStore to populate records
    store.recordEvents(
      [
        {
          eventId: 'evt_1',
          sessionId: 's1',
          questionDefinitionId: 'qd1',
          primarySkillId: 'multiplication',
          subSkillId: 'multiplication.x7',
          skillTags: ['multiplication', 'multiplication.x7'],
          templateFamily: 'mult_table',
          difficulty: 3,
          targetResponseTimeMs: 3500,
          responseTimeMs: 2000,
          isCorrect: true,
          timestamp: now,
        },
      ],
      now
    );

    render(
      <AdaptiveSummaryView
        answers={mockAnswers}
        durationMs={3000}
        onPlayAgain={vi.fn()}
        onOpenMasteryMap={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const record = store.getMasteryRecord('multiplication.x7');
    expect(screen.getByText(`${record.masteryScore}/100`)).toBeDefined();
    expect(screen.getByText(new RegExp(record.statusLabel, 'i'))).toBeDefined();
  });

  it('handles empty answers gracefully with 0% accuracy', () => {
    render(
      <AdaptiveSummaryView
        answers={[]}
        durationMs={0}
        onPlayAgain={vi.fn()}
        onOpenMasteryMap={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('0%')).toBeDefined();
    expect(screen.getByText(/0 dari 0 Soal Benar/i)).toBeDefined();
    expect(screen.getByText('0/0')).toBeDefined();
    expect(screen.getByText('0:00')).toBeDefined();
  });
});
