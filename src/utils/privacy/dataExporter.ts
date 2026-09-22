import { PrivacyState } from '../../types';
import { loadPrivacyState, CURRENT_POLICY_VERSION } from './privacyState';
import { loadCampaignState, createDefaultCampaignState } from '../campaignState';
import { loadUserStats } from '../mathGenerator';
import { loadDailyChallengeState } from '../dailyChallenge';
import { loadUnlockedAchievementsMap } from '../achievements';
import { getMasteryStore } from '../masteryBridge';

export interface ExportedGameDataPayload {
  metadata: {
    exportedAt: string;
    schemaVersion: number;
    appVersion: string;
    policyVersion: string;
  };
  privacy: PrivacyState;
  campaign: unknown;
  mastery: unknown;
  dailyChallenge: unknown;
  achievements: unknown;
  stats: unknown;
}

export function exportAllGameData(): ExportedGameDataPayload {
  const privacy = loadPrivacyState();
  const campaign = loadCampaignState() || createDefaultCampaignState();
  const stats = loadUserStats();
  const dailyChallenge = loadDailyChallengeState();
  const achievements = loadUnlockedAchievementsMap();
  let mastery: unknown = {};
  try {
    mastery = getMasteryStore().getAllMasteryRecords();
  } catch {
    mastery = {};
  }

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      appVersion: '2.0.0',
      policyVersion: CURRENT_POLICY_VERSION,
    },
    privacy,
    campaign,
    mastery,
    dailyChallenge,
    achievements,
    stats,
  };
}

export function triggerJSONDownload(filename: string, jsonString: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
