import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMasteryStore,
  MasteryStore,
  MASTERY_EVENTS_STORAGE_KEY,
  MASTERY_SNAPSHOTS_STORAGE_KEY
} from '../../src/engine/mastery/store';
import { StoredAnswerEvent } from '../../src/engine/mastery/types';
import * as masteryModule from '../../src/engine/mastery';

describe('MasteryStore Persistence & Pruning', () => {
  let store: MasteryStore;
  let mockStorage: Storage;

  beforeEach(() => {
    const memory = new Map<string, string>();
    mockStorage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
      clear: () => memory.clear(),
      key: (i: number) => Array.from(memory.keys())[i] ?? null,
      get length() {
        return memory.size;
      }
    };
    store = createMasteryStore(mockStorage);
  });

  it('records events and deduplicates by eventId', () => {
    const now = Date.now();
    const event1: StoredAnswerEvent = {
      eventId: 'evt-unique-1',
      sessionId: 's-1',
      questionDefinitionId: 'q-1',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: now
    };

    store.recordEvents([event1, event1]); // duplicate
    const events = store.getEventsForSubSkill('addition.single_digit');
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt-unique-1');
  });

  it('prunes events older than 90 days on ingestion', () => {
    const now = Date.now();
    const oldTimestamp = now - 91 * 86400000;
    const freshTimestamp = now - 5 * 86400000;

    const oldEvent: StoredAnswerEvent = {
      eventId: 'evt-old',
      sessionId: 's-1',
      questionDefinitionId: 'q-old',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: oldTimestamp
    };

    const freshEvent: StoredAnswerEvent = {
      ...oldEvent,
      eventId: 'evt-fresh',
      timestamp: freshTimestamp
    };

    store.recordEvents([oldEvent, freshEvent], now);
    const events = store.getEventsForSubSkill('addition.single_digit');
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt-fresh');
  });

  it('enforces maximum 30 events capacity per sub-skill', () => {
    const now = Date.now();
    const batch: StoredAnswerEvent[] = Array.from({ length: 45 }, (_, i) => ({
      eventId: `evt-${i}`,
      sessionId: `s-${i % 4}`,
      questionDefinitionId: `q-${i}`,
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1000,
      isCorrect: true,
      timestamp: now + i * 1000
    }));

    store.recordEvents(batch, now + 50000);
    const events = store.getEventsForSubSkill('addition.single_digit');
    expect(events.length).toBe(30);
    // Should keep the 30 newest events (indexes 15 to 44)
    expect(events[0].eventId).toBe('evt-15');
    expect(events[29].eventId).toBe('evt-44');
  });

  it('isolates 30-event capacity per sub-skill across multiple sub-skills', () => {
    const now = Date.now();
    const additionBatch: StoredAnswerEvent[] = Array.from({ length: 35 }, (_, i) => ({
      eventId: `add-${i}`,
      sessionId: `s-${i % 3}`,
      questionDefinitionId: `q-add-${i}`,
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: now + i * 1000
    }));

    const multBatch: StoredAnswerEvent[] = Array.from({ length: 12 }, (_, i) => ({
      eventId: `mult-${i}`,
      sessionId: `s-${i % 2}`,
      questionDefinitionId: `q-mult-${i}`,
      primarySkillId: 'multiplication',
      subSkillId: 'multiplication.x7',
      skillTags: [],
      templateFamily: 'mult_table',
      difficulty: 2,
      targetResponseTimeMs: 3000,
      responseTimeMs: 1500,
      isCorrect: true,
      timestamp: now + i * 1000
    }));

    store.recordEvents([...additionBatch, ...multBatch], now + 40000);

    const addEvents = store.getEventsForSubSkill('addition.single_digit');
    const multEvents = store.getEventsForSubSkill('multiplication.x7');
    const allEvents = store.getAllEvents();

    expect(addEvents.length).toBe(30);
    expect(multEvents.length).toBe(12);
    expect(allEvents.length).toBe(42);
  });

  it('persists data and snapshots to storage for cross-instance reload', () => {
    const now = Date.now();
    const event: StoredAnswerEvent = {
      eventId: 'evt-p1',
      sessionId: 'sess-p',
      questionDefinitionId: 'q-p1',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1000,
      isCorrect: true,
      timestamp: now
    };

    store.recordEvents([event], now);

    // Verify storage has non-empty JSON strings
    expect(mockStorage.getItem(MASTERY_EVENTS_STORAGE_KEY)).toContain('evt-p1');
    expect(mockStorage.getItem(MASTERY_SNAPSHOTS_STORAGE_KEY)).toContain('addition.single_digit');

    // Create a new store instance with the same storage
    const store2 = createMasteryStore(mockStorage);
    const reloadedEvents = store2.getEventsForSubSkill('addition.single_digit');
    expect(reloadedEvents.length).toBe(1);
    expect(reloadedEvents[0].eventId).toBe('evt-p1');

    const record = store2.getMasteryRecord('addition.single_digit');
    expect(record.subSkillId).toBe('addition.single_digit');
  });

  it('computes and returns mastery records, identifying weak and strong skills', () => {
    const now = 1773360000000;

    // 20 high-accuracy, fast answers across 2 sessions for strong skill
    const strongBatch: StoredAnswerEvent[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        eventId: `strong-${i}`,
        sessionId: 'sess-s1',
        questionDefinitionId: `q-s-${i}`,
        primarySkillId: 'multiplication',
        subSkillId: 'multiplication.x7',
        skillTags: [],
        templateFamily: 'mult_table',
        difficulty: 2,
        targetResponseTimeMs: 3000,
        responseTimeMs: 1200,
        isCorrect: true,
        timestamp: now - 86400000 + i * 1000
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        eventId: `strong-${i + 10}`,
        sessionId: 'sess-s2',
        questionDefinitionId: `q-s-${i + 10}`,
        primarySkillId: 'multiplication',
        subSkillId: 'multiplication.x7',
        skillTags: [],
        templateFamily: 'mult_table',
        difficulty: 2,
        targetResponseTimeMs: 3000,
        responseTimeMs: 1200,
        isCorrect: true,
        timestamp: now + i * 1000
      }))
    ];

    // 12 low-accuracy, slow answers across 2 sessions for weak skill
    const weakBatch: StoredAnswerEvent[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        eventId: `weak-${i}`,
        sessionId: 'sess-w1',
        questionDefinitionId: `q-w-${i}`,
        primarySkillId: 'division',
        subSkillId: 'division.basic',
        skillTags: [],
        templateFamily: 'div_basic',
        difficulty: 2,
        targetResponseTimeMs: 3000,
        responseTimeMs: 6000,
        isCorrect: false,
        timestamp: now - 86400000 + i * 1000
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        eventId: `weak-${i + 6}`,
        sessionId: 'sess-w2',
        questionDefinitionId: `q-w-${i + 6}`,
        primarySkillId: 'division',
        subSkillId: 'division.basic',
        skillTags: [],
        templateFamily: 'div_basic',
        difficulty: 2,
        targetResponseTimeMs: 3000,
        responseTimeMs: 5000,
        isCorrect: i % 2 === 0,
        timestamp: now + i * 1000
      }))
    ];

    store.recordEvents([...strongBatch, ...weakBatch], now + 20000);

    const allRecords = store.getAllMasteryRecords(now + 20000);
    expect(allRecords['multiplication.x7']).toBeDefined();
    expect(allRecords['division.basic']).toBeDefined();

    const strongSkills = store.getStrongSkills(now + 20000);
    const weakSkills = store.getWeakSkills(now + 20000);

    expect(strongSkills.some((s) => s.subSkillId === 'multiplication.x7')).toBe(true);
    expect(strongSkills.some((s) => s.subSkillId === 'division.basic')).toBe(false);

    expect(weakSkills.some((s) => s.subSkillId === 'division.basic')).toBe(true);
    expect(weakSkills.some((s) => s.subSkillId === 'multiplication.x7')).toBe(false);
  });

  it('returns INSUFFICIENT_DATA record for sub-skill with no events', () => {
    const record = store.getMasteryRecord('non_existent.skill');
    expect(record.subSkillId).toBe('non_existent.skill');
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.totalAnswers).toBe(0);
    expect(record.masteryScore).toBe(0);
    expect(record.isStrongSkill).toBe(false);
    expect(record.isWeakSkill).toBe(false);
  });

  it('consistently scopes getAllMasteryRecords to active subSkillIds with or without timestamp', () => {
    const now = Date.now();
    const event: StoredAnswerEvent = {
      eventId: 'evt-active-1',
      sessionId: 'sess-act',
      questionDefinitionId: 'q-act-1',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: now
    };

    store.recordEvents([event], now);

    // Query non-existent skill
    const unrecorded = store.getMasteryRecord('non_existent.skill');
    expect(unrecorded.status).toBe('INSUFFICIENT_DATA');

    // Both with and without timestamp should only return stored sub-skills
    const recordsWithoutTimestamp = store.getAllMasteryRecords();
    const recordsWithTimestamp = store.getAllMasteryRecords(now + 1000);

    expect(Object.keys(recordsWithoutTimestamp)).toEqual(['addition.single_digit']);
    expect(Object.keys(recordsWithTimestamp)).toEqual(['addition.single_digit']);
    expect(recordsWithoutTimestamp['non_existent.skill']).toBeUndefined();
    expect(recordsWithTimestamp['non_existent.skill']).toBeUndefined();
  });

  it('clears all stored events and snapshots', () => {
    const now = Date.now();
    const event: StoredAnswerEvent = {
      eventId: 'evt-clear-1',
      sessionId: 'sess-c',
      questionDefinitionId: 'q-c1',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1000,
      isCorrect: true,
      timestamp: now
    };

    store.recordEvents([event], now);
    expect(store.getAllEvents().length).toBe(1);

    store.clear();
    expect(store.getAllEvents().length).toBe(0);
    expect(mockStorage.getItem(MASTERY_EVENTS_STORAGE_KEY)).toBeNull();
    expect(mockStorage.getItem(MASTERY_SNAPSHOTS_STORAGE_KEY)).toBeNull();
  });

  it('falls back to memory storage when no storage is passed', () => {
    const memoryStore = createMasteryStore();
    const now = Date.now();
    const event: StoredAnswerEvent = {
      eventId: 'evt-fallback-1',
      sessionId: 'sess-fb',
      questionDefinitionId: 'q-fb1',
      primarySkillId: 'subtraction',
      subSkillId: 'subtraction.single_digit',
      skillTags: [],
      templateFamily: 'sub_single',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: now
    };

    memoryStore.recordEvents([event], now);
    const events = memoryStore.getEventsForSubSkill('subtraction.single_digit');
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt-fallback-1');
  });

  it('handles corrupted JSON in storage gracefully', () => {
    mockStorage.setItem(MASTERY_EVENTS_STORAGE_KEY, '{ invalid json');
    mockStorage.setItem(MASTERY_SNAPSHOTS_STORAGE_KEY, '[ invalid json');

    expect(store.getAllEvents()).toEqual([]);
    expect(store.getAllMasteryRecords()).toEqual({});
  });

  it('exports all expected functions and types from the barrel index.ts', () => {
    expect(masteryModule.createMasteryStore).toBeDefined();
    expect(masteryModule.computeSubSkillMastery).toBeDefined();
    expect(masteryModule.MASTERY_EVENTS_STORAGE_KEY).toBe('hk_mastery_events_v2');
    expect(masteryModule.MASTERY_SNAPSHOTS_STORAGE_KEY).toBe('hk_mastery_snapshots_v2');
  });
});
