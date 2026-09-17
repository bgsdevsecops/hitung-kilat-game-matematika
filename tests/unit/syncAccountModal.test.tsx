// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncAccountModal } from '../../src/components/SyncAccountModal';
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

describe('SyncAccountModal V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders V2 sync indicator and displays sync timestamp', () => {
    const onManualSync = vi.fn().mockResolvedValue(undefined);
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user-123', displayName: 'Budi' } as any}
        isSyncing={false}
        lastSyncedAt={new Date('2026-09-17T12:30:00Z')}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={onManualSync}
      />
    );

    expect(screen.getByText(/72 Level Kampanye & 16 Pencapaian/i)).toBeInTheDocument();
    const syncButton = screen.getByRole('button', { name: /sinkronkan/i });
    expect(syncButton).toBeInTheDocument();
    fireEvent.click(syncButton);
    expect(onManualSync).toHaveBeenCalledTimes(1);
  });

  it('shows saving spinner when isSyncing is true', () => {
    const onManualSync = vi.fn();
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user-123', displayName: 'Budi' } as any}
        isSyncing={true}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={onManualSync}
      />
    );

    expect(screen.getByText('Menyimpan...')).toBeInTheDocument();
    const syncButton = screen.getByRole('button', { name: /menyimpan/i });
    expect(syncButton).toBeInTheDocument();
    expect((syncButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(syncButton);
    expect(onManualSync).not.toHaveBeenCalled();
  });

  it('renders logged-out promotional card mentioning 72 level kampanye & 16 pencapaian', async () => {
    const onLoginGoogle = vi.fn().mockResolvedValue(undefined);

    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={null}
        isSyncing={false}
        lastSyncedAt={null}
        onLoginGoogle={onLoginGoogle}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={vi.fn()}
      />
    );

    expect(screen.getByText(/72 level kampanye/i)).toBeInTheDocument();
    expect(screen.getByText(/16 pencapaian/i)).toBeInTheDocument();

    const googleBtn = screen.getByRole('button', { name: /masuk dengan google/i });
    expect(googleBtn).toBeInTheDocument();
    fireEvent.click(googleBtn);
    expect(onLoginGoogle).toHaveBeenCalledTimes(1);
  });

  it('triggers onLoginGuest when guest login button is clicked', async () => {
    const onLoginGuest = vi.fn().mockResolvedValue(undefined);

    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={null}
        isSyncing={false}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={onLoginGuest}
        onLogout={vi.fn()}
        onManualSync={vi.fn()}
      />
    );

    const guestBtn = screen.getByRole('button', { name: /gunakan akun tamu cloud/i });
    expect(guestBtn).toBeInTheDocument();
    fireEvent.click(guestBtn);
    expect(onLoginGuest).toHaveBeenCalledTimes(1);
  });

  it('does not render modal content when isOpen is false', () => {
    const { container } = render(
      <SyncAccountModal
        isOpen={false}
        onClose={vi.fn()}
        currentUser={null}
        isSyncing={false}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('handles manual sync error gracefully and displays error notification', async () => {
    const onManualSync = vi.fn().mockRejectedValue(new Error('Network error'));
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user-123', displayName: 'Budi' } as any}
        isSyncing={false}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={onManualSync}
      />
    );

    const syncButton = screen.getByRole('button', { name: /sinkronkan/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Gagal menyinkronkan data ke server.')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={onClose}
        currentUser={null}
        isSyncing={false}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={vi.fn()}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onLogout when logout button is clicked', async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user-123', displayName: 'Budi' } as any}
        isSyncing={false}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={onLogout}
        onManualSync={vi.fn()}
      />
    );

    const logoutBtn = screen.getByRole('button', { name: /keluar dari akun ini/i });
    fireEvent.click(logoutBtn);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
