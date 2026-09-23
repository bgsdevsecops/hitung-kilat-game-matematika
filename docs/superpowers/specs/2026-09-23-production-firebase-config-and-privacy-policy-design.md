# Production Firebase Runtime Configuration & Privacy Policy Design

## 1. Executive Summary

This specification addresses two production-readiness requirements for **Hitung Kilat - Web Math Speed Game**:
1. **Zero-Secret Production Firebase Runtime Configuration**: A secure mechanism to decouple production Firebase credentials from the source code repository and Vite build artifacts, allowing production credentials to be injected at container runtime via Kubernetes Secrets without rebuilding images.
2. **Dedicated Privacy Policy Page & Universal Client Routing**: A comprehensive, COPPA-compliant, and Google OAuth2-verification-compliant Privacy Policy accessible via direct URL (`/privacy-policy`) in local and production environments, as well as via internal in-game navigation (Footer & Settings).

---

## 2. Problem Statement & Constraints

- **Git Secret Exclusion**: Production Firebase credentials must never be committed to git or baked into publicly distributable images.
- **Client-Side SPA Architecture**: The application is an SPA served by Nginx. Traditional runtime `process.env` does not exist in browser execution contexts.
- **Google OAuth2 Verification Requirement**: Google requires a publicly accessible, verifiable Privacy Policy URL that explicitly states how user data (Google profile & email) is used, stored, protected, and deleted, complying with the *Google API Services User Data Policy (Limited Use)*.
- **Developer Contact**: Developer and administrative contact for privacy inquiries must be explicitly listed as `webmaster@k8s.web.id`.
- **Bundle Size Budget**: The application enforces a strict gzip bundle size budget ($\le 350\text{ KiB}$). The Privacy Policy screen must be dynamically loaded via code-splitting (`React.lazy`).

---

## 3. Architecture & Technical Design

### 3.1 Firebase Runtime Configuration Injection

#### Dynamic Configuration Loader (`src/lib/firebaseConfigLoader.ts`)
We introduce a loader interface to retrieve Firebase credentials hierarchically:
```typescript
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
```

#### Hierarchy of Resolution:
1. `window.__FIREBASE_CONFIG__` (injected via `/firebase-config.js` generated at container startup).
2. Fallback: local `firebase-applet-config.json` (testing configuration included for local development and unit tests).

#### Container Runtime Injection (`docker-entrypoint.d/40-firebase-config.sh`):
The Nginx base image automatically executes shell scripts located in `/docker-entrypoint.d/` prior to starting Nginx:
```bash
#!/bin/sh
set -e

# Target file in web root
CONFIG_FILE="/usr/share/nginx/html/firebase-config.js"

if [ -n "$FIREBASE_CONFIG_JSON" ]; then
  echo "window.__FIREBASE_CONFIG__ = $FIREBASE_CONFIG_JSON;" > "$CONFIG_FILE"
  echo "[entrypoint] Injected production Firebase runtime configuration."
else
  # Empty stub if no production env var is provided
  echo "// Default local fallback" > "$CONFIG_FILE"
  echo "[entrypoint] No FIREBASE_CONFIG_JSON specified, falling back to bundled test config."
fi
```

#### HTML Integration (`index.html`):
```html
<!-- Runtime configuration script injected by container (optional, fails gracefully) -->
<script src="/firebase-config.js"></script>
```

#### Kubernetes Secret Configuration Guide (Where to Put Production Info):
1. **Create Kubernetes Secret**:
   ```bash
   kubectl create secret generic hitung-kilat-firebase-prod \
     --from-literal=FIREBASE_CONFIG_JSON='{"projectId":"PROD_PROJECT_ID","apiKey":"PROD_API_KEY","authDomain":"PROD_AUTH_DOMAIN","firestoreDatabaseId":"PROD_DATABASE_ID","storageBucket":"PROD_STORAGE_BUCKET","messagingSenderId":"PROD_SENDER_ID","appId":"PROD_APP_ID"}' \
     -n hitung-kilat
   ```
2. **Reference Secret in Helm Values** (`values-hitung-kilat-web-prod.yaml`):
   ```yaml
   env:
     - name: FIREBASE_CONFIG_JSON
       valueFrom:
         secretKeyRef:
           name: hitung-kilat-firebase-prod
           key: FIREBASE_CONFIG_JSON
   ```

---

### 3.2 Privacy Policy Page & Routing

#### Universal Client-Side Routing (`src/App.tsx`):
Instead of adding heavy external routing dependencies, `src/App.tsx` natively handles the URL pathname:
- Inspects `window.location.pathname`:
  - When pathname matches `/privacy-policy` or `/privacy`, the view state is set to `'privacy_policy'`.
  - When pathname is `/` or empty, normal game view is rendered.
- Listens to `popstate` events to allow browser Back/Forward navigation.
- Provides a helper `navigateTo(path: string)` utilizing `window.history.pushState(null, '', path)` to switch smoothly without a full page reload.

#### Navigation Links:
- **Game Footer**: Added clickable link `"Kebijakan Privasi"` navigating to `/privacy-policy`.
- **Settings Modal (`SettingsModal.tsx`)**: Added button `"Baca Kebijakan Privasi"` opening the screen.
- **Privacy Policy Screen**: Displays a sticky/prominent `"Kembali ke Permainan"` (Back to Game) button navigating to `/`.

#### Privacy Policy Content Structure (`src/components/privacy/PrivacyPolicyScreen.tsx`):
1. **Identitas Layanan & Pengembang (Service Identity & Developer Contact)**:
   - Aplikasi: *Hitung Kilat - Web Math Speed Game* (`https://hitung-kilat.k8s.web.id`)
   - Pengembang & Penanggung Jawab Privasi: *Hitung Kilat Team*
   - Kontak Email Resmi: `webmaster@k8s.web.id`
2. **Data yang Dikumpulkan (Data Collection)**:
   - Akun Google (Google OAuth2): ID Pengguna Google (UID), Nama Profil, Alamat Email.
   - Progres Permainan: Skor, bintang level, akurasi, waktu bermain, streak harian, dan riwayat tantangan harian.
   - Pengaturan Pengguna: Suara, pseudonym leaderboard, bendera wilayah, dan preferensi privasi.
3. **Tujuan Penggunaan Data (Data Usage Purpose)**:
   - Menyimpan progres pemain secara sinkron antar perangkat (Cloud Sync).
   - Menghitung akurasi dan statistik personal pemain.
   - Menampilkan papan peringkat publik dengan nama samaran (pseudonym).
4. **Google API Limited Use Disclosure (Kepatuhan Wajib Google OAuth)**:
   - Pernyataan tegas: *"Aplikasi Hitung Kilat mematuhi Kebijakan Data Pengguna Layanan Google API (Google API Services User Data Policy), termasuk ketentuan Penggunaan Terbatas (Limited Use). Data pengguna yang diperoleh dari Google OAuth2 tidak pernah dialihkan ke pihak ketiga, tidak pernah digunakan untuk periklanan, dan tidak pernah digunakan untuk pelatihan model kecerdasan buatan tanpa persetujuan eksplisit."*
5. **Privasi Anak & Kepatuhan Perlindungan Usia (COPPA / GDPR-K)**:
   - Fitur Guest Mode penuh: anak dapat bermain tanpa login Google.
   - Pemain berusia di bawah 13 tahun (*under 13*) dilarang dari papan peringkat publik.
   - Papan peringkat publik hanya memakai pseudonym hasil moderasi mandiri, tidak menampilkan nama asli akun Google.
6. **Keamanan & Lokasi Penyimpanan Data**:
   - Disimpan pada infrastruktur Google Cloud Firestore dengan enkripsi HTTPS (TLS) saat transit dan enkripsi at rest.
7. **Hak Pengguna & Penghapusan Data (User Rights & Data Deletion)**:
   - Ekspor Data Mandiri: Tombol unduh JSON data pemain di menu Pengaturan.
   - Penghapusan Akun Mandiri 2-Langkah: Fitur di menu Pengaturan yang menghapus dokumen pengguna di Firestore secara permanen.
   - Permohonan Manual: Pengguna dapat mengajukan permohonan penghapusan manual melalui email ke `webmaster@k8s.web.id`.

---

## 4. Test Strategy

1. **Unit Testing (`tests/unit/firebaseConfigLoader.test.ts`)**:
   - Verifies fallback to `firebase-applet-config.json` when `window.__FIREBASE_CONFIG__` is undefined.
   - Verifies precedence of `window.__FIREBASE_CONFIG__` when populated.
   - Verifies databaseId and credential handling.
2. **Unit Testing (`tests/unit/privacyPolicyScreen.test.tsx`)**:
   - Verifies rendering of developer contact `webmaster@k8s.web.id`.
   - Verifies Google OAuth2 Limited Use disclosure text presence.
   - Verifies COPPA and child safety disclosure presence.
   - Verifies back-to-game navigation callback invocation.
3. **Integration & Routing Testing (`tests/unit/appRouting.test.tsx`)**:
   - Verifies navigating to `/privacy-policy` displays `PrivacyPolicyScreen`.
   - Verifies back navigation restores game campaign map.
4. **Bundle Budget Verification**:
   - Ensure dynamic chunk splitting maintains `dist` gzip under 350 KiB.

---

## 5. Deployment & Release Safety

- Strict adherence to the deployment authorization rule: all features will be committed and merged to `main` locally without issuing push or deploy commands until explicitly commanded by the user.
