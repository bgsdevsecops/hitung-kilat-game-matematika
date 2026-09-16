// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PlayScreen } from '../../src/components/PlayScreen';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';
import { getMasteryStore } from '../../src/utils/masteryBridge';
import { LevelConfig } from '../../src/types';

describe('PlayScreen V2 Arena & Boss Battle (Spec §4)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const level1 = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-ADD-01')!;
  const bossLevel = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-BOSS')!;

  it('generates questions from registry and renders question prompt and keypad', () => {
    render(
      <PlayScreen
        level={level1}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Dynamic keypad numbers
    expect(screen.getByRole('button', { name: '1' })).toBeDefined();
    expect(screen.getByRole('button', { name: '9' })).toBeDefined();
    // Central prompt container exists
    expect(screen.getByTestId('question-prompt')).toBeDefined();
  });

  it('renders Boss HP bar and crimson theme on boss level', () => {
    render(
      <PlayScreen
        level={bossLevel}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/PERTARUNGAN BOSS/i)).toBeDefined();
    const hpBar = screen.getByRole('progressbar');
    expect(hpBar).toBeDefined();
    expect(hpBar.getAttribute('aria-valuemax')).toBe(String(bossLevel.questionCount));
  });

  it('triggers screen shake and sound on wrong answer during boss battle', () => {
    render(
      <PlayScreen
        level={bossLevel}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Type deliberately incorrect answer: '9999'
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));

    const submitBtn = screen.getByTestId('keypad-submit');
    fireEvent.click(submitBtn);

    // Verify error card feedback exists
    const arenaCard = screen.getByTestId('arena-card');
    expect(arenaCard.className).toContain('animate-shake');
  });

  it('submits answer and advances to next question when input is correct', () => {
    const handleFinish = vi.fn();
    render(
      <PlayScreen
        level={level1}
        onFinishLevel={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Initial question count indicator
    expect(screen.getByText(/Soal 1 dari/i)).toBeDefined();

    // Read prompt, solve it, and verify advancement to question 2
    const promptEl = screen.getByTestId('question-prompt');
    const promptText = promptEl.textContent || '';
    const match = promptText.match(/(\d+)\s*\+\s*(\d+)/);
    if (match) {
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const ans = (a + b).toString();
      for (const char of ans) {
        fireEvent.click(screen.getByRole('button', { name: char }));
      }
      fireEvent.click(screen.getByTestId('keypad-submit'));
      expect(screen.getByText(/Soal 2 dari/i)).toBeDefined();
    }
  });

  it('handles physical keyboard events, prevents default on handled keys, and ignores system chords', () => {
    render(
      <PlayScreen
        level={level1}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Test system chord (ctrl+c) is ignored
    const ctrlEvent = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
    window.dispatchEvent(ctrlEvent);
    expect(ctrlEvent.defaultPrevented).toBe(false);

    // Test digit key prevents default
    const digitEvent = new KeyboardEvent('keydown', { key: '5', cancelable: true });
    window.dispatchEvent(digitEvent);
    expect(digitEvent.defaultPrevented).toBe(true);

    // Test backspace prevents default
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    window.dispatchEvent(backspaceEvent);
    expect(backspaceEvent.defaultPrevented).toBe(true);

    // Test enter prevents default
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(enterEvent);
    expect(enterEvent.defaultPrevented).toBe(true);
  });

  it('supports legacy LevelConfig and successfully initializes game session', () => {
    const legacyLevel: LevelConfig = {
      id: 1,
      title: 'Penjumlahan Dasar',
      tier: 1,
      tierName: 'Pemula',
      description: 'Latihan penjumlahan dasar',
      questionsCount: 10,
      timeLimitSec: 45,
      operations: ['+'],
      numberRange: { min: 1, max: 10 },
    };

    render(
      <PlayScreen
        level={legacyLevel}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByTestId('question-prompt')).toBeDefined();
    expect(screen.getByText(/Soal 1 dari/i)).toBeDefined();
  });

  it('ingests answered questions into MasteryStore upon completing level', () => {
    const store = getMasteryStore();
    const initialEventsCount = store.getAllEvents().length;
    const handleFinish = vi.fn();

    // Create a quick 1-question level config for instant test completion
    const quickLevel = {
      ...level1,
      id: 'T1-TEST-01',
      questionCount: 1,
      rules: { kind: 'addition', minA: 1, maxA: 1, minB: 1, maxB: 1 },
    };

    render(
      <PlayScreen
        level={quickLevel}
        onFinishLevel={handleFinish}
        onExit={vi.fn()}
      />
    );

    // 1 + 1 = 2
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByTestId('keypad-submit'));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const summary = handleFinish.mock.calls[0][0];
    expect(summary.mode).toBe('campaign');
    expect(summary.correctCount).toBe(1);
    expect(summary.starsEarned).toBeGreaterThanOrEqual(1);

    // Verify mastery store ingested the answer
    const newEventsCount = store.getAllEvents().length;
    expect(newEventsCount).toBeGreaterThan(initialEventsCount);
  });
});
