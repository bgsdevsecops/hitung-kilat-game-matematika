import React from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { soundManager } from '../../utils/sound';

export interface UpdateNotificationToastProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export const UpdateNotificationToast: React.FC<UpdateNotificationToastProps> = ({
  onUpdate,
  onDismiss,
}) => {
  const handleUpdate = () => {
    soundManager.playClick();
    onUpdate();
  };

  const handleDismiss = () => {
    soundManager.playClick();
    onDismiss();
  };

  return (
    <aside
      aria-label="Pemberitahuan Pembaruan Aplikasi"
      role="alert"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 bg-indigo-950/95 border-2 border-amber-400/80 rounded-2xl shadow-2xl backdrop-blur-lg flex flex-col gap-3 transition-all motion-safe:animate-bounce-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-indigo-950 shadow-md flex-shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Versi Baru Tersedia!</span>
            </h4>
            <p className="text-xs text-indigo-200 mt-0.5">
              Pembaruan konten dan performa telah diunduh di latar belakang.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Tutup pemberitahuan pembaruan"
          className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-indigo-900/50 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-800/60">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition-colors"
        >
          Nanti
        </button>
        <button
          onClick={handleUpdate}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-indigo-950 font-bold text-xs shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Perbarui Sekarang</span>
        </button>
      </div>
    </aside>
  );
};
