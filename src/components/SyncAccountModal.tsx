import React, { useState } from 'react';
import {
  X,
  Cloud,
  CloudCheck,
  RefreshCw,
  LogOut,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { soundManager } from '../utils/sound';

interface SyncAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  onLoginGoogle: () => Promise<void>;
  onLoginGuest: () => Promise<void>;
  onLogout: () => Promise<void>;
  onManualSync: () => Promise<void>;
}

export const SyncAccountModal: React.FC<SyncAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isSyncing,
  lastSyncedAt,
  onLoginGoogle,
  onLoginGuest,
  onLogout,
  onManualSync,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    soundManager.playClick();
    setErrorMsg(null);
    setLoadingAction(true);
    try {
      await onLoginGoogle();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Gagal masuk dengan Google. Silakan coba lagi.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGuestLogin = async () => {
    soundManager.playClick();
    setErrorMsg(null);
    setLoadingAction(true);
    try {
      await onLoginGuest();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Gagal membuat sesi sinkronisasi tamu.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSyncNow = async () => {
    soundManager.playClick();
    setErrorMsg(null);
    try {
      await onManualSync();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal menyinkronkan data ke server.');
    }
  };

  const handleLogout = async () => {
    soundManager.playClick();
    setErrorMsg(null);
    setLoadingAction(true);
    try {
      await onLogout();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal keluar.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-indigo-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-white">Sinkronisasi Cloud</h2>
              <p className="text-xs text-indigo-300">Simpan progres ke server Firebase</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/20 p-3 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Status Card */}
        {currentUser ? (
          <div className="rounded-3xl border-2 border-emerald-500/40 bg-emerald-950/40 p-5 space-y-4">
            <div className="flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="h-12 w-12 rounded-2xl border-2 border-emerald-400 object-cover shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-emerald-950 font-black text-xl">
                  {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : '👤'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-white truncate">
                    {currentUser.displayName || (currentUser.isAnonymous ? 'Akun Tamu Terhubung' : 'Pemain Kilat')}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                </div>
                <p className="text-xs text-indigo-300 truncate">
                  {currentUser.email || `ID: ${currentUser.uid.slice(0, 8)}...`}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Cloud Sync Aktif (Otomatis)</span>
                </div>
              </div>
            </div>

            {/* Sync Status info */}
            <div className="rounded-2xl bg-indigo-900/80 p-3 text-xs border border-indigo-700/50 flex items-center justify-between">
              <div>
                <span className="text-indigo-300">Sinkron Terakhir:</span>
                <p className="font-bold text-white">
                  {lastSyncedAt
                    ? lastSyncedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Baru saja'}
                </p>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 font-bold transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menyimpan...' : 'Sinkronkan'}</span>
              </button>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              disabled={loadingAction}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 text-indigo-300 hover:text-white py-2.5 text-xs font-black transition border border-white/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar dari Akun Ini</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Feature Highlights */}
            <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/60 p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-indigo-200 font-bold">
                <Laptop className="h-4 w-4 text-sky-400" />
                <span>Bermain di Laptop</span>
                <span className="text-indigo-400">↔</span>
                <Smartphone className="h-4 w-4 text-sky-400" />
                <span>Lanjutkan di HP</span>
              </div>
              <p className="text-indigo-300 text-[11px] leading-relaxed">
                Saat Anda login, semua level yang terbuka, bintang, skor rekor, dan streak harian akan tersimpan aman di server Cloud Firestore secara instan.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-emerald-300 pt-1 border-t border-indigo-900">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>100% Gratis & Aman (Firebase Spark Plan)</span>
              </div>
            </div>

            {/* Login with Google Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loadingAction}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black py-3.5 px-4 shadow-xl transition transform active:scale-95 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loadingAction ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
            </button>

            {/* Alternative Guest Sync ID */}
            <button
              onClick={handleGuestLogin}
              disabled={loadingAction}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 text-indigo-200 py-2.5 text-xs font-bold transition border border-white/15 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Gunakan Akun Tamu Cloud (Tanpa Google)</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-indigo-400">
          Semua progres tetap dapat dimainkan saat offline dan otomatis disinkronkan saat terhubung kembali.
        </div>
      </div>
    </div>
  );
};
