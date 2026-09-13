// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DailyChallengeScreen } from '../../src/components/DailyChallengeScreen';
import { soundManager } from '../../src/utils/sound';
import { getWIBDateString, generateDailyQuestions } from '../../src/utils/dailyWib';
import { DailyChallengeUserState } from '../../src/types';

describe('DailyChallengeScreen Integration', () => {
  beforeEach(() => {
    vi.spyOn(soundManager, 'playCorrect').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playWrong').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders DailyHubView initially with WIB countdown and start button', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    expect(screen.getByText(/Tantangan Harian/i)).toBeDefined();
    expect(screen.getByText(/Reset dlm/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /mulai tantangan/i })).toBeDefined();
  });

  it('transitions from hub to gameplay on start challenge button click', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /mulai tantangan/i });
    fireEvent.click(startBtn);

    // Should render input and keypad
    expect(screen.getByPlaceholderText('Ketik jawaban...')).toBeDefined();
    expect(screen.getByRole('button', { name: '5' })).toBeDefined();
  });

  it('renders 10-stage curated question preview grid and leaderboard table in DailyHubView', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Stage preview section
    expect(screen.getByRole('heading', { name: /Rincian 10 Tahap Soal Curated/i })).toBeDefined();
    expect(screen.getByText('Refleks Puluhan')).toBeDefined();
    expect(screen.getByText('Grandmaster Math')).toBeDefined();

    // Leaderboard section
    expect(screen.getByRole('heading', { name: /Peringkat Global/i })).toBeDefined();
    expect(screen.getByRole('table')).toBeDefined();
  });

  it('handles date navigation in DailyHubView (prev day and next day disabled for today)', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    const prevBtn = screen.getByRole('button', { name: /Hari Sebelumnya/i });
    const nextBtn = screen.getByRole('button', { name: /Hari Berikutnya/i });

    // Next day should initially be disabled because selectedDate === today
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    // Click previous day
    fireEvent.click(prevBtn);

    // Next day should now be enabled
    expect(nextBtn.hasAttribute('disabled')).toBe(false);

    // Click next day to return to today
    fireEvent.click(nextBtn);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);
  });

  it('supports typing with virtual touch keypad and submitting answers during gameplay', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Start challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;
    expect(inputEl.value).toBe('');

    // Press '4', then '2'
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(inputEl.value).toBe('42');

    // Press Backspace
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(inputEl.value).toBe('4');

    // Press Submit
    fireEvent.click(screen.getByRole('button', { name: /Submit Jawaban/i }));
    expect(soundManager.playCorrect).toHaveBeenCalledTimes(0);
    // (input buffer is cleared after submission)
    expect(inputEl.value).toBe('');
  });

  it('supports physical keyboard input during gameplay (0-9, -, /, Backspace, Enter, Escape)', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Start challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    const inputEl = screen.getByPlaceholderText('Ketik jawaban...') as HTMLInputElement;

    // Type numbers via keyboard
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: '8' });
    expect(inputEl.value).toBe('78');

    // Backspace
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(inputEl.value).toBe('7');

    // Minus key
    fireEvent.keyDown(window, { key: '-' });
    expect(inputEl.value).toBe('-7');

    // Enter to submit
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(inputEl.value).toBe('');

    // Escape should return to hub
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /mulai tantangan/i })).toBeDefined();
  });

  it('completes 10 questions and transitions to DailyResultView with streak and score persistence', () => {
    vi.useFakeTimers();
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Start challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    const todayStr = getWIBDateString();
    const challengeId = `${todayStr}@Asia/Jakarta:2.0.0`;
    const questions = generateDailyQuestions(challengeId);

    // Answer all 10 questions with valid answers and >= 120ms latency
    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      const q = questions[i];
      const ansStr = String(q.answerSpec.value);
      for (const char of ansStr) {
        if (char === '-') {
          fireEvent.click(screen.getByRole('button', { name: /minus|negatif/i }));
        } else if (char === '/') {
          fireEvent.click(screen.getByRole('button', { name: /garis miring|pecahan/i }));
        } else {
          fireEvent.click(screen.getByRole('button', { name: char }));
        }
      }
      fireEvent.click(screen.getByRole('button', { name: /Submit Jawaban/i }));
    }

    // Should transition to DailyResultView
    expect(screen.getByText(/Tantangan Harian Selesai!/i)).toBeDefined();
    expect(screen.getByText(/Total Poin Diperoleh/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Main Ulang Mode Latihan/i })).toBeDefined();

    // Verify localStorage has saved the record
    const saved = localStorage.getItem('hitung_kilat_daily_challenge_v1');
    expect(saved).not.toBeNull();
    const parsed: DailyChallengeUserState = JSON.parse(saved!);
    expect(parsed.history[todayStr]).toBeDefined();
    expect(parsed.history[todayStr].completed).toBe(true);
    expect(parsed.currentStreak).toBe(1);

    vi.useRealTimers();
  });

  it('renders Main Ulang (Mode Latihan) button when today record already exists in userState', () => {
    const todayStr = getWIBDateString();
    const existingState: DailyChallengeUserState = {
      playerName: 'Ksatria Kilat',
      playerCountry: 'ID',
      playerFlag: '🇮🇩',
      currentStreak: 3,
      bestStreak: 5,
      lastCompletedDate: todayStr,
      history: {
        [todayStr]: {
          date: todayStr,
          completed: true,
          score: 1850,
          timeTakenSec: 45.2,
          correctCount: 8,
          totalQuestions: 10,
          accuracy: 80,
          maxStreak: 6,
          rank: 2,
          completedAt: new Date().toISOString(),
          answers: [],
        },
      },
    };
    localStorage.setItem('hitung_kilat_daily_challenge_v1', JSON.stringify(existingState));

    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Should show record badge and replay button
    expect(screen.getByText(/Rekor Resmi Hari Ini Tercatat/i)).toBeDefined();
    expect(screen.getByText(/1850 Poin/i)).toBeDefined();
    const replayBtn = screen.getByRole('button', { name: /Main Ulang Tantangan \(Mode Latihan\)/i });
    expect(replayBtn).toBeDefined();

    // Clicking replay button enters gameplay
    fireEvent.click(replayBtn);
    expect(screen.getByPlaceholderText('Ketik jawaban...')).toBeDefined();
  });

  it('ensures all interactive buttons in DailyHubView have >= 48px targets', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[48px]');
      expect(btn.className).toContain('min-w-[48px]');
    });
  });
});
