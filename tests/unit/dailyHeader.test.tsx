// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyHeader } from '../../src/components/daily/DailyHeader';

describe('DailyHeader Component', () => {
  it('renders countdown timer, stage title, and segmented progress bar', () => {
    const onExit = vi.fn();
    render(
      <DailyHeader
        timeRemainingMs={85000}
        currentQuestionIdx={3}
        totalQuestions={10}
        comboStreak={4}
        stageTitle="Perkalian Refleks"
        onExit={onExit}
      />
    );

    // Timer rendering (85s formatted as 01:25)
    expect(screen.getByText('01:25')).toBeDefined();
    expect(screen.getByText('Target: 75s')).toBeDefined();

    // Stage title and question counter
    expect(screen.getByText(/Perkalian Refleks/i)).toBeDefined();
    expect(screen.getByText(/Soal 4 dari 10/i)).toBeDefined();

    // Combo streak badge
    expect(screen.getByText(/4x Kombo/i)).toBeDefined();
    expect(screen.getByText(/\+120 Poin/i)).toBeDefined();

    // Exit button with 48px touch target
    const exitBtn = screen.getByRole('button', { name: /keluar|kembali/i });
    expect(exitBtn).toBeDefined();
    expect(exitBtn.className).toContain('min-h-[48px]');
    expect(exitBtn.className).toContain('min-w-[48px]');
    fireEvent.click(exitBtn);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('renders 10 progress segments with accessible progressbar attributes', () => {
    render(
      <DailyHeader
        timeRemainingMs={50000}
        currentQuestionIdx={2}
        totalQuestions={10}
        comboStreak={0}
        stageTitle="Tahap 3"
        onExit={vi.fn()}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('3');
    expect(progressbar.getAttribute('aria-valuemin')).toBe('1');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('10');
    expect(progressbar.getAttribute('aria-label')).toBe('Progres Soal Tantangan Harian');

    // Child segments verification
    expect(progressbar.children.length).toBe(10);
    // Index 0 and 1 should be passed (emerald)
    expect(progressbar.children[0].className).toContain('bg-emerald-400');
    expect(progressbar.children[1].className).toContain('bg-emerald-400');
    // Index 2 should be current (amber + pulse)
    expect(progressbar.children[2].className).toContain('bg-amber-400');
    expect(progressbar.children[2].className).toContain('animate-pulse');
    // Index 3..9 should be upcoming (indigo)
    expect(progressbar.children[3].className).toContain('bg-indigo-950');
  });

  it('does not display combo streak badge when streak <= 1', () => {
    render(
      <DailyHeader
        timeRemainingMs={60000}
        currentQuestionIdx={0}
        totalQuestions={10}
        comboStreak={1}
        stageTitle="Tahap 1"
        onExit={vi.fn()}
      />
    );

    expect(screen.queryByText(/Kombo/i)).toBeNull();
  });

  it('switches timer border and text color between within-target (emerald) and overtime (amber)', () => {
    const { rerender, container } = render(
      <DailyHeader
        timeRemainingMs={15000} // exactly at 75s elapsed (15s remaining)
        currentQuestionIdx={0}
        totalQuestions={10}
        comboStreak={0}
        stageTitle="Tahap 1"
        onExit={vi.fn()}
      />
    );

    // Green / emerald when within target (>= 15s remaining)
    expect(container.querySelector('.border-emerald-500\\/50')).not.toBeNull();
    expect(container.querySelector('.text-emerald-400')).not.toBeNull();

    // Re-render with overtime (< 15s remaining, e.g. 14999ms)
    rerender(
      <DailyHeader
        timeRemainingMs={14000}
        currentQuestionIdx={0}
        totalQuestions={10}
        comboStreak={0}
        stageTitle="Tahap 1"
        onExit={vi.fn()}
      />
    );

    // Amber when beyond target
    expect(container.querySelector('.border-amber-500\\/60')).not.toBeNull();
    expect(container.querySelector('.text-amber-400')).not.toBeNull();
  });
});
