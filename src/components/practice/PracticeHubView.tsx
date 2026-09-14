import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Brain,
  AlertCircle,
  SlidersHorizontal,
  Trophy,
  Play,
  CheckCircle2,
  Target,
} from 'lucide-react';
import {
  generateAdaptiveRecommendation,
  buildAdaptiveSession,
  AdaptiveSessionPlan,
} from '../../engine/adaptive';
import {
  buildRemediationSession,
  RemediationSessionPlan,
  FailedQuestionEvidence,
} from '../../engine/remediation';
import { createGeneratorRegistry } from '../../engine/registry';
import { MasteryRecord } from '../../engine/mastery';
import { getMasteryStore } from '../../utils/masteryBridge';
import { soundManager } from '../../utils/sound';
import { getSubSkill } from '../../engine/taxonomy';

export interface CustomPracticeConfig {
  operation: '+' | '-' | '*' | '/' | 'mix';
  numberRange: number;
  questionCount: number;
}

export interface PracticeHubViewProps {
  initialTab?: 'adaptive' | 'remediation' | 'custom';
  onTabChange?: (tab: 'adaptive' | 'remediation' | 'custom') => void;
  onStartAdaptive: (plan: AdaptiveSessionPlan) => void;
  onStartRemediation: (plan: RemediationSessionPlan) => void;
  onStartCustom: (config: CustomPracticeConfig) => void;
  onOpenStats?: () => void;
  onExit: () => void;
}

export const PracticeHubView: React.FC<PracticeHubViewProps> = ({
  initialTab = 'adaptive',
  onTabChange,
  onStartAdaptive,
  onStartRemediation,
  onStartCustom,
  onOpenStats,
  onExit,
}) => {
  const [activeTab, setActiveTab] = useState<'adaptive' | 'remediation' | 'custom'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Custom mode configuration state
  const [selectedOp, setSelectedOp] = useState<'+' | '-' | '*' | '/' | 'mix'>('+');
  const [numberRange, setNumberRange] = useState<number>(20);
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Retrieve mastery store data
  const masteryStore = getMasteryStore();
  const masteryRecords = useMemo(() => masteryStore.getAllMasteryRecords(), [masteryStore]);
  const allEvents = useMemo(() => masteryStore.getAllEvents(), [masteryStore]);
  const failedEvents = useMemo(() => allEvents.filter((e) => !e.isCorrect), [allEvents]);

  // Extract failed questions evidence
  const failedQuestions: FailedQuestionEvidence[] = useMemo(() => {
    return failedEvents.map((evt) => ({
      questionDefinitionId: evt.questionDefinitionId,
      primarySkillId: evt.primarySkillId,
      subSkillId: evt.subSkillId,
      skillTags: evt.skillTags,
      difficulty: evt.difficulty,
      templateFamily: evt.templateFamily,
      targetResponseTimeMs: evt.targetResponseTimeMs,
      responseTimeMs: evt.responseTimeMs,
    }));
  }, [failedEvents]);

  // Cold-start detection: fewer than 2 evaluated records beyond INSUFFICIENT_DATA
  const evaluatedRecords = useMemo(() => {
    return (Object.values(masteryRecords) as MasteryRecord[]).filter(
      (r: MasteryRecord) => r && r.status !== 'INSUFFICIENT_DATA'
    );
  }, [masteryRecords]);

  const isColdStart = evaluatedRecords.length < 2;

  // Generate adaptive recommendation
  const recommendation = useMemo(() => {
    return generateAdaptiveRecommendation(
      masteryRecords,
      failedQuestions.length,
      isColdStart
    );
  }, [masteryRecords, failedQuestions.length, isColdStart]);

  const primarySubSkillDef = useMemo(() => {
    return getSubSkill(recommendation.primarySubSkillId);
  }, [recommendation.primarySubSkillId]);

  // Handlers
  const handleExit = () => {
    soundManager.playClick();
    onExit();
  };

  const handleOpenStats = () => {
    if (!onOpenStats) return;
    soundManager.playClick();
    onOpenStats();
  };

  const handleTabChange = (tab: 'adaptive' | 'remediation' | 'custom') => {
    soundManager.playClick();
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleStartAdaptive = () => {
    soundManager.playClick();
    const registry = createGeneratorRegistry();
    const plan = buildAdaptiveSession({
      masteryRecords,
      recentErrors: failedQuestions,
      sessionSize: 10,
      registry,
    });
    onStartAdaptive(plan);
  };

  const handleStartRemediation = () => {
    soundManager.playClick();
    const registry = createGeneratorRegistry();
    const plan = buildRemediationSession({
      failedQuestions,
      registry,
    });
    onStartRemediation(plan);
  };

  const handleSwitchToAdaptive = () => {
    soundManager.playClick();
    setActiveTab('adaptive');
  };

  const handleStartCustom = () => {
    soundManager.playClick();
    onStartCustom({
      operation: selectedOp,
      numberRange,
      questionCount,
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 py-6 px-4">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleExit}
          aria-label="Kembali"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black italic tracking-tight text-white">
            Arena Latihan Cerdas
          </h1>
          <span className="text-xs text-indigo-300 font-medium">
            Latihan Personal Berbasis AI & Analisis Penguasaan
          </span>
        </div>

        {onOpenStats ? (
          <button
            type="button"
            onClick={handleOpenStats}
            aria-label="Peta Keahlian"
            className="min-h-[48px] min-w-[48px] px-3.5 flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-200 hover:text-white text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Peta Keahlian</span>
          </button>
        ) : (
          <div className="min-w-[48px]" />
        )}
      </header>

      {/* Segmented Mode Tabs */}
      <nav
        role="tablist"
        aria-label="Mode Latihan"
        className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-indigo-950/70 border border-indigo-800/60 backdrop-blur-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'adaptive'}
          onClick={() => handleTabChange('adaptive')}
          className={`min-h-[48px] px-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            activeTab === 'adaptive'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 shadow-md font-black'
              : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40'
          }`}
        >
          <Brain className="w-4 h-4 shrink-0" />
          <span>Latihan Adaptif AI</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'remediation'}
          onClick={() => handleTabChange('remediation')}
          className={`min-h-[48px] px-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            activeTab === 'remediation'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 shadow-md font-black'
              : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Latih Kesalahan</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'custom'}
          onClick={() => handleTabChange('custom')}
          className={`min-h-[48px] px-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            activeTab === 'custom'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 shadow-md font-black'
              : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>Kustom</span>
        </button>
      </nav>

      {/* Main Mode View */}
      <main className="w-full">
        {activeTab === 'adaptive' && (
          <div role="tabpanel" aria-label="Latihan Adaptif AI" className="flex flex-col gap-6">
            {/* AI Recommendation Card */}
            <div className="p-6 rounded-3xl bg-indigo-900/50 border border-indigo-700/60 shadow-xl flex flex-col gap-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-amber-400">
                      Rekomendasi AI Untukmu
                    </h2>
                    <span className="text-xs text-indigo-300">
                      {isColdStart ? 'Diagnostik Awal' : 'Kurikulum Adaptif Cerdas'}
                    </span>
                  </div>
                </div>

                {isColdStart && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Diagnostik
                  </span>
                )}
              </div>

              {/* Recommendation Details */}
              <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/70 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-400">
                    Fokus Utama:
                  </span>
                  <span className="text-sm font-bold text-white">
                    {primarySubSkillDef?.name || recommendation.primarySubSkillId}
                  </span>
                </div>
                <p className="text-sm text-indigo-200 leading-relaxed">
                  {recommendation.reason}
                </p>
              </div>

              {/* Session Overview Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-center">
                  <span className="block text-xs font-semibold text-indigo-300">Jumlah Soal</span>
                  <span className="text-lg font-black text-white">10 Soal</span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-center">
                  <span className="block text-xs font-semibold text-indigo-300">Target Waktu</span>
                  <span className="text-lg font-black text-white">Bebas Santai</span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-center col-span-2 sm:col-span-1">
                  <span className="block text-xs font-semibold text-indigo-300">Analisis Hasil</span>
                  <span className="text-lg font-black text-white">Update Realtime</span>
                </div>
              </div>

              {/* Start Adaptive CTA */}
              <button
                type="button"
                onClick={handleStartAdaptive}
                className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-amber-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Mulai Latihan Adaptif</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'remediation' && (
          <div role="tabpanel" aria-label="Latih Kesalahan" className="flex flex-col gap-6">
            {failedQuestions.length === 0 ? (
              // Congratulatory Zero-Mistakes Trophy Card
              <div className="p-8 rounded-3xl bg-indigo-900/50 border border-indigo-700/60 shadow-xl flex flex-col items-center text-center gap-4 text-white">
                <div
                  data-testid="zero-mistakes-trophy"
                  className="p-4 rounded-full bg-amber-400/20 text-amber-400 mb-2 ring-8 ring-amber-400/10"
                >
                  <Trophy className="w-16 h-16" />
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
                  Tidak Ada Kesalahan!
                </h2>

                <p className="text-sm sm:text-base text-indigo-200 max-w-md leading-relaxed">
                  Luar biasa! Rekam jejakmu bersih tanpa kesalahan yang perlu diperbaiki.
                  Pertahankan penguasaan matematikamu dengan latihan adaptif cerdas.
                </p>

                <button
                  type="button"
                  onClick={handleSwitchToAdaptive}
                  className="mt-2 min-h-[48px] py-3.5 px-8 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-amber-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <Brain className="w-5 h-5" />
                  <span>Coba Latihan Adaptif AI</span>
                </button>
              </div>
            ) : (
              // Remediation Mode with Mistakes
              <div className="p-6 rounded-3xl bg-indigo-900/50 border border-indigo-700/60 shadow-xl flex flex-col gap-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Latih Kesalahan Saya
                    </h2>
                    <span className="text-xs text-indigo-300">
                      Fokus Memperbaiki Konsep & Tipe Soal yang Keliru
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-800/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <div className="flex items-baseline justify-center sm:justify-start gap-2">
                      <span className="text-4xl font-black text-amber-400">
                        {failedQuestions.length}
                      </span>
                      <span className="text-base font-bold text-white">
                        Kesalahan Tercatat
                      </span>
                    </div>
                    <p className="text-xs text-indigo-300 mt-1">
                      Soal-soal ini akan dikemas ulang dengan variasi angka serupa untuk melatih pemahamanmu.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-900/50 px-3 py-2 rounded-xl border border-indigo-800/50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Variasi Baru & Non-Repetitif</span>
                  </div>
                </div>

                {/* Start Remediation CTA */}
                <button
                  type="button"
                  onClick={handleStartRemediation}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-amber-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Mulai Latih Kesalahan</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div role="tabpanel" aria-label="Kustom" className="p-6 rounded-3xl bg-indigo-900/50 border border-indigo-700/60 shadow-xl flex flex-col gap-6 text-white">
            {/* Operation Selector */}
            <div>
              <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider mb-2.5">
                1. Pilih Operasi Matematika
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: '+', label: '+' },
                  { id: '-', label: '−' },
                  { id: '*', label: '×' },
                  { id: '/', label: '÷' },
                  { id: 'mix', label: 'Campur' },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    aria-pressed={selectedOp === op.id}
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedOp(op.id as '+' | '-' | '*' | '/' | 'mix');
                    }}
                    className={`min-h-[48px] flex items-center justify-center rounded-2xl font-black text-lg transition active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      selectedOp === op.id
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-md border-b-4 border-amber-700'
                        : 'bg-indigo-950/60 border-2 border-indigo-800/80 text-indigo-200 hover:bg-indigo-800/60'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Number Range Selector */}
            <div>
              <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider mb-2.5">
                2. Batas Rentang Angka
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 10, label: '1 - 10' },
                  { val: 20, label: '1 - 20' },
                  { val: 50, label: '1 - 50' },
                  { val: 100, label: '1 - 100' },
                ].map((range) => (
                  <button
                    key={range.val}
                    type="button"
                    aria-pressed={numberRange === range.val}
                    onClick={() => {
                      soundManager.playClick();
                      setNumberRange(range.val);
                    }}
                    className={`min-h-[48px] flex items-center justify-center rounded-2xl font-black text-xs sm:text-sm transition active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      numberRange === range.val
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-md border-b-4 border-amber-700'
                        : 'bg-indigo-950/60 border-2 border-indigo-800/80 text-indigo-200 hover:bg-indigo-800/60'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count Selector */}
            <div>
              <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider mb-2.5">
                3. Jumlah Soal Latihan
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 20, 30].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    aria-pressed={questionCount === cnt}
                    onClick={() => {
                      soundManager.playClick();
                      setQuestionCount(cnt);
                    }}
                    className={`min-h-[48px] flex items-center justify-center rounded-2xl font-black text-xs sm:text-sm transition active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      questionCount === cnt
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-md border-b-4 border-amber-700'
                        : 'bg-indigo-950/60 border-2 border-indigo-800/80 text-indigo-200 hover:bg-indigo-800/60'
                    }`}
                  >
                    {cnt} Soal
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Custom CTA */}
            <button
              type="button"
              onClick={handleStartCustom}
              className="w-full min-h-[48px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-amber-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <Target className="w-5 h-5" />
              <span>Mulai Latihan Kustom</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
