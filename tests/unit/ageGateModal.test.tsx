// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgeGateModal } from '../../src/components/privacy/AgeGateModal';

describe('AgeGateModal component', () => {
  it('renders age confirmation options when open', () => {
    render(
      <AgeGateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmAge={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Verifikasi Usia/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /13 Tahun ke Atas/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /di Bawah 13 Tahun/i })).toBeDefined();
  });

  it('triggers onConfirmAge with 13plus on selecting 13+ button', () => {
    const handleConfirm = vi.fn();
    render(
      <AgeGateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmAge={handleConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /13 Tahun ke Atas/i }));
    expect(handleConfirm).toHaveBeenCalledWith('13plus');
  });

  it('triggers onConfirmAge with under13 on selecting < 13 button', () => {
    const handleConfirm = vi.fn();
    render(
      <AgeGateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmAge={handleConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /di Bawah 13 Tahun/i }));
    expect(handleConfirm).toHaveBeenCalledWith('under13');
  });
});
