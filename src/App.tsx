/**
 * Hitung Kilat - Web Math Speed Game
 * @license Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GameMode, LevelConfig, GameSummary, UserLevelProgress, UserStats, DailyChallengeUserState } from './types';
import { LEVELS, loadUserProgress, saveUserProgress, loadUserStats, saveUserStats } from './utils/mathGenerator';
import { loadDailyChallengeState, saveDailyChallengeState, getTodayDateString } from './utils/dailyChallenge';
import { recordGameActivity, resetDailyActivity, loadDailyActivityMap, saveDailyActivityMap } from './utils/dailyActivity';
import { soundManager } from './utils/sound';
import {
  auth,
  onAuthStateChanged,
  loginWithGoogle,
  loginAsGuest,
  logoutUser,
  saveGameDataToCloud,
  loadGameDataFromCloud,
  mergeGameProgress,
  SyncedGameData,
  User,
} from './lib/firebase';
import { Header } from './components/Header';
import { LevelMap } from './components/LevelMap';
import { PlayScreen } from './components/PlayScreen';
import { TimeAttackScreen } from './components/TimeAttackScreen';
import { PracticeScreen } from './components/PracticeScreen';
import { DailyChallengeScreen } from './components/DailyChallengeScreen';
import { ResultModal } from './components/ResultModal';
import { StatsModal } from './components/StatsModal';
import { HelpModal } from './components/HelpModal';
import { SyncAccountModal } from './components/SyncAccountModal';

export default function App() {
  const [currentMode, setCurrentMode] = useState<GameMode>('campaign');
  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(null);
  const [progress, setProgress] = useState<Record<number, UserLevelProgress>>({});
  const [stats, setStats] = useState<UserStats>(loadUserStats());
  const [dailyState, setDailyState] = useState<DailyChallengeUserState>(loadDailyChallengeState());
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  
  // Modals state
  const [activeSummary, setActiveSummary] = useState<GameSummary | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);

  // Firebase Auth and Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Load progress on mount
  useEffect(() => {
    const loadedProg = loadUserProgress();
    setProgress(loadedProg);
    const loadedStats = loadUserStats();
    setStats(loadedStats);
  }, []);

  // Listen for Firebase Auth changes and perform two-way merge on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsSyncing(true);
        try {
          const cloudData = await loadGameDataFromCloud(user.uid);
          const currentLocal: SyncedGameData = {
            progress: loadUserProgress(),
            stats: loadUserStats(),
            dailyState: loadDailyChallengeState(),
            dailyActivity: loadDailyActivityMap(),
          };

          if (cloudData) {
            const merged = mergeGameProgress(currentLocal, cloudData);
            saveUserProgress(merged.progress);
            saveUserStats(merged.stats);
            saveDailyChallengeState(merged.dailyState);
            saveDailyActivityMap(merged.dailyActivity);

            setProgress(merged.progress);
            setStats(merged.stats);
            setDailyState(merged.dailyState);

            await saveGameDataToCloud(user.uid, merged);
          } else {
            await saveGameDataToCloud(user.uid, currentLocal);
          }
          setLastSyncedAt(new Date());
        } catch (err) {
          console.error('Error during initial Firebase sync:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper to sync local data to cloud in background
  const syncCurrentStateToCloud = async (user = currentUser) => {
    if (!user) return;
    try {
      setIsSyncing(true);
      const dataToSave: SyncedGameData = {
        progress: loadUserProgress(),
        stats: loadUserStats(),
        dailyState: loadDailyChallengeState(),
        dailyActivity: loadDailyActivityMap(),
      };
      await saveGameDataToCloud(user.uid, dataToSave);
      setLastSyncedAt(new Date());
    } catch (e) {
      console.error('Background cloud sync error', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginGoogle = async () => {
    const user = await loginWithGoogle();
    await syncCurrentStateToCloud(user);
  };

  const handleLoginGuest = async () => {
    const user = await loginAsGuest();
    await syncCurrentStateToCloud(user);
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    await syncCurrentStateToCloud(currentUser);
  };

  // Compute total stars collected across all levels
  const totalStars = useMemo(() => {
    return (Object.values(progress) as UserLevelProgress[]).reduce((acc, curr) => acc + (curr.stars || 0), 0);
  }, [progress]);

  const unlockedLevelsCount = useMemo(() => {
    return (Object.values(progress) as UserLevelProgress[]).filter((p) => p.unlocked).length;
  }, [progress]);

  // Handle Mute Toggle
  const handleToggleMute = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
  };

  // Start Level
  const handleSelectLevel = (level: LevelConfig) => {
    setActiveLevel(level);
    setCurrentMode('campaign');
    setActiveSummary(null);
  };

  // Start Time Attack
  const handleStartTimeAttack = () => {
    setActiveLevel(null);
    setCurrentMode('time_attack');
    setActiveSummary(null);
  };

  // Start Practice
  const handleStartPractice = () => {
    setActiveLevel(null);
    setCurrentMode('practice');
    setActiveSummary(null);
  };

  // Start Daily Challenge
  const handleStartDailyChallenge = () => {
    setActiveLevel(null);
    setCurrentMode('daily_challenge');
    setActiveSummary(null);
    setDailyState(loadDailyChallengeState());
  };

  // Exit back to level map
  const handleNavigateHome = () => {
    setActiveLevel(null);
    setCurrentMode('campaign');
    setActiveSummary(null);
    setDailyState(loadDailyChallengeState());
  };

  // Process game finish (both campaign and time attack)
  const handleFinishGame = (summary: GameSummary) => {
    setActiveSummary(summary);

    // Record daily activity for accuracy trend
    recordGameActivity(summary.questionsTotal, summary.correctCount);

    // Update global cumulative stats
    setStats((prev) => {
      const updated: UserStats = {
        totalSolved: prev.totalSolved + summary.questionsTotal,
        totalCorrect: prev.totalCorrect + summary.correctCount,
        totalTimePlayedSec: prev.totalTimePlayedSec + summary.timeSpentSec,
        bestStreak: Math.max(prev.bestStreak, summary.maxStreak),
        highestTimeAttackScore:
          summary.mode === 'time_attack'
            ? Math.max(prev.highestTimeAttackScore, summary.score)
            : prev.highestTimeAttackScore,
        highestSPM: Math.max(prev.highestSPM, summary.questionsPerMinute),
        starsTotal: totalStars,
      };
      saveUserStats(updated);
      return updated;
    });

    // If campaign mode, update level progress and unlock next
    if (summary.mode === 'campaign' && summary.levelId) {
      const lvlId = summary.levelId;
      setProgress((prev) => {
        const currentProg = prev[lvlId] || {
          levelId: lvlId,
          unlocked: true,
          stars: 0,
          bestScore: 0,
          bestTimeSec: 0,
          accuracy: 0,
        };

        const newStars = Math.max(currentProg.stars, summary.starsEarned);
        const newBestScore = Math.max(currentProg.bestScore, summary.score);
        const newBestTime =
          currentProg.bestTimeSec > 0
            ? Math.min(currentProg.bestTimeSec, summary.timeSpentSec)
            : summary.timeSpentSec;

        const updatedMap: Record<number, UserLevelProgress> = {
          ...prev,
          [lvlId]: {
            ...currentProg,
            stars: newStars,
            bestScore: newBestScore,
            bestTimeSec: newBestTime,
            accuracy: Math.max(currentProg.accuracy, summary.accuracy),
          },
        };

        // Unlock next level if this level earned at least 1 star!
        if (summary.starsEarned > 0 && lvlId < 24) {
          const nextLvlId = lvlId + 1;
          const nextProg = updatedMap[nextLvlId] || {
            levelId: nextLvlId,
            unlocked: false,
            stars: 0,
            bestScore: 0,
            bestTimeSec: 0,
            accuracy: 0,
          };
          updatedMap[nextLvlId] = {
            ...nextProg,
            unlocked: true,
          };
        }

        saveUserProgress(updatedMap);
        return updatedMap;
      });
    }

    // Auto-sync game outcome to Cloud Firestore
    setTimeout(() => {
      syncCurrentStateToCloud();
    }, 150);
  };

  // Retry currently finished level
  const handleRetryCurrent = () => {
    setActiveSummary(null);
    if (currentMode === 'campaign' && activeLevel) {
      // Re-trigger level
      setActiveLevel({ ...activeLevel });
    }
  };

  // Advance to next level from result modal
  const handleAdvanceNextLevel = () => {
    if (!activeLevel) return;
    const nextLvlConfig = LEVELS.find((l) => l.id === activeLevel.id + 1);
    if (nextLvlConfig) {
      setActiveSummary(null);
      setActiveLevel(nextLvlConfig);
    } else {
      handleNavigateHome();
    }
  };

  // Reset all progress with confirmation
  const handleResetProgress = () => {
    const initProg: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 0, bestScore: 0, bestTimeSec: 0, accuracy: 0 },
    };
    const initStats: UserStats = {
      totalSolved: 0,
      totalCorrect: 0,
      totalTimePlayedSec: 0,
      bestStreak: 0,
      highestTimeAttackScore: 0,
      highestSPM: 0,
      starsTotal: 0,
    };
    setProgress(initProg);
    setStats(initStats);
    saveUserProgress(initProg);
    saveUserStats(initStats);
    resetDailyActivity();
    setShowStatsModal(false);
    setTimeout(() => {
      syncCurrentStateToCloud();
    }, 150);
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white font-sans antialiased selection:bg-pink-500 selection:text-white flex flex-col relative overflow-x-hidden">
      {/* Vibrant Ambient Glow Highlights */}
      <div className="fixed top-0 left-1/4 -translate-y-1/2 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/3 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-1/3 w-[30rem] h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      
      {/* Top Header Navigation */}
      <Header
        currentMode={activeLevel ? 'campaign' : currentMode}
        onNavigateHome={handleNavigateHome}
        onOpenStats={() => setShowStatsModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenDailyChallenge={handleStartDailyChallenge}
        onOpenSyncModal={() => setShowSyncModal(true)}
        currentUser={currentUser}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        totalStars={totalStars}
        dailyStreak={dailyState.currentStreak}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 flex-1 w-full relative z-10">
        {/* Campaign Level Play Screen */}
        {activeLevel && (
          <PlayScreen
            key={activeLevel.id}
            level={activeLevel}
            onFinishLevel={handleFinishGame}
            onExit={handleNavigateHome}
          />
        )}

        {/* Daily Challenge Screen */}
        {!activeLevel && currentMode === 'daily_challenge' && (
          <DailyChallengeScreen
            onExit={handleNavigateHome}
            onOpenStats={() => setShowStatsModal(true)}
          />
        )}

        {/* Time Attack 60s Sprint Screen */}
        {!activeLevel && currentMode === 'time_attack' && (
          <TimeAttackScreen
            onFinish={handleFinishGame}
            onExit={handleNavigateHome}
            highScore={stats.highestTimeAttackScore}
          />
        )}

        {/* Practice Screen */}
        {!activeLevel && currentMode === 'practice' && (
          <PracticeScreen onExit={handleNavigateHome} />
        )}

        {/* Home Campaign Level Map */}
        {!activeLevel && currentMode === 'campaign' && (
          <LevelMap
            progress={progress}
            onSelectLevel={handleSelectLevel}
            onStartTimeAttack={handleStartTimeAttack}
            onStartPractice={handleStartPractice}
            onStartDailyChallenge={handleStartDailyChallenge}
            dailyStreak={dailyState.currentStreak}
            isDailyCompletedToday={Boolean(dailyState.history[getTodayDateString()]?.completed)}
          />
        )}
      </main>

      {/* Vibrant Design Footer */}
      <footer className="mt-auto py-6 px-4 border-t border-indigo-900/60 bg-indigo-950/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-indigo-300/70">
          <div className="flex items-center gap-3">
            <span className="bg-white/10 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-indigo-200 border border-white/10">
              Keyboard Ready
            </span>
            <span className="bg-white/10 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-indigo-200 border border-white/10">
              {isMuted ? 'Sound Off' : 'Sound FX Active'}
            </span>
          </div>
          <div className="text-[11px] font-mono font-semibold tracking-widest uppercase opacity-75 text-indigo-200">
            Hitung Kilat • Speed Math Blaster
          </div>
        </div>
      </footer>

      {/* Game Result Summary Modal */}
      {activeSummary && (
        <ResultModal
          summary={activeSummary}
          onRetry={handleRetryCurrent}
          onNextLevel={handleAdvanceNextLevel}
          onHome={handleNavigateHome}
          hasNextLevel={activeLevel ? activeLevel.id < 24 : false}
        />
      )}

      {/* Statistics Modal */}
      <StatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        stats={stats}
        totalStars={totalStars}
        unlockedLevelsCount={unlockedLevelsCount}
        dailyStreak={dailyState.currentStreak}
        dailyCompletedCount={Object.keys(dailyState.history).length}
        onResetProgress={handleResetProgress}
      />

      {/* Help & Mental Math Tricks Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* Cloud Sync & Google Account Modal */}
      <SyncAccountModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        currentUser={currentUser}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        onLoginGoogle={handleLoginGoogle}
        onLoginGuest={handleLoginGuest}
        onLogout={handleLogout}
        onManualSync={handleManualSync}
      />

    </div>
  );
}
