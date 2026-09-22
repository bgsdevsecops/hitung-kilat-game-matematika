// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../../src/App';
import * as firebaseLib from '../../src/lib/firebase';
import { savePrivacyState } from '../../src/utils/privacy/privacyState';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// Mock TimeAttackScreen for simulating game finishes
vi.mock('../../src/components/TimeAttackScreen', () => ({
  TimeAttackScreen: ({ onFinish }: any) => (
    <div data-testid="mock-time-attack-screen">
      <button
        data-testid="simulate-finish-time-attack"
        onClick={() =>
          onFinish({
            sessionId: 'session_ta_test',
            mode: 'time_attack',
            score: 750,
            questionsTotal: 25,
            correctCount: 25,
            wrongCount: 0,
            accuracy: 100,
            timeSpentSec: 60,
            avgTimePerQuestionSec: 2.4,
            questionsPerMinute: 25,
            maxStreak: 25,
            starsEarned: 3,
            isNewRecord: true,
            history: [],
          })
        }
      >
        Finish Time Attack
      </button>
    </div>
  ),
}));

// Mock CompetitivePlayScreen for checking isRanked prop
vi.mock('../../src/components/competitive/CompetitivePlayScreen', () => ({
  CompetitivePlayScreen: ({ isRanked, mode, onExit }: any) => (
    <div data-testid="mock-competitive-play-screen" data-is-ranked={String(isRanked)} data-mode={mode}>
      <button data-testid="exit-competitive" onClick={onExit}>Exit</button>
    </div>
  ),
}));

let mockAuthStateCallback: ((user: any) => Promise<void> | void) | null = null;

vi.mock('../../src/lib/firebase', () => ({
  auth: { currentUser: null },
  db: null,
  loginWithGoogle: vi.fn(),
  loginAsGuest: vi.fn(),
  logoutUser: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    mockAuthStateCallback = callback;
    callback(null);
    return () => {};
  }),
  saveGameDataToCloud: vi.fn().mockResolvedValue(undefined),
  loadGameDataFromCloud: vi.fn().mockResolvedValue(null),
  submitTimeAttackScore: vi.fn().mockResolvedValue(true),
}));

describe('App Privacy & Child Safety Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders settings button in Header and opens SettingsModal on click', async () => {
    render(<App />);
    const settingsBtn = screen.getByRole('button', { name: /Buka Pengaturan dan Privasi/i });
    expect(settingsBtn).toBeDefined();

    fireEvent.click(settingsBtn);
    expect(await screen.findByRole('dialog', { name: /Pengaturan & Privasi/i })).toBeDefined();
  });

  it('triggers age gate interceptor when clicking cloud sync with unspecified age', async () => {
    render(<App />);
    const syncBtn = screen.getByRole('button', { name: /Sinkronisasi Progres/i });
    fireEvent.click(syncBtn);

    expect(await screen.findByRole('dialog', { name: /Verifikasi Usia & Privasi/i })).toBeDefined();
  });

  it('allows cloud sync modal to open when user confirms 13plus age', async () => {
    render(<App />);
    const syncBtn = screen.getByRole('button', { name: /Sinkronisasi Progres/i });
    fireEvent.click(syncBtn);

    const ageGateDialog = await screen.findByRole('dialog', { name: /Verifikasi Usia & Privasi/i });
    expect(ageGateDialog).toBeDefined();

    // Click 13+ button
    const confirm13Btn = screen.getByRole('button', { name: /13 Tahun ke Atas/i });
    fireEvent.click(confirm13Btn);

    // Sync modal should now open
    expect(await screen.findByRole('dialog', { name: /Sinkronisasi Akun Cloud/i })).toBeDefined();
  });

  it('triggers fallback and blocks cloud sync modal when user selects under13', async () => {
    render(<App />);
    const syncBtn = screen.getByRole('button', { name: /Sinkronisasi Progres/i });
    fireEvent.click(syncBtn);

    const ageGateDialog = await screen.findByRole('dialog', { name: /Verifikasi Usia & Privasi/i });
    expect(ageGateDialog).toBeDefined();

    // Click Under 13 button
    const under13Btn = screen.getByRole('button', { name: /Di Bawah 13 Tahun/i });
    fireEvent.click(under13Btn);

    // Alert should be triggered
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Mode Lokal Aman Aktif')
    );

    // Cloud sync dialog should NOT be shown
    expect(screen.queryByRole('dialog', { name: /Sinkronisasi Akun Cloud/i })).toBeNull();
  });

  it('decouples public identity from Google profile when auto-submitting leaderboard scores', async () => {
    savePrivacyState({
      pseudonym: 'KilatJuara',
      playerFlag: '🇲🇾',
      ageEligibility: '13plus',
      leaderboardOptOut: false,
    });

    render(<App />);

    // Simulate user logged in with Google identity
    await act(async () => {
      if (mockAuthStateCallback) {
        await mockAuthStateCallback({
          uid: 'google-user-789',
          displayName: 'Real Google Name',
          photoURL: 'https://lh3.googleusercontent.com/avatar.jpg',
        });
      }
    });

    // Start Time Attack mode
    const timeAttackBtn = screen.getByRole('button', { name: /Lari Kilat 60s/i });
    fireEvent.click(timeAttackBtn);

    // Finish Time Attack
    const finishBtn = await screen.findByTestId('simulate-finish-time-attack');
    fireEvent.click(finishBtn);

    expect(firebaseLib.submitTimeAttackScore).toHaveBeenCalledWith({
      userId: 'google-user-789',
      displayName: 'KilatJuara', // Used pseudonym, decoupled from 'Real Google Name'
      photoURL: null, // Strictly decoupled from Google photoURL
      score: 750,
      accuracy: 100,
      streak: 25,
      solvedCount: 25,
      playerFlag: '🇲🇾',
    });
  });

  it('respects leaderboardOptOut by skipping auto-submit to leaderboard', async () => {
    savePrivacyState({
      pseudonym: 'PemainRahasia',
      ageEligibility: '13plus',
      leaderboardOptOut: true, // Opted out
    });

    render(<App />);

    await act(async () => {
      if (mockAuthStateCallback) {
        await mockAuthStateCallback({
          uid: 'google-user-optout',
          displayName: 'Secret Player',
          photoURL: null,
        });
      }
    });

    // Start Time Attack mode
    const timeAttackBtn = screen.getByRole('button', { name: /Lari Kilat 60s/i });
    fireEvent.click(timeAttackBtn);

    // Finish Time Attack
    const finishBtn = await screen.findByTestId('simulate-finish-time-attack');
    fireEvent.click(finishBtn);

    // Must NOT submit to leaderboard when opted out
    expect(firebaseLib.submitTimeAttackScore).not.toHaveBeenCalled();
  });

  it('blocks leaderboard auto-submit when user is under13', async () => {
    savePrivacyState({
      pseudonym: 'AnakCerdas',
      ageEligibility: 'under13', // Child safety protection
      leaderboardOptOut: false,
    });

    render(<App />);

    await act(async () => {
      if (mockAuthStateCallback) {
        await mockAuthStateCallback({
          uid: 'child-user-123',
          displayName: 'Child User',
          photoURL: null,
        });
      }
    });

    // Start Time Attack mode
    const timeAttackBtn = screen.getByRole('button', { name: /Lari Kilat 60s/i });
    fireEvent.click(timeAttackBtn);

    // Finish Time Attack
    const finishBtn = await screen.findByTestId('simulate-finish-time-attack');
    fireEvent.click(finishBtn);

    // Must NOT submit to leaderboard for under13
    expect(firebaseLib.submitTimeAttackScore).not.toHaveBeenCalled();
  });

  it('suppresses automatic cloud sync on auth change if age is under13', async () => {
    savePrivacyState({
      ageEligibility: 'under13',
    });

    render(<App />);

    await act(async () => {
      if (mockAuthStateCallback) {
        await mockAuthStateCallback({
          uid: 'child-user-restored',
          displayName: 'Restored Child',
          photoURL: null,
        });
      }
    });

    // Cloud load and save should be suppressed for under-13 user
    expect(firebaseLib.loadGameDataFromCloud).not.toHaveBeenCalled();
    expect(firebaseLib.saveGameDataToCloud).not.toHaveBeenCalled();
  });

  it('allows reopening age gate from SettingsModal via Ubah Kelompok Usia', async () => {
    savePrivacyState({
      ageEligibility: '13plus',
    });

    render(<App />);

    // Open settings modal
    const settingsBtn = screen.getByRole('button', { name: /Buka Pengaturan dan Privasi/i });
    fireEvent.click(settingsBtn);

    const settingsDialog = await screen.findByRole('dialog', { name: /Pengaturan & Privasi/i });
    expect(settingsDialog).toBeDefined();

    // Click Ubah Kelompok Usia button
    const changeAgeBtn = await screen.findByRole('button', { name: /Ubah Kelompok Usia/i });
    fireEvent.click(changeAgeBtn);

    // AgeGateModal should be opened
    const ageGateDialog = await screen.findByRole('dialog', { name: /Verifikasi Usia & Privasi/i });
    expect(ageGateDialog).toBeDefined();
  });

  it('sets isRanked to false in CompetitivePlayScreen for under13 or opted-out users', async () => {
    savePrivacyState({
      ageEligibility: 'under13',
      leaderboardOptOut: false,
    });

    render(<App />);

    // Log in user
    await act(async () => {
      if (mockAuthStateCallback) {
        await mockAuthStateCallback({
          uid: 'competitive-child',
          displayName: 'Child Comp',
        });
      }
    });

    // Open competitive mode modal
    const compBtn = screen.getByRole('button', { name: /Mode Kompetitif \(Sprint & Survival\)/i });
    fireEvent.click(compBtn);

    // Select Sprint 60s from modal
    const sprintOption = await screen.findByText(/Escalation tier adaptif hingga 6/i);
    fireEvent.click(sprintOption);

    const compScreen = await screen.findByTestId('mock-competitive-play-screen');
    expect(compScreen.getAttribute('data-is-ranked')).toBe('false');
  });

  it('sets isRanked to true in CompetitivePlayScreen for 13plus users not opted out', async () => {
    savePrivacyState({
      ageEligibility: '13plus',
      leaderboardOptOut: false,
    });

    render(<App />);

    // Log in user
    await act(async () => {
      if (mockAuthStateCallback) {
        await mockAuthStateCallback({
          uid: 'competitive-adult',
          displayName: 'Adult Comp',
        });
      }
    });

    // Open competitive mode modal
    const compBtn = screen.getByRole('button', { name: /Mode Kompetitif \(Sprint & Survival\)/i });
    fireEvent.click(compBtn);

    // Select Sprint 60s from modal
    const sprintOption = await screen.findByText(/Escalation tier adaptif hingga 6/i);
    fireEvent.click(sprintOption);

    const compScreen = await screen.findByTestId('mock-competitive-play-screen');
    expect(compScreen.getAttribute('data-is-ranked')).toBe('true');
  });
});
