// tests/unit/globalMasteryIntegration.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { getMasteryStore } from '../../src/utils/masteryBridge';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock recharts ResponsiveContainer for JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

// Mock firebase
vi.mock('../../src/lib/firebase', () => ({
  auth: {},
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return vi.fn();
  }),
  loginWithGoogle: vi.fn(),
  loginAsGuest: vi.fn(),
  logoutUser: vi.fn(),
  saveGameDataToCloud: vi.fn(),
  loadGameDataFromCloud: vi.fn().mockResolvedValue(null),
  mergeGameProgress: vi.fn((a) => a),
  submitTimeAttackScore: vi.fn().mockResolvedValue(true),
  fetchTopTimeAttackScores: vi.fn().mockResolvedValue([]),
}));

// Mock soundManager
vi.mock('../../src/utils/sound', () => ({
  soundManager: {
    playClick: vi.fn(),
    playCorrect: vi.fn(),
    playWrong: vi.fn(),
    playFanfare: vi.fn(),
    playGameOver: vi.fn(),
    toggleMute: vi.fn(),
    getMuted: vi.fn(() => false),
  },
}));

// Mock PlayScreen to allow deterministic game completion simulation
vi.mock('../../src/components/PlayScreen', () => ({
  PlayScreen: ({ onFinishLevel, onExit }: any) => (
    <div data-testid="mock-play-screen">
      <button
        data-testid="simulate-finish-level"
        onClick={() =>
          onFinishLevel({
            sessionId: 'test_session_101',
            mode: 'campaign',
            levelId: 1,
            score: 850,
            questionsTotal: 2,
            correctCount: 1,
            wrongCount: 1,
            accuracy: 50,
            timeSpentSec: 15,
            avgTimePerQuestionSec: 7.5,
            questionsPerMinute: 8,
            maxStreak: 1,
            starsEarned: 1,
            isNewRecord: false,
            history: [
              {
                id: 'q_test_add1',
                prompt: '3 + 4',
                correctAnswer: 7,
                userAnswer: 7,
                isCorrect: true,
                timeSpentMs: 2400,
                difficulty: 1,
                subSkillId: 'addition.single_digit',
              },
              {
                id: 'q_test_add2',
                prompt: '8 + 9',
                correctAnswer: 17,
                userAnswer: 16,
                isCorrect: false,
                timeSpentMs: 3800,
                difficulty: 2,
                subSkillId: 'addition.carry',
              },
            ],
          })
        }
      >
        Simulate Finish Level
      </button>
      <button
        data-testid="simulate-finish-empty"
        onClick={() =>
          onFinishLevel({
            sessionId: 'test_session_empty',
            mode: 'campaign',
            levelId: 1,
            score: 0,
            questionsTotal: 0,
            correctCount: 0,
            wrongCount: 0,
            accuracy: 0,
            timeSpentSec: 0,
            avgTimePerQuestionSec: 0,
            questionsPerMinute: 0,
            maxStreak: 0,
            starsEarned: 0,
            isNewRecord: false,
            history: [],
          })
        }
      >
        Simulate Finish Empty
      </button>
      <button data-testid="mock-exit-playscreen" onClick={onExit}>
        Exit PlayScreen
      </button>
    </div>
  ),
}));

describe('Global Mastery Integration in App.tsx', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
    vi.clearAllMocks();
  });

  it('renders application with mastery-ready components without errors', () => {
    render(<App />);
    expect(screen.getAllByText(/Hitung Kilat/i).length).toBeGreaterThan(0);
    expect(document.getElementById('practice-mode-button')).toBeDefined();
  });

  it('ingests answer history into MasteryStore upon completing a game', () => {
    render(<App />);

    // Select Level 1 to enter PlayScreen
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);

    // PlayScreen is rendered
    expect(screen.getByTestId('mock-play-screen')).toBeDefined();

    // Verify MasteryStore is empty before finish
    expect(getMasteryStore().getAllEvents().length).toBe(0);

    // Simulate game completion
    fireEvent.click(screen.getByTestId('simulate-finish-level'));

    // Verify answers were ingested into MasteryStore
    const events = getMasteryStore().getAllEvents();
    expect(events.length).toBe(2);

    const correctEvent = events.find((e) => e.subSkillId === 'addition.single_digit');
    expect(correctEvent).toBeDefined();
    expect(correctEvent?.isCorrect).toBe(true);
    expect(correctEvent?.responseTimeMs).toBe(2400);

    const wrongEvent = events.find((e) => e.subSkillId === 'addition.carry');
    expect(wrongEvent).toBeDefined();
    expect(wrongEvent?.isCorrect).toBe(false);
    expect(wrongEvent?.responseTimeMs).toBe(3800);
  });

  it('navigates directly to practice mode in remediation tab when Latih Kesalahan is clicked on ResultModal', () => {
    render(<App />);

    // Select Level 1 to enter PlayScreen
    fireEvent.click(document.getElementById('level-card-1')!);

    // Finish game with 1 error
    fireEvent.click(screen.getByTestId('simulate-finish-level'));

    // ResultModal should show Latih Kesalahan button
    const remBtn = document.getElementById('result-remediation-button');
    expect(remBtn).toBeDefined();
    expect(remBtn?.textContent).toContain('Latih Kesalahan (1)');

    // Click Latih Kesalahan button
    fireEvent.click(remBtn!);

    // ResultModal should be dismissed, and PracticeScreen rendered in remediation tab
    expect(document.getElementById('result-remediation-button')).toBeNull();
    expect(screen.getByText(/Arena Latihan Cerdas/i)).toBeDefined();

    // Verify Latih Kesalahan tab is active
    const remediationTab = screen.getByRole('tab', { name: /latih kesalahan/i });
    expect(remediationTab.getAttribute('aria-selected')).toBe('true');
  });

  it('navigates to practice mode in adaptive tab when heatmap practice is triggered in StatsModal', async () => {
    render(<App />);

    // Open StatsModal from Header
    const statsBtn = document.getElementById('stats-modal-trigger');
    expect(statsBtn).toBeDefined();
    fireEvent.click(statsBtn!);

    // Switch to Mastery tab
    const masteryTab = document.getElementById('tab-mastery');
    expect(masteryTab).toBeDefined();
    fireEvent.click(masteryTab!);

    // Find and click "Penjumlahan Satu Digit" sub-skill chip to open detail modal
    const subSkillChip = screen.getByText('Penjumlahan Satu Digit');
    expect(subSkillChip).toBeDefined();
    fireEvent.click(subSkillChip);

    // Click "Latih Sub-Skill Ini" in SubSkillDetailModal
    const startPracticeBtn = screen.getByText('Latih Sub-Skill Ini');
    expect(startPracticeBtn).toBeDefined();
    fireEvent.click(startPracticeBtn);

    // StatsModal should close and PracticeScreen should open targeted arena directly
    expect(screen.queryByText(/Statistik & Pencapaian/i)).toBeNull();
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();

    // Exiting arena returns to Hub with adaptive tab active
    const exitBtn = screen.getByText('Keluar').closest('button')!;
    fireEvent.click(exitBtn);

    expect(screen.getByText(/Arena Latihan Cerdas/i)).toBeDefined();
    const adaptiveTab = screen.getByRole('tab', { name: /latihan adaptif ai/i });
    expect(adaptiveTab.getAttribute('aria-selected')).toBe('true');
  });

  it('opens StatsModal on mastery tab when Peta Keahlian is clicked from PracticeScreen', () => {
    render(<App />);

    // Open practice mode from LevelMap
    const practiceModeBtn = document.getElementById('practice-mode-button');
    expect(practiceModeBtn).toBeDefined();
    fireEvent.click(practiceModeBtn!);

    // Verify PracticeScreen is visible
    expect(screen.getByText(/Arena Latihan Cerdas/i)).toBeDefined();

    // Click "Peta Keahlian" button in PracticeScreen header
    const petaKeahlianBtn = screen.getByRole('button', { name: /peta keahlian/i });
    expect(petaKeahlianBtn).toBeDefined();
    fireEvent.click(petaKeahlianBtn);

    // StatsModal should open with Peta Keahlian tab active
    expect(screen.getByText(/Statistik & Pencapaian/i)).toBeDefined();
    const masteryTab = document.getElementById('tab-mastery');
    expect(masteryTab).toBeDefined();
    expect(masteryTab?.className).toContain('from-emerald-600');
    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
  });

  it('handles empty history gracefully without errors or ingesting events', () => {
    render(<App />);

    fireEvent.click(document.getElementById('level-card-1')!);

    // Simulate completion with empty history
    const finishEmptyBtn = screen.getByTestId('simulate-finish-empty');
    fireEvent.click(finishEmptyBtn);

    // Verify empty history does not ingest anything into MasteryStore
    expect(getMasteryStore().getAllEvents().length).toBe(0);
  });

  it('resets practiceInitialTab to adaptive when launching practice from LevelMap', () => {
    render(<App />);

    // First, launch remediation via game finish
    fireEvent.click(document.getElementById('level-card-1')!);
    fireEvent.click(screen.getByTestId('simulate-finish-level'));
    fireEvent.click(document.getElementById('result-remediation-button')!);

    // PracticeScreen should be in remediation tab
    let remediationTab = screen.getByRole('tab', { name: /latih kesalahan/i });
    expect(remediationTab.getAttribute('aria-selected')).toBe('true');

    // Exit practice back to home
    const backBtn = screen.getByLabelText('Kembali');
    fireEvent.click(backBtn);

    // Now launch practice from LevelMap button
    const practiceModeBtn = document.getElementById('practice-mode-button');
    fireEvent.click(practiceModeBtn!);

    // PracticeScreen should now have adaptive tab active
    const adaptiveTab = screen.getByRole('tab', { name: /latihan adaptif ai/i });
    expect(adaptiveTab.getAttribute('aria-selected')).toBe('true');
  });
});
