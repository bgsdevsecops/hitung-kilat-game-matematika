import React from 'react';
import { WifiOff } from 'lucide-react';

export interface OfflineStatusBadgeProps {
  isOnline: boolean;
}

export const OfflineStatusBadge: React.FC<OfflineStatusBadgeProps> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md shadow-sm animate-pulse"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
      <span>Mode Offline</span>
      <span className="hidden sm:inline text-amber-200/70 font-normal">| Progres tersimpan lokal</span>
    </div>
  );
};
