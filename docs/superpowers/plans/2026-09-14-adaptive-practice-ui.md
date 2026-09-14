# Learning Intelligence & Adaptive Practice UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the user interface for Learning Intelligence and Adaptive Practice (Sub-Project E.3), providing the Skill Mastery Heatmap in `StatsModal`, a 3-mode Smart Practice Hub, an accessible untimed play arena, session progress summary, cross-mode answer event ingestion into `MasteryStore`, and direct error remediation fast-launching.

**Architecture:** A modular frontend system anchored by `src/utils/masteryBridge.ts` for unified `StoredAnswerEvent` persistence across all gameplay modes; `SkillMasteryHeatmap` and `SubSkillDetailModal` embedded within `StatsModal`; and `PracticeScreen` refactored as a hub orchestrator delegating between `PracticeHubView`, `AdaptivePlayArena`, and `AdaptiveSummaryView`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, React Testing Library, canvas-confetti, existing mastery, taxonomy, remediation, and adaptive engines.

**Spec:** `docs/superpowers/specs/2026-09-14-adaptive-practice-ui-design.md`

## Global Constraints
- Target branch: `feature/12.9.13.34-adaptive-practice-ui` (Never commit or branch directly on `main` or `master`).
- Local commits only; no remote pushes without explicit user authorization.
- Commit message trailer on every commit: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Touch target size: $\ge 48\times 48\text{px}$ for all buttons, chips, keypad buttons, and interactive controls.
- Keyboard navigation: physical keyboard handlers must invoke `e.preventDefault()` on handled keys to prevent browser scrolling and duplicate inputs.
- Screen reader accessibility: `aria-live="polite"` on prompt cards; semantic progressbars with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Non-empty answer ingestion: only answers with defined, non-empty `subSkillId` are ingested into `MasteryStore`.
- Strict quality gates: 0 TypeScript errors (`tsc --noEmit`), 100% test pass rate, and clean Vite build.

---

### Task 1: Mastery Event Bridge Utility (`src/utils/masteryBridge.ts`)

**Files:**
- Create: `src/utils/masteryBridge.ts`
- Test: `tests/unit/masteryBridge.test.ts`

**Interfaces:**
- Consumes:
  - `createMasteryStore`, `MasteryStore`, `StoredAnswerEvent` from `src/engine/mastery`
- Produces:
  - `GameAnswerLog` interface
  - `getMasteryStore(): MasteryStore` singleton accessor
  - `ingestGameAnswers(sessionId: string, userId: string, answers: GameAnswerLog[], customStore?: MasteryStore): void`
  - `getTargetResponseTimeMs(difficulty: number): number`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/masteryBridge.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ingestGameAnswers,
  getTargetResponseTimeMs,
  getMasteryStore,
  GameAnswerLog,
} from '../../src/utils/masteryBridge';
import { createMasteryStore } from '../../src/engine/mastery';

describe('Mastery Bridge Utility', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('maps difficulty to correct target response times according to PRD §8.3.3', () => {
    expect(getTargetResponseTimeMs(1)).toBe(2500);
    expect(getTargetResponseTimeMs(2)).toBe(3000);
    expect(getTargetResponseTimeMs(3)).toBe(3500);
    expect(getTargetResponseTimeMs(4)).toBe(4000);
    expect(getTargetResponseTimeMs(5)).toBe(5000);
    expect(getTargetResponseTimeMs(6)).toBe(6000);
    expect(getTargetResponseTimeMs(99)).toBe(3500); // default fallback
  });

  it('ingests valid answers with subSkillId and ignores answers without subSkillId', () => {
    const store = createMasteryStore();
    const answers: GameAnswerLog[] = [
      {
        questionId: 'q1',
        subSkillId: 'multiplication.x7',
        primarySkillId: 'multiplication',
        skillTags: ['multiplication', 'multiplication.x7'],
        isCorrect: true,
        responseTimeMs: 2400,
        difficulty: 3,
      },
      {
        questionId: 'q2',
        // subSkillId missing
        isCorrect: false,
        responseTimeMs: 3800,
        difficulty: 2,
      },
      {
        questionId: 'q3',
        subSkillId: 'addition.carry',
        isCorrect: false,
        responseTimeMs: 4100,
        difficulty: 3,
      },
    ];

    ingestGameAnswers('sess_123', 'user_abc', answers, store);

    const allEvents = store.getAllEvents();
    expect(allEvents.length).toBe(2);

    const multEvents = store.getEventsForSubSkill('multiplication.x7');
    expect(multEvents.length).toBe(1);
    expect(multEvents[0].isCorrect).toBe(true);
    expect(multEvents[0].responseTimeMs).toBe(2400);
    expect(multEvents[0].targetResponseTimeMs).toBe(3500);
    expect(multEvents[0].primarySkillId).toBe('multiplication');

    const addEvents = store.getEventsForSubSkill('addition.carry');
    expect(addEvents.length).toBe(1);
    expect(addEvents[0].isCorrect).toBe(false);
  });

  it('defaults primarySkillId to subSkill namespace if omitted', () => {
    const store = createMasteryStore();
    const answers: GameAnswerLog[] = [
      {
        questionId: 'q1',
        subSkillId: 'division.basic_235',
        isCorrect: true,
        responseTimeMs: 1800,
        difficulty: 1,
      },
    ];

    ingestGameAnswers('sess_1', 'user_1', answers, store);
    const events = store.getEventsForSubSkill('division.basic_235');
    expect(events.length).toBe(1);
    expect(events[0].primarySkillId).toBe('division');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/masteryBridge.test.ts`  
Expected: FAIL with module not found or exports missing.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/masteryBridge.ts
import { createMasteryStore, MasteryStore, StoredAnswerEvent } from '../engine/mastery';

let defaultStoreInstance: MasteryStore | null = null;

export function getMasteryStore(): MasteryStore {
  if (!defaultStoreInstance) {
    defaultStoreInstance = createMasteryStore();
  }
  return defaultStoreInstance;
}

export interface GameAnswerLog {
  questionId: string;
  subSkillId?: string;
  primarySkillId?: string;
  skillTags?: string[];
  templateFamily?: string;
  isCorrect: boolean;
  responseTimeMs: number;
  difficulty: number;
}

const TARGET_RESPONSE_TIMES: Record<number, number> = {
  1: 2500,
  2: 3000,
  3: 3500,
  4: 4000,
  5: 5000,
  6: 6000,
};

export function getTargetResponseTimeMs(difficulty: number): number {
  return TARGET_RESPONSE_TIMES[difficulty] ?? 3500;
}

export function ingestGameAnswers(
  sessionId: string,
  userId: string,
  answers: GameAnswerLog[],
  customStore?: MasteryStore
): void {
  const store = customStore ?? getMasteryStore();
  const validAnswers = answers.filter((a) => typeof a.subSkillId === 'string' && a.subSkillId.trim().length > 0);

  if (validAnswers.length === 0) {
    return;
  }

  const now = Date.now();
  const events: StoredAnswerEvent[] = validAnswers.map((a, idx) => {
    const subSkillId = a.subSkillId!.trim();
    const primarySkillId = a.primarySkillId || subSkillId.split('.')[0] || 'arithmetic';
    const templateFamily = a.templateFamily || `${primarySkillId}_family`;
    const difficulty = Math.max(1, Math.min(6, a.difficulty || 1));
    const targetResponseTimeMs = getTargetResponseTimeMs(difficulty);
    const salt = Math.random().toString(36).substring(2, 8);

    return {
      eventId: `evt_${now}_${idx}_${salt}`,
      sessionId,
      questionDefinitionId: a.questionId,
      primarySkillId,
      subSkillId,
      skillTags: a.skillTags || [primarySkillId, subSkillId],
      templateFamily,
      difficulty,
      targetResponseTimeMs,
      responseTimeMs: Math.max(10, Math.round(a.responseTimeMs)),
      isCorrect: Boolean(a.isCorrect),
      timestamp: now,
    };
  });

  store.recordEvents(events, now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/masteryBridge.test.ts`  
Expected: PASS (3/3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/masteryBridge.ts tests/unit/masteryBridge.test.ts
git commit -m "feat(mastery): implement masteryBridge utility for answer event ingestion

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: SubSkillDetailModal Component (`src/components/mastery/SubSkillDetailModal.tsx`)

**Files:**
- Create: `src/components/mastery/SubSkillDetailModal.tsx`
- Test: `tests/unit/subSkillDetailModal.test.tsx`

**Interfaces:**
- Consumes:
  - `SubSkillDefinition` from `src/engine/taxonomy`
  - `MasteryRecord` from `src/engine/mastery`
- Produces:
  - `SubSkillDetailModal` React Component
  - Props: `{ isOpen: boolean; subSkill: SubSkillDefinition | null; masteryRecord?: MasteryRecord; onClose: () => void; onStartPractice?: (subSkillId: string) => void; }`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/subSkillDetailModal.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubSkillDetailModal } from '../../src/components/mastery/SubSkillDetailModal';
import { SubSkillDefinition } from '../../src/engine/taxonomy';
import { MasteryRecord } from '../../src/engine/mastery';

describe('SubSkillDetailModal Component', () => {
  const mockSubSkill: SubSkillDefinition = {
    id: 'multiplication.x7',
    skillId: 'multiplication',
    name: 'Perkalian ×7',
    description: 'Tabel perkalian angka 7 hingga 7 × 10',
    difficultyBase: 3,
  };

  const mockRecord: MasteryRecord = {
    subSkillId: 'multiplication.x7',
    status: 'NEEDS_PRACTICE',
    statusLabel: 'Perlu Latihan',
    masteryScore: 48,
    accuracyComponent: 50,
    speedComponent: 45,
    consistencyComponent: 50,
    recentAccuracy: 50,
    totalAnswers: 12,
    distinctSessions: 3,
    isStrongSkill: false,
    isWeakSkill: true,
    lastEvaluatedAt: Date.now(),
    algorithmVersion: '2.0.0',
  };

  it('renders sub-skill name, description, mastery status, and metrics', () => {
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={vi.fn()}
        onStartPractice={vi.fn()}
      />
    );

    expect(screen.getByText('Perkalian ×7')).toBeDefined();
    expect(screen.getByText(/Tabel perkalian angka 7/i)).toBeDefined();
    expect(screen.getByText(/Perlu Latihan/i)).toBeDefined();
    expect(screen.getByText(/Skor: 48\/100/i)).toBeDefined();
    expect(screen.getByText(/12 Soal/i)).toBeDefined();
  });

  it('triggers onStartPractice callback with subSkillId when CTA button clicked', () => {
    const handleStartPractice = vi.fn();
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={vi.fn()}
        onStartPractice={handleStartPractice}
      />
    );

    const ctaBtn = screen.getByRole('button', { name: /latih sub-skill ini/i });
    expect(ctaBtn.className).toContain('min-h-[48px]');
    fireEvent.click(ctaBtn);
    expect(handleStartPractice).toHaveBeenCalledWith('multiplication.x7');
  });

  it('handles onClose when close button clicked', () => {
    const handleClose = vi.fn();
    render(
      <SubSkillDetailModal
        isOpen={true}
        subSkill={mockSubSkill}
        masteryRecord={mockRecord}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /tutup/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/subSkillDetailModal.test.tsx`  
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/mastery/SubSkillDetailModal.tsx
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subskill-title"
        className="w-full max-w-md rounded-3xl border-2 border-indigo-700/80 bg-indigo-950 p-5 sm:p-6 shadow-2xl text-white relative"
      >
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          aria-label="Tutup"
          className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-indigo-300 hover:text-white transition"
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/subSkillDetailModal.test.tsx`  
Expected: PASS (3/3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/mastery/SubSkillDetailModal.tsx tests/unit/subSkillDetailModal.test.tsx
git commit -m "feat(mastery): create SubSkillDetailModal component

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: SkillMasteryHeatmap Component (`src/components/mastery/SkillMasteryHeatmap.tsx`)

**Files:**
- Create: `src/components/mastery/SkillMasteryHeatmap.tsx`
- Test: `tests/unit/skillMasteryHeatmap.test.tsx`

**Interfaces:**
- Consumes:
  - `SKILL_TAXONOMY`, `SubSkillDefinition` from `src/engine/taxonomy`
  - `MasteryRecord` from `src/engine/mastery`
  - `getMasteryStore` from `src/utils/masteryBridge`
  - `SubSkillDetailModal` from `src/components/mastery/SubSkillDetailModal`
- Produces:
  - `SkillMasteryHeatmap` React Component
  - Props: `{ onStartPractice?: (subSkillId?: string) => void; }`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/skillMasteryHeatmap.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkillMasteryHeatmap } from '../../src/components/mastery/SkillMasteryHeatmap';
import { getMasteryStore } from '../../src/utils/masteryBridge';

describe('SkillMasteryHeatmap Component', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('renders overall mastery meter and 14 arithmetic categories', () => {
    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
    expect(screen.getByText(/Cakupan Penguasaan Global/i)).toBeDefined();

    // Verify presence of category headers
    expect(screen.getByText('Penjumlahan')).toBeDefined();
    expect(screen.getByText('Pengurangan')).toBeDefined();
    expect(screen.getByText('Perkalian')).toBeDefined();
    expect(screen.getByText('Pembagian')).toBeDefined();
  });

  it('filters sub-skills using filter chips and opens sub-skill detail on click', () => {
    render(<SkillMasteryHeatmap onStartPractice={vi.fn()} />);

    // Click filter chip
    const needsPracticeFilter = screen.getByRole('button', { name: /perlu latihan/i });
    expect(needsPracticeFilter.className).toContain('min-h-[48px]');
    fireEvent.click(needsPracticeFilter);

    // Reset to "Semua"
    const allFilter = screen.getByRole('button', { name: /semua/i });
    fireEvent.click(allFilter);

    // Sub-skill chip click opens detail modal
    const subSkillChip = screen.getByText('Penjumlahan Satu Digit');
    fireEvent.click(subSkillChip);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Penjumlahan dasar angka 1–9/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/skillMasteryHeatmap.test.tsx`  
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/mastery/SkillMasteryHeatmap.tsx
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

interface SkillMasteryHeatmapProps {
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
              Cakupan: <strong className="text-amber-300 font-mono text-sm">{globalCoverage}%</strong>
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/skillMasteryHeatmap.test.tsx`  
Expected: PASS (2/2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/mastery/SkillMasteryHeatmap.tsx tests/unit/skillMasteryHeatmap.test.tsx
git commit -m "feat(mastery): implement SkillMasteryHeatmap accordion and filter view

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Integrate Heatmap into StatsModal (`src/components/StatsModal.tsx`)

**Files:**
- Modify: `src/components/StatsModal.tsx`
- Test: `tests/unit/statsModalMasteryTab.test.tsx`

**Interfaces:**
- Consumes:
  - `SkillMasteryHeatmap` from `src/components/mastery/SkillMasteryHeatmap`
- Produces:
  - Extended `StatsModalProps` with `defaultTab?: 'personal' | 'timeAttack' | 'achievements' | 'mastery'` and `onStartPractice?: (subSkillId?: string) => void`
  - 4th tab button: "Peta Keahlian" (`id="tab-mastery"`)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/statsModalMasteryTab.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsModal } from '../../src/components/StatsModal';
import { UserStats } from '../../src/types';

describe('StatsModal Mastery Tab Integration', () => {
  const dummyStats: UserStats = {
    totalSolved: 100,
    totalCorrect: 90,
    totalTimePlayedSec: 600,
    bestStreak: 15,
    highestTimeAttackScore: 1200,
    highestSPM: 35,
    starsTotal: 45,
  };

  it('renders 4th tab for Peta Keahlian and displays SkillMasteryHeatmap when clicked', () => {
    render(
      <StatsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={dummyStats}
        totalStars={45}
        unlockedLevelsCount={18}
        onResetProgress={vi.fn()}
        defaultTab="personal"
      />
    );

    const masteryTabBtn = screen.getByRole('button', { name: /peta keahlian/i });
    expect(masteryTabBtn).toBeDefined();

    fireEvent.click(masteryTabBtn);
    expect(screen.getByText(/Peta Penguasaan Keahlian/i)).toBeDefined();
    expect(screen.getByText(/Cakupan Penguasaan Global/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/statsModalMasteryTab.test.tsx`  
Expected: FAIL (tab not found or not rendered).

- [ ] **Step 3: Modify StatsModal.tsx**

In `src/components/StatsModal.tsx`:
- Extend `defaultTab?: 'personal' | 'timeAttack' | 'achievements' | 'mastery'`.
- Add `onStartPractice?: (subSkillId?: string) => void` to `StatsModalProps`.
- Add tab button `<button id="tab-mastery" onClick={() => setActiveTab('mastery')} ...><Sparkles /> Peta Keahlian</button>`.
- When `activeTab === 'mastery'`, render `<SkillMasteryHeatmap onStartPractice={onStartPractice} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/statsModalMasteryTab.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatsModal.tsx tests/unit/statsModalMasteryTab.test.tsx
git commit -m "feat(stats): integrate SkillMasteryHeatmap as 4th tab in StatsModal

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: PracticeHubView Component (`src/components/practice/PracticeHubView.tsx`)

**Files:**
- Create: `src/components/practice/PracticeHubView.tsx`
- Test: `tests/unit/practiceHubView.test.tsx`

**Interfaces:**
- Consumes:
  - `generateAdaptiveRecommendation`, `buildAdaptiveSession` from `src/engine/adaptive`
  - `getMasteryStore` from `src/utils/masteryBridge`
  - `createGeneratorRegistry` from `src/engine/registry`
- Produces:
  - `PracticeHubView` React component
  - Props:
    ```typescript
    interface PracticeHubViewProps {
      initialTab?: 'adaptive' | 'remediation' | 'custom';
      onStartAdaptive: (plan: AdaptiveSessionPlan) => void;
      onStartRemediation: (plan: RemediationSessionPlan) => void;
      onStartCustom: (config: CustomPracticeConfig) => void;
      onOpenStats?: () => void;
      onExit: () => void;
    }
    ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/practiceHubView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeHubView } from '../../src/components/practice/PracticeHubView';
import { getMasteryStore } from '../../src/utils/masteryBridge';

describe('PracticeHubView Component', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('renders 3 practice mode tabs and default AI adaptive recommendation banner', () => {
    render(
      <PracticeHubView
        onStartAdaptive={vi.fn()}
        onStartRemediation={vi.fn()}
        onStartCustom={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Latihan Adaptif AI/i)).toBeDefined();
    expect(screen.getByText(/Latih Kesalahan/i)).toBeDefined();
    expect(screen.getByText(/Kustom/i)).toBeDefined();

    // Recommendation card
    expect(screen.getByText(/Rekomendasi AI Untukmu/i)).toBeDefined();
    const startBtn = screen.getByRole('button', { name: /mulai latihan adaptif/i });
    expect(startBtn.className).toContain('min-h-[48px]');
  });

  it('switches to Latih Kesalahan tab and shows zero mistakes trophy if no mistakes recorded', () => {
    render(
      <PracticeHubView
        onStartAdaptive={vi.fn()}
        onStartRemediation={vi.fn()}
        onStartCustom={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const remTabBtn = screen.getByRole('button', { name: /latih kesalahan/i });
    fireEvent.click(remTabBtn);

    expect(screen.getByText(/Tidak Ada Catatan Kesalahan/i)).toBeDefined();
  });

  it('switches to Kustom tab and allows customizing operation and range', () => {
    render(
      <PracticeHubView
        onStartAdaptive={vi.fn()}
        onStartRemediation={vi.fn()}
        onStartCustom={vi.fn()}
        onExit={vi.fn()}
      />
    );

    const customTabBtn = screen.getByRole('button', { name: /kustom/i });
    fireEvent.click(customTabBtn);

    expect(screen.getByText(/Pilih Operasi/i)).toBeDefined();
    expect(screen.getByText(/Rentang Angka/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/practiceHubView.test.tsx`  
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/practice/PracticeHubView.tsx
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Target,
  Sliders,
  Play,
  Trophy,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  buildAdaptiveSession,
  generateAdaptiveRecommendation,
  AdaptiveSessionPlan,
} from '../../engine/adaptive';
import {
  buildRemediationSession,
  RemediationSessionPlan,
  FailedQuestionEvidence,
} from '../../engine/remediation';
import { createGeneratorRegistry } from '../../engine/registry';
import { getMasteryStore } from '../../utils/masteryBridge';
import { soundManager } from '../../utils/sound';

export interface CustomPracticeConfig {
  operation: '+' | '-' | '*' | '/' | 'mix';
  numberRange: number;
  questionCount: number;
}

export interface PracticeHubViewProps {
  initialTab?: 'adaptive' | 'remediation' | 'custom';
  onStartAdaptive: (plan: AdaptiveSessionPlan) => void;
  onStartRemediation: (plan: RemediationSessionPlan) => void;
  onStartCustom: (config: CustomPracticeConfig) => void;
  onOpenStats?: () => void;
  onExit: () => void;
}

export const PracticeHubView: React.FC<PracticeHubViewProps> = ({
  initialTab = 'adaptive',
  onStartAdaptive,
  onStartRemediation,
  onStartCustom,
  onOpenStats,
  onExit,
}) => {
  const [activeTab, setActiveTab] = useState<'adaptive' | 'remediation' | 'custom'>(initialTab);

  // Custom Practice State
  const [selectedOp, setSelectedOp] = useState<'+' | '-' | '*' | '/' | 'mix'>('+');
  const [numberRange, setNumberRange] = useState<number>(20);
  const [questionCount, setQuestionCount] = useState<number>(10);

  const store = useMemo(() => getMasteryStore(), []);
  const masteryRecords = useMemo(() => store.getAllMasteryRecords(), [store]);
  const allEvents = useMemo(() => store.getAllEvents(), [store]);

  const recentErrors = useMemo(() => {
    return allEvents
      .filter((e) => !e.isCorrect)
      .slice(-15)
      .map((e): FailedQuestionEvidence => ({
        primarySkillId: e.primarySkillId,
        templateFamily: e.templateFamily,
        difficulty: e.difficulty,
        skillTags: e.skillTags,
        targetResponseTimeMs: e.targetResponseTimeMs,
        responseTimeMs: e.responseTimeMs,
      }));
  }, [allEvents]);

  const evaluatedRecords = useMemo(() => {
    return Object.values(masteryRecords).filter((r) => r.status !== 'INSUFFICIENT_DATA');
  }, [masteryRecords]);

  const isColdStart = evaluatedRecords.length < 2;

  const recommendation = useMemo(() => {
    return generateAdaptiveRecommendation(masteryRecords, recentErrors.length, isColdStart);
  }, [masteryRecords, recentErrors.length, isColdStart]);

  const handleLaunchAdaptive = () => {
    soundManager.playClick();
    const registry = createGeneratorRegistry();
    const plan = buildAdaptiveSession({
      masteryRecords,
      recentErrors,
      sessionSize: 10,
      registry,
    });
    onStartAdaptive(plan);
  };

  const handleLaunchRemediation = () => {
    if (recentErrors.length === 0) return;
    soundManager.playClick();
    const registry = createGeneratorRegistry();
    const plan = buildRemediationSession({
      failedQuestions: recentErrors,
      registry,
    });
    onStartRemediation(plan);
  };

  const handleLaunchCustom = () => {
    soundManager.playClick();
    onStartCustom({
      operation: selectedOp,
      numberRange,
      questionCount,
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-6 px-3 sm:px-4 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          aria-label="Kembali"
          className="min-h-[48px] px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white flex items-center gap-2 text-xs font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
          Arena Latihan Cerdas
        </h1>

        {onOpenStats && (
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onOpenStats();
            }}
            aria-label="Lihat Peta Keahlian"
            className="min-h-[48px] px-3 py-2 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Peta Keahlian</span>
          </button>
        )}
      </div>

      {/* Segmented Mode Selector */}
      <div className="flex rounded-2xl bg-indigo-900/60 p-1.5 border border-indigo-800/80 gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setActiveTab('adaptive');
          }}
          className={`flex-1 min-h-[48px] rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${
            activeTab === 'adaptive'
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 shadow-md'
              : 'text-indigo-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Latihan Adaptif AI</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setActiveTab('remediation');
          }}
          className={`flex-1 min-h-[48px] rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${
            activeTab === 'remediation'
              ? 'bg-rose-500 text-white shadow-md'
              : 'text-indigo-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Latih Kesalahan</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setActiveTab('custom');
          }}
          className={`flex-1 min-h-[48px] rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 ${
            activeTab === 'custom'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-indigo-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Kustom</span>
        </button>
      </div>

      {/* Tab 1: AI Adaptive Practice */}
      {activeTab === 'adaptive' && (
        <div className="space-y-4">
          <div className="rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-indigo-950 to-indigo-900/60 p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Rekomendasi AI Untukmu</span>
            </div>

            <h2 className="text-xl font-black text-white mb-2">
              {isColdStart ? 'Sesi Diagnostik Pemetaan' : `Fokus: ${recommendation.primarySubSkillId}`}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed mb-4">
              {recommendation.reason}
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full text-xs font-bold">
                10 Soal Terarah
              </span>
              <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold">
                50% Soal Penguatan
              </span>
              <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold">
                Santai Tanpa Batas Waktu
              </span>
            </div>

            <button
              type="button"
              onClick={handleLaunchAdaptive}
              aria-label="Mulai Latihan Adaptif"
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 active:translate-y-0.5 text-amber-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl border-b-4 border-amber-700 transition uppercase tracking-wider"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Mulai Latihan Adaptif (10 Soal)</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Mistake Remediation */}
      {activeTab === 'remediation' && (
        <div className="space-y-4">
          {recentErrors.length > 0 ? (
            <div className="rounded-3xl border-2 border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-indigo-950 to-indigo-900/60 p-5 sm:p-6 shadow-xl">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-wider mb-2">
                <Target className="w-4 h-4" />
                <span>Perbaikan Kesalahan Aktif</span>
              </div>
              <h2 className="text-xl font-black text-white mb-2">
                Latih {recentErrors.length} Kesalahan Terbaru
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed mb-6">
                Sistem telah merancang soal khusus yang menyerupai pola kesalahan Anda sebelumnya agar tidak terulang lagi.
              </p>

              <button
                type="button"
                onClick={handleLaunchRemediation}
                aria-label="Mulai Latihan Remediasi"
                className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 active:translate-y-0.5 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl border-b-4 border-rose-800 transition uppercase tracking-wider"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Mulai Latihan Remediasi</span>
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/60 p-8 text-center shadow-xl">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-white mb-1">
                Tidak Ada Catatan Kesalahan!
              </h3>
              <p className="text-xs text-indigo-300 max-w-sm mx-auto mb-5">
                Hebat! Semua riwayat perhitunganmu bersih atau sudah tuntas dilatih.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('adaptive')}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white text-xs font-bold transition"
              >
                Coba Latihan Adaptif AI
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Custom Practice */}
      {activeTab === 'custom' && (
        <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/60 p-5 sm:p-6 shadow-xl space-y-5">
          <div>
            <label className="text-xs font-black text-indigo-300 uppercase tracking-wider block mb-2">
              Pilih Operasi
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { op: '+', label: '+' },
                { op: '-', label: '−' },
                { op: '*', label: '×' },
                { op: '/', label: '÷' },
                { op: 'mix', label: 'Campur' },
              ].map(({ op, label }) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setSelectedOp(op as any)}
                  className={`min-h-[48px] rounded-xl font-black text-sm transition border ${
                    selectedOp === op
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                      : 'bg-indigo-900/40 text-indigo-300 border-indigo-800 hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-indigo-300 uppercase tracking-wider block mb-2">
              Rentang Angka: <span className="text-amber-300 font-mono text-sm">Hingga {numberRange}</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 50, 100].map((rng) => (
                <button
                  key={rng}
                  type="button"
                  onClick={() => setNumberRange(rng)}
                  className={`min-h-[48px] rounded-xl font-black text-xs transition border ${
                    numberRange === rng
                      ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-md'
                      : 'bg-indigo-900/40 text-indigo-300 border-indigo-800 hover:bg-white/5'
                  }`}
                >
                  {rng}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchCustom}
            aria-label="Mulai Latihan Kustom"
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110 active:translate-y-0.5 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl border-b-4 border-indigo-800 transition uppercase tracking-wider"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Mulai Latihan Kustom</span>
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/practiceHubView.test.tsx`  
Expected: PASS (3/3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/practice/PracticeHubView.tsx tests/unit/practiceHubView.test.tsx
git commit -m "feat(practice): implement PracticeHubView with 3-tab segmented selector

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: AdaptivePlayArena Component (`src/components/practice/AdaptivePlayArena.tsx`)

**Files:**
- Create: `src/components/practice/AdaptivePlayArena.tsx`
- Test: `tests/unit/adaptivePlayArena.test.tsx`

**Interfaces:**
- Consumes:
  - `Question` from `src/engine/types/question`
  - `soundManager` from `src/utils/sound`
- Produces:
  - `AdaptivePlayArena` React component
  - Props:
    ```typescript
    interface AdaptivePlayArenaProps {
      questions: Question[];
      onFinish: (answers: Question[], durationMs: number) => void;
      onExit: () => void;
    }
    ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/adaptivePlayArena.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdaptivePlayArena } from '../../src/components/practice/AdaptivePlayArena';
import { Question } from '../../src/engine/types/question';

describe('AdaptivePlayArena Component', () => {
  const mockQuestions: Question[] = [
    {
      id: 'q1',
      displayPrompt: '7 × 8',
      prompt: '7 × 8',
      answerSpec: { kind: 'integer', value: 56 },
      difficulty: 3,
      primarySkillId: 'multiplication.x7',
    },
    {
      id: 'q2',
      displayPrompt: '14 + 19',
      prompt: '14 + 19',
      answerSpec: { kind: 'integer', value: 33 },
      difficulty: 2,
      primarySkillId: 'addition.carry',
    },
  ];

  it('renders question prompt, progress indicator, and virtual keypad targets >= 48px', () => {
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText('7 × 8')).toBeDefined();
    expect(screen.getByText(/Soal 1 dari 2/i)).toBeDefined();

    // Keypad digits
    const key5 = screen.getByRole('button', { name: '5' });
    expect(key5.className).toContain('min-h-[48px]');
  });

  it('submits answer via virtual keypad and advances to next question', () => {
    const handleFinish = vi.fn();
    render(
      <AdaptivePlayArena
        questions={mockQuestions}
        onFinish={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Enter 56 for question 1
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    // Verify advanced to question 2
    expect(screen.getByText('14 + 19')).toBeDefined();
    expect(screen.getByText(/Soal 2 dari 2/i)).toBeDefined();

    // Enter 33 for question 2 and submit
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: /kirim|submit|↵/i }));

    expect(handleFinish).toHaveBeenCalledTimes(1);
    const [finalAnswers] = handleFinish.mock.calls[0];
    expect(finalAnswers.length).toBe(2);
    expect(finalAnswers[0].isCorrect).toBe(true);
    expect(finalAnswers[1].isCorrect).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adaptivePlayArena.test.tsx`  
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/practice/AdaptivePlayArena.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Clock, Delete, CornerDownLeft } from 'lucide-react';
import { Question } from '../../engine/types/question';
import { soundManager } from '../../utils/sound';

export interface AdaptivePlayArenaProps {
  questions: Question[];
  onFinish: (answers: Question[], durationMs: number) => void;
  onExit: () => void;
}

export const AdaptivePlayArena: React.FC<AdaptivePlayArenaProps> = ({
  questions,
  onFinish,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [inputVal, setInputVal] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const startTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());
  const historyRef = useRef<Question[]>([]);

  // Untimed elapsed stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQ = questions[currentIndex] || questions[0];

  const formatStopwatch = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = useCallback((char: string) => {
    soundManager.playClick();
    setInputVal((prev) => {
      if (char === '-' && prev.length === 0) return '-';
      if (char === '/' && !prev.includes('/') && prev.length > 0) return prev + '/';
      if (/^[0-9]$/.test(char)) return prev + char;
      return prev;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    soundManager.playClick();
    setInputVal((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!inputVal.trim() || inputVal === '-') return;

    const now = Date.now();
    const responseTimeMs = now - questionStartTimeRef.current;

    // Check correctness
    let isCorrect = false;
    const spec = currentQ.answerSpec;
    if (spec?.kind === 'integer') {
      isCorrect = parseInt(inputVal, 10) === spec.value;
    } else if (spec?.kind === 'fraction') {
      const parts = inputVal.split('/');
      if (parts.length === 2) {
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        isCorrect = num === spec.numerator && den === spec.denominator;
      }
    } else {
      // Fallback
      isCorrect = inputVal.trim() === String(currentQ.answerSpec?.value ?? '');
    }

    if (isCorrect) {
      soundManager.playCorrect(0);
    } else {
      soundManager.playWrong();
    }

    const recordedQ: Question = {
      ...currentQ,
      isCorrect,
      timeSpentMs: responseTimeMs,
    };
    historyRef.current.push(recordedQ);

    setInputVal('');
    const nextIdx = currentIndex + 1;
    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx);
      questionStartTimeRef.current = Date.now();
    } else {
      const totalDurationMs = Date.now() - startTimeRef.current;
      onFinish(historyRef.current, totalDurationMs);
    }
  }, [inputVal, currentQ, currentIndex, questions.length, onFinish]);

  // Physical keyboard support with e.preventDefault()
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '-' || e.key === '/') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleBackspace, handleSubmit]);

  return (
    <div className="max-w-md mx-auto py-4 px-3 sm:px-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          aria-label="Kembali"
          className="min-h-[48px] px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white flex items-center gap-1.5 text-xs font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Keluar</span>
        </button>

        <div className="flex items-center gap-1.5 bg-indigo-900/60 px-3.5 py-2 rounded-2xl border border-indigo-800 text-xs font-mono font-bold text-amber-300">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>{formatStopwatch(elapsedSec)}</span>
        </div>

        <div className="text-xs font-bold text-indigo-200 bg-white/10 px-3 py-2 rounded-2xl">
          Soal {currentIndex + 1} dari {questions.length}
        </div>
      </div>

      {/* Central Math Prompt Card */}
      <div
        aria-live="polite"
        className="rounded-3xl border-2 border-indigo-700 bg-gradient-to-b from-indigo-900/90 to-indigo-950 p-6 sm:p-8 text-center shadow-2xl relative"
      >
        <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-300 block mb-2">
          {currentQ.primarySkillId || 'Latihan'}
        </span>
        <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-wider mb-6">
          {currentQ.displayPrompt || currentQ.prompt}
        </div>

        {/* User Input Display */}
        <div className="h-14 w-full rounded-2xl border-2 border-amber-400/60 bg-indigo-950/80 flex items-center justify-center text-3xl font-mono font-bold text-amber-300 shadow-inner">
          {inputVal || <span className="text-indigo-400/40 text-lg">Ketik jawaban...</span>}
        </div>
      </div>

      {/* Responsive Virtual Keypad */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '/'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyPress(key)}
            aria-label={key}
            className="min-h-[48px] h-12 sm:h-14 rounded-2xl border-2 border-indigo-700/80 border-b-4 border-b-indigo-950 bg-indigo-800/90 hover:bg-indigo-700 text-xl font-bold font-mono text-white active:translate-y-0.5 shadow-md transition"
          >
            {key}
          </button>
        ))}

        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Hapus"
          className="min-h-[48px] h-12 sm:h-14 rounded-2xl border-2 border-rose-700/80 border-b-4 border-b-rose-950 bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 flex items-center justify-center active:translate-y-0.5 shadow-md transition"
        >
          <Delete className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          aria-label="Kirim Jawaban"
          className="col-span-2 min-h-[48px] h-12 sm:h-14 rounded-2xl border-2 border-amber-500 border-b-4 border-b-amber-700 bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 active:translate-y-0.5 text-amber-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl transition uppercase tracking-wider"
        >
          <span>Kirim</span>
          <CornerDownLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adaptivePlayArena.test.tsx`  
Expected: PASS (2/2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/practice/AdaptivePlayArena.tsx tests/unit/adaptivePlayArena.test.tsx
git commit -m "feat(practice): implement AdaptivePlayArena component with virtual keypad

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: AdaptiveSummaryView Component (`src/components/practice/AdaptiveSummaryView.tsx`)

**Files:**
- Create: `src/components/practice/AdaptiveSummaryView.tsx`
- Test: `tests/unit/adaptiveSummaryView.test.tsx`

**Interfaces:**
- Consumes:
  - `Question` from `src/engine/types/question`
  - `MasteryRecord` from `src/engine/mastery`
  - `getMasteryStore` from `src/utils/masteryBridge`
- Produces:
  - `AdaptiveSummaryView` React component
  - Props:
    ```typescript
    interface AdaptiveSummaryViewProps {
      answers: Question[];
      durationMs: number;
      onPlayAgain: () => void;
      onOpenMasteryMap: () => void;
      onExit: () => void;
    }
    ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/adaptiveSummaryView.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdaptiveSummaryView } from '../../src/components/practice/AdaptiveSummaryView';
import { Question } from '../../src/engine/types/question';

describe('AdaptiveSummaryView Component', () => {
  const mockAnswers: Question[] = [
    {
      id: 'q1',
      displayPrompt: '7 × 8',
      prompt: '7 × 8',
      isCorrect: true,
      timeSpentMs: 2200,
      primarySkillId: 'multiplication.x7',
    },
    {
      id: 'q2',
      displayPrompt: '9 × 6',
      prompt: '9 × 6',
      isCorrect: true,
      timeSpentMs: 2500,
      primarySkillId: 'multiplication.x7',
    },
  ];

  it('renders accuracy, total questions, correct count, and milestone progression card', () => {
    render(
      <AdaptiveSummaryView
        answers={mockAnswers}
        durationMs={4700}
        onPlayAgain={vi.fn()}
        onOpenMasteryMap={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/Sesi Selesai/i)).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText(/2 dari 2 Soal Benar/i)).toBeDefined();
  });

  it('invokes onPlayAgain, onOpenMasteryMap, and onExit action handlers', () => {
    const handlePlayAgain = vi.fn();
    const handleOpenMap = vi.fn();
    const handleExit = vi.fn();

    render(
      <AdaptiveSummaryView
        answers={mockAnswers}
        durationMs={4700}
        onPlayAgain={handlePlayAgain}
        onOpenMasteryMap={handleOpenMap}
        onExit={handleExit}
      />
    );

    const playAgainBtn = screen.getByRole('button', { name: /lanjut latihan/i });
    expect(playAgainBtn.className).toContain('min-h-[48px]');
    fireEvent.click(playAgainBtn);
    expect(handlePlayAgain).toHaveBeenCalledTimes(1);

    const mapBtn = screen.getByRole('button', { name: /peta keahlian/i });
    fireEvent.click(mapBtn);
    expect(handleOpenMap).toHaveBeenCalledTimes(1);

    const exitBtn = screen.getByRole('button', { name: /menu utama/i });
    fireEvent.click(exitBtn);
    expect(handleExit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adaptiveSummaryView.test.tsx`  
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/practice/AdaptiveSummaryView.tsx
import React, { useMemo } from 'react';
import { Trophy, CheckCircle2, Sparkles, RotateCcw, Home, Clock, Award } from 'lucide-react';
import { Question } from '../../engine/types/question';
import { getMasteryStore } from '../../utils/masteryBridge';
import { soundManager } from '../../utils/sound';

export interface AdaptiveSummaryViewProps {
  answers: Question[];
  durationMs: number;
  onPlayAgain: () => void;
  onOpenMasteryMap: () => void;
  onExit: () => void;
}

export const AdaptiveSummaryView: React.FC<AdaptiveSummaryViewProps> = ({
  answers,
  durationMs,
  onPlayAgain,
  onOpenMasteryMap,
  onExit,
}) => {
  const store = useMemo(() => getMasteryStore(), []);
  const records = useMemo(() => store.getAllMasteryRecords(), [store]);

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalCount = answers.length;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const durationSec = Math.round(durationMs / 1000);

  // Collect distinct practiced sub-skills
  const practicedSubSkills = useMemo(() => {
    const ids = new Set<string>();
    for (const a of answers) {
      if (a.primarySkillId) ids.add(a.primarySkillId);
    }
    return Array.from(ids);
  }, [answers]);

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6 animate-fade-in">
      {/* Trophy & Title */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border-2 border-amber-400/40 shadow-xl">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white">Sesi Selesai!</h1>
        <p className="text-xs text-indigo-300">
          Setiap latihan membawamu semakin mahir berhitung cepat
        </p>
      </div>

      {/* Metrics Card */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-indigo-800/80 bg-indigo-950/60 p-3 text-center">
          <span className="text-[10px] text-indigo-300 uppercase block mb-1">Akurasi</span>
          <span className="text-2xl font-black font-mono text-emerald-400">{accuracy}%</span>
        </div>
        <div className="rounded-2xl border border-indigo-800/80 bg-indigo-950/60 p-3 text-center">
          <span className="text-[10px] text-indigo-300 uppercase block mb-1">Benar</span>
          <span className="text-2xl font-black font-mono text-amber-300">{correctCount}/{totalCount}</span>
        </div>
        <div className="rounded-2xl border border-indigo-800/80 bg-indigo-950/60 p-3 text-center">
          <span className="text-[10px] text-indigo-300 uppercase block mb-1">Waktu</span>
          <span className="text-2xl font-black font-mono text-white">{durationSec}s</span>
        </div>
      </div>

      {/* Milestone Progression Card */}
      <div className="rounded-3xl border-2 border-indigo-800 bg-indigo-950/80 p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-indigo-200 text-xs font-black uppercase tracking-wider">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Perkembangan Keahlian Terlatih</span>
        </div>

        <div className="space-y-2">
          {practicedSubSkills.map((subSkillId) => {
            const rec = records[subSkillId];
            const score = rec?.masteryScore ?? 0;
            const label = rec?.statusLabel || 'Berkembang';

            return (
              <div
                key={subSkillId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
              >
                <div className="overflow-hidden">
                  <span className="font-bold text-white block truncate">{subSkillId}</span>
                  <span className="text-[10px] text-indigo-300 block">{label}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-amber-300 block">{score}/100</span>
                  <span className="text-[9px] text-emerald-400 block">+Aktif</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onPlayAgain();
          }}
          aria-label="Lanjut Latihan"
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 active:translate-y-0.5 text-amber-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl border-b-4 border-amber-700 transition uppercase tracking-wider"
        >
          <RotateCcw className="w-4 h-4 stroke-[3]" />
          <span>Lanjut Latihan</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onOpenMasteryMap();
          }}
          aria-label="Buka Peta Keahlian"
          className="w-full min-h-[48px] rounded-2xl bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-indigo-700 shadow-md transition"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Buka Peta Keahlian</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          aria-label="Kembali ke Menu Utama"
          className="w-full min-h-[48px] rounded-2xl bg-white/10 hover:bg-white/15 text-indigo-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition"
        >
          <Home className="w-4 h-4" />
          <span>Menu Utama</span>
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adaptiveSummaryView.test.tsx`  
Expected: PASS (2/2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/practice/AdaptiveSummaryView.tsx tests/unit/adaptiveSummaryView.test.tsx
git commit -m "feat(practice): implement AdaptiveSummaryView with mastery progression cards

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Refactor PracticeScreen Orchestrator (`src/components/PracticeScreen.tsx`)

**Files:**
- Modify: `src/components/PracticeScreen.tsx`
- Test: `tests/unit/practiceScreenOrchestrator.test.tsx`

**Interfaces:**
- Consumes:
  - `PracticeHubView` from `src/components/practice/PracticeHubView`
  - `AdaptivePlayArena` from `src/components/practice/AdaptivePlayArena`
  - `AdaptiveSummaryView` from `src/components/practice/AdaptiveSummaryView`
  - `ingestGameAnswers` from `src/utils/masteryBridge`
- Produces:
  - Refactored `PracticeScreen` managing views `'hub' | 'playing' | 'summary'`
  - Props: `{ onExit: () => void; initialTab?: 'adaptive' | 'remediation' | 'custom'; onOpenStats?: () => void; userId?: string; }`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/practiceScreenOrchestrator.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeScreen } from '../../src/components/PracticeScreen';
import { getMasteryStore } from '../../src/utils/masteryBridge';

describe('PracticeScreen Orchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('renders PracticeHubView by default and transitions through playing and summary states', () => {
    render(<PracticeScreen onExit={vi.fn()} />);

    // Default view is Hub
    expect(screen.getByText(/Latihan Adaptif AI/i)).toBeDefined();

    // Start adaptive practice
    const startBtn = screen.getByRole('button', { name: /mulai latihan adaptif/i });
    fireEvent.click(startBtn);

    // Transitions to Arena
    expect(screen.getByText(/Soal 1 dari 10/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/practiceScreenOrchestrator.test.tsx`  
Expected: FAIL (view not matching orchestrator flow).

- [ ] **Step 3: Modify PracticeScreen.tsx**

Replace `src/components/PracticeScreen.tsx` with the orchestrator that manages:
- `viewMode: 'hub' | 'playing' | 'summary'`
- Generates custom questions when custom mode selected
- Passes `AdaptiveSessionPlan` or `RemediationSessionPlan` questions to `AdaptivePlayArena`
- Ingests finished questions to `MasteryStore` via `ingestGameAnswers`
- Renders `AdaptiveSummaryView` when complete.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/practiceScreenOrchestrator.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PracticeScreen.tsx tests/unit/practiceScreenOrchestrator.test.tsx
git commit -m "feat(practice): refactor PracticeScreen to hub-arena-summary orchestrator

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: ResultModal Direct Remediation Action (`src/components/ResultModal.tsx`)

**Files:**
- Modify: `src/components/ResultModal.tsx`
- Test: `tests/unit/remediationNavigation.test.tsx`

**Interfaces:**
- Consumes:
  - `ResultModalProps`
- Produces:
  - `onStartRemediation?: () => void` in `ResultModalProps`
  - Button `id="result-remediation-button"` rendered when `summary.wrongCount > 0`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/remediationNavigation.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultModal } from '../../src/components/ResultModal';
import { GameSummary } from '../../src/types';

describe('ResultModal Remediation Fast-Launch Button', () => {
  const mockSummaryWithErrors: GameSummary = {
    mode: 'campaign',
    levelId: 4,
    score: 850,
    questionsTotal: 10,
    correctCount: 7,
    wrongCount: 3,
    accuracy: 70,
    timeSpentSec: 25,
    avgTimePerQuestionSec: 2.5,
    questionsPerMinute: 24,
    maxStreak: 5,
    starsEarned: 1,
    history: [],
    isNewRecord: false,
  };

  it('renders Latih Kesalahan button when wrongCount > 0 and onStartRemediation is provided', () => {
    const handleRemediation = vi.fn();
    render(
      <ResultModal
        summary={mockSummaryWithErrors}
        onRetry={vi.fn()}
        onHome={vi.fn()}
        onStartRemediation={handleRemediation}
      />
    );

    const remBtn = screen.getByRole('button', { name: /latih kesalahan/i });
    expect(remBtn).toBeDefined();
    expect(remBtn.className).toContain('min-h-[48px]');

    fireEvent.click(remBtn);
    expect(handleRemediation).toHaveBeenCalledTimes(1);
  });

  it('does not render Latih Kesalahan button when wrongCount === 0', () => {
    const perfectSummary = {
      ...mockSummaryWithErrors,
      correctCount: 10,
      wrongCount: 0,
      accuracy: 100,
    };

    render(
      <ResultModal
        summary={perfectSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
        onStartRemediation={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /latih kesalahan/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/remediationNavigation.test.tsx`  
Expected: FAIL (button not found).

- [ ] **Step 3: Modify ResultModal.tsx**

In `src/components/ResultModal.tsx`:
- Add `onStartRemediation?: () => void;` to `ResultModalProps`.
- Render button with `Target` icon when `summary.wrongCount > 0 && onStartRemediation`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/remediationNavigation.test.tsx`  
Expected: PASS (2/2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultModal.tsx tests/unit/remediationNavigation.test.tsx
git commit -m "feat(remediation): add Latih Kesalahan button in ResultModal

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: App Navigation & Global Answer Ingestion (`src/App.tsx`)

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/unit/globalMasteryIntegration.test.tsx`

**Interfaces:**
- Consumes:
  - `ingestGameAnswers` from `src/utils/masteryBridge`
  - `StatsModal` with mastery tab
  - `PracticeScreen` with `initialTab` and `onOpenStats`
- Produces:
  - Automatic answer logging into `MasteryStore` from Campaign, Time Attack, and Practice
  - Seamless navigation to `'practice'` in remediation mode when clicked from `ResultModal`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/globalMasteryIntegration.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';
import { getMasteryStore } from '../../src/utils/masteryBridge';

describe('Global Mastery Integration in App.tsx', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('renders application with mastery-ready components without errors', () => {
    render(<App />);
    expect(screen.getByText(/Hitung Kilat/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails / passes as baseline**

Run: `npx vitest run tests/unit/globalMasteryIntegration.test.tsx`  
Expected: PASS/FAIL baseline.

- [ ] **Step 3: Modify App.tsx**

In `src/App.tsx`:
1. Import `ingestGameAnswers` from `./utils/masteryBridge`.
2. Add `practiceInitialTab` state (`'adaptive' | 'remediation' | 'custom'`).
3. In `handleFinishGame(summary: GameSummary)`:
   - Convert `summary.history` into `GameAnswerLog` items.
   - Call `ingestGameAnswers(summary.sessionId || 'game_' + Date.now(), currentUser?.uid || 'guest_user', answerLogs)`.
4. In `ResultModal`:
   - Pass `onStartRemediation={() => { setActiveSummary(null); setPracticeInitialTab('remediation'); setCurrentMode('practice'); }}`.
5. In `PracticeScreen`:
   - Pass `initialTab={practiceInitialTab}`, `onOpenStats={() => { setStatsModalTab('mastery'); setShowStatsModal(true); }}`.
6. In `StatsModal`:
   - Pass `onStartPractice={(subSkillId) => { setShowStatsModal(false); setPracticeInitialTab('adaptive'); setCurrentMode('practice'); }}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/globalMasteryIntegration.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/unit/globalMasteryIntegration.test.tsx
git commit -m "feat(app): connect global answer ingestion and remediation flow in App.tsx

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: End-to-End Test Suite & Quality Gate Verification

**Files:**
- Test: `tests/unit/` (all test suites)

**Steps:**
- [ ] **Step 1: Run complete unit test suite**

Run: `npm test`  
Expected: 100% passing tests (530+ tests).

- [ ] **Step 2: Run TypeScript compiler check**

Run: `npm run lint` or `npx tsc --noEmit`  
Expected: 0 TypeScript errors.

- [ ] **Step 3: Run production Vite build**

Run: `npm run build`  
Expected: Clean production build in `dist/`.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore(quality): verify 100% test pass rate, 0 type errors, and clean build

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
