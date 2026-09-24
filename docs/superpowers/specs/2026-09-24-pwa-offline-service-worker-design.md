# PWA Service Worker Offline Caching & Update Management Design

## 1. Executive Summary

This specification outlines the architecture for the **Progressive Web App (PWA) Offline Caching and Update Management** in **Hitung Kilat - Web Math Speed Game**:
1. **Lightweight Native Service Worker (`public/sw.js`)**: A zero-dependency, vanilla Service Worker providing instant cache-first loading for hashed assets and network-first navigation with offline fallback to `/index.html` for local single-page application (SPA) routing.
2. **Network Exclusions**: Strict network-only bypass for Kubernetes runtime config injection (`/firebase-config.js`), container healthchecks (`/actuator`), and Firestore/Google Auth APIs.
3. **Friendly Update Lifecycle**: Smooth background update detection with an unobtrusive in-app notification toast allowing players to update without disrupting ongoing math games.
4. **Offline Resilience**: Offline indicators and continuous local gameplay for 72 Campaign levels and practice modes.

---

## 2. Problem Statement & Constraints

- **Offline Playability**: PRD §6.3, §15.6, and §24 require local campaign progression, star rating, and practice modes to function seamlessly when users are offline or on intermittent connectivity.
- **Runtime Kubernetes Config Injection**: Production credentials are dynamically written to `/firebase-config.js` at container boot. The Service Worker must **never** cache `/firebase-config.js` or `/actuator`.
- **Zero New Dependencies**: Avoid heavy libraries like `workbox` or `vite-plugin-pwa` to prevent increasing `package.json` complexity and maintain strict bundle budget compliance ($\le 350\text{ KiB}$ gzip).
- **Non-Disruptive Updates**: Immediate worker takeover (`skipWaiting` on install) can cause active game sessions (like a 60-second sprint or boss fight) to reload or fail chunk loads unexpectedly. Updates must be user-prompted or gracefully staged.
- **Nginx Cache Directives**: Service Worker file `sw.js` must never be cached by the browser's HTTP cache so clients always discover new app deployments on launch.

---

## 3. Architecture & Technical Design

### 3.1 Service Worker Caching Architecture (`public/sw.js`)

A native Service Worker script located in `public/sw.js` (copied directly to `dist/sw.js` by Vite):

```javascript
const CACHE_NAME = 'hitung-kilat-v2-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];
```

#### Lifecycle Hooks:
1. **`install` event**:
   - Pre-caches `PRECACHE_URLS`.
   - Does **not** call `self.skipWaiting()` automatically; waits until the user initiates an update via UI.
2. **`activate` event**:
   - Iterates through `caches.keys()`.
   - Deletes any outdated caches not matching current `CACHE_NAME`.
   - Calls `self.clients.claim()` to start controlling existing uncontrolled clients.
3. **`message` event**:
   - Listens for `{ type: 'SKIP_WAITING' }`.
   - Executes `self.skipWaiting()` when received from client.

#### Fetch Interception Strategy:
1. **Method Check**: Only `GET` requests are intercepted; non-GET requests bypass the worker.
2. **Origin Check**: Only same-origin requests are handled. Third-party requests (Google Fonts, Firebase APIs, Auth endpoints) pass directly to network.
3. **Network-Only Endpoints**:
   - URL path is `/firebase-config.js` or `/actuator` $\rightarrow$ `fetch(event.request)` directly, no cache read or write.
4. **SPA Navigation Requests (`request.mode === 'navigate'`)**:
   - **Network-First**: Try `fetch(event.request)`.
   - If network succeeds, optionally cache a clone of the response for `/index.html`.
   - If network fails (offline), return cached `/index.html`.
5. **Hashed Static Assets (`/assets/*`)**:
   - **Cache-First**: Check `caches.match(event.request)`.
   - If found in cache, return immediately.
   - If not found, fetch from network, store a clone in `CACHE_NAME`, and return response.
6. **Other Local Assets (`/favicon.svg`, `/manifest.webmanifest`, images)**:
   - **Stale-While-Revalidate** or **Cache-First** with background update.

---

### 3.2 Registration & Lifecycle Manager (`src/utils/serviceWorkerRegistration.ts`)

A utility module providing clean lifecycle management for the frontend app:

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

#### Detailed Flow:
1. **Registration Guard**: Checks `typeof window !== 'undefined' && 'serviceWorker' in navigator`. Runs on window load.
2. **Update Listener**:
   - Subscribes to `registration.onupdatefound`.
   - Tracks the installing worker (`const installingWorker = registration.installing`).
   - Listens to `installingWorker.onstatechange`:
     - When `state === 'installed'`:
       - If `navigator.serviceWorker.controller` exists: new version available $\rightarrow$ trigger `config.onUpdate(registration)`.
       - Else: content cached for offline use $\rightarrow$ trigger `config.onSuccess(registration)`.
3. **Applying Update**:
   - Function `applyServiceWorkerUpdate(registration)` sends `{ type: 'SKIP_WAITING' }` to `registration.waiting`.
   - Listens for `navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())`.

---

### 3.3 UI Components

#### Update Notification Toast (`src/components/common/UpdateNotificationToast.tsx`)
- Displayed when `hasUpdate === true`.
- Placed non-intrusively in a fixed bottom corner or floating banner with `z-50`.
- Includes:
  - Sparkle / Refresh icon.
  - Text: *"Versi Baru Tersedia! Perbarui untuk mendapatkan fitur dan konten matematika terbaru."*
  - Action buttons:
    - **[Perbarui Sekarang]**: Triggers `applyServiceWorkerUpdate()`.
    - **[Nanti]**: Dismisses the banner for the current session.

#### Offline Status Banner / Indicator
- An indicator integrated in `App.tsx` or `Header.tsx` listening to `window.addEventListener('online')` and `window.addEventListener('offline')`.
- Displays a subtle badge/pill: *"Mode Offline"* when offline, reassuring the player that all progress and 72 campaign levels are saved locally.

---

### 3.4 Web Server Configuration (`nginx.conf`)

Add explicit caching headers to `nginx.conf`:

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

---

## 4. Test Strategy

1. **Unit Testing Registration Manager (`tests/unit/serviceWorkerRegistration.test.ts`)**:
   - Verify `registerServiceWorker` handles browser support gracefully.
   - Verify registration triggers `onSuccess` on first install.
   - Verify `onUpdate` is called when a waiting worker is detected.
   - Verify `applyServiceWorkerUpdate` posts `SKIP_WAITING` message and triggers reload on `controllerchange`.

2. **Unit Testing Update Notification Toast (`tests/unit/updateNotificationToast.test.tsx`)**:
   - Verify toast renders update text and buttons when active.
   - Verify clicking "Perbarui Sekarang" invokes the update handler.
   - Verify clicking "Nanti" calls the dismiss callback.

3. **Service Worker Logic Testing (`tests/unit/serviceWorkerLogic.test.ts`)**:
   - Test request classification (navigation vs static asset vs network-only).
   - Test that `/firebase-config.js` and `/actuator` return `network-only`.
   - Test cache deletion during `activate` event.

4. **Bundle Budget & Build Verification**:
   - `npm run build` generates `dist/sw.js` and valid asset output.
   - `npm run verify:bundle` asserts gzip entry size $\le 350.00\text{ KiB}$.

---

## 5. Security & Safety

- **No Secret Caching**: Production credentials from `/firebase-config.js` are never written to the Cache Storage.
- **No Infinite Reload Loops**: Reload on `controllerchange` is guarded with a single-shot flag (`let refreshing = false`).
- **Graceful Degradation**: If Service Worker is unsupported or fails to register (e.g. private window or restrictive environment), the app continues normal web functioning without throwing uncaught errors.
