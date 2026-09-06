import React, { useState } from 'react';
import { Play, Lock, Zap, Target, Award, Clock } from 'lucide-react';
import { LevelConfig, UserLevelProgress, DifficultyTier } from '../types';
import { LEVELS, TIERS } from '../utils/mathGenerator';
import { soundManager } from '../utils/sound';

interface LevelMapProps {
  progress: Record<number, UserLevelProgress>;
  onSelectLevel: (level: LevelConfig) => void;
  onStartTimeAttack: () => void;
  onStartPractice: () => void;
}

export const LevelMap: React.FC<LevelMapProps> = ({
  progress,
  onSelectLevel,
  onStartTimeAttack,
  onStartPractice,
}) => {
  const [selectedTier, setSelectedTier] = useState<DifficultyTier | 'all'>('all');

  const filteredLevels = selectedTier === 'all' 
    ? LEVELS 
    : LEVELS.filter(lvl => lvl.tier === selectedTier);

  // Count total unlocked
  const unlockedCount = (Object.values(progress) as UserLevelProgress[]).filter(p => p.unlocked).length;
  const completedCount = (Object.values(progress) as UserLevelProgress[]).filter(p => p.stars > 0).length;

  return (
    <div className="w-full pb-16">
      
      {/* Top Welcome / Mode Shortcuts */}
      <div className="mb-8 rounded-[2.5rem] bg-indigo-900 border-4 border-indigo-800/80 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        {/* Decorative ambient background */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-48 h-48 rounded-full bg-yellow-400/15 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-pink-500 text-white font-black px-4 py-1 text-xs shadow-md border-b-2 border-pink-700 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
              <span>Tantangan Bertingkat 24 Level</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
              Tingkatkan Kecepatan Berhitung Otak Anda
            </h1>
            <p className="text-sm sm:text-base text-indigo-200 leading-relaxed font-medium">
              Mulai dari operasi dasar hingga tantangan multi-operasi aljabar dan kuadrat tingkat master. Selesaikan tiap level secepat mungkin untuk meraih 3 bintang emas!
            </p>

            {/* Quick stats mini ribbon */}
            <div className="pt-2 flex flex-wrap gap-3 text-xs font-bold text-white">
              <span className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl border border-white/15">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
                {unlockedCount} / 24 Level Terbuka
              </span>
              <span className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl border border-white/15">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]" />
                {completedCount} Level Selesai
              </span>
            </div>
          </div>

          {/* Quick Play Alternative Modes */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              id="time-attack-mode-button"
              onClick={() => {
                soundManager.playClick();
                onStartTimeAttack();
              }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-xl shadow-orange-500/25 transition hover:brightness-110 active:translate-y-0.5 active:border-b-2"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950/20 text-amber-950">
                  <Zap className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <div className="leading-tight text-base font-black">Lari Kilat 60s</div>
                  <div className="text-[11px] font-bold text-amber-900/80">Mode Bertahan Waktu</div>
                </div>
              </div>
              <Play className="h-4 w-4 fill-amber-950 shrink-0 ml-2" />
            </button>

            <button
              id="practice-mode-button"
              onClick={() => {
                soundManager.playClick();
                onStartPractice();
              }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-800/90 border-2 border-indigo-700 border-b-4 border-indigo-950 px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-indigo-200">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="leading-tight text-base font-black">Latihan Bebas</div>
                  <div className="text-[11px] font-bold text-indigo-300">Pilih Operasi Sendiri</div>
                </div>
              </div>
              <Play className="h-4 w-4 shrink-0 ml-2 opacity-80" />
            </button>
          </div>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => {
            soundManager.playClick();
            setSelectedTier('all');
          }}
          className={`shrink-0 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-black transition ${
            selectedTier === 'all'
              ? 'bg-pink-500 text-white border-b-4 border-pink-700 shadow-lg shadow-pink-500/25'
              : 'bg-indigo-900/80 border-2 border-indigo-800 text-indigo-200 hover:text-white hover:bg-indigo-800'
          }`}
        >
          Semua Level (24)
        </button>

        {TIERS.map((tier) => (
          <button
            key={tier.id}
            onClick={() => {
              soundManager.playClick();
              setSelectedTier(tier.id);
            }}
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-black transition flex items-center gap-1.5 ${
              selectedTier === tier.id
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 border-b-4 border-amber-700 shadow-md'
                : 'bg-indigo-900/80 border-2 border-indigo-800 text-indigo-200 hover:text-white hover:bg-indigo-800'
            }`}
          >
            <span>T{tier.id}: {tier.name}</span>
          </button>
        ))}
      </div>

      {/* Level Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLevels.map((lvl) => {
          const lvlProgress = progress[lvl.id] || {
            levelId: lvl.id,
            unlocked: lvl.id === 1,
            stars: 0,
            bestScore: 0,
            bestTimeSec: 0,
            accuracy: 0,
          };
          const isUnlocked = lvlProgress.unlocked;
          const stars = lvlProgress.stars;
          const isNextPlayable = isUnlocked && stars === 0;

          const tier = TIERS.find(t => t.id === lvl.tier);

          return (
            <div
              key={lvl.id}
              id={`level-card-${lvl.id}`}
              onClick={() => {
                if (isUnlocked) {
                  soundManager.playClick();
                  onSelectLevel(lvl);
                }
              }}
              className={`group relative flex flex-col justify-between rounded-3xl border-2 p-5 transition-all duration-200 ${
                isUnlocked
                  ? 'cursor-pointer bg-indigo-900/90 border-indigo-700/80 hover:border-pink-500 hover:shadow-2xl hover:shadow-pink-500/20 hover:-translate-y-1 text-white'
                  : 'bg-indigo-950/60 border-indigo-900/60 opacity-50 cursor-not-allowed text-indigo-400'
              } ${isNextPlayable ? 'ring-4 ring-pink-500/30 border-pink-500 shadow-lg shadow-pink-500/10' : ''}`}
            >
              {/* Card Header: Level Number & Tier Badge */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs shadow-md ${
                      isUnlocked 
                        ? 'bg-pink-500 text-white border-b-2 border-pink-700' 
                        : 'bg-indigo-800 text-indigo-400'
                    }`}>
                      {lvl.id}
                    </span>
                    <span className={`rounded-xl border px-2.5 py-0.5 text-[11px] font-bold ${
                      isUnlocked
                        ? 'bg-indigo-800/90 border-indigo-600 text-indigo-200'
                        : 'bg-indigo-950 border-indigo-900 text-indigo-500'
                    }`}>
                      {lvl.tierName}
                    </span>
                  </div>

                  {/* Stars earned or Lock icon */}
                  {isUnlocked ? (
                    <div className="flex items-center gap-0.5 text-base" title={`${stars} Bintang`}>
                      {[1, 2, 3].map((starIdx) => (
                        <span
                          key={starIdx}
                          className={`${
                            starIdx <= stars
                              ? 'text-yellow-400 scale-110 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]'
                              : 'text-indigo-700'
                          } transition`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-indigo-400 text-xs font-bold">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Terkunci</span>
                    </div>
                  )}
                </div>

                {/* Level Title & Desc */}
                <h3 className="font-black text-white group-hover:text-yellow-300 transition text-base sm:text-lg">
                  {lvl.title}
                </h3>
                <p className="mt-1 text-xs text-indigo-300 leading-normal line-clamp-2">
                  {lvl.description}
                </p>

                {/* Specs: Soal & Batas Waktu */}
                <div className="mt-3.5 flex items-center gap-3 text-xs text-indigo-300/80 font-bold">
                  <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                    <Target className="h-3.5 w-3.5 text-pink-400" />
                    {lvl.questionsCount} Soal
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    {lvl.timeLimitSec} detik
                  </span>
                </div>
              </div>

              {/* Card Footer: Best Record or Action CTA */}
              <div className="mt-4 pt-3 border-t border-indigo-800/80 flex items-center justify-between">
                {isUnlocked && lvlProgress.bestScore > 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold font-mono">
                    <Award className="h-4 w-4 text-amber-400" />
                    <span>Rekor: {lvlProgress.bestScore} ({lvlProgress.bestTimeSec}s)</span>
                  </div>
                ) : isUnlocked ? (
                  <span className="text-xs font-black text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                    {isNextPlayable && <span className="h-2 w-2 rounded-full bg-pink-400 animate-ping" />}
                    Mulai Main
                  </span>
                ) : (
                  <span className="text-xs text-indigo-400 font-medium">
                    Selesaikan Lv {lvl.id - 1}
                  </span>
                )}

                {isUnlocked && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500 text-white group-hover:bg-pink-400 border-b-2 border-pink-700 transition shadow-md">
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
