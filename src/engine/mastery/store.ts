/**
 * Dedicated MasteryStore & Retention Pruning V2.0
 * Implementation of persistent answer event storage and cached mastery snapshots.
 * Adheres to PRD §8.3.2, §8.3.3 and Milestone V2.1 Design Spec Section 5.
 */

import { StoredAnswerEvent, MasteryRecord } from './types';
import { computeSubSkillMastery } from './calculator';

export const MASTERY_EVENTS_STORAGE_KEY = 'hk_mastery_events_v2';
export const MASTERY_SNAPSHOTS_STORAGE_KEY = 'hk_mastery_snapshots_v2';

export const RETENTION_WINDOW_MS = 90 * 86_400_000; // 90 days
export const MAX_EVENTS_PER_SUBSKILL = 30;

export interface MasteryStore {
  recordEvents(events: StoredAnswerEvent[], currentTimestamp?: number): void;
  getEventsForSubSkill(subSkillId: string): StoredAnswerEvent[];
  getAllEvents(): StoredAnswerEvent[];
  getMasteryRecord(subSkillId: string, currentTimestamp?: number): MasteryRecord;
  getAllMasteryRecords(currentTimestamp?: number): Record<string, MasteryRecord>;
  getWeakSkills(currentTimestamp?: number): MasteryRecord[];
  getStrongSkills(currentTimestamp?: number): MasteryRecord[];
  clear(): void;
}

function createMemoryStorage(): Storage {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, String(value));
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size;
    }
  };
}

function resolveStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // localStorage may throw in sandboxed/restricted environments
    }
  }
  return createMemoryStorage();
}

function sortEventsChronologically(events: StoredAnswerEvent[]): void {
  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.eventId.localeCompare(b.eventId);
  });
}

export function createMasteryStore(customStorage?: Storage): MasteryStore {
  const storage = resolveStorage(customStorage);

  function loadEvents(): StoredAnswerEvent[] {
    try {
      const raw = storage.getItem(MASTERY_EVENTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as StoredAnswerEvent[];
    } catch {
      return [];
    }
  }

  function saveEvents(events: StoredAnswerEvent[]): void {
    try {
      storage.setItem(MASTERY_EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
      console.error('Failed to save mastery events to storage:', err);
    }
  }

  function loadSnapshots(): Record<string, MasteryRecord> {
    try {
      const raw = storage.getItem(MASTERY_SNAPSHOTS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, MasteryRecord>;
      }
      return {};
    } catch {
      return {};
    }
  }

  function saveSnapshots(snapshots: Record<string, MasteryRecord>): void {
    try {
      storage.setItem(MASTERY_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
    } catch (err) {
      console.error('Failed to save mastery snapshots to storage:', err);
    }
  }

  function recordEvents(events: StoredAnswerEvent[], currentTimestamp?: number): void {
    if (!events || events.length === 0) {
      return;
    }

    const now = currentTimestamp ?? Date.now();
    const cutoff = now - RETENTION_WINDOW_MS;

    const existingEvents = loadEvents();

    // 1. Deduplicate by eventId (preserving existing, merging new)
    const eventMap = new Map<string, StoredAnswerEvent>();
    for (const evt of existingEvents) {
      if (evt && evt.eventId) {
        eventMap.set(evt.eventId, evt);
      }
    }
    for (const evt of events) {
      if (evt && evt.eventId) {
        // New events overwrite duplicate eventId if re-recorded
        eventMap.set(evt.eventId, evt);
      }
    }

    // 2. 90-day retention prune (timestamp >= cutoff)
    const validEvents = Array.from(eventMap.values()).filter((evt) => evt.timestamp >= cutoff);

    // 3. Sub-skill rolling window cap (max 30 newest events per subSkillId)
    const subSkillGroups = new Map<string, StoredAnswerEvent[]>();
    for (const evt of validEvents) {
      const list = subSkillGroups.get(evt.subSkillId) ?? [];
      list.push(evt);
      subSkillGroups.set(evt.subSkillId, list);
    }

    const retainedEvents: StoredAnswerEvent[] = [];
    for (const list of subSkillGroups.values()) {
      sortEventsChronologically(list);
      const capped = list.slice(-MAX_EVENTS_PER_SUBSKILL);
      retainedEvents.push(...capped);
    }

    sortEventsChronologically(retainedEvents);
    saveEvents(retainedEvents);

    // 4. Update cached snapshots
    const currentSnapshots = loadSnapshots();
    const updatedSnapshots: Record<string, MasteryRecord> = {};

    // Recompute snapshots for active sub-skills
    for (const subSkillId of subSkillGroups.keys()) {
      const record = computeSubSkillMastery(retainedEvents, {
        evaluationTimeMs: now,
        targetSubSkillId: subSkillId
      });
      updatedSnapshots[subSkillId] = record;
    }

    // Preserve any existing snapshots that still have retained events
    for (const [subSkillId, snap] of Object.entries(currentSnapshots)) {
      if (!updatedSnapshots[subSkillId] && subSkillGroups.has(subSkillId)) {
        updatedSnapshots[subSkillId] = snap;
      }
    }

    saveSnapshots(updatedSnapshots);
  }

  function getEventsForSubSkill(subSkillId: string): StoredAnswerEvent[] {
    const allEvents = loadEvents();
    const subSkillEvents = allEvents.filter((evt) => evt.subSkillId === subSkillId);
    sortEventsChronologically(subSkillEvents);
    return subSkillEvents;
  }

  function getAllEvents(): StoredAnswerEvent[] {
    const allEvents = loadEvents();
    sortEventsChronologically(allEvents);
    return allEvents;
  }

  function getMasteryRecord(subSkillId: string, currentTimestamp?: number): MasteryRecord {
    const allEvents = loadEvents();
    if (typeof currentTimestamp === 'number') {
      return computeSubSkillMastery(allEvents, {
        evaluationTimeMs: currentTimestamp,
        targetSubSkillId: subSkillId
      });
    }

    const snapshots = loadSnapshots();
    if (snapshots[subSkillId]) {
      return snapshots[subSkillId];
    }

    // Compute on demand if not cached
    const record = computeSubSkillMastery(allEvents, {
      targetSubSkillId: subSkillId
    });
    snapshots[subSkillId] = record;
    saveSnapshots(snapshots);
    return record;
  }

  function getAllMasteryRecords(currentTimestamp?: number): Record<string, MasteryRecord> {
    const allEvents = loadEvents();
    const subSkillIds = new Set<string>();

    for (const evt of allEvents) {
      subSkillIds.add(evt.subSkillId);
    }

    if (typeof currentTimestamp === 'number') {
      const records: Record<string, MasteryRecord> = {};
      for (const subSkillId of subSkillIds) {
        records[subSkillId] = computeSubSkillMastery(allEvents, {
          evaluationTimeMs: currentTimestamp,
          targetSubSkillId: subSkillId
        });
      }
      return records;
    }

    const snapshots = loadSnapshots();
    let cacheUpdated = false;

    for (const subSkillId of subSkillIds) {
      if (!snapshots[subSkillId]) {
        snapshots[subSkillId] = computeSubSkillMastery(allEvents, {
          targetSubSkillId: subSkillId
        });
        cacheUpdated = true;
      }
    }

    if (cacheUpdated) {
      saveSnapshots(snapshots);
    }

    return { ...snapshots };
  }

  function getWeakSkills(currentTimestamp?: number): MasteryRecord[] {
    const records = getAllMasteryRecords(currentTimestamp);
    return Object.values(records).filter((rec) => rec.isWeakSkill);
  }

  function getStrongSkills(currentTimestamp?: number): MasteryRecord[] {
    const records = getAllMasteryRecords(currentTimestamp);
    return Object.values(records).filter((rec) => rec.isStrongSkill);
  }

  function clear(): void {
    try {
      storage.removeItem(MASTERY_EVENTS_STORAGE_KEY);
      storage.removeItem(MASTERY_SNAPSHOTS_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear mastery storage:', err);
    }
  }

  return {
    recordEvents,
    getEventsForSubSkill,
    getAllEvents,
    getMasteryRecord,
    getAllMasteryRecords,
    getWeakSkills,
    getStrongSkills,
    clear
  };
}
