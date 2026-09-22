import React from 'react';
import { ShieldCheck, X, UserCheck, HeartHandshake } from 'lucide-react';
import { soundManager } from '../../utils/sound';

export interface AgeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAge: (eligibility: 'under13' | '13plus') => void;
}

export const AgeGateModal: React.FC<AgeGateModalProps> = ({
  isOpen,
  onClose,
  onConfirmAge,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-4 border-indigo-950 bg-gradient-to-b from-indigo-900 to-indigo-950 p-6 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          className="absolute right-4 top-4 rounded-xl p-2 text-indigo-300 hover:bg-white/10 hover:text-white transition"
          aria-label="Tutup Verifikasi Usia"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-amber-950 shadow-lg border-b-4 border-amber-600 mb-3">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 id="age-gate-title" className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
            Verifikasi Usia & Privasi
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-indigo-200 leading-relaxed">
            Hitung Kilat menjamin keamanan data pemain. Pilih kelompok usia untuk menyesuaikan fitur sinkronisasi akun dan peringkat publik.
          </p>
        </div>

        {/* Action Options */}
        <div className="space-y-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onConfirmAge('13plus');
            }}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-800/80 hover:bg-indigo-700/80 border-2 border-indigo-600/50 hover:border-amber-400 transition text-left group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-300 group-hover:scale-105 transition">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black text-white">
                  Saya Berusia 13 Tahun ke Atas
                </div>
                <div className="text-[11px] text-indigo-300">
                  Dapat mengaktifkan Cloud Sync dan Papan Peringkat Global.
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onConfirmAge('under13');
            }}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-800/80 hover:bg-indigo-700/80 border-2 border-indigo-600/50 hover:border-pink-400 transition text-left group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-pink-400/20 text-pink-300 group-hover:scale-105 transition">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black text-white">
                  Saya Berusia di Bawah 13 Tahun
                </div>
                <div className="text-[11px] text-indigo-300">
                  Mode Lokal Aman 100%. Tanpa pengumpulan data akun.
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <p className="mt-5 text-center text-[10px] text-indigo-400">
          Sesuai standar perlindungan privasi anak PRD §20 & COPPA/GDPR-K. Pilihan dapat ditinjau kembali di Pengaturan.
        </p>
      </div>
    </div>
  );
};
