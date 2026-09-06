import React from 'react';
import { X, Zap, Keyboard, Award, Lightbulb } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 sm:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-indigo-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500 text-white font-black border-b-2 border-pink-700 shadow-md">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-white">Panduan & Tips Hitung Kilat</h2>
              <p className="text-xs text-indigo-300">Cara bermain dan trik kalkulasi mental super cepat</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-800 border border-indigo-700 text-indigo-200 hover:bg-indigo-700 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="my-6 space-y-6 text-xs text-indigo-100 leading-relaxed">
          
          {/* Rules & Stars */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-black text-white text-sm">
              <Award className="h-4 w-4 text-yellow-400" />
              <span>Sistem Bintang & Tingkat Kesulitan</span>
            </div>
            <ul className="space-y-1.5 pl-5 list-disc text-indigo-200">
              <li>Setiap level memiliki batas waktu tertentu dan jumlah soal target.</li>
              <li><strong className="text-yellow-400">⭐ 1 Bintang</strong>: Akurasi minimal 60% soal benar.</li>
              <li><strong className="text-yellow-400">⭐⭐ 2 Bintang</strong>: Akurasi minimal 80% soal benar.</li>
              <li><strong className="text-yellow-400">⭐⭐⭐ 3 Bintang</strong>: Akurasi 95%+ dan diselesaikan dalam tempo cepat (&lt;75% dari batas waktu)!</li>
              <li>Menyelesaikan level akan membuka level selanjutnya yang lebih menantang.</li>
            </ul>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-black text-white text-sm">
              <Keyboard className="h-4 w-4 text-pink-400" />
              <span>Kontrol Keyboard Cepat (Desktop)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-2xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between">
                <span className="font-bold text-indigo-200">Angka</span>
                <kbd className="rounded-xl bg-indigo-800 px-2.5 py-1 border border-indigo-700 font-mono font-black text-white">0 - 9</kbd>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between">
                <span className="font-bold text-indigo-200">Kirim Jawaban</span>
                <kbd className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 font-mono font-black text-amber-950">Enter</kbd>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between">
                <span className="font-bold text-indigo-200">Hapus 1 Digit</span>
                <kbd className="rounded-xl bg-rose-700 px-2.5 py-1 font-mono font-black text-white">Backspace</kbd>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 p-2.5 flex items-center justify-between">
                <span className="font-bold text-indigo-200">Tanda Negatif</span>
                <kbd className="rounded-xl bg-indigo-800 px-2.5 py-1 border border-indigo-700 font-mono font-black text-white">-</kbd>
              </div>
            </div>
          </div>

          {/* Mental Math Speed Tricks */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-black text-white text-sm">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              <span>Trik Cepat Berhitung Mental</span>
            </div>
            
            <div className="space-y-2">
              <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
                <strong className="text-yellow-400 font-black block mb-1">Penjumlahan Puluhan (Contoh: 38 + 47)</strong>
                <span className="text-indigo-200">Bulatkan salah satu angka ke puluhan terdekat: (38 + 2) = 40. Lalu 40 + 45 = 85!</span>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
                <strong className="text-emerald-400 font-black block mb-1">Prioritas Operasi (BODMAS / PEMDAS)</strong>
                <span className="text-indigo-200">Operasi di dalam kurung dihitung pertama, lalu perkalian (×) dan pembagian (÷) selalu didahulukan sebelum penjumlahan (+) dan pengurangan (-).</span>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
                <strong className="text-pink-400 font-black block mb-1">Mencari Angka Hilang (? × 8 = 72)</strong>
                <span className="text-indigo-200">Gunakan kebalikan operasi: 72 dibagi 8 = 9. Jadi nilai ? adalah 9.</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 py-3.5 text-xs font-black text-amber-950 border-b-4 border-amber-700 shadow-xl transition active:translate-y-0.5 uppercase tracking-wider"
        >
          Mengerti, Ayo Latihan!
        </button>

      </div>
    </div>
  );
};
