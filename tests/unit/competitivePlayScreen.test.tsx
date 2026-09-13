// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CompetitivePlayScreen } from '../../src/components/competitive/CompetitivePlayScreen';
import { LevelMap } from '../../src/components/LevelMap';
import { soundManager } from '../../src/utils/sound';
import * as questionGenModule from '../../src/engine/competitive/questionGenerator';

describe('CompetitivePlayScreen', () => {
  const secret = 'test-secret-v2-123';

  beforeEach(() => {
    vi.spyOn(soundManager, 'playCorrect').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playWrong').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});

    // Provide predictable questions
    vi.spyOn(questionGenModule, 'generateCompetitiveQuestions').mockImplementation((tier, count) => {
      return Array.from({ length: count }, (_, idx) => ({
        id: `q_${tier}_${idx + 1}`,
        prompt: '12 + 8 = ?',
        displayPrompt: '12 + 8 = ?',
        difficulty: tier,
        skillId: 'add',
        subSkillId: 'add.1',
        answerSpec: { kind: 'integer', value: 20 },
      } as any));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders SprintHeader, central prompt card, input placeholder, and 0-9 keypad in sprint mode', () => {
    const onExit = vi.fn();
    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        userId="user_sprint"
        isRanked={true}
        onExit={onExit}
      />
    );

    // Header check
    expect(screen.getByText('Sprint 60s')).toBeDefined();
    expect(screen.getByText('Tier 1')).toBeDefined();

    // Central prompt card with aria-live="polite"
    const promptContainer = screen.getByText('12 + 8 = ?');
    expect(promptContainer).toBeDefined();
    expect(promptContainer.getAttribute('aria-live')).toBe('polite');

    // Input field
    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;
    expect(inputEl).toBeDefined();
    expect(inputEl.readOnly).toBe(true);
    expect(inputEl.value).toBe('');

    // Numeric keypad 0-9
    for (let i = 0; i <= 9; i++) {
      const btn = screen.getByRole('button', { name: String(i) });
      expect(btn).toBeDefined();
    }

    // Minus, Slash, Backspace and Submit buttons
    expect(screen.getByRole('button', { name: /minus|negatif/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /garis miring|pecahan/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /backspace|⌫/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /submit|↵/i })).toBeDefined();
  });

  it('renders SurvivalHeader with energy bar and timer in survival mode', () => {
    const onExit = vi.fn();
    render(
      <CompetitivePlayScreen
        mode="survival"
        secret={secret}
        userId="user_survival"
        isRanked={true}
        onExit={onExit}
      />
    );

    expect(screen.getByText('00:00')).toBeDefined();
    expect(screen.getByText('Tier 1')).toBeDefined();
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('updates input value when numeric keypad buttons are clicked', () => {
    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={vi.fn()}
      />
    );

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;
    expect(inputEl.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(inputEl.value).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(inputEl.value).toBe('20');
  });

  it('removes character when backspace button is clicked', () => {
    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={vi.fn()}
      />
    );

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(inputEl.value).toBe('45');

    const backspaceBtn = screen.getByRole('button', { name: /backspace|⌫/i });
    fireEvent.click(backspaceBtn);
    expect(inputEl.value).toBe('4');

    fireEvent.click(backspaceBtn);
    expect(inputEl.value).toBe('');

    // Clicking backspace on empty input doesn't crash
    fireEvent.click(backspaceBtn);
    expect(inputEl.value).toBe('');
  });

  it('submits answer, triggers sound FX, clears input, and advances question on submit button click', () => {
    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={vi.fn()}
      />
    );

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(inputEl.value).toBe('20');

    const submitBtn = screen.getByRole('button', { name: /submit|↵/i });
    fireEvent.click(submitBtn);

    expect(soundManager.playCorrect).toHaveBeenCalled();
    expect(inputEl.value).toBe('');
  });

  it('handles physical keyboard events: 0-9, Backspace, Enter, and Escape', () => {
    const onExit = vi.fn();
    const { unmount } = render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={onExit}
      />
    );

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;

    // Type '7'
    fireEvent.keyDown(window, { key: '7' });
    expect(inputEl.value).toBe('7');

    // Type '3'
    fireEvent.keyDown(window, { key: '3' });
    expect(inputEl.value).toBe('73');

    // Press Backspace
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(inputEl.value).toBe('7');

    // Press Enter with wrong answer '7'
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(soundManager.playWrong).toHaveBeenCalled();
    expect(inputEl.value).toBe('');

    // Type correct answer '20' and submit
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(soundManager.playCorrect).toHaveBeenCalled();
    expect(inputEl.value).toBe('');

    // Press Escape -> abandons session and calls onExit
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);

    // Unmount and verify no dangling listeners
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('supports negative numbers and fractions via virtual keypad and physical keyboard', () => {
    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={vi.fn()}
      />
    );

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;

    // Test virtual keypad minus sign
    const minusBtn = screen.getByRole('button', { name: /minus|negatif/i });
    fireEvent.click(minusBtn);
    expect(inputEl.value).toBe('-');

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(inputEl.value).toBe('-5');

    // Toggle minus off and on
    fireEvent.click(minusBtn);
    expect(inputEl.value).toBe('5');
    fireEvent.click(minusBtn);
    expect(inputEl.value).toBe('-5');

    // Clear with backspace
    const backspaceBtn = screen.getByRole('button', { name: /backspace|⌫/i });
    fireEvent.click(backspaceBtn);
    fireEvent.click(backspaceBtn);
    expect(inputEl.value).toBe('');

    // Test virtual keypad fraction
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    const slashBtn = screen.getByRole('button', { name: /garis miring|pecahan/i });
    fireEvent.click(slashBtn);
    expect(inputEl.value).toBe('3/');
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(inputEl.value).toBe('3/4');

    // Clear input
    fireEvent.click(backspaceBtn);
    fireEvent.click(backspaceBtn);
    fireEvent.click(backspaceBtn);
    expect(inputEl.value).toBe('');

    // Test physical keyboard '-' and '/'
    fireEvent.keyDown(window, { key: '-' });
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    expect(inputEl.value).toBe('-12');

    // Clear via Backspace
    fireEvent.keyDown(window, { key: 'Backspace' });
    fireEvent.keyDown(window, { key: 'Backspace' });
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(inputEl.value).toBe('');

    // Physical fraction 1/2
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '/' });
    fireEvent.keyDown(window, { key: '2' });
    expect(inputEl.value).toBe('1/2');
  });

  it('renders CompetitiveResultView when session ends (game over) and allows play again', () => {
    vi.useFakeTimers();
    const onExit = vi.fn();
    const onPlayAgain = vi.fn();

    render(
      <CompetitivePlayScreen
        mode="sprint"
        secret={secret}
        onExit={onExit}
        onPlayAgain={onPlayAgain}
      />
    );

    // Advance sprint timer by 60s to trigger game over
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // CompetitiveResultView should be rendered
    expect(screen.getByText('Hasil Pertandingan')).toBeDefined();
    expect(screen.getByText('Skor Akhir')).toBeDefined();

    // Click play again
    const playAgainBtn = screen.getByRole('button', { name: /main lagi/i });
    fireEvent.click(playAgainBtn);
    expect(onPlayAgain).toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('LevelMap competitive entry trigger', () => {
  it('renders Mode Kompetitif button and triggers onOpenCompetitiveModal on click', () => {
    const onOpenCompetitiveModal = vi.fn();
    render(
      <LevelMap
        progress={{ 1: { levelId: 1, unlocked: true, stars: 0, bestScore: 0, bestTimeSec: 0, accuracy: 0 } }}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
        onOpenCompetitiveModal={onOpenCompetitiveModal}
      />
    );

    const compBtn = screen.getByRole('button', { name: /mode kompetitif/i });
    expect(compBtn).toBeDefined();
    fireEvent.click(compBtn);
    expect(onOpenCompetitiveModal).toHaveBeenCalledTimes(1);
  });
});
