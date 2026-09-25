import React from 'react';
import { Zap, Heart, X, Shield } from 'lucide-react';
import { CompetitiveMode } from '../../engine/competitive/types';
import { PrivacyState } from '../../types';
import { loadPrivacyState } from '../../utils/privacy/privacyState';
import { evaluateCompetitiveEligibility } from '../../lib/competitiveEligibility';
import { isCompetitiveRankedEnabled } from '../../lib/featureFlags';
import { auth } from '../../lib/firebase';

export interface CompetitiveModeSelectModalProps {
  isOpen: boolean;
  onSelectMode: (mode: CompetitiveMode) => void;
  onClose: () => void;
  privacyState?: PrivacyState;
}

export const CompetitiveModeSelectModal: React.FC<CompetitiveModeSelectModalProps> = ({
  isOpen,
  onSelectMode,
  onClose,
  privacyState,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPrivacy = privacyState || loadPrivacyState();
  const currentUser = auth.currentUser;
  const isGuest = currentUser ? currentUser.isAnonymous : true;
  const isAuthenticated = Boolean(currentUser && !currentUser.isAnonymous);
  const featureFlagEnabled = isCompetitiveRankedEnabled();

  const eligibility = evaluateCompetitiveEligibility({
    ageEligibility: currentPrivacy.ageEligibility,
    isGuest,
    isAuthenticated,
    leaderboardOptOut: Boolean(currentPrivacy.leaderboardOptOut),
    featureFlagEnabled,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="competitive-mode-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-indigo-950 rounded-3xl border border-indigo-700/60 p-6 shadow-2xl flex flex-col gap-5"
      >
        <div className="flex items-center justify-between">
          <h3 id="competitive-mode-modal-title" className="text-xl font-black text-white">
            Mode Kompetitif
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Eligibility Indicator */}
        {eligibility.executionMode === 'practice' ? (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-900/50 border border-indigo-700/60 text-indigo-300 text-xs">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-white">Mode Latihan Lokal:</strong> Skor tersimpan di perangkat. Mode peringkat memerlukan verifikasi akun 13+ tahun.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-white">Peringkat Resmi Aktif:</strong> Sesi divalidasi oleh server dan skor tercatat di papan peringkat global.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Sprint 60s Option */}
          <button
            type="button"
            onClick={() => onSelectMode('sprint')}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-800/60 hover:border-amber-500/50 text-left transition-all active:scale-98"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white group-hover:text-amber-300 transition-colors">Sprint 60s</h4>
              <p className="text-xs text-indigo-300 mt-1">
                Jawab sebanyak mungkin soal dalam 60 detik mutlak. Escalation tier adaptif hingga 6.
              </p>
            </div>
          </button>

          {/* Survival Kilat Option */}
          <button
            type="button"
            onClick={() => onSelectMode('survival')}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-800/60 hover:border-emerald-500/50 text-left transition-all active:scale-98"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform">
              <Heart className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors">Survival Kilat</h4>
              <p className="text-xs text-indigo-300 mt-1">
                Mulai dengan 60 detik energi. Benar +2 detik, salah -4 detik. Bertahan hidup selama mungkin!
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
