import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Zap,
  AlertCircle,
  Target,
  Sparkles,
  Filter,
} from 'lucide-react';
import { SKILL_TAXONOMY, SubSkillDefinition } from '../../engine/taxonomy';
import { MasteryRecord } from '../../engine/mastery';
import { getMasteryStore } from '../../utils/masteryBridge';
import { soundManager } from '../../utils/sound';
import { SubSkillDetailModal } from './SubSkillDetailModal';

export type StatusFilter = 'ALL' | 'MASTERED' | 'DEVELOPING' | 'NEEDS_PRACTICE' | 'INSUFFICIENT_DATA';

export interface SkillMasteryHeatmapProps {
  onStartPractice?: (subSkillId?: string) => void;
}

export const SkillMasteryHeatmap: React.FC<SkillMasteryHeatmapProps> = ({ onStartPractice }) => {
  const store = useMemo(() => getMasteryStore(), []);
  const records = useMemo(() => store.getAllMasteryRecords(), [store]);

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    addition: true,
    subtraction: true,
    multiplication: true,
    division: true,
  });
  const [selectedSubSkill, setSelectedSubSkill] = useState<SubSkillDefinition | null>(null);

  const toggleCategory = (categoryId: string) => {
    soundManager.playClick();
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const categories = useMemo(() => Object.values(SKILL_TAXONOMY), []);

  // Compute global coverage %: (Strong + 0.5 * Medium) / TotalAvailable * 100%
  const allSubSkills = useMemo(() => categories.flatMap((c) => c.subSkills), [categories]);
  const totalSubSkillsCount = allSubSkills.length;

  const counts = useMemo(() => {
    let mastered = 0;
    let developing = 0;
    let needsPractice = 0;
    let insufficient = 0;

    for (const sub of allSubSkills) {
      const rec = records[sub.id];
      const status = rec?.status || 'INSUFFICIENT_DATA';
      if (status === 'MASTERED' || status === 'PROFICIENT') mastered++;
      else if (status === 'DEVELOPING' || status === 'COMPETENT') developing++;
      else if (status === 'NEEDS_PRACTICE') needsPractice++;
      else insufficient++;
    }

    return { mastered, developing, needsPractice, insufficient };
  }, [allSubSkills, records]);

  const globalCoverage = useMemo(() => {
    if (totalSubSkillsCount === 0) return 0;
    const effectiveMastered = counts.mastered + 0.5 * counts.developing;
    return Math.min(100, Math.round((effectiveMastered / totalSubSkillsCount) * 100));
  }, [counts, totalSubSkillsCount]);

  const filterMatches = (rec?: MasteryRecord): boolean => {
    const status = rec?.status || 'INSUFFICIENT_DATA';
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'MASTERED') return status === 'MASTERED' || status === 'PROFICIENT';
    if (activeFilter === 'DEVELOPING') return status === 'DEVELOPING' || status === 'COMPETENT';
    if (activeFilter === 'NEEDS_PRACTICE') return status === 'NEEDS_PRACTICE';
    if (activeFilter === 'INSUFFICIENT_DATA') return status === 'INSUFFICIENT_DATA';
    return true;
  };

  const getSubSkillStyle = (rec?: MasteryRecord) => {
    const status = rec?.status || 'INSUFFICIENT_DATA';
    switch (status) {
      case 'MASTERED':
      case 'PROFICIENT':
        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25';
      case 'DEVELOPING':
      case 'COMPETENT':
        return 'bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25';
      case 'NEEDS_PRACTICE':
        return 'bg-rose-500/15 border-rose-500/40 text-rose-200 hover:bg-rose-500/25';
      case 'INSUFFICIENT_DATA':
      default:
        return 'bg-slate-700/30 border-slate-600/40 text-slate-300 hover:bg-slate-700/50';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Global Mastery Meter */}
      <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/60 p-4 sm:p-5 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-indigo-900/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>Peta Penguasaan Keahlian</span>
              </h3>
              <p className="text-[11px] text-indigo-300">
                Visualisasi 48 sub-keahlian matematika berdasarkan akurasi dan kecepatan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-indigo-200">
              Cakupan Penguasaan Global: <strong className="text-amber-300 font-mono text-sm">{globalCoverage}%</strong>
            </div>
          </div>
        </div>

        {/* Meter Bar */}
        <div className="w-full h-3 bg-indigo-900/80 rounded-full overflow-hidden mb-3 border border-indigo-700/50">
          <div
            role="progressbar"
            aria-valuenow={globalCoverage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${globalCoverage}%` }}
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveFilter('ALL');
            }}
            className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'ALL'
                ? 'bg-white text-indigo-950 shadow-md'
                : 'bg-white/10 text-indigo-200 hover:bg-white/15'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Semua ({totalSubSkillsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveFilter('MASTERED');
            }}
            className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'MASTERED'
                ? 'bg-emerald-400 text-emerald-950 shadow-md'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dikuasai ({counts.mastered})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveFilter('DEVELOPING');
            }}
            className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'DEVELOPING'
                ? 'bg-amber-400 text-amber-950 shadow-md'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Berkembang ({counts.developing})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveFilter('NEEDS_PRACTICE');
            }}
            className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'NEEDS_PRACTICE'
                ? 'bg-rose-400 text-rose-950 shadow-md'
                : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Perlu Latihan ({counts.needsPractice})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              setActiveFilter('INSUFFICIENT_DATA');
            }}
            className={`min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeFilter === 'INSUFFICIENT_DATA'
                ? 'bg-slate-300 text-slate-950 shadow-md'
                : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 border border-slate-600/40'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-slate-400" />
            <span>Belum Cukup Data ({counts.insufficient})</span>
          </button>
        </div>
      </div>

      {/* 14 Category Accordions */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const matchingSubSkills = cat.subSkills.filter((sub) => filterMatches(records[sub.id]));
          if (matchingSubSkills.length === 0 && activeFilter !== 'ALL') {
            return null;
          }

          const isExpanded = expandedCategories[cat.id] ?? false;

          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-indigo-800/80 bg-indigo-950/40 overflow-hidden shadow-sm"
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-label={`${cat.name} (${matchingSubSkills.length} Sub-Skill)`}
                onClick={() => toggleCategory(cat.id)}
                className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-sm text-white">{cat.name}</span>
                  <span className="text-[11px] font-mono text-indigo-300 bg-white/5 px-2 py-0.5 rounded-md">
                    {matchingSubSkills.length} Sub-Skill
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-indigo-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-300" />
                )}
              </button>

              {isExpanded && (
                <div className="p-3.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-indigo-900/60">
                  {matchingSubSkills.map((sub) => {
                    const rec = records[sub.id];
                    const style = getSubSkillStyle(rec);
                    const score = rec?.masteryScore ?? 0;

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          soundManager.playClick();
                          setSelectedSubSkill(sub);
                        }}
                        className={`min-h-[48px] p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition active:scale-[0.98] ${style}`}
                      >
                        <div className="overflow-hidden">
                          <span className="block text-xs font-bold truncate text-white">
                            {sub.name}
                          </span>
                          <span className="block text-[10px] text-indigo-300 font-mono truncate">
                            {sub.id}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs font-black font-mono block">
                            {score > 0 ? `${score}%` : '—'}
                          </span>
                          <span className="text-[9px] text-indigo-300/80 block uppercase">
                            Tingkat {sub.difficultyBase}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sub-Skill Detail Modal */}
      <SubSkillDetailModal
        isOpen={Boolean(selectedSubSkill)}
        subSkill={selectedSubSkill}
        masteryRecord={selectedSubSkill ? records[selectedSubSkill.id] : undefined}
        onClose={() => setSelectedSubSkill(null)}
        onStartPractice={(subSkillId) => {
          setSelectedSubSkill(null);
          if (onStartPractice) {
            onStartPractice(subSkillId);
          }
        }}
      />
    </div>
  );
};
