import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Flame,
  Trophy,
  Clock,
  Zap,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Medal,
  Sparkles,
  RotateCcw,
  User,
  Edit2,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  DailyChallengePuzzle,
  DailyChallengeQuestion,
  DailyChallengeRecord,
  DailyChallengeUserState,
  LeaderboardEntry,
  Question,
} from '../types';
import {
  getDailyPuzzle,
  getLeaderboardForDate,
  getTodayDateString,
  getTimeUntilNextDaily,
  loadDailyChallengeState,
  saveDailyChallengeState,
  submitDailyChallengeScore,
} from '../utils/dailyChallenge';
import { soundManager } from '../utils/sound';

interface DailyChallengeScreenProps {
  onExit: () => void;
  onOpenStats: () => void;
}

type ScreenState = 'hub' | 'playing' | 'result';

export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({ onExit, onOpenStats }) => {
  // Selected date for viewing / playing
  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Challenge puzzle data
  const [puzzle, setPuzzle] = useState<DailyChallengePuzzle>(() => getDailyPuzzle(todayStr));
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => getLeaderboardForDate(todayStr));
  const [userState, setUserState] = useState<DailyChallengeUserState>(() => loadDailyChallengeState());

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('hub');

  // Countdown timer to midnight
  const [countdown, setCountdown] = useState(getTimeUntilNextDaily());

  // Player Name Edit Modal
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [tempPlayerName, setTempPlayerName] = useState<string>(userState.playerName);
  const [tempPlayerFlag, setTempPlayerFlag] = useState<string>(userState.playerFlag);

  // Leaderboard filter
  const [leaderboardTab, setLeaderboardTab] = useState<'all' | 'podium' | 'near_me'>('all');

  // Gameplay State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [userInputValue, setUserInputValue] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'wrong' | null>(null);
  const [answersHistory, setAnswersHistory] = useState<Question[]>([]);
  const [comboStreak, setComboStreak] = useState<number>(0);
  const [maxComboStreak, setMaxComboStreak] = useState<number>(0);
  const [elapsedTimeSec, setElapsedTimeSec] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Completed result state
  const [latestResult, setLatestResult] = useState<{
    record: DailyChallengeRecord;
    userRank: number;
    totalParticipants: number;
    percentile: number;
    streak: number;
    leaderboard: LeaderboardEntry[];
  } | null>(null);

  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // Sync puzzle & leaderboard when selectedDate changes
  useEffect(() => {
    const pz = getDailyPuzzle(selectedDate);
    setPuzzle(pz);
    const lb = getLeaderboardForDate(selectedDate);
    setLeaderboard(lb);
  }, [selectedDate]);

  // Countdown updater
  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown(getTimeUntilNextDaily());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Check if today's challenge is already completed
  const currentRecord = userState.history[selectedDate];

  // ================= GAMEPLAY CONTROLS =================

  // Start the daily sequence
  const handleStartChallenge = () => {
    soundManager.playClick();
    setCurrentQuestionIdx(0);
    setUserInputValue('');
    setAnswersHistory([]);
    setComboStreak(0);
    setMaxComboStreak(0);
    setElapsedTimeSec(0);
    setFeedbackType(null);
    setScreenState('playing');

    // Start timer
    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    const startTime = Date.now();
    timerIntervalRef.current = window.setInterval(() => {
      setElapsedTimeSec(Math.round(((Date.now() - startTime) / 1000) * 10) / 10);
    }, 100);
  };

  // Stop timer helper
  const stopTimer = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Submit single answer in sequence
  const handleSubmitCurrentAnswer = useCallback(() => {
    if (userInputValue.trim() === '') return;

    const currentQ = puzzle.questions[currentQuestionIdx];
    const userVal = parseInt(userInputValue, 10);
    const isCorrect = userVal === currentQ.correctAnswer;

    if (isCorrect) {
      soundManager.playCorrect();
      setFeedbackType('correct');
      const nextCombo = comboStreak + 1;
      setComboStreak(nextCombo);
      setMaxComboStreak((prev) => Math.max(prev, nextCombo));
    } else {
      soundManager.playWrong();
      setFeedbackType('wrong');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      setComboStreak(0);
    }

    const recordedQuestion: Question = {
      ...currentQ,
      userAnswer: userVal,
      isCorrect,
    };

    const nextAnswers = [...answersHistory, recordedQuestion];
    setAnswersHistory(nextAnswers);

    // Proceed to next question or finish
    setTimeout(() => {
      setFeedbackType(null);
      setUserInputValue('');

      if (currentQuestionIdx + 1 < puzzle.questions.length) {
        setCurrentQuestionIdx((prev) => prev + 1);
      } else {
        // Sequence Complete!
        stopTimer();
        const totalCorrect = nextAnswers.filter((a) => a.isCorrect).length;
        const finalMaxStreak = Math.max(maxComboStreak, isCorrect ? comboStreak + 1 : comboStreak);

        // Submit and calculate rank
        const result = submitDailyChallengeScore(
          puzzle.date,
          totalCorrect,
          puzzle.questions.length,
          elapsedTimeSec,
          finalMaxStreak,
          nextAnswers
        );

        setLatestResult(result);
        setUserState(loadDailyChallengeState());
        setLeaderboard(result.leaderboard);
        setScreenState('result');
        soundManager.playFanfare();

        // Celebrate with confetti
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'],
        });
      }
    }, 280);
  }, [userInputValue, puzzle, currentQuestionIdx, comboStreak, maxComboStreak, answersHistory, elapsedTimeSec]);

  // Keypad & keyboard handling
  const handleKeypadPress = useCallback(
    (key: string) => {
      soundManager.playClick();
      if (key === 'ENTER') {
        handleSubmitCurrentAnswer();
      } else if (key === 'BACKSPACE') {
        setUserInputValue((prev) => prev.slice(0, -1));
      } else if (key === 'NEG') {
        setUserInputValue((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev));
      } else {
        if (userInputValue.length < 7) {
          setUserInputValue((prev) => prev + key);
        }
      }
    },
    [handleSubmitCurrentAnswer, userInputValue]
  );

  // Desktop keyboard listener
  useEffect(() => {
    if (screenState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('BACKSPACE');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleKeypadPress('ENTER');
      } else if (e.key === '-') {
        e.preventDefault();
        handleKeypadPress('NEG');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenState, handleKeypadPress]);

  // Save Player Profile Edit
  const handleSaveProfile = () => {
    const trimmed = tempPlayerName.trim() || 'Ksatria Kilat';
    const updated: DailyChallengeUserState = {
      ...userState,
      playerName: trimmed,
      playerFlag: tempPlayerFlag,
    };
    setUserState(updated);
    saveDailyChallengeState(updated);
    setIsEditingProfile(false);
    // Refresh leaderboard with new name
    setLeaderboard(getLeaderboardForDate(selectedDate));
  };

  // Copy shareable summary text
  const handleCopyShare = () => {
    soundManager.playClick();
    const res = latestResult || (currentRecord ? {
      record: currentRecord,
      userRank: currentRecord.rank,
      totalParticipants: leaderboard.length,
      streak: userState.currentStreak,
    } : null);

    if (!res) return;

    const text = `⚡ Hitung Kilat - Tantangan Harian (${puzzle.date})\n` +
      `🏆 Skor: ${res.record.score} Poin\n` +
      `⏱️ Waktu: ${res.record.timeTakenSec}s\n` +
      `🎯 Akurasi: ${res.record.accuracy}% (${res.record.correctCount}/${res.record.totalQuestions})\n` +
      `🏅 Peringkat: #${res.userRank || res.record.rank} Dunia\n` +
      `🔥 Streak Harian: ${userState.currentStreak} Hari\n\n` +
      `Uji kecepatan kalkulasi mentalmu di Hitung Kilat!`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    });
  };

  // Filtered leaderboard entries based on active tab
  const displayedLeaderboard = React.useMemo(() => {
    if (leaderboardTab === 'podium') {
      return leaderboard.slice(0, 3);
    }
    if (leaderboardTab === 'near_me') {
      const userIndex = leaderboard.findIndex((e) => e.isCurrentUser);
      if (userIndex === -1) return leaderboard.slice(0, 10);
      const start = Math.max(0, userIndex - 3);
      const end = Math.min(leaderboard.length, userIndex + 4);
      return leaderboard.slice(start, end);
    }
    return leaderboard;
  }, [leaderboard, leaderboardTab]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    };
  }, []);

  const currentQ = puzzle.questions[currentQuestionIdx];

  return (
    <div className="w-full pb-20">
      {/* =========================================================================
          VIEW 1: HUB / LEADERBOARD VIEW
         ========================================================================= */}
      {screenState === 'hub' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Navigation Bar */}
          <div className="flex items-center justify-between">
            <button
              id="back-to-map-button"
              onClick={() => {
                soundManager.playClick();
                onExit();
              }}
              className="flex items-center gap-2 rounded-2xl bg-indigo-900/90 border border-indigo-700/80 px-4 py-2.5 text-xs font-black text-indigo-200 hover:bg-indigo-800 hover:text-white transition shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Peta Level</span>
            </button>

            {/* Streak Counter Header Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-amber-950 font-black text-xs shadow-lg border-b-2 border-amber-700">
                <Flame className="h-4 w-4 fill-amber-950" />
                <span>STREAK: {userState.currentStreak || 0} HARI</span>
              </div>

              <button
                onClick={() => {
                  soundManager.playClick();
                  onOpenStats();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-yellow-400 hover:bg-white/15 border border-white/15 transition shadow-sm"
                title="Buka Statistik"
              >
                <Trophy className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Daily Hero Banner */}
          <div className="relative overflow-hidden rounded-[2.5rem] border-4 border-indigo-800 bg-gradient-to-br from-indigo-900 via-indigo-900 to-indigo-950 p-6 sm:p-8 text-white shadow-2xl">
            {/* Glow effects */}
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
            <div className="absolute left-1/3 -bottom-16 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Date & Mode Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md border-b-2 border-pink-700">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                  <span>Tantangan Harian Global</span>
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-1.5 text-xs font-mono font-bold text-indigo-200 border border-white/15">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    Reset dlm {countdown.hours}j {countdown.minutes}m {countdown.seconds}s
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
                  {puzzle.title}
                </h1>
                <p className="mt-1 text-xs sm:text-sm font-medium text-indigo-200/90 leading-relaxed max-w-2xl">
                  {puzzle.description} Satu rangkaian 10 teka-teki matematika unik yang sama untuk seluruh pemain di dunia hari ini!
                </p>
              </div>

              {/* Date Selector Navigation */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-1.5 border border-white/15">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      // shift 1 day back
                      const [y, m, d] = selectedDate.split('-').map(Number);
                      const prevD = new Date(y, m - 1, d - 1);
                      setSelectedDate(
                        `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(
                          prevD.getDate()
                        ).padStart(2, '0')}`
                      );
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-800 hover:bg-indigo-700 text-white transition"
                    title="Tantangan Kemarin"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2 px-3 text-xs sm:text-sm font-black text-white">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    <span>{puzzle.formattedDate}</span>
                    {selectedDate === todayStr && (
                      <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-black uppercase text-yellow-300 border border-amber-400/30">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      soundManager.playClick();
                      // shift 1 day forward (up to today)
                      if (selectedDate >= todayStr) return;
                      const [y, m, d] = selectedDate.split('-').map(Number);
                      const nextD = new Date(y, m - 1, d + 1);
                      setSelectedDate(
                        `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(
                          nextD.getDate()
                        ).padStart(2, '0')}`
                      );
                    }}
                    disabled={selectedDate >= todayStr}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                      selectedDate >= todayStr
                        ? 'opacity-40 cursor-not-allowed bg-indigo-950 text-indigo-500'
                        : 'bg-indigo-800 hover:bg-indigo-700 text-white'
                    }`}
                    title="Tantangan Selanjutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Return to today button if viewing past */}
                {selectedDate !== todayStr && (
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedDate(todayStr);
                    }}
                    className="rounded-xl bg-indigo-800 border border-indigo-700 px-3 py-1.5 text-xs font-bold text-indigo-200 hover:text-white"
                  >
                    Kembali ke Hari Ini
                  </button>
                )}
              </div>

              {/* Status & Play CTA */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-indigo-800/80">
                <div>
                  {currentRecord ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-amber-950 font-black text-xl border-b-2 border-amber-700 shadow-md">
                        #{currentRecord.rank}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Selesai Dikerjakan
                          </span>
                          <span className="text-xs text-indigo-300">•</span>
                          <span className="text-xs font-bold text-yellow-400">
                            Peringkat #{currentRecord.rank} Dunia
                          </span>
                        </div>
                        <div className="text-xl font-black font-mono text-white">
                          {currentRecord.score} Poin{' '}
                          <span className="text-xs font-medium text-indigo-300">
                            ({currentRecord.timeTakenSec}s • Akurasi {currentRecord.accuracy}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-400">
                        <Zap className="h-3.5 w-3.5 fill-amber-400" /> 10 Soal Kurasi Siap Dimainkan
                      </span>
                      <p className="text-xs text-indigo-200">
                        Target waktu 75 detik. Dapatkan poin kecepatan dan pertahankan kombo streak!
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  {currentRecord && (
                    <button
                      onClick={handleCopyShare}
                      className="flex items-center gap-2 rounded-2xl bg-indigo-800 hover:bg-indigo-700 border-2 border-indigo-700 border-b-4 border-indigo-950 px-4 py-3.5 text-xs font-black text-white shadow-lg transition active:translate-y-0.5 active:border-b-2"
                    >
                      <Share2 className="h-4 w-4" />
                      <span>{copiedShare ? 'Tersalin!' : 'Bagikan'}</span>
                    </button>
                  )}

                  <button
                    id="start-daily-challenge-button"
                    onClick={handleStartChallenge}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-orange-500 hover:brightness-110 px-7 py-3.5 text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-xl shadow-orange-500/20 transition active:translate-y-0.5 active:border-b-2 uppercase tracking-wider"
                  >
                    <Zap className="h-5 w-5 fill-amber-950" />
                    <span>{currentRecord ? 'Main Ulang (Latihan)' : 'Mulai Tantangan Hari Ini'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sequence Structure Preview Card */}
          <div className="rounded-3xl border-2 border-indigo-800/80 bg-indigo-900/60 p-5 backdrop-blur-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-200 mb-3 flex items-center gap-2">
              <span>Kurasi 10 Tahap Teka-teki Hari Ini</span>
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {puzzle.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-2xl bg-white/5 border border-white/10 p-2.5 text-center hover:bg-white/10 transition"
                >
                  <div className="text-lg mb-0.5">{q.stageIcon || '⚡'}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Tahap {idx + 1}
                  </div>
                  <div className="text-xs font-bold text-white truncate" title={q.stageTitle}>
                    {q.stageTitle}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Leaderboard Section */}
          <div className="rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 p-6 sm:p-8 shadow-2xl">
            {/* Leaderboard Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-indigo-800/80">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-amber-950 font-black shadow-md border-b-2 border-amber-700">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span>Papan Peringkat Global</span>
                    <span className="rounded-lg bg-pink-500/20 px-2 py-0.5 text-[11px] font-black text-pink-300 border border-pink-500/40 uppercase tracking-wider">
                      Spesifik Puzzle Ini
                    </span>
                  </h2>
                  <p className="text-xs text-indigo-300">
                    Skor tertinggi pemain dari seluruh dunia untuk {puzzle.formattedDate}
                  </p>
                </div>
              </div>

              {/* Player Profile Quick Setting */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setIsEditingProfile(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2 text-xs font-bold text-white transition"
                  title="Ubah Nama & Bendera Pemain"
                >
                  <User className="h-4 w-4 text-pink-400" />
                  <span>
                    {userState.playerFlag} {userState.playerName}
                  </span>
                  <Edit2 className="h-3 w-3 opacity-70" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="my-5 flex items-center gap-2">
              <button
                onClick={() => {
                  soundManager.playClick();
                  setLeaderboardTab('all');
                }}
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                  leaderboardTab === 'all'
                    ? 'bg-amber-400 text-amber-950 border-b-2 border-amber-600 shadow-md'
                    : 'bg-white/10 text-indigo-200 hover:text-white'
                }`}
              >
                Semua Peringkat ({leaderboard.length})
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  setLeaderboardTab('podium');
                }}
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                  leaderboardTab === 'podium'
                    ? 'bg-amber-400 text-amber-950 border-b-2 border-amber-600 shadow-md'
                    : 'bg-white/10 text-indigo-200 hover:text-white'
                }`}
              >
                Top 3 Podium 🥇
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  setLeaderboardTab('near_me');
                }}
                className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                  leaderboardTab === 'near_me'
                    ? 'bg-amber-400 text-amber-950 border-b-2 border-amber-600 shadow-md'
                    : 'bg-white/10 text-indigo-200 hover:text-white'
                }`}
              >
                Sekitar Peringkatmu
              </button>
            </div>

            {/* Top 3 Podium Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {leaderboard.slice(0, 3).map((topEntry, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;

                const bgColors = isFirst
                  ? 'bg-gradient-to-b from-amber-500/20 via-indigo-900 to-indigo-950 border-amber-400'
                  : isSecond
                  ? 'bg-gradient-to-b from-slate-300/15 via-indigo-900 to-indigo-950 border-slate-300'
                  : 'bg-gradient-to-b from-amber-700/20 via-indigo-900 to-indigo-950 border-amber-600';

                const medalEmoji = isFirst ? '🥇' : isSecond ? '🥈' : '🥉';
                const medalTitle = isFirst ? 'Juara 1' : isSecond ? 'Juara 2' : 'Juara 3';

                return (
                  <div
                    key={topEntry.id}
                    className={`relative rounded-3xl border-2 ${bgColors} p-4 text-center shadow-lg overflow-hidden ${
                      topEntry.isCurrentUser ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-indigo-900' : ''
                    }`}
                  >
                    <div className="text-3xl mb-1">{medalEmoji}</div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-amber-300 mb-1">
                      {medalTitle}
                    </div>
                    <div className="font-black text-sm text-white truncate flex items-center justify-center gap-1.5">
                      <span>{topEntry.flag}</span>
                      <span>{topEntry.playerName}</span>
                      {topEntry.isCurrentUser && (
                        <span className="rounded bg-pink-500 px-1.5 py-0.2 text-[10px] text-white">Kamu</span>
                      )}
                    </div>
                    <div className="mt-2 text-2xl font-black font-mono text-yellow-400">{topEntry.score}</div>
                    <div className="text-[11px] text-indigo-300 font-medium">
                      {topEntry.timeTakenSec}s • Akurasi {topEntry.accuracy}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leaderboard Table List */}
            <div className="overflow-hidden rounded-2xl border-2 border-indigo-800 bg-indigo-950/60 divide-y divide-indigo-900/80">
              <div className="grid grid-cols-12 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950/90">
                <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
                <div className="col-span-6 sm:col-span-6">Pemain</div>
                <div className="col-span-4 sm:col-span-3 text-right">Skor</div>
                <div className="hidden sm:block sm:col-span-2 text-right">Waktu / Akurasi</div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-indigo-900/60">
                {displayedLeaderboard.map((entry) => {
                  const isUser = entry.isCurrentUser;
                  return (
                    <div
                      key={entry.id}
                      className={`grid grid-cols-12 items-center px-4 py-3 transition ${
                        isUser
                          ? 'bg-gradient-to-r from-pink-500/25 via-amber-500/20 to-indigo-900/80 border-l-4 border-l-amber-400 font-bold'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                        {entry.rank === 1 ? (
                          <span className="text-xl">🥇</span>
                        ) : entry.rank === 2 ? (
                          <span className="text-xl">🥈</span>
                        ) : entry.rank === 3 ? (
                          <span className="text-xl">🥉</span>
                        ) : (
                          <span className="font-mono text-sm font-black text-indigo-300">#{entry.rank}</span>
                        )}
                      </div>

                      {/* Player Info */}
                      <div className="col-span-6 sm:col-span-6 flex items-center gap-2 truncate">
                        <span className="text-base">{entry.flag}</span>
                        <span className="font-black text-sm text-white truncate">{entry.playerName}</span>
                        {isUser && (
                          <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-black uppercase text-white tracking-wider">
                            Kamu
                          </span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="col-span-4 sm:col-span-3 text-right font-mono font-black text-base text-yellow-400">
                        {entry.score}
                      </div>

                      {/* Time / Accuracy */}
                      <div className="hidden sm:block sm:col-span-2 text-right text-xs font-mono text-indigo-300">
                        <span>{entry.timeTakenSec}s</span>
                        <span className="text-indigo-400 text-[11px] block">{entry.accuracy}% Benar</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: ACTIVE GAMEPLAY VIEW (10 CURATED QUESTIONS)
         ========================================================================= */}
      {screenState === 'playing' && currentQ && (
        <div className="mx-auto max-w-xl space-y-5 animate-in fade-in duration-200">
          {/* Top Status & Progress Bar */}
          <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-900/90 p-4 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between gap-3 text-xs font-black">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-pink-500 text-white shadow-sm">
                  {currentQ.stageIcon || '⚡'}
                </span>
                <span className="text-white">
                  Soal {currentQuestionIdx + 1} dari {puzzle.questions.length}
                </span>
                <span className="text-indigo-400">•</span>
                <span className="text-amber-400 truncate max-w-[150px] sm:max-w-xs">{currentQ.stageTitle}</span>
              </div>

              {/* Live Timer */}
              <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1 font-mono text-sm text-white border border-white/15">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>{elapsedTimeSec.toFixed(1)}s</span>
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="mt-3 flex gap-1.5">
              {puzzle.questions.map((_, idx) => {
                const isPassed = idx < currentQuestionIdx;
                const isCurrent = idx === currentQuestionIdx;
                return (
                  <div
                    key={idx}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      isPassed
                        ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                        : isCurrent
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse'
                        : 'bg-indigo-950'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Combo Indicator */}
          {comboStreak > 1 && (
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1 text-amber-950 font-black text-xs shadow-lg border-b-2 border-amber-700 animate-bounce">
                <Flame className="h-4 w-4 fill-amber-950" />
                <span>{comboStreak}x KOMBO BERUNTUN! (+{comboStreak * 30} Poin Bonus)</span>
              </div>
            </div>
          )}

          {/* Flashcard Math Expression Display */}
          <div
            className={`relative rounded-[2.5rem] border-4 p-8 text-center shadow-2xl transition-all ${
              feedbackType === 'correct'
                ? 'border-emerald-400 bg-emerald-950/80 shadow-emerald-500/25 scale-[1.02]'
                : feedbackType === 'wrong'
                ? 'border-rose-500 bg-rose-950/80 shadow-rose-500/25'
                : 'border-indigo-800 bg-indigo-900/90 shadow-indigo-950/50'
            } ${isShaking ? 'animate-[shake_0.35s_ease-in-out]' : ''}`}
          >
            <div className="text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-2">
              {puzzle.title} • {puzzle.formattedDate}
            </div>

            {/* Large Mathematical Question */}
            <div className="my-6 text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-3">
              <span>{currentQ.prompt}</span>
              <span className="text-pink-400 font-extrabold">=</span>
              <div className="min-w-[4rem] rounded-2xl bg-indigo-950/90 border-2 border-indigo-700 px-4 py-1 text-yellow-300 font-mono text-3xl sm:text-4xl shadow-inner inline-flex items-center justify-center">
                {userInputValue === '' ? (
                  <span className="animate-pulse text-indigo-500">?</span>
                ) : (
                  <span>{userInputValue}</span>
                )}
              </div>
            </div>

            {/* Feedback Message */}
            {feedbackType === 'correct' && (
              <div className="text-emerald-400 font-black text-sm flex items-center justify-center gap-1.5 animate-in zoom-in-75">
                <CheckCircle2 className="h-4 w-4" /> Benar Sekali!
              </div>
            )}
            {feedbackType === 'wrong' && (
              <div className="text-rose-400 font-black text-sm flex items-center justify-center gap-1.5 animate-in zoom-in-75">
                <XCircle className="h-4 w-4" /> Kurang Tepat, Coba Lagi!
              </div>
            )}
          </div>

          {/* 3D Tactile Keypad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'NEG', '0', 'BACKSPACE'].map((key) => {
              const isNeg = key === 'NEG';
              const isBack = key === 'BACKSPACE';

              return (
                <button
                  key={key}
                  onClick={() => handleKeypadPress(key)}
                  className={`h-14 rounded-2xl font-black text-lg shadow-md transition active:translate-y-0.5 active:border-b-2 flex items-center justify-center select-none ${
                    isBack
                      ? 'bg-rose-600 border-b-4 border-rose-800 text-white hover:bg-rose-500'
                      : isNeg
                      ? 'bg-indigo-800 border-b-4 border-indigo-950 text-indigo-200 hover:bg-indigo-700'
                      : 'bg-indigo-800/90 border-2 border-indigo-700 border-b-4 border-indigo-950 text-white hover:bg-indigo-700 text-xl'
                  }`}
                >
                  {isBack ? '⌫' : isNeg ? '±' : key}
                </button>
              );
            })}
          </div>

          {/* Large Submit Button */}
          <div className="max-w-sm mx-auto">
            <button
              onClick={handleSubmitCurrentAnswer}
              disabled={userInputValue.trim() === ''}
              className={`w-full py-4 rounded-2xl font-black text-base shadow-xl border-b-4 transition active:translate-y-0.5 active:border-b-2 flex items-center justify-center gap-2 uppercase tracking-wider ${
                userInputValue.trim() === ''
                  ? 'bg-indigo-900 border-indigo-950 text-indigo-400 opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-amber-300 to-orange-500 border-amber-700 text-amber-950 hover:brightness-110 shadow-orange-500/25'
              }`}
            >
              <span>Kirim Jawaban (Enter)</span>
              <Check className="h-5 w-5" />
            </button>
          </div>

          {/* Abort button */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                stopTimer();
                soundManager.playClick();
                setScreenState('hub');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-200 underline"
            >
              Batalkan dan kembali ke menu
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: COMPLETION / RESULT VICTORY VIEW
         ========================================================================= */}
      {screenState === 'result' && latestResult && (
        <div className="mx-auto max-w-xl space-y-6 animate-in zoom-in-95 duration-300">
          {/* Main Victory Card */}
          <div className="relative overflow-hidden rounded-[2.5rem] border-4 border-indigo-800 bg-gradient-to-br from-indigo-900 via-indigo-900 to-indigo-950 p-6 sm:p-8 text-center text-white shadow-2xl">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-1.5 text-xs font-black text-amber-950 shadow-lg border-b-2 border-amber-700 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 fill-amber-950" />
                <span>Tantangan Harian Selesai!</span>
              </div>

              {/* Big Global Rank Placement Celebration */}
              <div className="py-2">
                <div className="text-5xl font-black text-yellow-300 font-mono drop-shadow-md">
                  Peringkat #{latestResult.userRank}
                </div>
                <p className="mt-1 text-xs font-bold text-amber-300 uppercase tracking-widest">
                  Top {latestResult.percentile}% Pemain Dunia Hari Ini!
                </p>
              </div>

              {/* Score Display */}
              <div className="rounded-3xl bg-white/10 border border-white/15 p-4 flex items-center justify-around">
                <div>
                  <div className="text-[11px] font-black uppercase text-indigo-300">Total Skor</div>
                  <div className="text-3xl font-black font-mono text-white">{latestResult.record.score}</div>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div>
                  <div className="text-[11px] font-black uppercase text-indigo-300">Waktu</div>
                  <div className="text-2xl font-black font-mono text-white">{latestResult.record.timeTakenSec}s</div>
                </div>
                <div className="h-10 w-px bg-white/20" />
                <div>
                  <div className="text-[11px] font-black uppercase text-indigo-300">Akurasi</div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {latestResult.record.accuracy}%
                  </div>
                </div>
              </div>

              {/* Streak info */}
              <div className="flex items-center justify-center gap-2 text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-2xl py-2 px-4">
                <Flame className="h-4 w-4 fill-amber-400" />
                <span>Rekor Beruntun Harian: {latestResult.streak} Hari Berturut-turut!</span>
              </div>

              {/* Share & Hub buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCopyShare}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-800 hover:bg-indigo-700 border-2 border-indigo-700 border-b-4 border-indigo-950 py-3.5 text-xs font-black text-white shadow-lg transition active:translate-y-0.5 active:border-b-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span>{copiedShare ? 'Tersalin ke Clipboard!' : 'Bagikan Hasil'}</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playClick();
                    setScreenState('hub');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 border-b-4 border-amber-700 py-3.5 text-xs font-black text-amber-950 shadow-xl transition active:translate-y-0.5 active:border-b-2 uppercase tracking-wider"
                >
                  <Trophy className="h-4 w-4" />
                  <span>Lihat Peringkat Lengkap</span>
                </button>
              </div>
            </div>
          </div>

          {/* Curated 10 Puzzles Review with Step-by-Step Explanations */}
          <div className="rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-400" />
                <span>Bedah Trik & Pembahasan 10 Soal Hari Ini</span>
              </h3>
              <span className="text-xs text-indigo-300 font-bold">
                {latestResult.record.correctCount} / {latestResult.record.totalQuestions} Benar
              </span>
            </div>

            <div className="space-y-3">
              {latestResult.record.answers.map((ans, idx) => (
                <div
                  key={ans.id}
                  className={`rounded-2xl border p-3.5 text-xs space-y-1.5 transition ${
                    ans.isCorrect
                      ? 'bg-white/5 border-emerald-500/40 text-indigo-100'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-100'
                  }`}
                >
                  <div className="flex items-center justify-between font-black">
                    <span className="flex items-center gap-2 text-white">
                      <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] text-amber-300">
                        #{idx + 1}
                      </span>
                      <span>{ans.prompt}</span>
                      <span className="text-indigo-400">=</span>
                      <span className="text-yellow-400 font-mono text-sm">{ans.correctAnswer}</span>
                    </span>

                    <span
                      className={`flex items-center gap-1 text-[11px] font-black uppercase ${
                        ans.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ans.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Benar
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" /> Jawabmu: {ans.userAnswer ?? '-'}
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-[11px] text-indigo-300 leading-relaxed font-medium bg-black/20 rounded-xl p-2.5">
                    💡 <strong className="text-indigo-200">Trik Cepat:</strong> {ans.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PROFILE / NICKNAME CUSTOMIZATION MODAL
         ========================================================================= */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <User className="h-5 w-5 text-pink-400" />
              <span>Profil Papan Peringkat</span>
            </h3>
            <p className="text-xs text-indigo-300">
              Nama dan bendera yang akan tampil di papan peringkat global untuk tantangan harian.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-200 block mb-1">
                  Nama / Nickname
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={tempPlayerName}
                  onChange={(e) => setTempPlayerName(e.target.value)}
                  className="w-full rounded-xl bg-indigo-950 border-2 border-indigo-700 px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                  placeholder="Misal: Bgs, KilatMaster"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-200 block mb-1">
                  Pilih Bendera Wilayah
                </label>
                <div className="flex flex-wrap gap-2">
                  {['🇮🇩', '🇯🇵', '🇺🇸', '🇰🇷', '🇩🇪', '🇬🇧', '🇸🇬', '🇲🇾', '🇦🇺'].map((flg) => (
                    <button
                      key={flg}
                      onClick={() => setTempPlayerFlag(flg)}
                      className={`text-xl p-2 rounded-xl border transition ${
                        tempPlayerFlag === flg
                          ? 'bg-pink-500 border-pink-400 scale-110'
                          : 'bg-white/10 border-white/10 hover:bg-white/20'
                      }`}
                    >
                      {flg}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={handleSaveProfile}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-2.5 text-xs font-black text-amber-950 border-b-2 border-amber-700 shadow-md uppercase tracking-wider"
              >
                Simpan Profil
              </button>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="rounded-xl bg-indigo-800 border border-indigo-700 px-4 py-2.5 text-xs font-bold text-indigo-200 hover:text-white"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
