// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateNotificationToast } from '../../src/components/common/UpdateNotificationToast';
import { soundManager } from '../../src/utils/sound';

declare module 'vitest' {
  interface Assertion<R = void, T = unknown> {
    toBeInTheDocument(): R;
  }
}

expect.extend({
  toBeInTheDocument(received: HTMLElement | null) {
    const pass = Boolean(
      received !== null &&
      received !== undefined &&
      received.ownerDocument?.body.contains(received)
    );
    return {
      pass,
      message: () => `expected element ${pass ? 'not ' : ''}to be in document`,
    };
  },
});

describe('UpdateNotificationToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders update announcement and action buttons', () => {
    render(<UpdateNotificationToast onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Versi Baru Tersedia!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perbarui Sekarang/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nanti/i })).toBeInTheDocument();
  });

  it('calls onUpdate and plays sound when clicking Perbarui Sekarang', () => {
    const handleUpdate = vi.fn();
    render(<UpdateNotificationToast onUpdate={handleUpdate} onDismiss={vi.fn()} />);

    const updateBtn = screen.getByRole('button', { name: /Perbarui Sekarang/i });
    fireEvent.click(updateBtn);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss and plays sound when clicking Nanti', () => {
    const handleDismiss = vi.fn();
    render(<UpdateNotificationToast onUpdate={vi.fn()} onDismiss={handleDismiss} />);

    const dismissBtn = screen.getByRole('button', { name: /Nanti/i });
    fireEvent.click(dismissBtn);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss and plays sound when clicking close button', () => {
    const handleDismiss = vi.fn();
    render(<UpdateNotificationToast onUpdate={vi.fn()} onDismiss={handleDismiss} />);

    const closeBtn = screen.getByRole('button', { name: /Tutup pemberitahuan pembaruan/i });
    fireEvent.click(closeBtn);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders with role="alert" and proper aria-label', () => {
    render(<UpdateNotificationToast onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast.getAttribute('aria-label')).toBe('Pemberitahuan Pembaruan Aplikasi');
  });
});
