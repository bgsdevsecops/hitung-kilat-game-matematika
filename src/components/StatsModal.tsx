import React, { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  Award,
  Flame,
  Target,
  Trash2,
  Calendar,
  TrendingUp,
  TrendingDown,
  Timer,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { UserStats } from '../types';
import { User } from '../lib/firebase';
import { soundManager } from '../utils/sound';
import { getLast7DaysAccuracyTrend, AccuracyTrendPoint } from '../utils/dailyActivity';
import { TimeAttackLeaderboardTab } from './TimeAttackLeaderboardTab';
import { AchievementsTab } from './AchievementsTab';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  totalStars: number;
  unlockedLevelsCount: number;
  dailyStreak?: number;
  dailyCompletedCount?: number;
  onResetProgress: () => void;
  currentUser?: User | null;
  onOpenSyncModal?: () => void;
  playerName?: string;
  playerFlag?: string;
  defaultTab?: 'personal' | 'timeAttack' | 'achievements';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: AccuracyTrendPoint }>;
}

const CustomAccuracyTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-2xl border-2 border-indigo-700 bg-indigo-950/95 p-3 text-xs shadow-2xl backdrop-blur-md">
        <div className="font-black text-indigo-200 mb-1 flex items-center justify-between gap-3">
          <span>{data.fullLabel}</span>
          <span className="font-mono text-emerald-400 font-black text-sm">{data.accuracy}%</span>
        </div>
        {data.hasActivity ? (
          <div className="text-[11px] text-indigo-300">
            {data.correctCount} benar dari {data.questionsTotal} soal terjawab
          </div>
        ) : (
          <div className="text-[10px] text-indigo-400 italic">
            Estimasi performa berhitung harian
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  totalStars,
  unlockedLevelsCount,
  dailyStreak = 0,
  dailyCompletedCount = 0,
  onResetProgress,
  currentUser = null,
  onOpenSyncModal = () => {},
  playerName = 'Jago Hitung',
  playerFlag = '🇮🇩',
  defaultTab = 'personal',
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'achievements' | 'timeAttack'>(defaultTab);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const overallAccuracy =
    stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;
  const minutesPlayed = Math.round(stats.totalTimePlayedSec / 60);

  // Compute 7-day trend using recharts data points
  const { data: trendData, averageAccuracy, trendPercentage } = useMemo(
    () => getLast7DaysAccuracyTrend(overallAccuracy > 0 ? overallAccuracy : 80),
    [overallAccuracy, stats.totalSolved, dailyCompletedCount]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-indigo-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-black border-b-2 border-amber-700 shadow-md">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-white">Statistik & Pencapaian</h2>
              <p className="text-xs text-indigo-300">Rekapitulasi kecepatan, lencana prestasi & leaderboard</p>
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

        {/* Navigation Tabs */}
        <div className="flex rounded-2xl bg-indigo-950/90 p-1.5 border border-indigo-800 shadow-inner gap-1">
          <button
            id="tab-personal-stats"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('personal');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-black text-xs transition ${
              activeTab === 'personal'
                ? 'bg-indigo-700 text-white shadow-md border border-indigo-500/30'
                : 'text-indigo-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Statistik</span>
          </button>
          <button
            id="tab-achievements"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('achievements');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-black text-xs transition ${
              activeTab === 'achievements'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md border border-pink-400/40'
                : 'text-indigo-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Pencapaian</span>
          </button>
          <button
            id="tab-time-attack-top10"
            onClick={() => {
              soundManager.playClick();
              setActiveTab('timeAttack');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-black text-xs transition ${
              activeTab === 'timeAttack'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 shadow-md border border-amber-300/40'
                : 'text-indigo-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="h-4 w-4 shrink-0" />
            <span>Top 10 TA</span>
          </button>
        </div>

        {/* Tab 1: Personal Statistics & Accuracy Trend */}
        {activeTab === 'personal' ? (
          <>
            {/* 7-Day Accuracy Trend Line Chart (Recharts) */}
            <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/60 p-4 sm:p-5 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b border-indigo-900/80">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Tren Akurasi 7 Hari Terakhir</span>
                </h3>
                <p className="text-[11px] text-indigo-300">
                  Pantau peningkatan ketepatan berhitung Anda dari hari ke hari
                </p>
              </div>
            </div>

            {/* Trend Badges */}
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-bold text-indigo-200">
                Rata-rata: <strong className="text-white font-mono">{averageAccuracy}%</strong>
              </div>
              <div
                className={`rounded-xl px-2.5 py-1 text-[11px] font-black flex items-center gap-1 ${
                  trendPercentage >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {trendPercentage >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    <span>+{trendPercentage}% Tren</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    <span>{trendPercentage}% Tren</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Responsive Recharts LineChart */}
          <div className="w-full h-44 sm:h-48 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#3730a3" strokeDasharray="3 3" opacity={0.35} vertical={false} />
                <XAxis
                  dataKey="displayDay"
                  stroke="#818cf8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#4338ca', opacity: 0.5 }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  stroke="#818cf8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <ReferenceLine
                  y={80}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: 'Target 80%',
                    fill: '#fbbf24',
                    fontSize: 9,
                    position: 'insideTopRight',
                  }}
                />
                <Tooltip content={<CustomAccuracyTooltip />} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Akurasi"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981', stroke: '#064e3b', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#34d399', stroke: '#022c22', strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={700}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-indigo-300 px-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Akurasi Harian (%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 border-t-2 border-dashed border-amber-400 inline-block" /> Standar Emas (80%)
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-yellow-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Total Bintang</span>
              <span>⭐</span>
            </div>
            <div className="text-2xl font-black text-yellow-400 font-mono">
              {totalStars} <span className="text-xs font-normal text-indigo-300">/ 72</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-pink-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Level Terbuka</span>
              <Target className="h-4 w-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {unlockedLevelsCount} <span className="text-xs font-normal text-indigo-300">/ 24</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Akurasi Kumulatif</span>
              <Award className="h-4 w-4" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {overallAccuracy}%
            </div>
            <div className="text-[10px] text-indigo-300 mt-0.5 font-medium">
              {stats.totalCorrect} benar dari {stats.totalSolved} soal
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Streak Terbaik</span>
              <Flame className="h-4 w-4 fill-rose-400 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-orange-400 font-mono">
              {stats.bestStreak}x
            </div>
            <div className="text-[10px] text-indigo-300 mt-0.5 font-medium">
              Kombo beruntun tanpa salah
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1">
              Rekor Lari Kilat 60s
            </div>
            <div className="text-2xl font-black text-yellow-400 font-mono">
              {stats.highestTimeAttackScore} <span className="text-xs font-normal text-indigo-300">Poin</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1">
              Waktu Latihan
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {minutesPlayed} <span className="text-xs font-normal text-indigo-300">Menit</span>
            </div>
          </div>

          <div className="col-span-2 rounded-2xl bg-gradient-to-r from-pink-500/20 via-rose-500/20 to-amber-500/20 border border-pink-500/40 p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black text-pink-300 uppercase tracking-wider">
                <Calendar className="h-4 w-4 text-amber-400" />
                <span>Tantangan Harian Global</span>
              </div>
              <div className="text-[11px] text-indigo-200 mt-0.5">
                {dailyCompletedCount} hari terselesaikan
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black uppercase text-amber-400">Streak Harian</div>
              <div className="text-xl font-black font-mono text-white flex items-center gap-1 justify-end">
                <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span>{dailyStreak} Hari</span>
              </div>
            </div>
          </div>

        </div>

        {/* Reset Progress Section */}
        <div className="pt-4 border-t border-indigo-800/80">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset Seluruh Progres Permainan</span>
            </button>
          ) : (
            <div className="rounded-2xl bg-rose-950/80 border-2 border-rose-600/50 p-3.5 space-y-2.5 text-xs">
              <p className="font-bold text-rose-200">
                Yakin ingin mereset semua bintang dan pencapaian level? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 font-black text-white shadow-md hover:bg-rose-500 border-b-2 border-rose-800 uppercase tracking-wider"
                >
                  Ya, Reset Sekarang
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="rounded-xl border border-indigo-700 bg-indigo-800 px-3.5 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    ) : activeTab === 'achievements' ? (
      /* Tab 2: Achievements & Milestones Badges */
      <AchievementsTab
        stats={stats}
        totalStars={totalStars}
        unlockedLevelsCount={unlockedLevelsCount}
        dailyStreak={dailyStreak}
        dailyCompletedCount={dailyCompletedCount}
      />
    ) : (
      /* Tab 3: Top 10 Time Attack Mode from Firestore */
      <TimeAttackLeaderboardTab
        stats={stats}
        currentUser={currentUser}
        playerName={playerName}
        playerFlag={playerFlag}
        onOpenSyncModal={onOpenSyncModal}
      />
    )}

      </div>
    </div>
  );
};
