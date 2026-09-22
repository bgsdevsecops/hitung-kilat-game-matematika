// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsModal } from '../../src/components/privacy/SettingsModal';
import { DEFAULT_PRIVACY_STATE } from '../../src/utils/privacy/privacyState';

vi.mock('../../src/utils/privacy/dataExporter', () => ({
  exportAllGameData: vi.fn(() => ({ test: true })),
  triggerJSONDownload: vi.fn(),
}));

vi.mock('../../src/utils/privacy/accountDeletion', () => ({
  executeAccountDeletion: vi.fn().mockResolvedValue({
    receiptId: 'DEL-TEST1234',
    timestamp: '2026-09-22T10:00:00.000Z',
    status: 'COMPLETED',
    scopesPurged: ['cloud_firestore', 'auth_session', 'local_progress'],
    policyNotice: 'Data dihapus.',
  }),
}));

describe('SettingsModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 sections with accessible elements', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    expect(screen.getByText(/Pengaturan & Privasi/i)).toBeDefined();
    expect(screen.getByText(/Profil Publik/i)).toBeDefined();
    expect(screen.getByText(/Privasi & Visibilitas/i)).toBeDefined();
    expect(screen.getByText(/Portabilitas Data/i)).toBeDefined();
    expect(screen.getByText(/Zona Bahaya/i)).toBeDefined();
  });

  it('triggers JSON data export download on button click', async () => {
    const { triggerJSONDownload } = await import('../../src/utils/privacy/dataExporter');
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Unduh Data JSON/i });
    fireEvent.click(exportBtn);
    expect(triggerJSONDownload).toHaveBeenCalled();
  });

  it('handles pseudonym modification with character counter and feedback', () => {
    const handleUpdate = vi.fn().mockReturnValue({ valid: true, sanitized: 'GayaBaru' });
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={handleUpdate}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const input = screen.getByPlaceholderText(/Ketik nama samaran/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: ' GayaBaru ' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Profil/i }));
    expect(handleUpdate).toHaveBeenCalledWith(' GayaBaru ');
    expect(input.value).toBe('GayaBaru');
  });

  it('displays error message when pseudonym validation fails', () => {
    const handleUpdate = vi.fn().mockReturnValue({ valid: false, error: 'Nama samaran tidak pantas', sanitized: 'bad' });
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={handleUpdate}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const input = screen.getByPlaceholderText(/Ketik nama samaran/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Profil/i }));
    expect(handleUpdate).toHaveBeenCalledWith('bad');
    expect(screen.getByText(/Nama samaran tidak pantas/i)).toBeDefined();
  });

  it('handles country flag changes', () => {
    const handleCountryFlag = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={handleCountryFlag}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'MY' } });
    expect(handleCountryFlag).toHaveBeenCalledWith('MY', '🇲🇾');
  });

  it('toggles analytics consent and leaderboard opt out', () => {
    const handleToggleAnalytics = vi.fn();
    const handleToggleLeaderboard = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={handleToggleAnalytics}
        onToggleLeaderboardOptOut={handleToggleLeaderboard}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(2);
    fireEvent.click(switches[0]);
    expect(handleToggleAnalytics).toHaveBeenCalled();
    fireEvent.click(switches[1]);
    expect(handleToggleLeaderboard).toHaveBeenCalled();
  });

  it('handles reset local progress flow with confirmation', () => {
    const handleReset = vi.fn();
    const handleClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={handleClose}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={handleReset}
        currentUser={null}
      />
    );

    const resetBtn = screen.getByRole('button', { name: /Reset Progres/i });
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Konfirmasi Reset Progres\?/i)).toBeDefined();

    const confirmResetBtn = screen.getByRole('button', { name: /Ya, Reset Progres/i });
    fireEvent.click(confirmResetBtn);
    expect(handleReset).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('handles account deletion flow for authenticated user', async () => {
    const mockUser = { uid: 'user-123' } as any;
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={mockUser}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /Hapus Akun Cloud/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/Hapus Permanen Akun Cloud/i)).toBeDefined();

    const input = screen.getByPlaceholderText(/Ketik HAPUS/i);
    fireEvent.change(input, { target: { value: 'HAPUS' } });

    const confirmDeleteBtn = screen.getByRole('button', { name: /Hapus Akun Permanen/i }) as HTMLButtonElement;
    expect(confirmDeleteBtn.disabled).toBe(false);
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/Penghapusan Akun Selesai/i)).toBeDefined();
      expect(screen.getByText(/DEL-TEST1234/i)).toBeDefined();
    });
  });

  it('triggers openAgeGate when Ubah Kelompok Usia button is clicked', () => {
    const handleOpenAgeGate = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
        openAgeGate={handleOpenAgeGate}
      />
    );

    const changeAgeBtn = screen.getByRole('button', { name: /Ubah Kelompok Usia/i });
    fireEvent.click(changeAgeBtn);
    expect(handleOpenAgeGate).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press when no submodal is active', () => {
    const handleClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={handleClose}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes confirmation submodal on Escape key press without closing main modal', () => {
    const handleClose = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={handleClose}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const resetBtn = screen.getByRole('button', { name: /Reset Progres/i });
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Konfirmasi Reset Progres\?/i)).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/Konfirmasi Reset Progres\?/i)).toBeNull();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
