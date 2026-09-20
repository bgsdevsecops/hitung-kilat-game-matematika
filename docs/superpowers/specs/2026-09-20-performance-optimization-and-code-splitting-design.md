# Performance Optimization & Code Splitting Design

**Date:** 2026-09-20  
**Status:** Approved  
**Author:** Claude Code & cachak  
**Branch:** `feature/12.9.18.1-performance-code-splitting`  
**Milestone:** V2.4 Polish & GA Readiness  
**References:** PRD §24 (Performance Budgets & Code Splitting), §28 (Production Readiness), §31 (Milestone Roadmap)  

---

## 1. Overview & Problem Statement

Hitung Kilat V2 has grown substantially with the addition of:
- A data-driven 72-level DAG campaign progression system (`LEVEL_MANIFEST_72`)
- Learning intelligence, taxonomy matrix, mastery tracker, and mistake bank
- Competitive modes (Sprint 60s, Survival Kilat, and Daily Challenge V2)
- Detailed performance telemetry with `recharts` visual charting
- Real-time Firestore Cloud Sync V2

Currently, the production build emits a single monolithic JavaScript bundle:
```
dist/assets/index-[hash].js: ~1,664 KiB uncompressed / ~444 KiB gzip
```

This violates **PRD §24 (Performance Budgets)**:
> - **Initial JS Bundle Budget:** $\le$ 350 KiB (gzipped)
> - **Time to Interactive (TTI):** $\le$ 2.0s on 4G
> - **Chunk Isolation:** Recharts/D3 and non-home game modes must be code-split into isolated on-demand chunks.

### Primary Goals
1. Optimize Vite/Rollup bundling configuration via granular, role-based vendor chunking (`manualChunks`).
2. Implement asynchronous route/screen and modal code splitting (`React.lazy` + `Suspense`) in `src/App.tsx`.
3. Provide smooth, responsive user experience via lightweight ambient loading fallbacks and idle prefetching (`requestIdleCallback`).
4. Establish an automated bundle budget assertion verifying entry bundle size $\le$ 350 KiB gzip in CI/build pipelines.
5. Guarantee 100% backward compatibility and test regression stability (70 existing test suites, 706+ tests).

---

## 2. Vite / Rollup Granular Vendor Splitting Architecture

### 2.1 Chunk Partitioning Strategy (`vite.config.ts`)
Rollup bundling in Vite will be configured with an explicit `manualChunks(id)` function to isolate heavy dependencies into distinct, cacheable vendor chunks.

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;

          // 1. Data visualization (Recharts + D3)
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

          // 3. Animation library (framer-motion)
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }

          // 4. Celebration effects
          if (id.includes('canvas-confetti')) {
            return 'vendor-confetti';
          }

          // 5. Icons
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          // 6. React Core Runtime
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/')
          ) {
            return 'vendor-react';
          }

          // 7. General utility & remaining vendor packages
          return 'vendor-misc';
        },
      },
    },
  },
});
```

### 2.2 Expected Vendor Breakdown & Caching Benefits
- `vendor-charts`: ~400–450 KiB (isolated from initial landing page; loaded only when viewing detailed statistics).
- `vendor-firebase`: ~250–300 KiB (isolated for cloud sync and leaderboard operations).
- `vendor-motion`: ~100–120 KiB.
- `vendor-confetti`: ~15–20 KiB.
- `vendor-icons`: ~80–100 KiB.
- `vendor-react`: ~140–150 KiB (gzipped ~45 KiB).
- **Result:** The entry application bundle (`index-[hash].js`) drops from **444 KiB gzip** to well below **150–200 KiB gzip**, easily satisfying the $\le$ 350 KiB gzip threshold.

---

## 3. Screen & Modal Code Splitting (`src/App.tsx`)

### 3.1 Lazy-Loaded Component Registry
Components that are not immediately visible upon initial landing (the campaign map is the initial screen) are split into dynamic imports using `React.lazy()`:

```typescript
// Screens (Loaded on demand when player enters a game mode)
const PlayScreen = React.lazy(() =>
  import('./components/PlayScreen').then((m) => ({ default: m.PlayScreen }))
);
const PracticeScreen = React.lazy(() =>
  import('./components/PracticeScreen').then((m) => ({ default: m.PracticeScreen }))
);
const TimeAttackScreen = React.lazy(() =>
  import('./components/TimeAttackScreen').then((m) => ({ default: m.TimeAttackScreen }))
);
const DailyChallengeScreen = React.lazy(() =>
  import('./components/DailyChallengeScreen').then((m) => ({ default: m.DailyChallengeScreen }))
);
const CompetitivePlayScreen = React.lazy(() =>
  import('./components/competitive/CompetitivePlayScreen').then((m) => ({
    default: m.CompetitivePlayScreen,
  }))
);

// Modals (Loaded on demand when toggled)
const StatsModal = React.lazy(() =>
  import('./components/StatsModal').then((m) => ({ default: m.StatsModal }))
);
const SyncAccountModal = React.lazy(() =>
  import('./components/SyncAccountModal').then((m) => ({ default: m.SyncAccountModal }))
);
const CompetitiveModeSelectModal = React.lazy(() =>
  import('./components/competitive/CompetitiveModeSelectModal').then((m) => ({
    default: m.CompetitiveModeSelectModal,
  }))
);
const HelpModal = React.lazy(() =>
  import('./components/HelpModal').then((m) => ({ default: m.HelpModal }))
);
const ResultModal = React.lazy(() =>
  import('./components/ResultModal').then((m) => ({ default: m.ResultModal }))
);
```

### 3.2 Lightweight Ambient Fallbacks
A minimal, zero-dependency Tailwind CSS loading indicator prevents layout shifts without adding bundle weight:

```tsx
export function ScreenLoadingFallback() {
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
}

export function ModalLoadingFallback() {
  return (
    <div
      data-testid="modal-loading-fallback"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
    </div>
  );
}
```

### 3.3 Idle Prefetching Strategy
To eliminate visible latency when players click the first level or open stats, an idle prefetch hook triggers during browser idle periods:

```typescript
useEffect(() => {
  const prefetchCoreChunks = () => {
    // Warm up the most common next interactions in the background
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

---

## 4. Resilient Chunk Loading & Error Boundary

### 4.1 Chunk Loading Error Handling
When a user experiences a temporary network disconnection or a new deployment invalidates cached asset hashes, dynamic imports can throw `ChunkLoadError`.

An `AppErrorBoundary` wraps all suspense boundaries:
- Catches chunk loading failures (`e.name === 'ChunkLoadError'` or message containing `Failed to fetch dynamically imported module`).
- Displays a clean error banner with an explicit "Muat Ulang Halaman" (*Reload Page*) action button.
- Preserves local progress in `localStorage` before triggering reload.

---

## 5. Automated Bundle Budget Assertion & Verification (PRD §24)

### 5.1 Bundle Budget Specification
| Chunk / Asset | Max Allowed Size (Uncompressed) | Max Allowed Size (gzip) |
|---|---|---|
| `dist/assets/index-*.js` (Entry Bundle) | $\le$ 1,000 KiB | $\le$ 350 KiB |
| `vendor-charts-*.js` | Isolated chunk | Separate from entry |
| `vendor-firebase-*.js` | Isolated chunk | Separate from entry |

### 5.2 Verification Script (`scripts/verify-bundle-budget.mjs`)
A Node.js build verification script reads the output of `dist/assets/`:
1. Locates the primary entry file (`index-*.js`).
2. Calculates the uncompressed and gzipped byte sizes using `zlib.gzipSync()`.
3. Verifies that the gzipped size is strictly $\le$ 350 KiB (358,400 bytes).
4. Verifies that `vendor-charts` exists as an independent chunk.
5. Emits a structured diagnostic table and exits with code 0 on success or code 1 on budget violation.

A test in `tests/unit/bundleBudget.test.ts` also runs as part of the test suite to guard against future regressions.

---

## 6. Testing & Quality Assurance Plan

1. **Unit & Integration Tests:**
   - Verify `App.tsx` renders fallback while dynamic components are resolving.
   - Verify `PlayScreen`, `PracticeScreen`, `CompetitivePlayScreen`, and `DailyChallengeScreen` render properly when their respective modes are triggered.
   - Ensure `appCloudSyncIntegration.test.tsx` passes with lazy-loaded components (using appropriate `waitFor` and mock handlers).
2. **Bundle Budget Validation:**
   - Execute `npm run build`.
   - Run `node scripts/verify-bundle-budget.mjs` to confirm entry bundle $\le$ 350 KiB gzip.
3. **Full Regression Suite:**
   - Execute `npm test -- --run` to ensure all 70 suites and 706+ tests pass with zero regressions.
   - Execute `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
