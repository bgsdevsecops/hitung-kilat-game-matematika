import React from 'react';
import { Sparkles, Trophy, Star, ArrowRight, ShieldCheck } from 'lucide-react';
import { soundManager } from '../utils/sound';

export const MIGRATION_ACK_KEY = 'hitung_kilat_migration_ack_v2';

export interface V2WelcomeModalProps {
  isOpen: boolean;
  transferredStars: number;
  legacyStarCredits: number;
  unlockedLevelsCount: number;
  onClose: () => void;
}

export const V2WelcomeModal: React.FC<V2WelcomeModalProps> = ({
  isOpen,
  transferredStars,
  legacyStarCredits,
  unlockedLevelsCount,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(MIGRATION_ACK_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
    soundManager.playClick();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2-welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-[2.5rem] border-4 border-amber-500/80 bg-gradient-to-b from-indigo-900 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        {/* Glow Header Accent */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-amber-950 shadow-lg border-b-4 border-amber-600 mb-2">
            <Sparkles className="h-9 w-9 text-amber-950 fill-amber-950" />
          </div>
          <div className="inline-block rounded-full bg-amber-500/20 border border-amber-400/30 px-3.5 py-1 text-xs font-black text-amber-300 uppercase tracking-wider">
            Pembaruan Besar V2
          </div>
          <h2
            id="v2-welcome-title"
            className="text-2xl sm:text-3xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400"
          >
            Selamat Datang di Hitung Kilat V2!
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 font-medium leading-relaxed">
            Petualangan berhitung diperluas menjadi <span className="text-amber-300 font-bold">72 Level</span> dalam 6 Tier dengan <span className="text-rose-300 font-bold">Pertarungan Boss</span> di setiap akhir tier. Kemajuan bermain Anda sebelumnya telah diselaraskan secara aman!
          </p>
        </div>

        {/* Migration Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
            <div className="flex items-center justify-center text-amber-400 mb-1">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">{transferredStars} Bintang</div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">
              Bintang Ditransfer
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
            <div className="flex items-center justify-center text-cyan-400 mb-1">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-xl font-black text-white font-mono">{legacyStarCredits} Kredit</div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">
              Kredit Warisan
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
            <div className="flex items-center justify-center text-emerald-400 mb-1">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="text-xl font-black text-white font-mono">{unlockedLevelsCount} Level</div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">
              Level Terbuka
            </div>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="rounded-2xl border border-indigo-800 bg-indigo-900/50 p-4 space-y-2 text-xs text-indigo-200">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-black">✓</span>
            <span>6 Tier terstruktur dari Pemula hingga Legenda (12 level per tier).</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-black">✓</span>
            <span>Pertarungan Boss dengan HP Bar interaktif dan efek getar kemarahan.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-black">✓</span>
            <span>16 Pencapaian baru terstandarisasi hingga 216★ & penaklukan Boss.</span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            id="v2-welcome-cta-button"
            onClick={handleDismiss}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-xl transition active:translate-y-0.5 uppercase tracking-wider"
          >
            <span>Mulai Petualangan 72 Level</span>
            <ArrowRight className="h-4 w-4 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
