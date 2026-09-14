import React from 'react';
import { X, Target, Zap, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { SubSkillDefinition } from '../../engine/taxonomy';
import { MasteryRecord } from '../../engine/mastery';
import { soundManager } from '../../utils/sound';

export interface SubSkillDetailModalProps {
  isOpen: boolean;
  subSkill: SubSkillDefinition | null;
  masteryRecord?: MasteryRecord;
  onClose: () => void;
  onStartPractice?: (subSkillId: string) => void;
}

export const SubSkillDetailModal: React.FC<SubSkillDetailModalProps> = ({
  isOpen,
  subSkill,
  masteryRecord,
  onClose,
  onStartPractice,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !subSkill) return null;

  const status = masteryRecord?.status || 'INSUFFICIENT_DATA';
  const score = masteryRecord?.masteryScore ?? 0;
  const recentAcc = masteryRecord?.recentAccuracy ?? 0;
  const totalAnswers = masteryRecord?.totalAnswers ?? 0;
  const distinctSessions = masteryRecord?.distinctSessions ?? 0;

  const getStatusBadge = () => {
    switch (status) {
      case 'MASTERED':
      case 'PROFICIENT':
        return {
          label: 'Dikuasai',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
      case 'DEVELOPING':
      case 'COMPETENT':
        return {
          label: 'Sedang Berkembang',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Zap className="w-4 h-4 text-amber-400" />,
        };
      case 'NEEDS_PRACTICE':
        return {
          label: 'Perlu Latihan',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
        };
      case 'INSUFFICIENT_DATA':
      default:
        return {
          label: 'Belum Cukup Data',
          bg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          icon: <Target className="w-4 h-4 text-slate-400" />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subskill-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border-2 border-indigo-700/80 bg-indigo-950 p-5 sm:p-6 shadow-2xl text-white relative"
      >
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          aria-label="Tutup"
          className="absolute top-4 right-4 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-indigo-300 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
            {badge.icon}
            <span>{badge.label}</span>
          </span>
          <span className="text-xs font-mono text-indigo-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            Tingkat {subSkill.difficultyBase}
          </span>
        </div>

        <h2 id="subskill-title" className="text-xl font-black text-white mb-1">
          {subSkill.name}
        </h2>
        <p className="text-xs text-indigo-200/90 mb-4 leading-relaxed">
          {subSkill.description}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl border border-indigo-800/60 bg-indigo-900/40 p-3">
            <span className="text-[11px] text-indigo-300 block mb-0.5">Penguasaan</span>
            <span className="text-lg font-black font-mono text-amber-300">
              Skor: {score}/100
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-800/60 bg-indigo-900/40 p-3">
            <span className="text-[11px] text-indigo-300 block mb-0.5">Akurasi Terakhir</span>
            <span className="text-lg font-black font-mono text-emerald-400">
              {recentAcc}%
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-800/60 bg-indigo-900/40 p-3">
            <span className="text-[11px] text-indigo-300 block mb-0.5">Total Dijawab</span>
            <span className="text-sm font-black font-mono text-white">
              {totalAnswers} Soal
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-800/60 bg-indigo-900/40 p-3">
            <span className="text-[11px] text-indigo-300 block mb-0.5">Sesi Berbeda</span>
            <span className="text-sm font-black font-mono text-white">
              {distinctSessions} Sesi
            </span>
          </div>
        </div>

        {/* Action Button */}
        {onStartPractice && (
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onStartPractice(subSkill.id);
            }}
            aria-label="Latih Sub-Skill Ini Sekarang"
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 active:translate-y-0.5 text-amber-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl border-b-4 border-amber-700 transition uppercase tracking-wider"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Latih Sub-Skill Ini</span>
          </button>
        )}
      </div>
    </div>
  );
};
