# Performance Optimization & Code Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement granular vendor code splitting and lazy loading in Hitung Kilat V2 to reduce initial entry bundle size from ~444 KiB gzip to $\le$ 350 KiB gzip per PRD §24.

**Architecture:** Configure Rollup `manualChunks` in `vite.config.ts` to isolate heavy vendor dependencies (`vendor-charts`, `vendor-firebase`, `vendor-motion`, `vendor-confetti`, `vendor-icons`, `vendor-react`, `vendor-misc`). Convert non-home game screens and modals in `src/App.tsx` into dynamic `React.lazy` imports wrapped in `<Suspense>` boundaries with lightweight ambient fallbacks, chunk error boundaries, and background idle prefetching via `requestIdleCallback`.

**Tech Stack:** React 19, Vite 6, Rollup, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-20-performance-optimization-and-code-splitting-design.md`

## Global Constraints

- **PRD §24 Bundle Budget:** Initial entry JS bundle (`dist/assets/index-*.js`) MUST be strictly $\le$ 350 KiB (358,400 bytes) gzipped.
- **Chunk Isolation:** `recharts`, `d3-*`, and `victory-vendor` MUST be isolated into `vendor-charts` and never bundled into the entry chunk.
- **Zero-Dependency Fallbacks:** Suspense fallbacks must be built purely with Tailwind CSS and zero third-party packages.
- **Git Safety Policy:** Strictly local commits on `feature/12.9.18.1-performance-code-splitting`, zero push to remote, mandatory trailer `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- **Full Regression Safety:** All 70 existing test suites (706+ tests) and `npm run lint` (`tsc --noEmit`) must remain 100% green.

---

### Task 1: Create Fallback & Chunk Error Boundary Components

**Files:**
- Create: `src/components/common/LoadingFallback.tsx`
- Create: `src/components/common/ChunkErrorBoundary.tsx`
- Test: `tests/unit/loadingFallback.test.tsx`

**Interfaces:**
- Consumes: React standard types and Tailwind CSS classes.
- Produces:
  - `ScreenLoadingFallback: React.FC`
  - `ModalLoadingFallback: React.FC`
  - `ChunkErrorBoundary: React.ComponentType<{ children: React.ReactNode; fallback?: React.ReactNode }>`

- [ ] **Step 1: Write the failing test for LoadingFallback and ChunkErrorBoundary**

```tsx
// tests/unit/loadingFallback.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ScreenLoadingFallback,
  ModalLoadingFallback,
} from '../../src/components/common/LoadingFallback';
import { ChunkErrorBoundary } from '../../src/components/common/ChunkErrorBoundary';

describe('LoadingFallback and ChunkErrorBoundary (Task 1)', () => {
  it('renders ScreenLoadingFallback with accessible text and spinner', () => {
    render(<ScreenLoadingFallback />);
    expect(screen.getByTestId('screen-loading-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Menyiapkan Arena/i)).toBeInTheDocument();
  });

  it('renders ModalLoadingFallback with backdrop and spinner', () => {
    render(<ModalLoadingFallback />);
    expect(screen.getByTestId('modal-loading-fallback')).toBeInTheDocument();
  });

  it('catches chunk load errors in ChunkErrorBoundary and displays retry UI', () => {
    const ProblemChild = () => {
      const err = new Error('Failed to fetch dynamically imported module: /assets/PlayScreen-xyz.js');
      err.name = 'ChunkLoadError';
      throw err;
    };

    // Suppress React error boundary console log for test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChunkErrorBoundary>
        <ProblemChild />
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('chunk-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Gagal Memuat Komponen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Muat Ulang Halaman/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/loadingFallback.test.tsx`  
Expected: FAIL with "Cannot find module '../../src/components/common/LoadingFallback'"

- [ ] **Step 3: Implement LoadingFallback and ChunkErrorBoundary**

Create `src/components/common/LoadingFallback.tsx`:
```tsx
import React from 'react';

export const ScreenLoadingFallback: React.FC = () => {
  return (
    <div
      data-testid="screen-loading-fallback"
      className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-indigo-200"
    >
      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-pink-500 rounded-full animate-spin" />
      <span className="text-sm font-medium tracking-wide animate-pulse">
        Menyiapkan Arena...
      </span>
    </div>
  );
};

export const ModalLoadingFallback: React.FC = () => {
  return (
    <div
      data-testid="modal-loading-fallback"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
    </div>
  );
};
```

Create `src/components/common/ChunkErrorBoundary.tsx`:
```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ChunkErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          data-testid="chunk-error-boundary"
          className="my-8 mx-auto max-w-md p-6 rounded-2xl bg-indigo-950/90 border border-red-500/30 text-center shadow-xl backdrop-blur-md"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xl font-bold">
            !
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Gagal Memuat Komponen
          </h3>
          <p className="text-sm text-indigo-200/80 mb-6">
            Koneksi internet terputus atau versi aplikasi telah diperbarui. Silakan muat ulang halaman untuk melanjutkan.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white text-sm font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/loadingFallback.test.tsx`  
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/components/common/LoadingFallback.tsx src/components/common/ChunkErrorBoundary.tsx tests/unit/loadingFallback.test.tsx
git commit -m "feat(perf): add screen and modal loading fallbacks with chunk error boundary

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Configure Rollup `manualChunks` in `vite.config.ts`

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: Rollup `manualChunks(id: string)` callback from Vite config.
- Produces: Separated vendor chunks: `vendor-charts`, `vendor-firebase`, `vendor-motion`, `vendor-confetti`, `vendor-icons`, `vendor-react`, `vendor-misc`.

- [ ] **Step 1: Update `vite.config.ts` with vendor manualChunks**

Update `vite.config.ts` to include:
```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;

            // 1. Data visualization (Recharts + D3 + Victory)
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('victory-vendor')
            ) {
              return 'vendor-charts';
            }

            // 2. Firebase SDK
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }

            // 3. Motion animation library
            if (id.includes('framer-motion') || id.includes('/motion/') || id.includes('motion-dom') || id.includes('motion-utils')) {
              return 'vendor-motion';
            }

            // 4. Celebration confetti
            if (id.includes('canvas-confetti')) {
              return 'vendor-confetti';
            }

            // 5. Icons
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }

            // 6. React core runtime
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/')
            ) {
              return 'vendor-react';
            }

            // 7. General utilities & remaining vendor packages
            return 'vendor-misc';
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

- [ ] **Step 2: Run build to verify vendor chunks are generated**

Run: `npm run build`  
Expected: `vendor-charts-*.js`, `vendor-firebase-*.js`, `vendor-motion-*.js`, `vendor-confetti-*.js`, `vendor-icons-*.js`, `vendor-react-*.js` appear in `dist/assets/`.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "build(vite): configure granular role-based vendor manualChunks

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Implement Lazy Loading, Suspense Boundaries, and Idle Prefetching in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  - `ScreenLoadingFallback`, `ModalLoadingFallback` from `src/components/common/LoadingFallback`
  - `ChunkErrorBoundary` from `src/components/common/ChunkErrorBoundary`
- Produces:
  - `App: React.FC` with lazy screens & modals, Suspense wrappers, and idle prefetching hook.

- [ ] **Step 1: Convert static component imports to `React.lazy` in `src/App.tsx`**

Replace static imports:
```typescript
// Replace lines 29-38 in src/App.tsx:
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
```

Import `ScreenLoadingFallback`, `ModalLoadingFallback`, and `ChunkErrorBoundary`:
```typescript
import {
  ScreenLoadingFallback,
  ModalLoadingFallback,
} from './components/common/LoadingFallback';
import { ChunkErrorBoundary } from './components/common/ChunkErrorBoundary';
```

- [ ] **Step 2: Add idle prefetching effect in `App` component**

```typescript
  // Idle prefetch core game screens and stats modal
  useEffect(() => {
    const prefetchCoreChunks = () => {
      import('./components/PlayScreen');
      import('./components/StatsModal');
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
```

- [ ] **Step 3: Wrap main content area and modals with `ChunkErrorBoundary` and `<Suspense>`**

In `<main className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 flex-1 w-full relative z-10">`:
```tsx
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
                onFinishLevel={handleFinishLevel}
                onExit={handleNavigateHome}
              />
            )}

            {/* Time Attack Play Screen */}
            {!activeLevel && currentMode === 'time_attack' && (
              <TimeAttackScreen
                onFinish={handleFinishTimeAttack}
                onExit={handleNavigateHome}
                currentUser={currentUser}
              />
            )}

            {/* Practice / Remediation Play Screen */}
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

            {/* Daily Challenge Screen */}
            {!activeLevel && currentMode === 'daily_challenge' && (
              <DailyChallengeScreen
                onFinish={handleFinishDailyChallenge}
                onExit={handleNavigateHome}
                dailyState={dailyState}
                onUpdateDailyState={setDailyState}
              />
            )}

            {/* Competitive Mode Screen (Sprint 60s & Survival Kilat) */}
            {!activeLevel && (currentMode === 'competitive_sprint' || currentMode === 'competitive_survival') && (
              <CompetitivePlayScreen
                mode={currentMode === 'competitive_sprint' ? 'sprint' : 'survival'}
                secret="hitung-kilat-competitive-secret-v2"
                userId={currentUser?.uid || 'guest_user'}
                isRanked={Boolean(currentUser)}
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
```

And wrap lazy modals:
```tsx
      {/* Game Result Summary Modal */}
      {activeSummary && (
        <ChunkErrorBoundary>
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
        <ChunkErrorBoundary>
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
              onOpenSyncModal={() => setShowSyncModal(true)}
              playerName={dailyState.playerName}
              playerFlag={dailyState.playerFlag}
              defaultTab={statsModalTab}
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
        <ChunkErrorBoundary>
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
        <ChunkErrorBoundary>
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
        <ChunkErrorBoundary>
          <Suspense fallback={<ModalLoadingFallback />}>
            <SyncAccountModal
              isOpen={showSyncModal}
              onClose={() => setShowSyncModal(false)}
              currentUser={currentUser}
              onLoginGoogle={handleLoginGoogle}
              onLoginGuest={handleLoginGuest}
              onLogout={handleLogout}
              syncStatus={syncStatus}
              lastSyncedAt={lastSyncedAt}
              onManualSync={syncCurrentStateToCloud}
              stats={stats}
              totalStars={totalStars}
            />
          </Suspense>
        </ChunkErrorBoundary>
      )}
```

- [ ] **Step 4: Run typecheck and existing integration test**

Run: `npm run lint && npx vitest run tests/unit/appCloudSyncIntegration.test.tsx`  
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): split non-home screens and modals into lazy Suspense boundaries with idle prefetching

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Create Bundle Budget Verification Script & Automated Assertion Test

**Files:**
- Create: `scripts/verify-bundle-budget.mjs`
- Create: `tests/unit/bundleBudget.test.ts`
- Modify: `package.json` (add `"verify:bundle"` script)

**Interfaces:**
- Consumes: `dist/assets/` filesystem directory.
- Produces: CLI script exiting with code 0 or 1, and unit test checking PRD §24 budget ($\le$ 350 KiB gzip).

- [ ] **Step 1: Write the failing test for bundle budget utility**

Create `tests/unit/bundleBudget.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const MAX_ENTRY_GZIP_BYTES = 350 * 1024; // 350 KiB = 358,400 bytes per PRD §24

describe('PRD §24 Bundle Budget Verification (Task 4)', () => {
  it('verifies dist/assets contains index entry JS bundle <= 350 KiB gzip', () => {
    const assetsDir = path.resolve(__dirname, '../../dist/assets');
    expect(fs.existsSync(assetsDir), 'dist/assets must exist (run npm run build first)').toBe(true);

    const files = fs.readdirSync(assetsDir);
    const entryFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    expect(entryFile, 'Entry index-[hash].js must exist in dist/assets').toBeDefined();

    const entryPath = path.join(assetsDir, entryFile!);
    const rawBuffer = fs.readFileSync(entryPath);
    const gzipBuffer = zlib.gzipSync(rawBuffer);

    const rawKiB = (rawBuffer.length / 1024).toFixed(2);
    const gzipKiB = (gzipBuffer.length / 1024).toFixed(2);

    console.log(`Entry bundle: ${entryFile} -> ${rawKiB} KiB uncompressed, ${gzipKiB} KiB gzip`);

    expect(
      gzipBuffer.length,
      `Entry bundle ${entryFile} gzip size (${gzipKiB} KiB) exceeds PRD §24 budget of 350 KiB`
    ).toBeLessThanOrEqual(MAX_ENTRY_GZIP_BYTES);
  });

  it('verifies vendor-charts is isolated into its own chunk', () => {
    const assetsDir = path.resolve(__dirname, '../../dist/assets');
    const files = fs.readdirSync(assetsDir);
    const chartsChunk = files.find((f) => f.startsWith('vendor-charts-') && f.endsWith('.js'));
    expect(chartsChunk, 'vendor-charts-[hash].js must exist as an isolated chunk').toBeDefined();
  });
});
```

- [ ] **Step 2: Create `scripts/verify-bundle-budget.mjs`**

```javascript
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_GZIP_BYTES = 350 * 1024; // 350 KiB
const assetsDir = path.resolve(__dirname, '../dist/assets');

if (!fs.existsSync(assetsDir)) {
  console.error('❌ dist/assets directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const entryFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));

if (!entryFile) {
  console.error('❌ Could not find entry index-[hash].js file in dist/assets.');
  process.exit(1);
}

const entryPath = path.join(assetsDir, entryFile);
const rawBuffer = fs.readFileSync(entryPath);
const gzipBuffer = zlib.gzipSync(rawBuffer);

const rawKiB = (rawBuffer.length / 1024).toFixed(2);
const gzipKiB = (gzipBuffer.length / 1024).toFixed(2);

console.log('--------------------------------------------------');
console.log('📦 Hitung Kilat V2 — Bundle Budget Report (PRD §24)');
console.log('--------------------------------------------------');
console.log(`Entry Asset:     ${entryFile}`);
console.log(`Uncompressed:    ${rawKiB} KiB`);
console.log(`Gzip Compressed: ${gzipKiB} KiB`);
console.log(`Budget Limit:    350.00 KiB gzip`);
console.log('--------------------------------------------------');

// Inspect vendor chunks
const vendorChunks = files.filter((f) => f.startsWith('vendor-') && f.endsWith('.js'));
console.log(`Vendor Chunks (${vendorChunks.length} chunks isolated):`);
for (const chunk of vendorChunks) {
  const cPath = path.join(assetsDir, chunk);
  const cBuf = fs.readFileSync(cPath);
  const cGzip = zlib.gzipSync(cBuf);
  console.log(`  • ${chunk.padEnd(30)}: ${(cBuf.length / 1024).toFixed(2)} KiB (${(cGzip.length / 1024).toFixed(2)} KiB gzip)`);
}
console.log('--------------------------------------------------');

if (gzipBuffer.length > MAX_GZIP_BYTES) {
  console.error(`❌ VIOLATION: Entry bundle gzip size (${gzipKiB} KiB) exceeds 350 KiB budget!`);
  process.exit(1);
}

console.log('✅ SUCCESS: Entry bundle is within the PRD §24 budget (<= 350 KiB gzip)!');
process.exit(0);
```

- [ ] **Step 3: Add `verify:bundle` script to `package.json`**

In `package.json`:
```json
    "verify:bundle": "node scripts/verify-bundle-budget.mjs"
```

- [ ] **Step 4: Build and test bundle budget verification**

Run: `npm run build && npm run verify:bundle && npx vitest run tests/unit/bundleBudget.test.ts`  
Expected: Build succeeds, bundle budget verification outputs `✅ SUCCESS`, and unit test passes.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-bundle-budget.mjs tests/unit/bundleBudget.test.ts package.json
git commit -m "feat(perf): add automated PRD §24 bundle budget verification script and test

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Lazy Screen & Modal Integration Unit Tests

**Files:**
- Create: `tests/unit/lazyScreens.test.tsx`

**Interfaces:**
- Consumes: `App.tsx` and mocked dynamic screen components.
- Produces: Unit test suite verifying dynamic loading and rendering of non-home screens and modals under Suspense.

- [ ] **Step 1: Write integration tests for lazy screens and modals**

Create `tests/unit/lazyScreens.test.tsx`:
```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import * as firebaseLib from '../../src/lib/firebase';
import { soundManager } from '../../src/utils/sound';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/lib/firebase', async () => {
  const actual = await vi.importActual<any>('../../src/lib/firebase');
  return {
    ...actual,
    auth: { currentUser: null },
    onAuthStateChanged: vi.fn((_auth: any, cb: any) => {
      return vi.fn();
    }),
    loginWithGoogle: vi.fn(),
    loginAsGuest: vi.fn(),
    logoutUser: vi.fn(),
    saveGameDataToCloud: vi.fn().mockResolvedValue(undefined),
    loadGameDataFromCloud: vi.fn().mockResolvedValue(null),
    mergeGameProgress: vi.fn(actual.mergeGameProgress),
  };
});

describe('Lazy Screen & Modal Loading Integration (Task 5)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hitung_kilat_migration_ack_v2', 'true');
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playFanfare').mockImplementation(() => {});
  });

  it('renders LevelMap immediately on initial load without showing screen fallback', () => {
    render(<App />);
    expect(screen.getByText(/Peta Petualangan/i)).toBeInTheDocument();
  });

  it('dynamically loads and renders PlayScreen when a level is clicked', async () => {
    render(<App />);
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();

    fireEvent.click(level1Card!);

    // PlayScreen should load and mount
    await waitFor(() => {
      expect(
        screen.getByText(/Level 1/i) || screen.getByText(/T1-ADD-01/i) || screen.getByRole('button', { name: /Jawab|Kirim|Selesai/i })
      ).toBeDefined();
    });
  });

  it('dynamically loads and renders StatsModal when header stars badge is clicked', async () => {
    render(<App />);
    const starsBadge = screen.getByTitle(/Total Bintang Diraih/i);
    fireEvent.click(starsBadge);

    await waitFor(() => {
      expect(screen.getByText(/Statistik Pemain/i)).toBeInTheDocument();
    });
  });

  it('dynamically loads and renders HelpModal when help button is clicked', async () => {
    render(<App />);
    const helpBtn = screen.getByTitle(/Panduan & Trik Cepat/i);
    fireEvent.click(helpBtn);

    await waitFor(() => {
      expect(screen.getByText(/Panduan & Trik Hitung Kilat/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/lazyScreens.test.tsx`  
Expected: PASS (4 tests passed).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/lazyScreens.test.tsx
git commit -m "test(perf): add lazy screens and modals suspense integration tests

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Full Production Build Verification & Regression Validation

**Files:**
- None (Verification task)

**Interfaces:**
- Consumes: Entire project repository, test suite, and build artifacts.
- Produces: Final verified build evidence satisfying PRD §24.

- [ ] **Step 1: Execute type check**

Run: `npm run lint`  
Expected: 0 TypeScript errors.

- [ ] **Step 2: Execute full regression test suite**

Run: `npm test -- --run`  
Expected: 70+ suites passed, 715+ tests passed, 0 failures.

- [ ] **Step 3: Execute production build and bundle budget verification**

Run: `npm run build && npm run verify:bundle`  
Expected:
- Build completes cleanly.
- `index-[hash].js` gzip size is $\le$ 350 KiB gzip.
- All vendor chunks cleanly isolated.

- [ ] **Step 4: Commit and tag completion**

```bash
git commit --allow-empty -m "chore(perf): complete verification of performance optimization and code splitting

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
