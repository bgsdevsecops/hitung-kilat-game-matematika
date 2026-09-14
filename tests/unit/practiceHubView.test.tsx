// tests/unit/practiceHubView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PracticeHubView,
  PracticeHubViewProps,
  CustomPracticeConfig,
} from '../../src/components/practice/PracticeHubView';
import { getMasteryStore } from '../../src/utils/masteryBridge';
import { soundManager } from '../../src/utils/sound';
import { StoredAnswerEvent } from '../../src/engine/mastery/types';

describe('PracticeHubView Component', () => {
  const defaultProps: PracticeHubViewProps = {
    onStartAdaptive: vi.fn(),
    onStartRemediation: vi.fn(),
    onStartCustom: vi.fn(),
    onOpenStats: vi.fn(),
    onExit: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  describe('Top Bar and Navigation', () => {
    it('renders the header with title "Arena Latihan Cerdas", back button, and stats button', () => {
      render(<PracticeHubView {...defaultProps} />);

      expect(screen.getByText('Arena Latihan Cerdas')).toBeDefined();

      const backBtn = screen.getByRole('button', { name: /kembali/i });
      expect(backBtn).toBeDefined();
      expect(backBtn.className).toContain('min-h-[48px]');

      fireEvent.click(backBtn);
      expect(soundManager.playClick).toHaveBeenCalled();
      expect(defaultProps.onExit).toHaveBeenCalledTimes(1);

      const statsBtn = screen.getByRole('button', { name: /peta keahlian/i });
      expect(statsBtn).toBeDefined();
      expect(statsBtn.className).toContain('min-h-[48px]');

      fireEvent.click(statsBtn);
      expect(defaultProps.onOpenStats).toHaveBeenCalledTimes(1);
    });

    it('does not render "Peta Keahlian" button when onOpenStats is not provided', () => {
      render(<PracticeHubView {...defaultProps} onOpenStats={undefined} />);
      expect(screen.queryByRole('button', { name: /peta keahlian/i })).toBeNull();
    });

    it('renders 3 mode tabs with min-h-[48px] and respects initialTab', () => {
      render(<PracticeHubView {...defaultProps} initialTab="custom" />);

      const adaptiveTab = screen.getByRole('tab', { name: /latihan adaptif ai/i });
      const remediationTab = screen.getByRole('tab', { name: /latih kesalahan/i });
      const customTab = screen.getByRole('tab', { name: /kustom/i });

      expect(adaptiveTab.className).toContain('min-h-[48px]');
      expect(remediationTab.className).toContain('min-h-[48px]');
      expect(customTab.className).toContain('min-h-[48px]');

      // initialTab is custom, so custom mode content should be visible
      expect(screen.getByText(/pilih operasi/i)).toBeDefined();
    });

    it('switches between tabs and plays click sound', () => {
      render(<PracticeHubView {...defaultProps} initialTab="adaptive" />);

      // Initially in adaptive
      expect(screen.getByText(/rekomendasi ai untukmu/i)).toBeDefined();

      // Switch to remediation
      const remediationTab = screen.getByRole('tab', { name: /latih kesalahan/i });
      fireEvent.click(remediationTab);
      expect(soundManager.playClick).toHaveBeenCalled();
      expect(screen.queryByText(/rekomendasi ai untukmu/i)).toBeNull();

      // Switch to custom
      const customTab = screen.getByRole('tab', { name: /kustom/i });
      fireEvent.click(customTab);
      expect(screen.getByText(/pilih operasi/i)).toBeDefined();

      // Switch back to adaptive
      const adaptiveTab = screen.getByRole('tab', { name: /latihan adaptif ai/i });
      fireEvent.click(adaptiveTab);
      expect(screen.getByText(/rekomendasi ai untukmu/i)).toBeDefined();
    });
  });

  describe('Adaptive Mode', () => {
    it('handles cold-start state when fewer than 2 evaluated records exist', () => {
      // Store is empty, cold-start should be active
      render(<PracticeHubView {...defaultProps} initialTab="adaptive" />);

      expect(screen.getByText(/rekomendasi ai untukmu/i)).toBeDefined();
      // Should show diagnostic or cold-start indication
      expect(screen.getAllByText(/diagnostik/i).length).toBeGreaterThanOrEqual(1);

      const startBtn = screen.getByRole('button', { name: /mulai latihan/i });
      expect(startBtn.className).toContain('min-h-[48px]');

      fireEvent.click(startBtn);
      expect(soundManager.playClick).toHaveBeenCalled();
      expect(defaultProps.onStartAdaptive).toHaveBeenCalledTimes(1);

      const plan = (defaultProps.onStartAdaptive as any).mock.calls[0][0];
      expect(plan).toBeDefined();
      expect(plan.isColdStart).toBe(true);
      expect(plan.questions.length).toBe(10);
    });

    it('displays personalized recommendation and builds 10-question session when evaluated records exist', () => {
      const store = getMasteryStore();
      const now = Date.now();
      // Ingest enough answers (>=10 answers, >=2 sessions) for 2 sub-skills to exit cold-start
      const events: StoredAnswerEvent[] = [
        ...Array.from({ length: 10 }, (_, i) => ({
          eventId: `evt-add-${i}`,
          sessionId: i < 5 ? 's-1' : 's-2',
          questionDefinitionId: `q-add-${i}`,
          primarySkillId: 'addition',
          subSkillId: 'addition.single_digit',
          skillTags: ['addition'],
          templateFamily: 'addition_basic',
          difficulty: 1,
          targetResponseTimeMs: 2500,
          responseTimeMs: 1500,
          isCorrect: true,
          timestamp: now - i * 1000,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          eventId: `evt-sub-${i}`,
          sessionId: i < 5 ? 's-1' : 's-2',
          questionDefinitionId: `q-sub-${i}`,
          primarySkillId: 'subtraction',
          subSkillId: 'subtraction.single_digit',
          skillTags: ['subtraction'],
          templateFamily: 'subtraction_basic',
          difficulty: 1,
          targetResponseTimeMs: 2500,
          responseTimeMs: 3500,
          isCorrect: false,
          timestamp: now - i * 1000,
        })),
      ];
      store.recordEvents(events, now);

      render(<PracticeHubView {...defaultProps} initialTab="adaptive" />);

      expect(screen.getByText(/rekomendasi ai untukmu/i)).toBeDefined();
      // Should mention subtraction or weak skill reason
      expect(screen.getAllByText(/pengurangan|subtraction/i).length).toBeGreaterThanOrEqual(1);

      const startBtn = screen.getByRole('button', { name: /mulai latihan/i });
      fireEvent.click(startBtn);

      expect(defaultProps.onStartAdaptive).toHaveBeenCalledTimes(1);
      const plan = (defaultProps.onStartAdaptive as any).mock.calls[0][0];
      expect(plan.isColdStart).toBe(false);
      expect(plan.questions.length).toBe(10);
    });
  });

  describe('Remediation Mode', () => {
    it('renders zero-mistakes congratulatory card with trophy and switch button when no mistakes exist', () => {
      render(<PracticeHubView {...defaultProps} initialTab="remediation" />);

      // Zero mistakes state
      expect(screen.getByText(/tidak ada kesalahan/i)).toBeDefined();
      expect(screen.getByTestId('zero-mistakes-trophy')).toBeDefined();

      const switchBtn = screen.getByRole('button', { name: /latihan adaptif/i });
      expect(switchBtn.className).toContain('min-h-[48px]');

      fireEvent.click(switchBtn);
      expect(soundManager.playClick).toHaveBeenCalled();

      // Should have switched to adaptive tab
      expect(screen.getByText(/rekomendasi ai untukmu/i)).toBeDefined();
    });

    it('renders mistakes count and launches remediation session when mistakes exist', () => {
      const store = getMasteryStore();
      const now = Date.now();
      const failedEvents: StoredAnswerEvent[] = [
        {
          eventId: 'evt-fail-1',
          sessionId: 's-1',
          questionDefinitionId: 'q-fail-1',
          primarySkillId: 'multiplication',
          subSkillId: 'multiplication.x7',
          skillTags: ['multiplication'],
          templateFamily: 'multiplication_basic',
          difficulty: 3,
          targetResponseTimeMs: 3500,
          responseTimeMs: 4500,
          isCorrect: false,
          timestamp: now,
        },
        {
          eventId: 'evt-fail-2',
          sessionId: 's-1',
          questionDefinitionId: 'q-fail-2',
          primarySkillId: 'multiplication',
          subSkillId: 'multiplication.x8',
          skillTags: ['multiplication'],
          templateFamily: 'multiplication_basic',
          difficulty: 3,
          targetResponseTimeMs: 3500,
          responseTimeMs: 5000,
          isCorrect: false,
          timestamp: now,
        },
      ];
      store.recordEvents(failedEvents, now);

      render(<PracticeHubView {...defaultProps} initialTab="remediation" />);

      // Should show mistakes count (2)
      expect(screen.getByText(/2/)).toBeDefined();
      expect(screen.getByText(/kesalahan tercatat/i)).toBeDefined();

      const startRemediationBtn = screen.getByRole('button', { name: /latih kesalahan/i });
      expect(startRemediationBtn.className).toContain('min-h-[48px]');

      fireEvent.click(startRemediationBtn);
      expect(soundManager.playClick).toHaveBeenCalled();
      expect(defaultProps.onStartRemediation).toHaveBeenCalledTimes(1);

      const plan = (defaultProps.onStartRemediation as any).mock.calls[0][0];
      expect(plan).toBeDefined();
      expect(plan.questions.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Custom Practice Mode', () => {
    it('allows selecting operation, number range, question count, and launches custom practice', () => {
      render(<PracticeHubView {...defaultProps} initialTab="custom" />);

      // Operation selection: default should be '+'
      const mulBtn = screen.getByRole('button', { name: /×|\*/i });
      expect(mulBtn.className).toContain('min-h-[48px]');
      fireEvent.click(mulBtn);
      expect(soundManager.playClick).toHaveBeenCalled();

      // Number range selection: click 50
      const range50Btn = screen.getByRole('button', { name: /50/i });
      expect(range50Btn.className).toContain('min-h-[48px]');
      fireEvent.click(range50Btn);

      // Question count selection: click 20
      const count20Btn = screen.getByRole('button', { name: /20 soal/i });
      expect(count20Btn.className).toContain('min-h-[48px]');
      fireEvent.click(count20Btn);

      // Launch CTA
      const startCustomBtn = screen.getByRole('button', { name: /mulai latihan/i });
      expect(startCustomBtn.className).toContain('min-h-[48px]');
      fireEvent.click(startCustomBtn);

      expect(defaultProps.onStartCustom).toHaveBeenCalledTimes(1);
      expect(defaultProps.onStartCustom).toHaveBeenCalledWith({
        operation: '*',
        numberRange: 50,
        questionCount: 20,
      });
    });

    it('supports selecting mix operation and 100 range', () => {
      render(<PracticeHubView {...defaultProps} initialTab="custom" />);

      const mixBtn = screen.getByRole('button', { name: /campur|mix/i });
      fireEvent.click(mixBtn);

      const range100Btn = screen.getByRole('button', { name: /100/i });
      fireEvent.click(range100Btn);

      const startCustomBtn = screen.getByRole('button', { name: /mulai latihan/i });
      fireEvent.click(startCustomBtn);

      expect(defaultProps.onStartCustom).toHaveBeenCalledWith({
        operation: 'mix',
        numberRange: 100,
        questionCount: 10,
      });
    });
  });

  describe('Accessibility and Touch Target Compliance', () => {
    it('ensures all interactive buttons have min-h-[48px]', () => {
      const { rerender } = render(<PracticeHubView {...defaultProps} initialTab="adaptive" />);
      let buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        expect(btn.className).toContain('min-h-[48px]');
      }

      // Remediation without mistakes
      rerender(<PracticeHubView {...defaultProps} initialTab="remediation" />);
      buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        expect(btn.className).toContain('min-h-[48px]');
      }

      // Remediation with mistakes
      const store = getMasteryStore();
      store.recordEvents([
        {
          eventId: 'evt-err-touch',
          sessionId: 's-t',
          questionDefinitionId: 'q-t',
          primarySkillId: 'addition',
          subSkillId: 'addition.single_digit',
          skillTags: ['addition'],
          templateFamily: 'addition_basic',
          difficulty: 1,
          targetResponseTimeMs: 2500,
          responseTimeMs: 3000,
          isCorrect: false,
          timestamp: Date.now(),
        },
      ]);
      rerender(<PracticeHubView {...defaultProps} initialTab="remediation" />);
      buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        expect(btn.className).toContain('min-h-[48px]');
      }

      // Custom mode
      rerender(<PracticeHubView {...defaultProps} initialTab="custom" />);
      buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        expect(btn.className).toContain('min-h-[48px]');
      }
    });
  });
});
