// tests/unit/subSkillDetailModal.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubSkillDetailModal } from '../../src/components/mastery/SubSkillDetailModal';
import { SubSkillDefinition } from '../../src/engine/taxonomy';
import { MasteryRecord } from '../../src/engine/mastery';

describe('SubSkillDetailModal Component', () => {
  const mockSubSkill: SubSkillDefinition = {
    id: 'multiplication.x7',
    skillId: 'multiplication',
    name: 'Perkalian ×7',
    description: 'Tabel perkalian angka 7 hingga 7 × 10',
    difficultyBase: 3,
  };

  const mockRecord: MasteryRecord = {
    subSkillId: 'multiplication.x7',
    status: 'NEEDS_PRACTICE',
    statusLabel: 'Perlu Latihan',
    masteryScore: 48,
    accuracyComponent: 50,
    speedComponent: 45,
    consistencyComponent: 50,
    recentAccuracy: 50,
    totalAnswers: 12,
    distinctSessions: 3,
    isStrongSkill: false,
    isWeakSkill: true,
    lastEvaluatedAt: Date.now(),
    algorithmVersion: '2.0.0',
  };

  it('renders sub-skill name, description, mastery status, and metrics', () => {
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={vi.fn()}
        onStartPractice={vi.fn()}
      />
    );

    expect(screen.getByText('Perkalian ×7')).toBeDefined();
    expect(screen.getByText(/Tabel perkalian angka 7/i)).toBeDefined();
    expect(screen.getByText(/Perlu Latihan/i)).toBeDefined();
    expect(screen.getByText(/Skor: 48\/100/i)).toBeDefined();
    expect(screen.getByText(/12 Soal/i)).toBeDefined();
  });

  it('triggers onStartPractice callback with subSkillId when CTA button clicked', () => {
    const handleStartPractice = vi.fn();
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={vi.fn()}
        onStartPractice={handleStartPractice}
      />
    );

    const ctaBtn = screen.getByRole('button', { name: /latih sub-skill ini/i });
    expect(ctaBtn.className).toContain('min-h-[48px]');
    fireEvent.click(ctaBtn);
    expect(handleStartPractice).toHaveBeenCalledWith('multiplication.x7');
  });

  it('handles onClose when close button clicked', () => {
    const handleClose = vi.fn();
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /tutup/i });
    expect(closeBtn.className).toContain('min-h-[48px]');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <SubSkillDetailModal
        isOpen={false}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when subSkill is null', () => {
    const { container } = render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={null}
        masteryRecord={mockRecord}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('handles default values when masteryRecord is not provided', () => {
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Belum Cukup Data')).toBeDefined();
    expect(screen.getByText(/Skor: 0\/100/i)).toBeDefined();
    expect(screen.getByText(/0 Soal/i)).toBeDefined();
    expect(screen.getByText(/0 Sesi/i)).toBeDefined();
  });

  it('renders MASTERED status badge correctly', () => {
    const masteredRecord: MasteryRecord = {
      ...mockRecord,
      status: 'MASTERED',
      statusLabel: 'Dikuasai',
      masteryScore: 92,
    };

    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={masteredRecord}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Dikuasai')).toBeDefined();
    expect(screen.getByText(/Skor: 92\/100/i)).toBeDefined();
  });

  it('renders DEVELOPING status badge correctly', () => {
    const developingRecord: MasteryRecord = {
      ...mockRecord,
      status: 'DEVELOPING',
      statusLabel: 'Sedang Berkembang',
      masteryScore: 65,
    };

    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={developingRecord}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Sedang Berkembang')).toBeDefined();
    expect(screen.getByText(/Skor: 65\/100/i)).toBeDefined();
  });

  it('closes modal on Escape key press', () => {
    const handleClose = vi.fn();
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
