import React from 'react';

export const ScreenLoadingFallback: React.FC = () => {
  return (
    <div
      data-testid="screen-loading-fallback"
      className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-indigo-200"
    >
      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-pink-500 rounded-full animate-spin" />
      <span className="text-sm font-medium tracking-wide animate-pulse">
        Menyiapkan Arena...
      </span>
    </div>
  );
};

export const ModalLoadingFallback: React.FC = () => {
  return (
    <div
      data-testid="modal-loading-fallback"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
    </div>
  );
};
