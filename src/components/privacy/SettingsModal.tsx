import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  User,
  Shield,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Copy,
} from 'lucide-react';
import { PrivacyState, DeletionReceipt } from '../../types';
import { PseudonymValidationResult } from '../../utils/privacy/pseudonymValidator';
import { exportAllGameData, triggerJSONDownload } from '../../utils/privacy/dataExporter';
import { executeAccountDeletion } from '../../utils/privacy/accountDeletion';
import { soundManager } from '../../utils/sound';
import type { User as FirebaseUser } from 'firebase/auth';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  privacyState: PrivacyState;
  onUpdatePseudonym: (name: string) => PseudonymValidationResult;
  onUpdateCountryFlag: (country: string, flag: string) => void;
  onToggleAnalyticsConsent: () => void;
  onToggleLeaderboardOptOut: () => void;
  onResetLocalProgress: () => void;
  currentUser: FirebaseUser | null;
  openAgeGate?: () => void;
  onOpenPrivacyPolicy?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  privacyState,
  onUpdatePseudonym,
  onUpdateCountryFlag,
  onToggleAnalyticsConsent,
  onToggleLeaderboardOptOut,
  onResetLocalProgress,
  currentUser,
  openAgeGate,
  onOpenPrivacyPolicy,
}) => {
  const [pseudonymInput, setPseudonymInput] = useState<string>(privacyState.pseudonym);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>('');
  const [deletionReceipt, setDeletionReceipt] = useState<DeletionReceipt | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showResetConfirm) {
          setShowResetConfirm(false);
        } else if (showDeleteModal && !deletionReceipt) {
          setShowDeleteModal(false);
          setDeleteConfirmationText('');
          setDeleteError(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showResetConfirm, showDeleteModal, deletionReceipt]);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    soundManager.playClick();
    setValidationError(null);
    setSuccessMsg(null);
    const result = onUpdatePseudonym(pseudonymInput);
    if (!result.valid) {
      setValidationError(result.error || 'Nama samaran tidak valid.');
    } else {
      setPseudonymInput(result.sanitized);
      setSuccessMsg('Profil berhasil diperbarui!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleExportJSON = () => {
    soundManager.playClick();
    const data = exportAllGameData();
    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerJSONDownload(`hitung-kilat-data-${dateStr}.json`, jsonStr);
  };

  const handleConfirmReset = () => {
    soundManager.playClick();
    onResetLocalProgress();
    setShowResetConfirm(false);
    onClose();
  };

  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmationText !== 'HAPUS') return;
    soundManager.playClick();
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const receipt = await executeAccountDeletion(currentUser?.uid);
      setDeletionReceipt(receipt);
    } catch (e: any) {
      console.error(e);
      setDeleteError(e?.message || 'Gagal menghapus akun. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-8 overflow-hidden rounded-3xl border-4 border-indigo-950 bg-gradient-to-b from-indigo-900 to-indigo-950 p-6 text-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-indigo-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-amber-950 font-black shadow-md border-b-2 border-amber-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 id="settings-title" className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
                Pengaturan & Privasi
              </h2>
              <p className="text-xs text-indigo-300">
                Data Governance & Tata Kelola Privasi V2.0
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="rounded-xl p-2 text-indigo-300 hover:bg-white/10 hover:text-white transition"
            aria-label="Tutup Pengaturan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 custom-scrollbar">
          {/* Section 1: Profil Publik */}
          <div className="rounded-2xl border-2 border-indigo-800/80 bg-indigo-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-400">
              <User className="h-4 w-4" />
              <span>Profil Publik</span>
            </div>
            <p className="text-xs text-indigo-200">
              Nama samaran yang tampil pada papan peringkat global. Identitas Google Anda tidak akan dipublikasikan.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={pseudonymInput}
                    maxLength={20}
                    onChange={(e) => setPseudonymInput(e.target.value)}
                    placeholder="Ketik nama samaran..."
                    className="w-full rounded-xl bg-indigo-900/90 border border-indigo-700 px-3.5 py-2.5 text-sm font-bold text-white placeholder-indigo-400 focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] font-mono text-indigo-400">
                    {pseudonymInput.length}/20
                  </span>
                </div>
              </div>

              <select
                value={privacyState.playerCountry}
                onChange={(e) => {
                  const val = e.target.value;
                  const flags: Record<string, string> = { ID: '🇮🇩', MY: '🇲🇾', SG: '🇸🇬', GLOBAL: '🌐' };
                  onUpdateCountryFlag(val, flags[val] || '🇮🇩');
                }}
                className="rounded-xl bg-indigo-900/90 border border-indigo-700 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ID">🇮🇩 Indonesia</option>
                <option value="MY">🇲🇾 Malaysia</option>
                <option value="SG">🇸🇬 Singapura</option>
                <option value="GLOBAL">🌐 Global</option>
              </select>

              <button
                onClick={handleSaveProfile}
                className="rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 px-4 py-2 text-xs sm:text-sm font-black transition border-b-2 border-amber-600 shadow-md whitespace-nowrap"
              >
                Simpan Profil
              </button>
            </div>

            {validationError && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Section 2: Privasi & Visibilitas */}
          <div className="rounded-2xl border-2 border-indigo-800/80 bg-indigo-950/50 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-400">
              <Shield className="h-4 w-4" />
              <span>Privasi & Visibilitas</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">Status Kelayakan Usia</div>
                <div className="text-[11px] text-indigo-300">
                  {privacyState.ageEligibility === '13plus'
                    ? '13 Tahun ke Atas (Fitur Cloud & Peringkat Aktif)'
                    : privacyState.ageEligibility === 'under13'
                    ? 'Di Bawah 13 Tahun (Mode Lokal Aman Aktif)'
                    : 'Belum Ditetapkan'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  privacyState.ageEligibility === '13plus'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {privacyState.ageEligibility}
                </span>
                {openAgeGate && (
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      openAgeGate();
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-800 hover:bg-indigo-700 text-amber-300 border border-indigo-600 transition shadow-sm whitespace-nowrap"
                  >
                    Ubah Kelompok Usia
                  </button>
                )}
              </div>
            </div>

            {/* Analytics Consent Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
              <div className="pr-4">
                <div className="text-xs sm:text-sm font-bold text-white">Persetujuan Telemetri Anonim</div>
                <div className="text-[11px] text-indigo-300 leading-normal">
                  Membantu kami menyeimbangkan tingkat kesulitan soal. Bebas PII, email, atau jawaban spesifik.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={privacyState.analyticsConsent}
                onClick={() => {
                  soundManager.playClick();
                  onToggleAnalyticsConsent();
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacyState.analyticsConsent ? 'bg-emerald-500' : 'bg-indigo-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                    privacyState.analyticsConsent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Leaderboard Opt-Out Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
              <div className="pr-4">
                <div className="text-xs sm:text-sm font-bold text-white">Sembunyikan dari Papan Peringkat (Opt-Out)</div>
                <div className="text-[11px] text-indigo-300 leading-normal">
                  Skor Anda tidak akan diproyeksikan ke publik (&le; 24 jam). Progres lokal Anda tetap tersimpan.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={privacyState.leaderboardOptOut}
                onClick={() => {
                  soundManager.playClick();
                  onToggleLeaderboardOptOut();
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacyState.leaderboardOptOut ? 'bg-amber-500' : 'bg-indigo-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                    privacyState.leaderboardOptOut ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Privacy Policy Link */}
            {onOpenPrivacyPolicy && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
                <div className="pr-4">
                  <div className="text-xs sm:text-sm font-bold text-white">Kebijakan Privasi & Perlindungan Data</div>
                  <div className="text-[11px] text-indigo-300 leading-normal">
                    Pelajari kepatuhan privasi anak COPPA, Google OAuth2 Limited Use, dan tata kelola data pemain.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    onOpenPrivacyPolicy();
                  }}
                  className="rounded-xl bg-indigo-800 hover:bg-indigo-700 text-amber-300 px-3.5 py-2 text-xs font-bold border border-indigo-600 transition shadow-sm whitespace-nowrap cursor-pointer"
                >
                  Baca Kebijakan Privasi
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Portabilitas Data */}
          <div className="rounded-2xl border-2 border-indigo-800/80 bg-indigo-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-400">
              <Download className="h-4 w-4" />
              <span>Portabilitas Data</span>
            </div>
            <p className="text-xs text-indigo-200">
              Unduh salinan lengkap seluruh rekor permainan, progres level, dan riwayat belajar Anda dalam format JSON terstandarisasi.
            </p>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold border border-indigo-600 transition shadow-sm"
            >
              <Download className="h-4 w-4 text-amber-300" />
              <span>Unduh Data JSON</span>
            </button>
          </div>

          {/* Section 4: Zona Bahaya */}
          <div className="rounded-2xl border-2 border-rose-900/60 bg-rose-950/20 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Zona Bahaya</span>
            </div>

            {/* Reset Local Progress */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-900/20 border border-rose-800/30">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">Reset Progres Permainan Lokal</div>
                <div className="text-[11px] text-rose-200/80">
                  Mengembalikan progres level dan statistik ke awal pada perangkat ini.
                </div>
              </div>
              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowResetConfirm(true);
                }}
                className="rounded-xl bg-rose-800/80 hover:bg-rose-700 text-rose-100 px-3.5 py-2 text-xs font-bold border border-rose-600 transition whitespace-nowrap"
              >
                Reset Progres
              </button>
            </div>

            {/* Delete Account (Cloud) */}
            {currentUser && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-950/40 border border-rose-700/50">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white">Hapus Akun Cloud & Seluruh Data</div>
                  <div className="text-[11px] text-rose-200/80">
                    Menghapus data Firestore, skor publik, sesi login, dan menerbitkan kwitansi resmi DEL-XXXXXX.
                  </div>
                </div>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setShowDeleteModal(true);
                  }}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 text-xs font-black transition whitespace-nowrap shadow-md"
                >
                  Hapus Akun Cloud
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation: Reset Local Progress */}
        {showResetConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-indigo-900 border-2 border-rose-500 p-5 text-center space-y-4">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-white">Konfirmasi Reset Progres?</h3>
              <p className="text-xs text-indigo-200">
                Seluruh 72 level, bintang, dan statistik lokal akan dikembalikan ke level 1. Aksi ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl bg-indigo-800 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-black text-white"
                >
                  Ya, Reset Progres
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Delete Account Cloud Double Confirmation */}
        {showDeleteModal && !deletionReceipt && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-indigo-950 border-2 border-rose-500 p-5 space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <Trash2 className="h-6 w-6" />
                <h3 className="text-base font-black text-white">Hapus Permanen Akun Cloud</h3>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Aksi ini menghapus seluruh data cloud dan sesi akun Anda secara permanen. Untuk konfirmasi, ketik <strong className="text-yellow-300">HAPUS</strong> di bawah ini:
              </p>
              {deleteError && (
                <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Ketik HAPUS..."
                className="w-full rounded-xl bg-indigo-900 border border-rose-500/50 px-3 py-2 text-sm font-mono text-white placeholder-indigo-400 focus:outline-none focus:border-rose-400"
              />
              <div className="flex gap-3 justify-end pt-2">
                <button
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmationText('');
                    setDeleteError(null);
                  }}
                  className="rounded-xl bg-indigo-800 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white"
                >
                  Batal
                </button>
                <button
                  disabled={deleteConfirmationText !== 'HAPUS' || isDeleting}
                  onClick={handleExecuteDeleteAccount}
                  className="rounded-xl bg-rose-600 disabled:opacity-40 hover:bg-rose-500 px-4 py-2 text-xs font-black text-white"
                >
                  {isDeleting ? 'Menghapus...' : 'Hapus Akun Permanen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Modal: Deletion Success */}
        {deletionReceipt && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-indigo-900 border-2 border-emerald-500 p-6 space-y-4 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Penghapusan Akun Selesai</h3>
              <p className="text-xs text-indigo-200">
                Seluruh data akun cloud Anda telah dihapus secara permanen. Simpan ID kwitansi ini untuk arsip Anda:
              </p>
              <div className="rounded-xl bg-indigo-950/80 p-3 border border-indigo-700 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-amber-300">
                  {deletionReceipt.receiptId}
                </span>
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(deletionReceipt.receiptId);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1 p-1.5 rounded-lg bg-indigo-800 text-indigo-200 hover:text-white text-xs font-bold"
                  title="Salin ID Kwitansi"
                >
                  <Copy className="h-4 w-4" />
                  {isCopied && <span>Tersalin!</span>}
                </button>
              </div>
              <p className="text-[11px] text-indigo-400">
                Waktu: {deletionReceipt.timestamp}
              </p>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-2.5 text-xs sm:text-sm"
              >
                Muat Ulang Permainan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
