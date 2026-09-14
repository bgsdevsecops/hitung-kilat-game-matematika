import React, { useMemo } from 'react';
import { Trophy, Sparkles, RotateCcw, Home, Award } from 'lucide-react';
import { Question } from '../../engine/types/question';
import { getMasteryStore } from '../../utils/masteryBridge';
import { soundManager } from '../../utils/sound';
import { getSubSkill, SKILL_TAXONOMY } from '../../engine/taxonomy';

export interface AdaptiveSummaryViewProps {
  answers: Question[];
  durationMs: number;
  onPlayAgain: () => void;
  onOpenMasteryMap: () => void;
  onExit: () => void;
}

export const AdaptiveSummaryView: React.FC<AdaptiveSummaryViewProps> = ({
  answers,
  durationMs,
  onPlayAgain,
  onOpenMasteryMap,
  onExit,
}) => {
  const store = useMemo(() => getMasteryStore(), []);
  const records = useMemo(() => store.getAllMasteryRecords(), [store]);

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalCount = answers.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const durationSec = Math.round(durationMs / 1000);

  // Collect distinct practiced sub-skills
  const practicedSubSkills = useMemo(() => {
    const ids = new Set<string>();
    for (const a of answers) {
      if (a.primarySkillId) ids.add(a.primarySkillId);
      const extended = a as unknown as { subSkillId?: string };
      if (extended.subSkillId) ids.add(extended.subSkillId);
    }
    return Array.from(ids);
  }, [answers]);

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6 animate-fade-in">
      {/* Trophy & Title */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border-2 border-amber-400/40 shadow-xl">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white">Sesi Selesai!</h1>
        <p className="text-sm font-bold text-amber-300">
          {correctCount} dari {totalCount} Soal Benar
        </p>
        <p className="text-xs text-indigo-300">
          Setiap latihan membawamu semakin mahir berhitung cepat
        </p>
      </div>

      {/* Metrics Card */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-indigo-800/80 bg-indigo-950/60 p-3 text-center">
          <span className="text-[10px] text-indigo-300 uppercase block mb-1">Akurasi</span>
          <span className="text-2xl font-black font-mono text-emerald-400">{accuracy}%</span>
        </div>
        <div className="rounded-2xl border border-indigo-800/80 bg-indigo-950/60 p-3 text-center">
          <span className="text-[10px] text-indigo-300 uppercase block mb-1">Benar</span>
          <span className="text-2xl font-black font-mono text-amber-300">{correctCount}/{totalCount}</span>
        </div>
        <div className="rounded-2xl border border-indigo-800/80 bg-indigo-950/60 p-3 text-center">
          <span className="text-[10px] text-indigo-300 uppercase block mb-1">Waktu</span>
          <span className="text-2xl font-black font-mono text-white">{durationSec}s</span>
        </div>
      </div>

      {/* Milestone Progression Card */}
      <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/80 p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-indigo-200 text-xs font-black uppercase tracking-wider">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Perkembangan Keahlian Terlatih</span>
        </div>

        <div className="space-y-2">
          {practicedSubSkills.length === 0 ? (
            <p className="text-xs text-indigo-300 italic text-center py-2">
              Tidak ada keahlian khusus yang tercatat pada sesi ini.
            </p>
          ) : (
            practicedSubSkills.map((subSkillId) => {
              const rec = records[subSkillId];
              const score = rec?.masteryScore ?? 0;
              const label = rec?.statusLabel || 'Berkembang';
              const def = getSubSkill(subSkillId);
              const categoryName = def?.skillId ? (SKILL_TAXONOMY[def.skillId]?.name || def.skillId) : '';
              const subtitle = categoryName ? `${categoryName} • ${label}` : label;

              return (
                <div
                  key={subSkillId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
                >
                  <div className="overflow-hidden mr-2">
                    <span className="font-bold text-white block truncate">{def?.name || subSkillId}</span>
                    <span className="text-[10px] text-indigo-300 block">
                      {subtitle}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono font-black text-amber-300 block">{score}/100</span>
                    <span className="text-[9px] text-emerald-400 block">+Aktif</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onPlayAgain();
          }}
          aria-label="Lanjut Latihan"
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 active:translate-y-0.5 text-amber-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl border-b-4 border-amber-700 transition uppercase tracking-wider"
        >
          <RotateCcw className="w-4 h-4 stroke-[3]" />
          <span>Lanjut Latihan</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onOpenMasteryMap();
          }}
          aria-label="Buka Peta Keahlian"
          className="w-full min-h-[48px] rounded-2xl bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-indigo-700 shadow-md transition"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Buka Peta Keahlian</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          aria-label="Kembali ke Menu Utama"
          className="w-full min-h-[48px] rounded-2xl bg-white/10 hover:bg-white/15 text-indigo-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition"
        >
          <Home className="w-4 h-4" />
          <span>Menu Utama</span>
        </button>
      </div>
    </div>
  );
};
