// tests/unit/adaptivePlayArena.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AdaptivePlayArena } from '../../src/components/practice/AdaptivePlayArena';
import { Question } from '../../src/engine/types/question';
import { soundManager } from '../../src/utils/sound';

vi.mock('../../src/utils/sound', () => ({
  soundManager: {
    playClick: vi.fn(),
    playCorrect: vi.fn(),
    playWrong: vi.fn(),
  },
}));

describe('AdaptivePlayArena Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockQuestions: Question[] = [
    {
      id: 'q1',
      displayPrompt: '7 × 8',
      prompt: '7 × 8',
      answerSpec: { kind: 'integer', value: 56 },
      difficulty: 3,
      primarySkillId: 'multiplication.x7',
    },
    {
      id: 'q2',
      displayPrompt: '14 + 19',
      prompt: '14 + 19',
      answerSpec: { kind: 'integer', value: 33 },
      difficulty: 2,
      primarySkillId: 'addition.carry',
    },
  ];

  it('renders question prompt, progress indicator, and virtual keypad targets >= 48px', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('7 × 8')).toBeDefined();
    expect(screen.getByText(/Soal 1 dari 2/i)).toBeDefined();

    // Keypad digits
    const key5 = screen.getByRole('button', { name: '5' });
    expect(key5.className).toContain('min-h-[48px]');

    // Verify all buttons have min-h-[48px]
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(0);
    allButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[48px]');
    });
  });

  it('submits answer via virtual keypad and advances to next question', () => {
    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Enter 56 for question 1
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    // Verify advanced to question 2
    expect(screen.getByText('14 + 19')).toBeDefined();
    expect(screen.getByText(/Soal 2 dari 2/i)).toBeDefined();

    // Enter 33 for question 2 and submit
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const [finalAnswers, durationMs] = handleFinish.mock.calls[0];
    expect(finalAnswers.length).toBe(2);
    expect(finalAnswers[0].isCorrect).toBe(true);
    expect(finalAnswers[1].isCorrect).toBe(true);
    expect(typeof durationMs).toBe('number');
  });

  it('handles physical keyboard events and calls e.preventDefault on handled keys', () => {
    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Type 5 and 6 using physical keyboard
    let event5: KeyboardEvent;
    act(() => {
      event5 = new KeyboardEvent('keydown', { key: '5', cancelable: true });
      window.dispatchEvent(event5);
    });
    expect(event5!.defaultPrevented).toBe(true);

    let event6: KeyboardEvent;
    act(() => {
      event6 = new KeyboardEvent('keydown', { key: '6', cancelable: true });
      window.dispatchEvent(event6);
    });
    expect(event6!.defaultPrevented).toBe(true);

    // Enter submits
    let eventEnter: KeyboardEvent;
    act(() => {
      eventEnter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      window.dispatchEvent(eventEnter);
    });
    expect(eventEnter!.defaultPrevented).toBe(true);

    // Advanced to question 2
    expect(screen.getByText('14 + 19')).toBeDefined();

    // Unhandled key does not call preventDefault
    let eventA: KeyboardEvent;
    act(() => {
      eventA = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      window.dispatchEvent(eventA);
    });
    expect(eventA!.defaultPrevented).toBe(false);
  });

  it('ignores browser shortcut keys with Ctrl, Meta, or Alt and does not prevent default', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const inputDisplay = screen.getByTestId('user-input-display');

    // Ctrl+1 (e.g. browser tab switch)
    let eventCtrl1: KeyboardEvent;
    act(() => {
      eventCtrl1 = new KeyboardEvent('keydown', { key: '1', ctrlKey: true, cancelable: true });
      window.dispatchEvent(eventCtrl1);
    });
    expect(eventCtrl1!.defaultPrevented).toBe(false);
    expect(inputDisplay.textContent).toContain('Ketik jawaban...');

    // Meta+2 (Cmd+2 on macOS)
    let eventMeta2: KeyboardEvent;
    act(() => {
      eventMeta2 = new KeyboardEvent('keydown', { key: '2', metaKey: true, cancelable: true });
      window.dispatchEvent(eventMeta2);
    });
    expect(eventMeta2!.defaultPrevented).toBe(false);
    expect(inputDisplay.textContent).toContain('Ketik jawaban...');

    // Alt+3
    let eventAlt3: KeyboardEvent;
    act(() => {
      eventAlt3 = new KeyboardEvent('keydown', { key: '3', altKey: true, cancelable: true });
      window.dispatchEvent(eventAlt3);
    });
    expect(eventAlt3!.defaultPrevented).toBe(false);
    expect(inputDisplay.textContent).toContain('Ketik jawaban...');
  });

  it('supports backspace via virtual button and physical keyboard', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Type 5, 6, 7
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(screen.getByText('567')).toBeDefined();

    // Click backspace button
    fireEvent.click(screen.getByRole('button', { name: /hapus/i }));
    expect(screen.getByText('56')).toBeDefined();

    // Physical Backspace
    const eventBackspace = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    window.dispatchEvent(eventBackspace);
    expect(eventBackspace.defaultPrevented).toBe(true);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('handles negative integers correctly', () => {
    const questionsWithNegative: Question[] = [
      {
        id: 'q-neg',
        displayPrompt: '3 - 8',
        prompt: '3 - 8',
        answerSpec: { kind: 'integer', value: -5 },
        difficulty: 2,
        primarySkillId: 'subtraction.negative',
      },
    ];

    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={questionsWithNegative}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Click '-' then '5'
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByText('-5')).toBeDefined();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const [finalAnswers] = handleFinish.mock.calls[0];
    expect(finalAnswers[0].isCorrect).toBe(true);
  });

  it('handles fractions correctly with slash key', () => {
    const fractionQuestions: Question[] = [
      {
        id: 'q-frac',
        displayPrompt: '1/2 + 1/4',
        prompt: '1/2 + 1/4',
        answerSpec: { kind: 'fraction', numerator: 3, denominator: 4 } as any,
        difficulty: 3,
        primarySkillId: 'fraction.addition',
      },
    ];

    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={fractionQuestions}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Enter 3/4
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '/' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByText('3/4')).toBeDefined();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const [finalAnswers] = handleFinish.mock.calls[0];
    expect(finalAnswers[0].isCorrect).toBe(true);
  });

  it('does not submit empty input or bare minus sign', () => {
    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Click submit with empty input
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));
    expect(handleFinish).not.toHaveBeenCalled();
    expect(screen.getByText('7 × 8')).toBeDefined();

    // Click '-' then submit
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));
    expect(handleFinish).not.toHaveBeenCalled();
    expect(screen.getByText('7 × 8')).toBeDefined();
  });

  it('handles exit action and sound effect', () => {
    const handleExit = vi.fn();
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={handleExit}
      />
    );

    const exitBtn = screen.getByRole('button', { name: /kembali|keluar/i });
    fireEvent.click(exitBtn);

    expect(handleExit).toHaveBeenCalledTimes(1);
    expect(soundManager.playClick).toHaveBeenCalled();
  });

  it('runs untimed stopwatch incrementing every second', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('00:00')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(65000); // 1 min 5 sec
    });

    expect(screen.getByText('01:05')).toBeDefined();
  });

  it('has aria-live="polite" on prompt card for screen reader accessibility', () => {
    const { container } = render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('evaluates rational answer spec correctly and triggers appropriate sounds', () => {
    const rationalQuestions: Question[] = [
      {
        id: 'q-rat',
        displayPrompt: '6/8 disederhanakan',
        prompt: '6/8 disederhanakan',
        answerSpec: { kind: 'rational', numerator: 3, denominator: 4 },
        difficulty: 3,
        primarySkillId: 'fraction.simplify',
      },
    ];

    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={rationalQuestions}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Enter 3/4
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '/' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const [answers] = handleFinish.mock.calls[0];
    expect(answers[0].isCorrect).toBe(true);
    expect(soundManager.playCorrect).toHaveBeenCalledWith(0);
  });

  it('records wrong answer and plays playWrong when answer is incorrect', () => {
    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={mockQuestions.slice(0, 1)}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Enter incorrect answer 99 for 7 × 8
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const [answers] = handleFinish.mock.calls[0];
    expect(answers[0].isCorrect).toBe(false);
    expect(soundManager.playWrong).toHaveBeenCalledTimes(1);
  });

  it('enforces input restrictions (no duplicate minus, no duplicate slash, no leading slash, no slash after minus)', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const inputDisplay = screen.getByTestId('user-input-display');

    // Leading slash should not be added
    fireEvent.click(screen.getByRole('button', { name: '/' }));
    expect(inputDisplay.textContent).toContain('Ketik jawaban...');

    // Type minus
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(inputDisplay.textContent).toBe('-');

    // Second minus should be ignored
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(inputDisplay.textContent).toBe('-');

    // Slash immediately after minus should be ignored
    fireEvent.click(screen.getByRole('button', { name: '/' }));
    expect(inputDisplay.textContent).toBe('-');

    // Clear with backspace
    fireEvent.click(screen.getByRole('button', { name: /hapus/i }));
    expect(inputDisplay.textContent).toContain('Ketik jawaban...');

    // Type 3/4
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '/' }));
    expect(inputDisplay.textContent).toBe('3/');

    // Second slash should be ignored
    fireEvent.click(screen.getByRole('button', { name: '/' }));
    expect(inputDisplay.textContent).toBe('3/');
  });

  it('handles empty questions list gracefully without crashing and respects Rules of Hooks', () => {
    const { container, rerender } = render(
      <AdaptivePlayArena
        questions={[]}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();

    // Rerender with questions to ensure hook count and order are preserved
    rerender(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(screen.getByText('7 × 8')).toBeDefined();
  });

  it('limits input length to 12 characters to prevent visual overflow', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const inputDisplay = screen.getByTestId('user-input-display');

    // Click '1' 12 times
    for (let i = 0; i < 12; i++) {
      fireEvent.click(screen.getByRole('button', { name: '1' }));
    }
    expect(inputDisplay.textContent).toBe('111111111111');
    expect(inputDisplay.textContent?.length).toBe(12);

    // 13th key press should be ignored
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(inputDisplay.textContent).toBe('111111111111');
    expect(inputDisplay.textContent?.length).toBe(12);
  });

  it('handles physical minus and slash keys with e.preventDefault', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const inputDisplay = screen.getByTestId('user-input-display');

    let eventMinus: KeyboardEvent;
    act(() => {
      eventMinus = new KeyboardEvent('keydown', { key: '-', cancelable: true });
      window.dispatchEvent(eventMinus);
    });
    expect(eventMinus!.defaultPrevented).toBe(true);
    expect(inputDisplay.textContent).toBe('-');

    // Backspace
    let eventBs: KeyboardEvent;
    act(() => {
      eventBs = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
      window.dispatchEvent(eventBs);
    });
    expect(eventBs!.defaultPrevented).toBe(true);

    // Digit 5 then slash
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', cancelable: true }));
    });
    let eventSlash: KeyboardEvent;
    act(() => {
      eventSlash = new KeyboardEvent('keydown', { key: '/', cancelable: true });
      window.dispatchEvent(eventSlash);
    });
    expect(eventSlash!.defaultPrevented).toBe(true);
    expect(inputDisplay.textContent).toBe('5/');
  });
});
