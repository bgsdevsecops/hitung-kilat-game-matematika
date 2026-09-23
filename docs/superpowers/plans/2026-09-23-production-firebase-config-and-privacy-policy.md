# Production Firebase Runtime Configuration & Privacy Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement zero-secret production Firebase runtime configuration injection via Kubernetes container entrypoint and a COPPA/Google-OAuth2-compliant Privacy Policy page with universal URL routing (`/privacy-policy`).

**Architecture:** A TypeScript runtime configuration loader (`src/lib/firebaseConfigLoader.ts`) resolves credentials from `window.__FIREBASE_CONFIG__` with a seamless fallback to bundled test configuration. An Nginx container entrypoint script (`/docker-entrypoint.d/40-firebase-config.sh`) dynamically writes `firebase-config.js` from the `FIREBASE_CONFIG_JSON` environment variable injected by Kubernetes Secrets. Universal client-side routing in `src/App.tsx` handles browser path navigation for `/privacy-policy` without adding external router dependencies, rendering a code-split `PrivacyPolicyScreen` with developer contact `webmaster@k8s.web.id` and Google Limited Use disclosures.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Tailwind CSS, Docker (Nginx Alpine).

**Spec:** `docs/superpowers/specs/2026-09-23-production-firebase-config-and-privacy-policy-design.md`

## Global Constraints

- **Strict Deployment Authorization**: Never execute Docker build/push to registry or Helm Kubernetes deployment until feature is finished, merged to `main`, and explicitly requested by the user (`feedback-deployment-order`).
- **Gzip Bundle Size Budget**: Maximum entry bundle gzip size $\le 350\text{ KiB}$. All new screens must be dynamically imported via `React.lazy`.
- **Developer Contact**: Developer contact email must strictly be `webmaster@k8s.web.id`.
- **Google OAuth2 Limited Use**: Privacy Policy must contain verbatim compliance statements for *Google API Services User Data Policy*.
- **Zero Secrets in Git**: No production Firebase API keys or database IDs committed to git.

## Review Focus

1. **Missing or Malformed `window.__FIREBASE_CONFIG__`**: When `window.__FIREBASE_CONFIG__` is undefined, null, or missing required fields, `getFirebaseConfig()` must gracefully fall back to local test configuration without throwing runtime errors.
2. **Container Startup with Empty `$FIREBASE_CONFIG_JSON`**: When the container boots in local dev without the environment variable set, `40-firebase-config.sh` must write a valid no-op script instead of failing or creating a broken JS file.
3. **Browser Direct Navigation & Refresh on Sub-paths**: Directly opening `https://hitung-kilat.k8s.web.id/privacy-policy` or reloading the page on that route must correctly mount `PrivacyPolicyScreen` on the initial render without flash of incorrect screen.
4. **Browser Back/Forward (`popstate`) History**: Clicking browser Back from `/privacy-policy` to `/` must transition the view back to the main game map without requiring a page reload.
5. **Screen Accessibility & Responsive Layout**: The Privacy Policy screen must support full keyboard navigation, screen reader headings (`h1`, `h2`, `h3`), and legible mobile layout down to 320px viewport width.

---

### Task 1: Firebase Runtime Configuration Loader & Unit Tests

**Files:**
- Create: `src/lib/firebaseConfigLoader.ts`
- Modify: `src/lib/firebase.ts:41-58`
- Test: `tests/unit/firebaseConfigLoader.test.ts`

**Interfaces:**
- Consumes: `firebase-applet-config.json` (testing config)
- Produces: `getFirebaseConfig(): FirebaseAppletConfig`, `FirebaseAppletConfig` interface

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/firebaseConfigLoader.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFirebaseConfig, FirebaseAppletConfig } from '../../src/lib/firebaseConfigLoader';
import fallbackConfig from '../../firebase-applet-config.json';

describe('firebaseConfigLoader', () => {
  const originalWindowConfig = window.__FIREBASE_CONFIG__;

  beforeEach(() => {
    delete (window as any).__FIREBASE_CONFIG__;
  });

  afterEach(() => {
    (window as any).__FIREBASE_CONFIG__ = originalWindowConfig;
  });

  it('falls back to local firebase-applet-config.json when window.__FIREBASE_CONFIG__ is undefined', () => {
    const config = getFirebaseConfig();
    expect(config.projectId).toBe(fallbackConfig.projectId);
    expect(config.appId).toBe(fallbackConfig.appId);
    expect(config.apiKey).toBe(fallbackConfig.apiKey);
  });

  it('uses window.__FIREBASE_CONFIG__ when provided', () => {
    const mockProdConfig: FirebaseAppletConfig = {
      projectId: 'prod-hitung-kilat-app',
      appId: '1:123456789:web:abcdef123456',
      apiKey: 'AIzaSyPROD_MOCK_KEY_999999',
      authDomain: 'prod-hitung-kilat-app.firebaseapp.com',
      firestoreDatabaseId: 'prod-db-hitung-kilat',
      storageBucket: 'prod-hitung-kilat-app.firebasestorage.app',
      messagingSenderId: '123456789',
    };

    (window as any).__FIREBASE_CONFIG__ = mockProdConfig;

    const config = getFirebaseConfig();
    expect(config.projectId).toBe('prod-hitung-kilat-app');
    expect(config.apiKey).toBe('AIzaSyPROD_MOCK_KEY_999999');
    expect(config.firestoreDatabaseId).toBe('prod-db-hitung-kilat');
  });

  it('falls back to local config if window.__FIREBASE_CONFIG__ is empty or lacks projectId', () => {
    (window as any).__FIREBASE_CONFIG__ = {} as any;
    const config = getFirebaseConfig();
    expect(config.projectId).toBe(fallbackConfig.projectId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/firebaseConfigLoader.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/firebaseConfigLoader'"

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/firebaseConfigLoader.ts`:
```typescript
/**
 * Firebase Runtime Configuration Loader
 * Decouples production credentials from repository artifacts.
 */
import fallbackConfig from '../../firebase-applet-config.json';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseAppletConfig;
  }
}

/**
 * Retrieves the effective Firebase configuration.
 * Prioritizes window.__FIREBASE_CONFIG__ (injected at runtime in production container).
 * Falls back to local firebase-applet-config.json for local development and testing.
 */
export function getFirebaseConfig(): FirebaseAppletConfig {
  if (
    typeof window !== 'undefined' &&
    window.__FIREBASE_CONFIG__ &&
    typeof window.__FIREBASE_CONFIG__.projectId === 'string' &&
    window.__FIREBASE_CONFIG__.projectId.trim().length > 0
  ) {
    return window.__FIREBASE_CONFIG__;
  }

  return fallbackConfig as FirebaseAppletConfig;
}
```

Update `src/lib/firebase.ts:41-58`:
Replace line 41:
```typescript
import { getFirebaseConfig } from './firebaseConfigLoader';

const firebaseConfigRaw = getFirebaseConfig();

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfigRaw) : getApp();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/firebaseConfigLoader.test.ts`
Expected: PASS with 3/3 tests passing.

- [ ] **Step 5: Run existing firebase-dependent tests**

Run: `npx vitest run tests/unit/appCloudSyncIntegration.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit changes**

```bash
git add src/lib/firebaseConfigLoader.ts src/lib/firebase.ts tests/unit/firebaseConfigLoader.test.ts
git commit -m "feat(firebase): add runtime config loader for zero-secret production injection

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Container Entrypoint Runtime Injection & Kubernetes Setup

**Files:**
- Create: `docker-entrypoint.d/40-firebase-config.sh`
- Modify: `Dockerfile:27-35`
- Modify: `index.html:15-18`
- Modify: `values-hitung-kilat-web-prod.yaml:48-52`
- Test: `tests/unit/entrypointScript.test.ts`

**Interfaces:**
- Consumes: Environment variable `FIREBASE_CONFIG_JSON`
- Produces: `/usr/share/nginx/html/firebase-config.js` (`window.__FIREBASE_CONFIG__ = ...`)

- [ ] **Step 1: Write test verifying entrypoint shell script behavior**

Create `tests/unit/entrypointScript.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('docker-entrypoint script', () => {
  const scriptPath = path.resolve(__dirname, '../../docker-entrypoint.d/40-firebase-config.sh');
  const tempOutputDir = path.resolve(__dirname, '../../.tmp-test-entrypoint');
  const tempOutputFile = path.join(tempOutputDir, 'firebase-config.js');

  beforeEach(() => {
    fs.mkdirSync(tempOutputDir, { recursive: true });
    if (fs.existsSync(tempOutputFile)) {
      fs.unlinkSync(tempOutputFile);
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempOutputDir)) {
      fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
  });

  it('generates fallback dummy config when FIREBASE_CONFIG_JSON is unset', () => {
    execSync(`TARGET_CONFIG_FILE="${tempOutputFile}" sh "${scriptPath}"`, {
      env: { ...process.env, FIREBASE_CONFIG_JSON: '' },
    });

    expect(fs.existsSync(tempOutputFile)).toBe(true);
    const content = fs.readFileSync(tempOutputFile, 'utf8');
    expect(content).toContain('// Default local fallback');
  });

  it('injects window.__FIREBASE_CONFIG__ when FIREBASE_CONFIG_JSON is provided', () => {
    const mockJson = JSON.stringify({ projectId: 'k8s-prod-project', apiKey: 'SECRET123' });
    execSync(`TARGET_CONFIG_FILE="${tempOutputFile}" sh "${scriptPath}"`, {
      env: { ...process.env, FIREBASE_CONFIG_JSON: mockJson },
    });

    expect(fs.existsSync(tempOutputFile)).toBe(true);
    const content = fs.readFileSync(tempOutputFile, 'utf8');
    expect(content).toContain('window.__FIREBASE_CONFIG__ = {"projectId":"k8s-prod-project","apiKey":"SECRET123"};');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/entrypointScript.test.ts`
Expected: FAIL because `40-firebase-config.sh` does not exist yet.

- [ ] **Step 3: Create entrypoint script and update Dockerfile & index.html**

Create `docker-entrypoint.d/40-firebase-config.sh`:
```bash
#!/bin/sh
set -e

# Target output file (allows override for testing)
CONFIG_FILE="${TARGET_CONFIG_FILE:-/usr/share/nginx/html/firebase-config.js}"

if [ -n "$FIREBASE_CONFIG_JSON" ]; then
  echo "window.__FIREBASE_CONFIG__ = $FIREBASE_CONFIG_JSON;" > "$CONFIG_FILE"
  echo "[entrypoint] Injected production Firebase runtime configuration into $CONFIG_FILE"
else
  echo "// Default local fallback" > "$CONFIG_FILE"
  echo "[entrypoint] No FIREBASE_CONFIG_JSON specified; using default bundled configuration."
fi
```
Set executable permission: `chmod +x docker-entrypoint.d/40-firebase-config.sh`.

Update `Dockerfile`:
```dockerfile
# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy container entrypoint hooks
COPY docker-entrypoint.d/ /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/*.sh
```

Update `index.html`:
Insert before line 18 (`<script type="module" src="/src/main.tsx"></script>`):
```html
    <!-- Runtime configuration script injected by container (optional fallback) -->
    <script src="/firebase-config.js"></script>
```

Update `values-hitung-kilat-web-prod.yaml`:
Add commented instructions at line 48 under `envFrom`:
```yaml
# To inject production Firebase credentials securely without committing them to git:
# 1. Create a secret:
#    kubectl create secret generic hitung-kilat-firebase-prod \
#      --from-literal=FIREBASE_CONFIG_JSON='{"projectId":"...","apiKey":"...","authDomain":"...","firestoreDatabaseId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}' \
#      -n hitung-kilat
# 2. Reference the secret below:
# envFrom:
#   - secretRef:
#       name: hitung-kilat-firebase-prod
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/entrypointScript.test.ts`
Expected: PASS with 2/2 tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add docker-entrypoint.d/40-firebase-config.sh Dockerfile index.html values-hitung-kilat-web-prod.yaml tests/unit/entrypointScript.test.ts
git commit -m "feat(deploy): add container entrypoint for production firebase runtime config

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Privacy Policy Screen Component & Unit Tests

**Files:**
- Create: `src/components/privacy/PrivacyPolicyScreen.tsx`
- Test: `tests/unit/privacyPolicyScreen.test.tsx`

**Interfaces:**
- Consumes: `{ onBack: () => void }`
- Produces: `PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps>`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/privacyPolicyScreen.test.tsx`:
```typescript
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyPolicyScreen } from '../../src/components/privacy/PrivacyPolicyScreen';

describe('PrivacyPolicyScreen', () => {
  it('renders official developer contact webmaster@k8s.web.id', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    const contactLinks = screen.getAllByRole('link', { name: /webmaster@k8s\.web\.id/i });
    expect(contactLinks.length).toBeGreaterThan(0);
    expect(contactLinks[0].getAttribute('href')).toBe('mailto:webmaster@k8s.web.id');
  });

  it('renders Google OAuth2 Limited Use disclosure', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Google API Services User Data Policy/i)).toBeInTheDocument();
    expect(screen.getByText(/Limited Use/i)).toBeInTheDocument();
  });

  it('renders COPPA and child protection safeguards', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Perlindungan Anak & Privasi Usia \(COPPA \/ GDPR-K\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Guest Mode/i)).toBeInTheDocument();
  });

  it('invokes onBack callback when clicking back to game button', () => {
    const onBackMock = vi.fn();
    render(<PrivacyPolicyScreen onBack={onBackMock} />);
    const backBtn = screen.getByRole('button', { name: /Kembali ke Permainan/i });
    fireEvent.click(backBtn);
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/privacyPolicyScreen.test.tsx`
Expected: FAIL with "Cannot find module '../../src/components/privacy/PrivacyPolicyScreen'"

- [ ] **Step 3: Implement `PrivacyPolicyScreen.tsx`**

Create `src/components/privacy/PrivacyPolicyScreen.tsx`:
Implement full bilingual / Indonesian primary with explicit English Google compliance statements, structured with glassmorphism dark theme, semantic headings, and accessibility attributes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/privacyPolicyScreen.test.tsx`
Expected: PASS with 4/4 tests passing.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/privacy/PrivacyPolicyScreen.tsx tests/unit/privacyPolicyScreen.test.tsx
git commit -m "feat(privacy): create COPPA and Google OAuth2 compliant PrivacyPolicyScreen

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Universal Client Routing & In-Game Navigation Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/privacy/SettingsModal.tsx`
- Test: `tests/unit/privacyRoutingIntegration.test.tsx`

**Interfaces:**
- Consumes: `window.location.pathname`, `window.history.pushState`, `popstate`
- Produces: Seamless URL routing for `/privacy-policy` and `/privacy`

- [ ] **Step 1: Write integration tests for routing**

Create `tests/unit/privacyRoutingIntegration.test.tsx`:
```typescript
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

describe('Privacy Routing Integration', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  afterEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('renders PrivacyPolicyScreen directly when starting at /privacy-policy', async () => {
    window.history.pushState(null, '', '/privacy-policy');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('navigates back to game and updates URL to / when clicking back from PrivacyPolicyScreen', async () => {
    window.history.pushState(null, '', '/privacy-policy');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kembali ke Permainan/i })).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /Kembali ke Permainan/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('navigates to /privacy-policy when clicking footer link', async () => {
    render(<App />);

    const footerLink = await screen.findByRole('button', { name: /Kebijakan Privasi/i });
    fireEvent.click(footerLink);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/privacy-policy');
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/privacyRoutingIntegration.test.tsx`
Expected: FAIL because `/privacy-policy` routing is not yet handled in `App.tsx`.

- [ ] **Step 3: Update `src/App.tsx` and `SettingsModal.tsx`**

- In `src/App.tsx`:
  - Dynamically load `PrivacyPolicyScreen` via `React.lazy`.
  - Maintain `currentRoute` state initialized from `window.location.pathname`.
  - Handle `popstate` event to sync `currentRoute`.
  - When `currentRoute === '/privacy-policy'` or `currentRoute === '/privacy'`, render `<PrivacyPolicyScreen onBack={() => handleNavigate('/')} />`.
  - Add footer link for "Kebijakan Privasi".
  - Wire `onOpenPrivacyPolicy` handler down to `SettingsModal`.
- In `src/components/privacy/SettingsModal.tsx`:
  - Add "Kebijakan Privasi" button that triggers `onOpenPrivacyPolicy`.

- [ ] **Step 4: Run integration test to verify it passes**

Run: `npx vitest run tests/unit/privacyRoutingIntegration.test.tsx`
Expected: PASS with 3/3 tests passing.

- [ ] **Step 5: Run full project test suite**

Run: `npm test`
Expected: PASS across all 86 test files.

- [ ] **Step 6: Verify bundle size budget and build**

Run: `npm run build && npm run verify:bundle`
Expected: Build passes with exit code 0 and bundle size within $\le 350\text{ KiB}$ limit.

- [ ] **Step 7: Commit changes**

```bash
git add src/App.tsx src/components/privacy/SettingsModal.tsx tests/unit/privacyRoutingIntegration.test.tsx
git commit -m "feat(routing): integrate universal /privacy-policy routing and in-game navigation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
