import React from 'react';
import { Volume2, VolumeX, Trophy, HelpCircle, Flame, ArrowLeft, Calendar, Cloud, CloudCheck, Award } from 'lucide-react';
import { soundManager } from '../utils/sound';
import { GameMode } from '../types';
import { User } from 'firebase/auth';

interface HeaderProps {
  currentMode: GameMode;
  onNavigateHome: () => void;
  onOpenStats: () => void;
  onOpenAchievements?: () => void;
  onOpenHelp: () => void;
  onOpenDailyChallenge: () => void;
  onOpenSyncModal: () => void;
  currentUser: User | null;
  isMuted: boolean;
  onToggleMute: () => void;
  totalStars: number;
  streak?: number;
  dailyStreak?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onNavigateHome,
  onOpenStats,
  onOpenAchievements,
  onOpenHelp,
  onOpenDailyChallenge,
  onOpenSyncModal,
  currentUser,
  isMuted,
  onToggleMute,
  totalStars,
  streak = 0,
  dailyStreak = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b-4 border-indigo-950 bg-indigo-900/95 backdrop-blur-md shadow-2xl transition-all">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4 sm:px-6">
        
        {/* Left: Brand or Back Button */}
        <div className="flex items-center gap-3">
          {currentMode !== 'campaign' && (
            <button
              id="header-back-button"
              onClick={() => {
                soundManager.playClick();
                onNavigateHome();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
              title="Kembali ke Peta Level"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div 
            onClick={() => {
              if (currentMode !== 'campaign') {
                soundManager.playClick();
                onNavigateHome();
              }
            }}
            className="flex cursor-pointer items-center gap-3 select-none"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500 text-white font-black text-2xl shadow-lg border-b-4 border-pink-700">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black italic tracking-tight text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
                  HITUNG KILAT
                </h1>
                <span className="rounded-lg bg-pink-500/20 px-2 py-0.5 text-[10px] font-black text-pink-300 border border-pink-500/40 uppercase tracking-widest hidden xs:inline-block">
                  BLASTER
                </span>
              </div>
              <p className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider hidden sm:block">
                Mode: Kalkulasi Mental Kilat
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Streak, Daily Challenge, or Stars Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Daily Challenge Quick Link */}
          <button
            id="header-daily-challenge-button"
            onClick={() => {
              soundManager.playClick();
              onOpenDailyChallenge();
            }}
            className={`flex items-center gap-2 rounded-2xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-black transition border-b-2 shadow-md ${
              currentMode === 'daily_challenge'
                ? 'bg-pink-500 text-white border-pink-700 shadow-pink-500/30'
                : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-amber-950 border-amber-700'
            }`}
            title="Tantangan Harian & Papan Peringkat Global"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden xs:inline">Harian</span>
            {dailyStreak > 0 && (
              <span className="rounded-full bg-amber-950/20 px-1.5 py-0.2 text-[10px] font-black text-amber-950">
                🔥{dailyStreak}
              </span>
            )}
          </button>

          {streak > 1 && (
            <div className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3.5 py-1.5 text-amber-950 font-black text-xs sm:text-sm shadow-lg border-b-2 border-amber-600 animate-pulse hidden md:flex">
              <Flame className="h-4 w-4 fill-amber-950 text-amber-950" />
              <span>{streak}x COMBO!</span>
            </div>
          )}

          <div 
            className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-3 sm:px-4 py-2 border border-white/20 text-xs sm:text-sm font-black text-yellow-400 shadow-md cursor-pointer hover:bg-white/15 transition select-none"
            onClick={onOpenStats}
            title="Total Bintang Diraih"
          >
            <span className="text-yellow-400 text-base">⭐</span>
            <span className="font-mono text-base font-black text-white">{totalStars}</span>
            <span className="text-indigo-300/80 text-[11px] font-bold hidden xs:inline">/ 72</span>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Cloud Sync Button */}
          <button
            id="cloud-sync-modal-trigger"
            onClick={() => {
              soundManager.playClick();
              onOpenSyncModal();
            }}
            className={`flex items-center gap-1.5 h-10 px-2.5 sm:px-3 rounded-2xl transition border shadow-sm ${
              currentUser
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/40'
                : 'bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 border-white/15'
            }`}
            title={
              currentUser
                ? `Tersinkron: ${currentUser.displayName || currentUser.email || 'Cloud'}`
                : 'Sinkronisasi Progres ke Server / Multi-Device'
            }
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="h-5 w-5 rounded-full object-cover border border-emerald-400"
                referrerPolicy="no-referrer"
              />
            ) : currentUser ? (
              <CloudCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <Cloud className="h-4 w-4 shrink-0" />
            )}
            <span className="text-xs font-bold hidden md:inline">
              {currentUser ? 'Tersimpan' : 'Cloud'}
            </span>
          </button>

          {/* Help Button */}
          <button
            id="help-modal-trigger"
            onClick={() => {
              soundManager.playClick();
              onOpenHelp();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 border border-white/15 transition shadow-sm"
            title="Panduan Bermain & Tips Trik"
          >
            <HelpCircle className="h-5 w-5" />
          </button>

          {/* Achievements Button */}
          <button
            id="achievements-modal-trigger"
            onClick={() => {
              soundManager.playClick();
              if (onOpenAchievements) {
                onOpenAchievements();
              } else {
                onOpenStats();
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-amber-300 hover:text-white hover:bg-white/20 border border-white/15 transition shadow-sm"
            title="Lencana Pencapaian & Prestasi"
          >
            <Award className="h-5 w-5" />
          </button>

          {/* Stats Button */}
          <button
            id="stats-modal-trigger"
            onClick={() => {
              soundManager.playClick();
              onOpenStats();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 border border-white/15 transition shadow-sm"
            title="Statistik Performa"
          >
            <Trophy className="h-5 w-5" />
          </button>

          {/* Sound Toggle */}
          <button
            id="sound-toggle-button"
            onClick={() => {
              onToggleMute();
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-2xl transition border border-white/15 shadow-sm ${
              isMuted
                ? 'bg-white/5 text-indigo-400 hover:bg-white/10 hover:text-indigo-200'
                : 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 border-pink-500/30'
            }`}
            title={isMuted ? 'Suara Senyap (Klik untuk Nyalakan)' : 'Suara Aktif (Klik untuk Senyap)'}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

      </div>
    </header>
  );
};
