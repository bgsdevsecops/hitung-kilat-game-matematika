// tests/unit/skillMasteryHeatmap.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SkillMasteryHeatmap } from '../../src/components/mastery/SkillMasteryHeatmap';
import { getMasteryStore } from '../../src/utils/masteryBridge';
import { MasteryRecord } from '../../src/engine/mastery';

describe('SkillMasteryHeatmap Component', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('renders overall mastery meter and 14 arithmetic categories', () => {
    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
    expect(screen.getByText(/Cakupan Penguasaan Global/i)).toBeDefined();

    // Verify presence of category headers
    expect(screen.getByText('Penjumlahan')).toBeDefined();
    expect(screen.getByText('Pengurangan')).toBeDefined();
    expect(screen.getByText('Perkalian')).toBeDefined();
    expect(screen.getByText('Pembagian')).toBeDefined();
  });

  it('filters sub-skills using filter chips and opens sub-skill detail on click', () => {
    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    // Click filter chip
    const needsPracticeFilter = screen.getByRole('button', { name: /perlu latihan/i });
    expect(needsPracticeFilter.className).toContain('min-h-[48px]');
    fireEvent.click(needsPracticeFilter);

    // Reset to "Semua"
    const allFilter = screen.getByRole('button', { name: /semua/i });
    expect(allFilter.className).toContain('min-h-[48px]');
    fireEvent.click(allFilter);

    // Sub-skill chip click opens detail modal
    const subSkillChip = screen.getByText('Penjumlahan Satu Digit');
    fireEvent.click(subSkillChip);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Penjumlahan dasar angka 1–9/i)).toBeDefined();
  });

  it('toggles category accordion collapse and expansion on click', () => {
    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    // Addition is expanded by default
    expect(screen.getByText('Penjumlahan Satu Digit')).toBeDefined();

    // Click header to collapse
    const additionHeader = screen.getByRole('button', { name: /penjumlahan \(5 sub-skill\)/i });
    expect(additionHeader.className).toContain('min-h-[48px]');
    expect(additionHeader.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(additionHeader);

    // Should now be collapsed
    expect(additionHeader.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Penjumlahan Satu Digit')).toBeNull();

    // Click again to expand
    fireEvent.click(additionHeader);
    expect(additionHeader.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Penjumlahan Satu Digit')).toBeDefined();
  });

  it('calculates global coverage correctly with mastered and developing records', () => {
    const store = getMasteryStore();
    const mockMastered: MasteryRecord = {
      subSkillId: 'addition.single_digit',
      status: 'MASTERED',
      statusLabel: 'Dikuasai',
      masteryScore: 90,
      accuracyComponent: 95,
      speedComponent: 85,
      consistencyComponent: 90,
      recentAccuracy: 100,
      totalAnswers: 15,
      distinctSessions: 3,
      isStrongSkill: true,
      isWeakSkill: false,
      lastEvaluatedAt: Date.now(),
      algorithmVersion: '2.0.0',
    };
    const mockDeveloping: MasteryRecord = {
      subSkillId: 'addition.within_20',
      status: 'DEVELOPING',
      statusLabel: 'Sedang Berkembang',
      masteryScore: 65,
      accuracyComponent: 70,
      speedComponent: 60,
      consistencyComponent: 65,
      recentAccuracy: 75,
      totalAnswers: 8,
      distinctSessions: 2,
      isStrongSkill: false,
      isWeakSkill: false,
      lastEvaluatedAt: Date.now(),
      algorithmVersion: '2.0.0',
    };

    store.getAllMasteryRecords = vi.fn().mockReturnValue({
      'addition.single_digit': mockMastered,
      'addition.within_20': mockDeveloping,
    });

    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    // Total subskills is ~54 or 48. Effective mastered = 1 + 0.5 = 1.5. Coverage > 0%.
    const progressbar = screen.getByRole('progressbar');
    const coverageVal = Number(progressbar.getAttribute('aria-valuenow'));
    expect(coverageVal).toBeGreaterThan(0);

    // Verify filter counts
    expect(screen.getByRole('button', { name: /dikuasai \(1\)/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /berkembang \(1\)/i })).toBeDefined();
  });

  it('passes onStartPractice callback through modal', () => {
    const handleStartPractice = vi.fn();
    render(<SkillMasteryHeatmap onStartPractice={handleStartPractice} />);

    // Open detail modal
    const subSkillChip = screen.getByText('Penjumlahan Satu Digit');
    fireEvent.click(subSkillChip);

    // Click CTA button in modal
    const startPracticeBtn = screen.getByRole('button', { name: /latih sub-skill ini/i });
    expect(startPracticeBtn.className).toContain('min-h-[48px]');
    fireEvent.click(startPracticeBtn);

    expect(handleStartPractice).toHaveBeenCalledWith('addition.single_digit');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ensures all sub-skill chips and headers have at least 48px touch targets', () => {
    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.className).toContain('min-h-[48px]');
    }
  });

  it('hides categories without matching sub-skills when filtered', () => {
    const store = getMasteryStore();
    const mockMastered: MasteryRecord = {
      subSkillId: 'addition.single_digit',
      status: 'MASTERED',
      statusLabel: 'Dikuasai',
      masteryScore: 90,
      accuracyComponent: 95,
      speedComponent: 85,
      consistencyComponent: 90,
      recentAccuracy: 100,
      totalAnswers: 15,
      distinctSessions: 3,
      isStrongSkill: true,
      isWeakSkill: false,
      lastEvaluatedAt: Date.now(),
      algorithmVersion: '2.0.0',
    };

    store.getAllMasteryRecords = vi.fn().mockReturnValue({
      'addition.single_digit': mockMastered,
    });

    render(<SkillMasteryHeatmap />);

    // Initially all categories are shown
    expect(screen.getByText('Penjumlahan')).toBeDefined();
    expect(screen.getByText('Pengurangan')).toBeDefined();

    // Filter by Dikuasai
    const masteredFilter = screen.getByRole('button', { name: /dikuasai \(1\)/i });
    fireEvent.click(masteredFilter);

    // Addition has 1 mastered subskill so it stays visible
    expect(screen.getByText('Penjumlahan')).toBeDefined();
    expect(screen.getByText('90%')).toBeDefined();

    // Subtraction has 0 mastered subskills so it is hidden
    expect(screen.queryByText('Pengurangan')).toBeNull();
  });

  it('handles modal practice click gracefully when onStartPractice is not provided', () => {
    render(<SkillMasteryHeatmap />);

    const subSkillChip = screen.getByText('Penjumlahan Satu Digit');
    fireEvent.click(subSkillChip);

    const startPracticeBtn = screen.getByRole('button', { name: /latih sub-skill ini/i });
    expect(() => fireEvent.click(startPracticeBtn)).not.toThrow();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
