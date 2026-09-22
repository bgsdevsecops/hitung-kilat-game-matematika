/**
 * Hitung Kilat - Web Math Speed Game
 * @license Apache-2.0
 */

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { GameMode, LevelConfig, GameSummary, UserLevelProgress, UserStats, DailyChallengeUserState } from './types';
import { LEVELS, loadUserProgress, saveUserProgress, loadUserStats, saveUserStats } from './utils/mathGenerator';
import { loadDailyChallengeState, saveDailyChallengeState, getTodayDateString, getEffectiveDailyStreak } from './utils/dailyChallenge';
import { getWIBDateString } from './utils/dailyWib';
import { recordGameActivity, resetDailyActivity, loadDailyActivityMap, saveDailyActivityMap } from './utils/dailyActivity';
import { soundManager } from './utils/sound';
import { usePrivacySettings } from './hooks/usePrivacySettings';
import { loadPrivacyState } from './utils/privacy/privacyState';
import {
  auth,
  onAuthStateChanged,
  loginWithGoogle,
  loginAsGuest,
  logoutUser,
  saveGameDataToCloud,
  loadGameDataFromCloud,
  mergeGameProgress,
  submitTimeAttackScore,
  SyncedGameData,
  SyncedGameDataV2,
  User,
} from './lib/firebase';
import { Header } from './components/Header';
import { LevelMap } from './components/LevelMap';
import {
  ScreenLoadingFallback,
  ModalLoadingFallback,
} from './components/common/LoadingFallback';
import { ChunkErrorBoundary } from './components/common/ChunkErrorBoundary';

const PlayScreen = React.lazy(() =>
  import('./components/PlayScreen').then((m) => ({ default: m.PlayScreen }))
);
const TimeAttackScreen = React.lazy(() =>
  import('./components/TimeAttackScreen').then((m) => ({ default: m.TimeAttackScreen }))
);
const PracticeScreen = React.lazy(() =>
  import('./components/PracticeScreen').then((m) => ({ default: m.PracticeScreen }))
);
const DailyChallengeScreen = React.lazy(() =>
  import('./components/DailyChallengeScreen').then((m) => ({ default: m.DailyChallengeScreen }))
);
const ResultModal = React.lazy(() =>
  import('./components/ResultModal').then((m) => ({ default: m.ResultModal }))
);
const StatsModal = React.lazy(() =>
  import('./components/StatsModal').then((m) => ({ default: m.StatsModal }))
);
const HelpModal = React.lazy(() =>
  import('./components/HelpModal').then((m) => ({ default: m.HelpModal }))
);
const SyncAccountModal = React.lazy(() =>
  import('./components/SyncAccountModal').then((m) => ({ default: m.SyncAccountModal }))
);
const CompetitivePlayScreen = React.lazy(() =>
  import('./components/competitive/CompetitivePlayScreen').then((m) => ({
    default: m.CompetitivePlayScreen,
  }))
);
const CompetitiveModeSelectModal = React.lazy(() =>
  import('./components/competitive/CompetitiveModeSelectModal').then((m) => ({
    default: m.CompetitiveModeSelectModal,
  }))
);
const SettingsModal = React.lazy(() =>
  import('./components/privacy/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const AgeGateModal = React.lazy(() =>
  import('./components/privacy/AgeGateModal').then((m) => ({ default: m.AgeGateModal }))
);
import { CompetitiveMode } from './engine/competitive/types';
import { ingestGameAnswers, getMasteryStore } from './utils/masteryBridge';
import {
  initializeOrMigrateCampaignState,
  loadCampaignState,
  saveCampaignState,
  updateLevelProgress,
  V2CampaignState,
  V2LevelProgress,
  isLevelUnlocked,
  getCompletedBossIds,
  createDefaultCampaignState,
  projectV2ToLegacyV1,
} from './utils/campaignState';
import { V2WelcomeModal, MIGRATION_ACK_KEY } from './components/V2WelcomeModal';
import { LEVEL_MANIFEST_72 } from './engine/manifest/levels';
import { LevelConfigV2 } from './engine/types/level';
import {
  evaluateAchievements,
  loadUnlockedAchievementsMap,
  saveUnlockedAchievementsMap,
} from './utils/achievements';
import { StarRatingResult } from './utils/starRating';

export default function App() {
  const [currentMode, setCurrentMode] = useState<GameMode>('campaign');

  // V2 Campaign State & Migration
  const initialV2State = useMemo(() => initializeOrMigrateCampaignState(), []);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    const hasAck = typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_ACK_KEY) === 'true';
    if (hasAck) return false;
    return initialV2State.justMigrated;
  });
  const [campaignState, setCampaignState] = useState<V2CampaignState>(initialV2State.state);
  const [activeLevel, setActiveLevel] = useState<LevelConfig | LevelConfigV2 | null>(null);
  const [progress, setProgress] = useState<Record<number, UserLevelProgress>>({});
  const [stats, setStats] = useState<UserStats>(loadUserStats());
  const [dailyState, setDailyState] = useState<DailyChallengeUserState>(loadDailyChallengeState());
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());

  // Modals state
  const [activeSummary, setActiveSummary] = useState<GameSummary | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [statsModalTab, setStatsModalTab] = useState<'personal' | 'achievements' | 'timeAttack' | 'mastery'>('personal');
  const [practiceInitialTab, setPracticeInitialTab] = useState<'adaptive' | 'remediation' | 'custom'>('adaptive');
  const [targetSubSkillId, setTargetSubSkillId] = useState<string | undefined>(undefined);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showCompetitiveModal, setShowCompetitiveModal] = useState<boolean>(false);

  // Privacy & Child Safety Governance
  const {
    privacyState,
    isAgeGateOpen,
    openAgeGate,
    closeAgeGate,
    confirmAge,
    updatePseudonym,
    updateCountryFlag,
    toggleAnalyticsConsent,
    toggleLeaderboardOptOut,
    requestAgeProtectedAction,
  } = usePrivacySettings();
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const handleOpenSyncModal = () => {
    requestAgeProtectedAction(
      () => setShowSyncModal(true),
      () => {
        // Fallback for under 13: Local mode notification
        alert('Mode Lokal Aman Aktif: Anda dapat memainkan seluruh 72 level tanpa akun.');
      }
    );
  };

  // Firebase Auth and Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const debouncedSyncTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserRef = React.useRef<User | null>(currentUser);
  currentUserRef.current = currentUser;
  const syncSequenceRef = React.useRef<number>(0);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debouncedSyncTimeoutRef.current) {
        clearTimeout(debouncedSyncTimeoutRef.current);
      }
    };
  }, []);

  // Idle prefetch core game screens and stats modal
  useEffect(() => {
    const prefetchCoreChunks = () => {
      import('./components/PlayScreen').catch(() => {});
      import('./components/StatsModal').catch(() => {});
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prefetchCoreChunks, {
        timeout: 2000,
      });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(prefetchCoreChunks, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load progress on mount
  useEffect(() => {
    const loadedProg = loadUserProgress();
    setProgress(loadedProg);
    const loadedStats = loadUserStats();
    setStats(loadedStats);
    const loadedCamp = loadCampaignState();
    if (loadedCamp) {
      setCampaignState(loadedCamp);
    }
  }, []);

  // Listen for Firebase Auth changes and perform two-way merge on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      currentUserRef.current = user;
      if (user) {
        if (loadPrivacyState().ageEligibility === 'under13') {
          console.warn('Under-13 user detected in auth state change. Suppressing automatic cloud sync.');
          return;
        }
        setIsSyncing(true);
        try {
          const cloudData = await loadGameDataFromCloud(user.uid);
          if (currentUserRef.current?.uid !== user.uid) return;

          const localCampaign = loadCampaignState() ?? createDefaultCampaignState();
          const currentLocal: SyncedGameDataV2 = {
            schemaVersion: 2,
            campaignV2: localCampaign,
            achievementsV2: loadUnlockedAchievementsMap(),
            stats: loadUserStats(),
            dailyState: loadDailyChallengeState(),
            dailyActivity: loadDailyActivityMap(),
            progress: projectV2ToLegacyV1(localCampaign),
          };

          if (cloudData) {
            const merged = mergeGameProgress(currentLocal, cloudData);
            if (currentUserRef.current?.uid !== user.uid) return;

            saveCampaignState(merged.campaignV2);
            saveUnlockedAchievementsMap(merged.achievementsV2);
            saveUserProgress(merged.progress);
            saveUserStats(merged.stats);
            saveDailyChallengeState(merged.dailyState);
            saveDailyActivityMap(merged.dailyActivity);

            setCampaignState(merged.campaignV2);
            setProgress(merged.progress);
            setStats(merged.stats);
            setDailyState(merged.dailyState);

            await saveGameDataToCloud(user.uid, merged);
          } else {
            if (currentUserRef.current?.uid !== user.uid) return;
            await saveGameDataToCloud(user.uid, currentLocal);
          }
          if (currentUserRef.current?.uid === user.uid) {
            setLastSyncedAt(new Date());
          }
        } catch (err) {
          console.error('Error during initial Firebase sync:', err);
        } finally {
          if (currentUserRef.current?.uid === user.uid) {
            setIsSyncing(false);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper to sync local data to cloud in background with debouncing (300ms)
  const syncCurrentStateToCloud = async (
    user = currentUser,
    optionsOrImmediate?: boolean | { immediate?: boolean; merge?: boolean }
  ): Promise<void> => {
    if (privacyState.ageEligibility === 'under13') return;
    const targetUser = user || currentUserRef.current;
    if (!targetUser) return;

    const immediate =
      typeof optionsOrImmediate === 'boolean'
        ? optionsOrImmediate
        : Boolean(optionsOrImmediate?.immediate);
    const shouldMerge =
      typeof optionsOrImmediate === 'object' && optionsOrImmediate !== null && 'merge' in optionsOrImmediate
        ? optionsOrImmediate.merge
        : true;

    const performSync = async (u: User) => {
      const syncSeq = ++syncSequenceRef.current;
      try {
        setIsSyncing(true);
        const campState = loadCampaignState() ?? createDefaultCampaignState();
        const dataToSave: SyncedGameDataV2 = {
          schemaVersion: 2,
          campaignV2: campState,
          achievementsV2: loadUnlockedAchievementsMap(),
          stats: loadUserStats(),
          dailyState: loadDailyChallengeState(),
          dailyActivity: loadDailyActivityMap(),
          progress: projectV2ToLegacyV1(campState),
        };
        if (shouldMerge) {
          await saveGameDataToCloud(u.uid, dataToSave);
        } else {
          await saveGameDataToCloud(u.uid, dataToSave, { merge: false });
        }
        if (syncSeq === syncSequenceRef.current) {
          setLastSyncedAt(new Date());
        }
      } catch (e) {
        console.error('Background cloud sync error', e);
      } finally {
        if (syncSeq === syncSequenceRef.current) {
          setIsSyncing(false);
        }
      }
    };

    if (immediate) {
      if (debouncedSyncTimeoutRef.current) {
        clearTimeout(debouncedSyncTimeoutRef.current);
        debouncedSyncTimeoutRef.current = null;
      }
      return performSync(targetUser);
    }

    if (debouncedSyncTimeoutRef.current) {
      clearTimeout(debouncedSyncTimeoutRef.current);
    }
    debouncedSyncTimeoutRef.current = setTimeout(() => {
      debouncedSyncTimeoutRef.current = null;
      const activeUser = currentUserRef.current;
      if (activeUser) {
        performSync(activeUser);
      }
    }, 300);
  };

  const handleLoginGoogle = async () => {
    await loginWithGoogle();
  };

  const handleLoginGuest = async () => {
    await loginAsGuest();
  };

  const handleLogout = async () => {
    if (debouncedSyncTimeoutRef.current) {
      clearTimeout(debouncedSyncTimeoutRef.current);
      debouncedSyncTimeoutRef.current = null;
    }
    await logoutUser();
    setCurrentUser(null);
  };

  const handleManualSync = async () => {
    if (!currentUser) return;
    await syncCurrentStateToCloud(currentUser, true);
  };

  // Compute total stars collected across all levels (V2 canonical)
  const totalStars = useMemo(() => {
    return campaignState.totalStars;
  }, [campaignState]);

  const unlockedLevelsCount = useMemo(() => {
    return (Object.values(campaignState.levels) as V2LevelProgress[]).filter((p) => p.unlocked).length;
  }, [campaignState]);

  // Handle Mute Toggle
  const handleToggleMute = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
  };

  // Start Level
  const handleSelectLevel = (level: LevelConfig | LevelConfigV2) => {
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
    setPracticeInitialTab('adaptive');
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

  // Start Competitive Mode
  const handleSelectCompetitiveMode = (mode: CompetitiveMode) => {
    setShowCompetitiveModal(false);
    setActiveLevel(null);
    setActiveSummary(null);
    if (mode === 'sprint') {
      setCurrentMode('competitive_sprint');
    } else if (mode === 'survival') {
      setCurrentMode('competitive_survival');
    }
  };

  // Exit back to level map
  const handleNavigateHome = () => {
    setActiveLevel(null);
    setCurrentMode('campaign');
    setActiveSummary(null);
    setTargetSubSkillId(undefined);
    setDailyState(loadDailyChallengeState());
    syncCurrentStateToCloud();
  };

  // Process game finish (both campaign and time attack)
  const handleFinishGame = (summary: GameSummary) => {
    if (summary.history && summary.history.length > 0) {
      try {
        const sessionId = summary.sessionId || `game_${Date.now()}`;
        const userId = currentUser?.uid || 'guest_user';
        ingestGameAnswers(sessionId, userId, summary.history);
      } catch (err) {
        console.error('Failed to ingest answers into MasteryStore:', err);
      }
    }

    // Record daily activity for accuracy trend
    recordGameActivity(summary.questionsTotal, summary.correctCount);

    let nextCampaignState = campaignState;
    let finalSummary: GameSummary = { ...summary };

    // If campaign mode, update level progress and unlock next
    if (summary.mode === 'campaign' && summary.levelId !== undefined) {
      const rawId = summary.levelId;
      const matchedManifest =
        LEVEL_MANIFEST_72.find((l) => l.id === rawId) ||
        (typeof rawId === 'number'
          ? LEVEL_MANIFEST_72.find((l) => l.order === rawId)
          : !isNaN(Number(rawId))
          ? LEVEL_MANIFEST_72.find((l) => l.order === Number(rawId))
          : undefined);

      const resolvedLevelId = matchedManifest ? matchedManifest.id : String(rawId);
      const isBoss = matchedManifest ? Boolean(matchedManifest.boss) : Boolean(summary.isBoss);
      const targetTimeSec = matchedManifest ? matchedManifest.targetTimeSec : summary.targetTimeSec;
      const timeLimitSec = matchedManifest ? matchedManifest.timeLimitSec : summary.timeLimitSec;

      finalSummary.isBoss = summary.isBoss ?? isBoss;
      finalSummary.targetTimeSec = summary.targetTimeSec ?? targetTimeSec;
      finalSummary.timeLimitSec = summary.timeLimitSec ?? timeLimitSec;
      if (finalSummary.isPerfect === undefined && targetTimeSec !== undefined) {
        finalSummary.isPerfect =
          summary.accuracy === 100 &&
          summary.timeSpentSec <= targetTimeSec &&
          summary.questionsTotal > 0 &&
          summary.correctCount === summary.questionsTotal;
      }

      const starResult: StarRatingResult = {
        stars: summary.starsEarned,
        isPerfect: Boolean(finalSummary.isPerfect),
        isPassed: summary.starsEarned >= 1,
        accuracy: summary.accuracy,
        reason: '',
      };

      nextCampaignState = updateLevelProgress(
        campaignState,
        resolvedLevelId,
        starResult,
        summary.score,
        summary.timeSpentSec,
        summary.correctCount,
        summary.questionsTotal
      );
      setCampaignState(nextCampaignState);

      // Keep legacy progress synced for backward compatibility
      setProgress((prev) => {
        const legacyId = typeof rawId === 'number' ? rawId : matchedManifest?.order || 1;
        const currentProg = prev[legacyId] || {
          levelId: legacyId,
          unlocked: true,
          stars: 0,
          bestScore: 0,
          bestTimeSec: 0,
          accuracy: 0,
        };

        const updatedMap: Record<number, UserLevelProgress> = {
          ...prev,
          [legacyId]: {
            ...currentProg,
            stars: Math.max(currentProg.stars, summary.starsEarned),
            bestScore: Math.max(currentProg.bestScore, summary.score),
            bestTimeSec:
              currentProg.bestTimeSec > 0
                ? Math.min(currentProg.bestTimeSec, summary.timeSpentSec)
                : summary.timeSpentSec,
            accuracy: Math.max(currentProg.accuracy, summary.accuracy),
          },
        };

        // Unlock next level if this level earned at least 1 star!
        if (summary.starsEarned > 0 && legacyId < 24) {
          const nextLvlId = legacyId + 1;
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

    // Update global cumulative stats
    let updatedStats: UserStats = stats;
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
        starsTotal: nextCampaignState.totalStars,
      };
      saveUserStats(updated);
      updatedStats = updated;
      return updated;
    });

    // Evaluate Achievements
    try {
      const completedBossIds = getCompletedBossIds(nextCampaignState);
      const masteryRecords = getMasteryStore().getAllMasteryRecords();
      const masteredSubSkillsCount = Object.values(masteryRecords).filter(
        (r) => r.masteryScore >= 85
      ).length;

      const achContext = {
        stats: {
          ...updatedStats,
          starsTotal: nextCampaignState.totalStars,
        },
        totalStars: nextCampaignState.totalStars,
        unlockedLevelsCount: (Object.values(nextCampaignState.levels) as V2LevelProgress[]).filter((l) => l.unlocked).length,
        completedBossIds,
        highestSprintScore: updatedStats.highestTimeAttackScore || 0,
        highestSurvivalSec: 0,
        dailyStreak: getEffectiveDailyStreak(dailyState),
        masteredSubSkillsCount,
        dailyCompletedCount: Object.keys(dailyState.history).length,
      };

      const { newlyUnlocked } = evaluateAchievements(achContext);
      if (newlyUnlocked && newlyUnlocked.length > 0) {
        finalSummary.unlockedAchievements = newlyUnlocked;
      }
    } catch (err) {
      console.error('Failed to evaluate achievements:', err);
    }

    setActiveSummary(finalSummary);

    // Auto-sync game outcome to Cloud Firestore (debounced 300ms)
    syncCurrentStateToCloud();
    if (
      summary.mode === 'time_attack' &&
      currentUser &&
      summary.score > 0 &&
      !privacyState.leaderboardOptOut &&
      privacyState.ageEligibility !== 'under13'
    ) {
      submitTimeAttackScore({
        userId: currentUser.uid,
        displayName: privacyState.pseudonym || 'Pemain Kilat',
        photoURL: null, // Strictly decoupled from Google identity per AC-PRIV-02 & AC-PRIV-06
        score: summary.score,
        accuracy: summary.accuracy,
        streak: summary.maxStreak,
        solvedCount: summary.correctCount,
        playerFlag: privacyState.playerFlag || '🇮🇩',
      }).catch((e) => console.error('Auto-submit time attack score error:', e));
    }
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
    if ('order' in activeLevel) {
      const nextOrder = activeLevel.order + 1;
      const nextLvlV2 = LEVEL_MANIFEST_72.find((l) => l.order === nextOrder);
      if (nextLvlV2) {
        setActiveSummary(null);
        setActiveLevel(nextLvlV2);
        return;
      }
    } else {
      const nextLvlConfig = LEVELS.find((l) => l.id === Number(activeLevel.id) + 1);
      if (nextLvlConfig) {
        setActiveSummary(null);
        setActiveLevel(nextLvlConfig);
        return;
      }
    }
    handleNavigateHome();
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
    const initCampaign = createDefaultCampaignState();
    setProgress(initProg);
    setCampaignState(initCampaign);
    setStats(initStats);
    saveUserProgress(initProg);
    saveCampaignState(initCampaign);
    saveUserStats(initStats);
    saveUnlockedAchievementsMap({});
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(MIGRATION_ACK_KEY);
      } catch {
        // ignore storage errors
      }
    }
    resetDailyActivity();
    setShowStatsModal(false);
    syncCurrentStateToCloud(currentUser, { immediate: true, merge: false });
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
        onOpenStats={() => {
          setStatsModalTab('personal');
          setShowStatsModal(true);
        }}
        onOpenAchievements={() => {
          setStatsModalTab('achievements');
          setShowStatsModal(true);
        }}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenDailyChallenge={handleStartDailyChallenge}
        onOpenSyncModal={handleOpenSyncModal}
        onOpenSettings={() => setShowSettingsModal(true)}
        currentUser={currentUser}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        totalStars={totalStars}
        dailyStreak={getEffectiveDailyStreak(dailyState)}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 flex-1 w-full relative z-10">
        <ChunkErrorBoundary>
          <Suspense fallback={<ScreenLoadingFallback />}>
            {/* Campaign Level Play Screen */}
            {activeLevel && (
              <PlayScreen
                key={activeLevel.id}
                level={activeLevel}
                currentStars={
                  campaignState.levels[String(activeLevel.id)]?.stars ??
                  (typeof activeLevel.id === 'number' ? progress[activeLevel.id]?.stars : 0) ??
                  0
                }
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
              <PracticeScreen
                onExit={() => {
                  setTargetSubSkillId(undefined);
                  handleNavigateHome();
                }}
                initialTab={practiceInitialTab}
                targetSubSkillId={targetSubSkillId}
                onClearTargetSubSkill={() => setTargetSubSkillId(undefined)}
                userId={currentUser?.uid || 'guest_user'}
                onOpenStats={() => {
                  setTargetSubSkillId(undefined);
                  setStatsModalTab('mastery');
                  setShowStatsModal(true);
                }}
              />
            )}

            {/* Competitive Mode Screen (Sprint 60s & Survival Kilat) */}
            {!activeLevel && (currentMode === 'competitive_sprint' || currentMode === 'competitive_survival') && (
              <CompetitivePlayScreen
                mode={currentMode === 'competitive_sprint' ? 'sprint' : 'survival'}
                secret="hitung-kilat-competitive-secret-v2"
                userId={currentUser?.uid || 'guest_user'}
                isRanked={
                  Boolean(currentUser) &&
                  privacyState.ageEligibility !== 'under13' &&
                  !privacyState.leaderboardOptOut
                }
                onExit={handleNavigateHome}
              />
            )}

            {/* Home Campaign Level Map */}
            {!activeLevel && currentMode === 'campaign' && (
              <LevelMap
                campaignState={campaignState}
                progress={progress}
                onSelectLevel={handleSelectLevel}
                onStartTimeAttack={handleStartTimeAttack}
                onStartPractice={handleStartPractice}
                onStartDailyChallenge={handleStartDailyChallenge}
                onOpenCompetitiveModal={() => setShowCompetitiveModal(true)}
                dailyStreak={getEffectiveDailyStreak(dailyState)}
                isDailyCompletedToday={Boolean(dailyState.history[getWIBDateString()]?.completed)}
              />
            )}
          </Suspense>
        </ChunkErrorBoundary>
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
        <ChunkErrorBoundary variant="modal" onClose={() => setActiveSummary(null)}>
          <Suspense fallback={<ModalLoadingFallback />}>
            <ResultModal
              summary={activeSummary}
              onRetry={handleRetryCurrent}
              onNextLevel={handleAdvanceNextLevel}
              onHome={handleNavigateHome}
              hasNextLevel={
                activeLevel
                  ? 'order' in activeLevel
                    ? activeLevel.order < 72
                    : activeLevel.id < 24
                  : false
              }
              onStartRemediation={() => {
                setActiveSummary(null);
                setActiveLevel(null);
                setPracticeInitialTab('remediation');
                setCurrentMode('practice');
              }}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* Statistics Modal */}
      {showStatsModal && (
        <ChunkErrorBoundary variant="modal" onClose={() => setShowStatsModal(false)}>
          <Suspense fallback={<ModalLoadingFallback />}>
            <StatsModal
              isOpen={showStatsModal}
              onClose={() => setShowStatsModal(false)}
              stats={stats}
              totalStars={totalStars}
              unlockedLevelsCount={unlockedLevelsCount}
              dailyStreak={dailyState.currentStreak}
              dailyCompletedCount={Object.keys(dailyState.history).length}
              onResetProgress={handleResetProgress}
              currentUser={currentUser}
              onOpenSyncModal={handleOpenSyncModal}
              playerName={privacyState.pseudonym || dailyState.playerName}
              playerFlag={privacyState.playerFlag || dailyState.playerFlag}
              defaultTab={statsModalTab}
              isLeaderboardSubmissionAllowed={
                Boolean(currentUser) &&
                privacyState.ageEligibility !== 'under13' &&
                !privacyState.leaderboardOptOut
              }
              onStartPractice={(subSkillId) => {
                setShowStatsModal(false);
                setActiveLevel(null);
                setTargetSubSkillId(subSkillId);
                setPracticeInitialTab('adaptive');
                setCurrentMode('practice');
              }}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* Help & Mental Math Tricks Modal */}
      {showHelpModal && (
        <ChunkErrorBoundary variant="modal" onClose={() => setShowHelpModal(false)}>
          <Suspense fallback={<ModalLoadingFallback />}>
            <HelpModal
              isOpen={showHelpModal}
              onClose={() => setShowHelpModal(false)}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* Competitive Mode Selection Modal */}
      {showCompetitiveModal && (
        <ChunkErrorBoundary variant="modal" onClose={() => setShowCompetitiveModal(false)}>
          <Suspense fallback={<ModalLoadingFallback />}>
            <CompetitiveModeSelectModal
              isOpen={showCompetitiveModal}
              onClose={() => setShowCompetitiveModal(false)}
              onSelectMode={handleSelectCompetitiveMode}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* Cloud Sync & Google Account Modal */}
      {showSyncModal && (
        <ChunkErrorBoundary variant="modal" onClose={() => setShowSyncModal(false)}>
          <Suspense fallback={<ModalLoadingFallback />}>
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
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* Settings & Privacy Modal */}
      {showSettingsModal && (
        <ChunkErrorBoundary variant="modal" onClose={() => setShowSettingsModal(false)}>
          <Suspense fallback={<ModalLoadingFallback />}>
            <SettingsModal
              isOpen={showSettingsModal}
              onClose={() => setShowSettingsModal(false)}
              privacyState={privacyState}
              onUpdatePseudonym={updatePseudonym}
              onUpdateCountryFlag={updateCountryFlag}
              onToggleAnalyticsConsent={toggleAnalyticsConsent}
              onToggleLeaderboardOptOut={toggleLeaderboardOptOut}
              onResetLocalProgress={handleResetProgress}
              currentUser={currentUser}
              openAgeGate={openAgeGate}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* Age Verification Gate Modal */}
      {isAgeGateOpen && (
        <ChunkErrorBoundary variant="modal" onClose={closeAgeGate}>
          <Suspense fallback={<ModalLoadingFallback />}>
            <AgeGateModal
              isOpen={isAgeGateOpen}
              onClose={closeAgeGate}
              onConfirmAge={confirmAge}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}

      {/* V2 Welcome & Migration Modal */}
      {showWelcomeModal && (
        <V2WelcomeModal
          isOpen={showWelcomeModal}
          transferredStars={campaignState.totalStars}
          legacyStarCredits={campaignState.legacyStarCredits}
          unlockedLevelsCount={unlockedLevelsCount}
          onClose={() => {
            try {
              localStorage.setItem(MIGRATION_ACK_KEY, 'true');
            } catch {
              // ignore
            }
            setShowWelcomeModal(false);
          }}
        />
      )}

    </div>
  );
}
