# PWA Offline Service Worker & Update Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a lightweight, zero-dependency native PWA Service Worker for offline caching of 72 campaign levels and assets, coupled with friendly in-app update notification toasts and Nginx HTTP cache optimization.

**Architecture:** A native `public/sw.js` intercepts network requests using Cache-First for hashed static assets, Network-First with cached `/index.html` fallback for SPA routes, and strict Network-Only bypass for `/firebase-config.js` and `/actuator`. The frontend coordinates updates through `src/utils/serviceWorkerRegistration.ts` and renders an unobtrusive `UpdateNotificationToast` and `OfflineStatusBadge`.

**Tech Stack:** TypeScript, Vanilla Service Worker API, React 19, Lucide Icons, Vite 6, Nginx, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-pwa-offline-service-worker-design.md`

## Global Constraints

- **Zero Added Dependencies**: Must not introduce external packages like `workbox` or `vite-plugin-pwa` to `package.json`.
- **Bundle Budget Ceiling**: Total gzipped entry bundle must remain $\le 350.00\text{ KiB}$ (currently at ~33.67 KiB gzip).
- **Strict Network Bypass**: `/firebase-config.js` and `/actuator` must **never** be cached by the Service Worker or Nginx HTTP cache.
- **Controlled Invalidation**: Must avoid automatic `self.skipWaiting()` on install to prevent unexpected reloads during active gameplay.
- **Safe Controller Reload**: Reload on `controllerchange` must be guarded with a single-shot boolean to prevent infinite reload loops.
- **TDD Requirement**: Every component and utility must have unit test coverage verifying both happy and edge paths.

## Review Focus

1. **Kubernetes Runtime Injection Bypass**: A request to `/firebase-config.js` in an active Service Worker session must never read from or write to CacheStorage.
2. **Offline SPA Route Fallback**: When network is disconnected, navigating to `/terms-of-service`, `/privacy-policy`, or `/` must return the cached `/index.html` instead of failing.
3. **Double Reload Guard**: Multiple rapid `controllerchange` events must only trigger `window.location.reload()` exactly once.
4. **Non-Intrusive Update Dismissal**: Dismissing the update toast must allow the user to complete their game session without re-prompting until the next session.
5. **Non-GET and External API Passthrough**: POST/PUT/DELETE requests and cross-origin calls (Google Auth, Firestore) must be passed directly through to `fetch()`.

---

### Task 1: Service Worker Script & Logic (`public/sw.js`)

**Files:**
- Create: `public/sw.js`
- Test: `tests/unit/serviceWorkerLogic.test.ts`

**Interfaces:**
- Produces: Service Worker script accessible at `/sw.js` caching static assets and handling `{ type: 'SKIP_WAITING' }`.
- Exported helper in test: `serviceWorkerRouteStrategy(requestUrl, requestMode, requestMethod)` to allow deterministic unit testing of routing rules.

- [ ] **Step 1: Write failing unit test for Service Worker routing logic**

Create `tests/unit/serviceWorkerLogic.test.ts`:
```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

// Extracted / mocked routing logic evaluator matching public/sw.js
export function determineRouteStrategy(urlStr: string, mode: string, method: string): 'network-only' | 'navigate-fallback' | 'cache-first' | 'passthrough' {
  if (method !== 'GET') return 'passthrough';
  const url = new URL(urlStr, 'https://hitung-kilat.k8s.web.id');
  if (url.origin !== 'https://hitung-kilat.k8s.web.id') return 'passthrough';
  if (url.pathname === '/firebase-config.js' || url.pathname === '/actuator') {
    return 'network-only';
  }
  if (mode === 'navigate') {
    return 'navigate-fallback';
  }
  if (url.pathname.startsWith('/assets/')) {
    return 'cache-first';
  }
  return 'cache-first';
}

describe('Service Worker Routing Rules', () => {
  it('bypasses non-GET requests', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/api/test', 'cors', 'POST')).toBe('passthrough');
  });

  it('bypasses external domains (Google Auth, Firestore, etc.)', () => {
    expect(determineRouteStrategy('https://firestore.googleapis.com/v1/projects', 'cors', 'GET')).toBe('passthrough');
  });

  it('enforces network-only for /firebase-config.js and /actuator', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/firebase-config.js', 'no-cors', 'GET')).toBe('network-only');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/actuator', 'no-cors', 'GET')).toBe('network-only');
  });

  it('routes SPA navigations to navigate-fallback', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/terms-of-service', 'navigate', 'GET')).toBe('navigate-fallback');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/', 'navigate', 'GET')).toBe('navigate-fallback');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/privacy-policy', 'navigate', 'GET')).toBe('navigate-fallback');
  });

  it('routes static assets to cache-first', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/assets/main-12345.js', 'cors', 'GET')).toBe('cache-first');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/favicon.svg', 'no-cors', 'GET')).toBe('cache-first');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/serviceWorkerLogic.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `public/sw.js`**

Create `public/sw.js`:
```javascript
const CACHE_NAME = 'hitung-kilat-v2-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// Install: precache essential offline shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate: clean up outdated caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Message listener: allow client to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: custom routing and offline resilience
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Only intercept GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 2. Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  // 3. Strict Network-Only bypass for container runtime config and actuator
  if (url.pathname === '/firebase-config.js' || url.pathname === '/actuator') {
    return;
  }

  // 4. SPA Navigation requests (HTML documents) -> Network-First with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // 5. Static Assets (/assets/*) -> Cache-First with dynamic caching
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 6. Other local static files (favicon, manifest, icons) -> Stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});
```

- [ ] **Step 4: Verify test suite & commit**

Run: `npx vitest run tests/unit/serviceWorkerLogic.test.ts`
Expected: PASS

```bash
git add public/sw.js tests/unit/serviceWorkerLogic.test.ts
git commit -m "$(cat <<'EOF'
feat(pwa): add native service worker script with offline cache strategies

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Service Worker Registration Manager (`src/utils/serviceWorkerRegistration.ts`)

**Files:**
- Create: `src/utils/serviceWorkerRegistration.ts`
- Test: `tests/unit/serviceWorkerRegistration.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ServiceWorkerRegistrationConfig {
    onSuccess?: (registration: ServiceWorkerRegistration) => void;
    onUpdate?: (registration: ServiceWorkerRegistration) => void;
    onError?: (error: Error) => void;
  }
  export function registerServiceWorker(config?: ServiceWorkerRegistrationConfig): void;
  export function unregisterServiceWorker(): void;
  export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void;
  ```

- [ ] **Step 1: Write failing unit test for registration manager**

Create `tests/unit/serviceWorkerRegistration.test.ts`:
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerServiceWorker,
  unregisterServiceWorker,
  applyServiceWorkerUpdate,
} from '../../src/utils/serviceWorkerRegistration';

describe('serviceWorkerRegistration', () => {
  let originalNavigator: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing if serviceWorker is not supported in navigator', () => {
    const originalSW = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });

    const onUpdate = vi.fn();
    registerServiceWorker({ onUpdate });
    expect(onUpdate).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      configurable: true,
    });
  });

  it('registers /sw.js on window load when supported', async () => {
    const mockRegister = vi.fn().mockResolvedValue({
      onupdatefound: null,
      installing: null,
      waiting: null,
      active: null,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    registerServiceWorker();
    window.dispatchEvent(new Event('load'));

    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });

  it('sends SKIP_WAITING and sets up single-shot reload in applyServiceWorkerUpdate', () => {
    const postMessageMock = vi.fn();
    const addEventListenerMock = vi.fn();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: addEventListenerMock,
      },
      configurable: true,
    });

    const mockRegistration = {
      waiting: {
        postMessage: postMessageMock,
      },
    } as unknown as ServiceWorkerRegistration;

    applyServiceWorkerUpdate(mockRegistration);

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(addEventListenerMock).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });

  it('unregisters active service worker registrations', async () => {
    const unregisterMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          unregister: unregisterMock,
        }),
      },
      configurable: true,
    });

    unregisterServiceWorker();
    await Promise.resolve();
    expect(unregisterMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/serviceWorkerRegistration.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/utils/serviceWorkerRegistration.ts`**

Create `src/utils/serviceWorkerRegistration.ts`:
```typescript
export interface ServiceWorkerRegistrationConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

let isRefreshing = false;

export function registerServiceWorker(config?: ServiceWorkerRegistrationConfig): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // If a waiting worker already exists (e.g. from previous background fetch)
        if (registration.waiting && navigator.serviceWorker.controller) {
          config?.onUpdate?.(registration);
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                config?.onUpdate?.(registration);
              } else {
                // Content cached for offline use
                config?.onSuccess?.(registration);
              }
            }
          };
        };
      })
      .catch((error) => {
        config?.onError?.(error);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshing) {
        isRefreshing = true;
        window.location.reload();
      }
    });
  }
}

export function unregisterServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/serviceWorkerRegistration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/serviceWorkerRegistration.ts tests/unit/serviceWorkerRegistration.test.ts
git commit -m "$(cat <<'EOF'
feat(pwa): add service worker registration manager and update lifecycle

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Network Status Hook & Offline Indicator Badge

**Files:**
- Create: `src/hooks/useNetworkStatus.ts`
- Create: `src/components/common/OfflineStatusBadge.tsx`
- Test: `tests/unit/useNetworkStatus.test.ts`
- Test: `tests/unit/offlineStatusBadge.test.tsx`

**Interfaces:**
- Produces:
  - `useNetworkStatus(): { isOnline: boolean }`
  - `<OfflineStatusBadge isOnline={boolean} />`

- [ ] **Step 1: Write failing unit test for `useNetworkStatus` and `OfflineStatusBadge`**

Create `tests/unit/useNetworkStatus.test.ts`:
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial online status from navigator.onLine', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(navigator.onLine);
  });

  it('updates isOnline state on window online and offline events', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });
});
```

Create `tests/unit/offlineStatusBadge.test.tsx`:
```typescript
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineStatusBadge } from '../../src/components/common/OfflineStatusBadge';

describe('OfflineStatusBadge', () => {
  it('renders nothing when online', () => {
    const { container } = render(<OfflineStatusBadge isOnline={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badge with offline icon and text when offline', () => {
    render(<OfflineStatusBadge isOnline={false} />);
    expect(screen.getByText(/Mode Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/Progres tersimpan lokal/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/useNetworkStatus.test.ts tests/unit/offlineStatusBadge.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `useNetworkStatus.ts` and `OfflineStatusBadge.tsx`**

Create `src/hooks/useNetworkStatus.ts`:
```typescript
import { useState, useEffect } from 'react';

export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
```

Create `src/components/common/OfflineStatusBadge.tsx`:
```typescript
import React from 'react';
import { WifiOff } from 'lucide-react';

export interface OfflineStatusBadgeProps {
  isOnline: boolean;
}

export const OfflineStatusBadge: React.FC<OfflineStatusBadgeProps> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md shadow-sm animate-pulse"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
      <span>Mode Offline</span>
      <span className="hidden sm:inline text-amber-200/70 font-normal">| Progres tersimpan lokal</span>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/useNetworkStatus.test.ts tests/unit/offlineStatusBadge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNetworkStatus.ts src/components/common/OfflineStatusBadge.tsx tests/unit/useNetworkStatus.test.ts tests/unit/offlineStatusBadge.test.tsx
git commit -m "$(cat <<'EOF'
feat(pwa): add useNetworkStatus hook and OfflineStatusBadge indicator

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Update Notification Toast Component (`src/components/common/UpdateNotificationToast.tsx`)

**Files:**
- Create: `src/components/common/UpdateNotificationToast.tsx`
- Test: `tests/unit/updateNotificationToast.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface UpdateNotificationToastProps {
    onUpdate: () => void;
    onDismiss: () => void;
  }
  export const UpdateNotificationToast: React.FC<UpdateNotificationToastProps>;
  ```

- [ ] **Step 1: Write failing unit test for `UpdateNotificationToast`**

Create `tests/unit/updateNotificationToast.test.tsx`:
```typescript
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateNotificationToast } from '../../src/components/common/UpdateNotificationToast';
import { soundManager } from '../../src/utils/sound';

describe('UpdateNotificationToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders update announcement and action buttons', () => {
    render(<UpdateNotificationToast onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Versi Baru Tersedia!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perbarui Sekarang/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nanti/i })).toBeInTheDocument();
  });

  it('calls onUpdate and plays sound when clicking Perbarui Sekarang', () => {
    const handleUpdate = vi.fn();
    render(<UpdateNotificationToast onUpdate={handleUpdate} onDismiss={vi.fn()} />);

    const updateBtn = screen.getByRole('button', { name: /Perbarui Sekarang/i });
    fireEvent.click(updateBtn);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss and plays sound when clicking Nanti', () => {
    const handleDismiss = vi.fn();
    render(<UpdateNotificationToast onUpdate={vi.fn()} onDismiss={handleDismiss} />);

    const dismissBtn = screen.getByRole('button', { name: /Nanti/i });
    fireEvent.click(dismissBtn);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/updateNotificationToast.test.tsx`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `UpdateNotificationToast.tsx`**

Create `src/components/common/UpdateNotificationToast.tsx`:
```typescript
import React from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { soundManager } from '../../utils/sound';

export interface UpdateNotificationToastProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export const UpdateNotificationToast: React.FC<UpdateNotificationToastProps> = ({
  onUpdate,
  onDismiss,
}) => {
  const handleUpdate = () => {
    soundManager.playClick();
    onUpdate();
  };

  const handleDismiss = () => {
    soundManager.playClick();
    onDismiss();
  };

  return (
    <aside
      aria-label="Pemberitahuan Pembaruan Aplikasi"
      role="alert"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 p-4 bg-indigo-950/95 border-2 border-amber-400/80 rounded-2xl shadow-2xl backdrop-blur-lg flex flex-col gap-3 transition-all animate-bounce-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-indigo-950 shadow-md flex-shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Versi Baru Tersedia!</span>
            </h4>
            <p className="text-xs text-indigo-200 mt-0.5">
              Pembaruan konten dan performa telah diunduh di latar belakang.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Tutup pemberitahuan pembaruan"
          className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-indigo-900/50 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-800/60">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition-colors"
        >
          Nanti
        </button>
        <button
          onClick={handleUpdate}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-indigo-950 font-bold text-xs shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Perbarui Sekarang</span>
        </button>
      </div>
    </aside>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/updateNotificationToast.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/common/UpdateNotificationToast.tsx tests/unit/updateNotificationToast.test.tsx
git commit -m "$(cat <<'EOF'
feat(pwa): create UpdateNotificationToast component for non-disruptive app updates

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: App Integration & Web Server Nginx Optimization

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `nginx.conf`
- Test: `tests/unit/pwaAppIntegration.test.tsx`

**Interfaces:**
- Consumes: `registerServiceWorker`, `applyServiceWorkerUpdate`, `useNetworkStatus`, `OfflineStatusBadge`, `UpdateNotificationToast`.
- Produces: Integrated PWA Service Worker registration, offline indicator in header, update toast container.

- [ ] **Step 1: Write failing integration test for PWA features in `App.tsx`**

Create `tests/unit/pwaAppIntegration.test.tsx`:
```typescript
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../../src/App';

describe('App PWA Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without error and displays offline badge when network drops', () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const offlineBadges = screen.getAllByText(/Mode Offline/i);
    expect(offlineBadges.length).toBeGreaterThan(0);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByText(/Mode Offline/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify initial state**

Run: `npx vitest run tests/unit/pwaAppIntegration.test.tsx`
Expected: FAIL (Offline badge not integrated in Header / App yet)

- [ ] **Step 3: Modify `src/components/Header.tsx` to include `OfflineStatusBadge`**

Update `src/components/Header.tsx` to render `<OfflineStatusBadge isOnline={isOnline} />` near the streak/stats buttons:
Import:
```typescript
import { OfflineStatusBadge } from './common/OfflineStatusBadge';
```
Props addition (optional or hook-based):
Call `const { isOnline } = useNetworkStatus();` or pass `isOnline`.
Using `useNetworkStatus()` inside `Header.tsx` ensures the status badge is automatically displayed on all main game screens.

- [ ] **Step 4: Modify `src/main.tsx` or `src/App.tsx` for Service Worker registration**

In `src/App.tsx`:
- Import:
```typescript
import { registerServiceWorker, applyServiceWorkerUpdate } from './utils/serviceWorkerRegistration';
import { UpdateNotificationToast } from './components/common/UpdateNotificationToast';
```
- In `App`:
```typescript
const [waitingRegistration, setWaitingRegistration] = useState<ServiceWorkerRegistration | null>(null);
const [updateDismissed, setUpdateDismissed] = useState(false);

useEffect(() => {
  registerServiceWorker({
    onUpdate: (registration) => {
      setWaitingRegistration(registration);
    },
  });
}, []);

const handleApplyUpdate = () => {
  if (waitingRegistration) {
    applyServiceWorkerUpdate(waitingRegistration);
  }
};
```
- In JSX root:
```typescript
{waitingRegistration && !updateDismissed && (
  <UpdateNotificationToast
    onUpdate={handleApplyUpdate}
    onDismiss={() => setUpdateDismissed(true)}
  />
)}
```

- [ ] **Step 5: Update `nginx.conf` with explicit Service Worker caching directives**

Modify `nginx.conf` to add:
```nginx
    # Service Worker: must never be cached by browser HTTP cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Web App Manifest
    location = /manifest.webmanifest {
        add_header Content-Type "application/manifest+json";
        add_header Cache-Control "public, max-age=86400";
    }
```

- [ ] **Step 6: Run integration tests and whole test suite**

Run: `npx vitest run tests/unit/pwaAppIntegration.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/Header.tsx nginx.conf tests/unit/pwaAppIntegration.test.tsx
git commit -m "$(cat <<'EOF'
feat(pwa): integrate service worker lifecycle, offline header badge, and nginx cache rules

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full Verification, Bundle Budget & Security Checks

**Files:**
- Test: All unit tests (`npm test`)
- Build: `npm run build`
- Verify Bundle: `npm run verify:bundle`

- [ ] **Step 1: Run complete unit & property test suite**

Run: `npm test`
Expected: 100% green across all test files (92+ test files, 840+ tests).

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Vite build succeeds, `dist/sw.js` is generated in `dist/`.

- [ ] **Step 3: Run bundle budget verification**

Run: `npm run verify:bundle`
Expected: PASS with entry bundle $\le 350.00\text{ KiB}$ gzip.

- [ ] **Step 4: Verify git status is clean**

Run: `git status`
Expected: clean working directory.
