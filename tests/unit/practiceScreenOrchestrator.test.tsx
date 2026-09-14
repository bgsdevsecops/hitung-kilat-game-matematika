// tests/unit/practiceScreenOrchestrator.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeScreen, generateCustomQuestions } from '../../src/components/PracticeScreen';
import { getMasteryStore, ingestGameAnswers } from '../../src/utils/masteryBridge';

describe('PracticeScreen Orchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('renders PracticeHubView by default and transitions through playing and summary states', () => {
    render(<PracticeScreen onExit={vi.fn()} />);

    // Default view is Hub
    expect(screen.getByText(/Latihan Adaptif AI/i)).toBeDefined();

    // Start adaptive practice
    const startBtn = screen.getByRole('button', { name: /mulai latihan adaptif/i });
    fireEvent.click(startBtn);

    // Transitions to Arena
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();
    expect(screen.getByText('Keluar')).toBeDefined();
  });

  it('navigates back to hub when exiting play arena', () => {
    render(<PracticeScreen onExit={vi.fn()} />);

    const startBtn = screen.getByRole('button', { name: /mulai latihan adaptif/i });
    fireEvent.click(startBtn);

    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();

    const exitBtn = screen.getByRole('button', { name: /kembali/i });
    fireEvent.click(exitBtn);

    expect(screen.getByText(/Latihan Adaptif AI/i)).toBeDefined();
  });

  it('supports initialTab prop to open custom tab directly', () => {
    render(<PracticeScreen onExit={vi.fn()} initialTab="custom" />);

    expect(screen.getByText(/Pilih Operasi Matematika/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /mulai latihan kustom/i })).toBeDefined();
  });

  it('calls onExit when clicking exit button in hub', () => {
    const handleExit = vi.fn();
    render(<PracticeScreen onExit={handleExit} />);

    const backBtn = screen.getByRole('button', { name: 'Kembali' });
    fireEvent.click(backBtn);

    expect(handleExit).toHaveBeenCalledTimes(1);
  });

  it('starts custom practice and ingests answers to mastery store upon completion', () => {
    const handleExit = vi.fn();
    const handleOpenStats = vi.fn();

    render(
      <PracticeScreen
        onExit={handleExit}
        initialTab="custom"
        onOpenStats={handleOpenStats}
        userId="test_user_orchestrator"
      />
    );

    // In custom tab, select 10 questions and click start
    const startCustomBtn = screen.getByRole('button', { name: /mulai latihan kustom/i });
    fireEvent.click(startCustomBtn);

    // Transitions to arena with 10 questions
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();

    // Answer all 10 questions by submitting answers
    for (let i = 1; i <= 10; i++) {
      // Type '0' on virtual keypad
      const zeroBtn = screen.getByRole('button', { name: '0' });
      fireEvent.click(zeroBtn);

      // Click submit
      const submitBtn = screen.getByRole('button', { name: /kirim jawaban/i });
      fireEvent.click(submitBtn);
    }

    // Should transition to Summary View
    expect(screen.getByText(/Sesi Selesai!/i)).toBeDefined();
    expect(screen.getByText(/Perkembangan Keahlian Terlatih/i)).toBeDefined();

    // Verify answers were ingested into MasteryStore
    const store = getMasteryStore();
    const events = store.getAllEvents();
    expect(events.length).toBe(10);
    expect(events[0].sessionId).toMatch(/^practice_/);

    // Test Summary buttons:
    // 1. Open Mastery Map
    const masteryMapBtn = screen.getByRole('button', { name: /buka peta keahlian/i });
    fireEvent.click(masteryMapBtn);
    expect(handleOpenStats).toHaveBeenCalledTimes(1);

    // 2. Play Again
    const playAgainBtn = screen.getByRole('button', { name: /lanjut latihan/i });
    fireEvent.click(playAgainBtn);
    // Should replay custom practice and show arena again
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();
  });

  it('handles summary exit button', () => {
    const handleExit = vi.fn();

    render(
      <PracticeScreen
        onExit={handleExit}
        initialTab="custom"
      />
    );

    const startCustomBtn = screen.getByRole('button', { name: /mulai latihan kustom/i });
    fireEvent.click(startCustomBtn);

    // Submit 10 questions
    for (let i = 1; i <= 10; i++) {
      const oneBtn = screen.getByRole('button', { name: '1' });
      fireEvent.click(oneBtn);
      const submitBtn = screen.getByRole('button', { name: /kirim jawaban/i });
      fireEvent.click(submitBtn);
    }

    // Now in Summary View
    expect(screen.getByText(/Sesi Selesai!/i)).toBeDefined();

    const homeBtn = screen.getByRole('button', { name: /kembali ke menu utama/i });
    fireEvent.click(homeBtn);
    expect(handleExit).toHaveBeenCalledTimes(1);
  });

  it('falls back to hub when opening mastery map from summary without onOpenStats', () => {
    render(<PracticeScreen onExit={vi.fn()} initialTab="custom" />);

    const startCustomBtn = screen.getByRole('button', { name: /mulai latihan kustom/i });
    fireEvent.click(startCustomBtn);

    for (let i = 1; i <= 10; i++) {
      const oneBtn = screen.getByRole('button', { name: '1' });
      fireEvent.click(oneBtn);
      const submitBtn = screen.getByRole('button', { name: /kirim jawaban/i });
      fireEvent.click(submitBtn);
    }

    expect(screen.getByText(/Sesi Selesai!/i)).toBeDefined();

    const masteryMapBtn = screen.getByRole('button', { name: /buka peta keahlian/i });
    fireEvent.click(masteryMapBtn);

    // Should return to hub
    expect(screen.getByText(/Latihan Adaptif AI/i)).toBeDefined();
  });

  it('completes adaptive practice and supports replay in summary', () => {
    render(<PracticeScreen onExit={vi.fn()} initialTab="adaptive" />);

    const startBtn = screen.getByRole('button', { name: /mulai latihan adaptif/i });
    fireEvent.click(startBtn);

    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();

    for (let i = 1; i <= 10; i++) {
      const oneBtn = screen.getByRole('button', { name: '1' });
      fireEvent.click(oneBtn);
      const submitBtn = screen.getByRole('button', { name: /kirim jawaban/i });
      fireEvent.click(submitBtn);
    }

    expect(screen.getByText(/Sesi Selesai!/i)).toBeDefined();

    const playAgainBtn = screen.getByRole('button', { name: /lanjut latihan/i });
    fireEvent.click(playAgainBtn);

    // Replays adaptive session
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();
  });

  it('plays remediation mode when error history is present', () => {
    // Populate store with failed questions via ingestGameAnswers
    ingestGameAnswers('sess_prev', 'test_user', [
      {
        questionId: 'q_fail_1',
        primarySkillId: 'addition',
        subSkillId: 'addition.carry',
        skillTags: ['addition', 'addition.carry'],
        templateFamily: 'addition_carry',
        difficulty: 3,
        responseTimeMs: 5000,
        isCorrect: false,
      },
    ]);

    render(<PracticeScreen onExit={vi.fn()} initialTab="remediation" />);

    // Start remediation
    const startRemBtn = screen.getByRole('button', { name: /mulai latih kesalahan/i });
    fireEvent.click(startRemBtn);

    // Should transition to arena
    expect(screen.getByText(/Soal 1 dari/i)).toBeDefined();
  });

  it('launches directly into arena targeting targetSubSkillId when provided and clears on exit', () => {
    const handleExit = vi.fn();
    const handleClearTarget = vi.fn();

    render(
      <PracticeScreen
        onExit={handleExit}
        initialTab="adaptive"
        targetSubSkillId="multiplication.x7"
        onClearTargetSubSkill={handleClearTarget}
      />
    );

    // Should immediately be in arena targeting multiplication.x7
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();

    // Exit arena
    const exitBtn = screen.getByRole('button', { name: /kembali/i });
    fireEvent.click(exitBtn);

    expect(handleClearTarget).toHaveBeenCalled();
    // Navigated back to hub
    expect(screen.getByText(/Latihan Adaptif AI/i)).toBeDefined();
  });
});

describe('generateCustomQuestions Helper', () => {
  it('generates requested number of questions with compliant Question structure', () => {
    const qs = generateCustomQuestions({
      operation: '+',
      numberRange: 10,
      questionCount: 5,
    });

    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(q.id).toBeDefined();
      expect(q.prompt).toBeDefined();
      expect(q.displayPrompt).toBe(q.prompt);
      expect(q.answerSpec).toBeDefined();
      expect(q.answerSpec.kind).toBe('integer');
      expect((q.answerSpec as any).value).toBe((q as any).correctAnswer);
      expect(q.primarySkillId).toBe('addition');
      expect(q.subSkillId).toBe('addition.single_digit');
      expect(q.difficulty).toBe(1);
    }
  });

  it('handles subtraction, multiplication, division, and mix operations with dynamic subSkillId', () => {
    const subQuestions = generateCustomQuestions({
      operation: '-',
      numberRange: 20,
      questionCount: 4,
    });
    expect(subQuestions).toHaveLength(4);
    expect(subQuestions[0].primarySkillId).toBe('subtraction');
    expect(subQuestions[0].subSkillId).toBeDefined();

    const mulQuestions = generateCustomQuestions({
      operation: '*',
      numberRange: 50,
      questionCount: 4,
    });
    expect(mulQuestions).toHaveLength(4);
    expect(mulQuestions[0].primarySkillId).toBe('multiplication');
    expect(mulQuestions[0].subSkillId).toMatch(/^multiplication\.x\d+$/);

    const divQuestions = generateCustomQuestions({
      operation: '/',
      numberRange: 100,
      questionCount: 4,
    });
    expect(divQuestions).toHaveLength(4);
    expect(divQuestions[0].primarySkillId).toBe('division');
    expect(divQuestions[0].subSkillId).toMatch(/^division\./);

    const mixQuestions = generateCustomQuestions({
      operation: 'mix',
      numberRange: 20,
      questionCount: 8,
    });
    expect(mixQuestions).toHaveLength(8);
  });
});


