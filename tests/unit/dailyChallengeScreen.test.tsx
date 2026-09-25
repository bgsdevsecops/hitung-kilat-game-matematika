// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DailyChallengeScreen } from '../../src/components/DailyChallengeScreen';
import { soundManager } from '../../src/utils/sound';
import {
  getWIBDateString,
  getYesterdayWIBDateString,
  generateDailyQuestions,
} from '../../src/utils/dailyWib';
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
    expect(screen.getByRole('heading', { name: /Peringkat Benchmark Global/i })).toBeDefined();
    expect(screen.getByText(/Papan peringkat hanya tersedia untuk pemain terverifikasi/i)).toBeDefined();
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

  it('supports physical keyboard input during gameplay (0-9, -, /, Backspace, Enter, Escape)', async () => {
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

    // Escape should abandon session and return to hub where the official attempt is consumed
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText(/Kesempatan Resmi Telah Digunakan/i, {}, { timeout: 4000 })).toBeDefined();
    expect(await screen.findByRole('button', { name: /Main Ulang.*Mode Latihan/i }, { timeout: 4000 })).toBeDefined();
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

  it('enforces anti-reroll: starting ranked challenge consumes the daily slot immediately in localStorage', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    const todayStr = getWIBDateString();

    // Start challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    // Slot must be recorded as consumed immediately (completed: false)
    const raw = localStorage.getItem('hitung_kilat_daily_challenge_v1');
    expect(raw).not.toBeNull();
    const parsed: DailyChallengeUserState = JSON.parse(raw!);
    expect(parsed.history[todayStr]).toBeDefined();
    expect(parsed.history[todayStr].completed).toBe(false);

    // Abandon session via Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Now on hub, should show official attempt was consumed
    expect(screen.getByText(/Kesempatan Resmi Telah Digunakan/i)).toBeDefined();
    expect(screen.getAllByText(/0 Poin/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Main Ulang.*Mode Latihan/i })).toBeDefined();
  });

  it('maintains streak continuity when completing consecutively from yesterday WIB', () => {
    vi.useFakeTimers();
    const todayStr = getWIBDateString();
    const yesterdayStr = getYesterdayWIBDateString();

    // User completed yesterday's challenge with streak of 3
    const existingState: DailyChallengeUserState = {
      playerName: 'Ksatria Kilat',
      playerCountry: 'ID',
      playerFlag: '🇮🇩',
      currentStreak: 3,
      bestStreak: 5,
      lastCompletedDate: yesterdayStr,
      history: {
        [yesterdayStr]: {
          date: yesterdayStr,
          completed: true,
          score: 1800,
          timeTakenSec: 40,
          correctCount: 8,
          totalQuestions: 10,
          accuracy: 80,
          maxStreak: 5,
          rank: 1,
          completedAt: new Date().toISOString(),
          answers: [],
        },
      },
    };
    localStorage.setItem('hitung_kilat_daily_challenge_v1', JSON.stringify(existingState));

    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Start today's challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    const challengeId = `${todayStr}@Asia/Jakarta:2.0.0`;
    const questions = generateDailyQuestions(challengeId);

    // Answer all 10 questions correctly
    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(1200);
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

    // Streak should increment from 3 to 4
    const raw = localStorage.getItem('hitung_kilat_daily_challenge_v1');
    const parsed: DailyChallengeUserState = JSON.parse(raw!);
    expect(parsed.currentStreak).toBe(4);
    expect(parsed.lastCompletedDate).toBe(todayStr);

    vi.useRealTimers();
  });

  it('resets streak to 1 when a day was skipped between completions', () => {
    vi.useFakeTimers();
    const todayStr = getWIBDateString();
    const olderDate = '2026-09-01'; // Missed several days

    const existingState: DailyChallengeUserState = {
      playerName: 'Ksatria Kilat',
      playerCountry: 'ID',
      playerFlag: '🇮🇩',
      currentStreak: 7,
      bestStreak: 10,
      lastCompletedDate: olderDate,
      history: {},
    };
    localStorage.setItem('hitung_kilat_daily_challenge_v1', JSON.stringify(existingState));

    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Start today's challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    const challengeId = `${todayStr}@Asia/Jakarta:2.0.0`;
    const questions = generateDailyQuestions(challengeId);

    // Answer all 10 questions correctly
    for (let i = 0; i < 10; i++) {
      act(() => {
        vi.advanceTimersByTime(1200);
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

    // Streak should reset to 1 because yesterday was not completed
    const raw = localStorage.getItem('hitung_kilat_daily_challenge_v1');
    const parsed: DailyChallengeUserState = JSON.parse(raw!);
    expect(parsed.currentStreak).toBe(1);
    expect(parsed.lastCompletedDate).toBe(todayStr);

    vi.useRealTimers();
  });

  it('resets streak to 0 when ranked attempt is abandoned', () => {
    const todayStr = getWIBDateString();
    const yesterdayStr = getYesterdayWIBDateString();

    const existingState: DailyChallengeUserState = {
      playerName: 'Ksatria Kilat',
      playerCountry: 'ID',
      playerFlag: '🇮🇩',
      currentStreak: 4,
      bestStreak: 6,
      lastCompletedDate: yesterdayStr,
      history: {},
    };
    localStorage.setItem('hitung_kilat_daily_challenge_v1', JSON.stringify(existingState));

    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Start ranked challenge
    fireEvent.click(screen.getByRole('button', { name: /mulai tantangan/i }));

    // Abandon session via Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Verify streak is reset to 0 in localStorage
    const raw = localStorage.getItem('hitung_kilat_daily_challenge_v1');
    const parsed: DailyChallengeUserState = JSON.parse(raw!);
    expect(parsed.currentStreak).toBe(0);
    expect(parsed.history[todayStr].completed).toBe(false);
  });

  it('renders Mode Latihan Arsip when navigating to a past date without record', () => {
    render(<DailyChallengeScreen onExit={vi.fn()} onOpenStats={vi.fn()} />);

    // Navigate to previous day
    const prevBtn = screen.getByRole('button', { name: /Hari Sebelumnya/i });
    fireEvent.click(prevBtn);

    // Should display Mode Latihan Arsip and Mulai Latihan button
    expect(screen.getByText(/Mode Latihan Arsip/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Mulai Latihan Arsip/i })).toBeDefined();
  });
});
