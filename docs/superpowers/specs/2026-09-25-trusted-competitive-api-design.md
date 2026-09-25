# Trusted Competitive API — Architecture Design Spec

> **Date:** 2026-09-25
> **Branch:** `feature/12.9.24.11-trusted-competitive-api`
> **Status:** Draft

---

## 1. Purpose

Build a self-hosted Node.js/Express backend (`hitung-kilat-api`) deployed on the existing Kubernetes cluster. This backend is the **single trusted authority** for competitive game sessions (Sprint 60s, Survival Kilat, Daily Challenge V2). It validates every competitive result server-side before writing to Firestore, replacing the current client-only simulation with a tamper-proof pipeline.

### What this spec does NOT cover

- Cloud Functions (not used; backend runs on Kubernetes).
- Changes to non-competitive features (Campaign, Adaptive Practice, Mastery).
- Migration of existing V1 Time Attack scores.
- Frontend UI changes beyond wiring fetch calls to new API endpoints.

---

## 2. Architecture Overview

```
Browser (React SPA)
  │
  │  Firebase Auth → ID Token
  │  POST/GET /api/...
  ▼
Gateway (APISIX)
  │
  ├── /api/*  → Service hitung-kilat-api:80 (Node.js/Express)
  └── /*      → Service hitung-kilat-web:80  (Nginx SPA)

hitung-kilat-api container:
  ├── Express HTTP server on port 3000
  ├── Firebase Admin SDK (verifyIdToken, Firestore writes)
  ├── Competitive domain engine (shared from src/engine/competitive/)
  └── Rate limiter + anti-replay middleware
```

### Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node.js 22 + Express + TypeScript | Same stack as frontend build tooling; shared domain engine |
| Auth | Firebase Authentication (ID tokens) | Already used by frontend; no new auth system |
| Database | Cloud Firestore via Admin SDK | Data stays in sync with frontend reads; existing rules block client writes |
| Deployment | Kubernetes (same cluster) | No new infrastructure cost; operational consistency |
| Helm | Separate release `hitung-kilat-api` using same chart `myindo:1.0.4` | Independent lifecycle from web; values isolation |
| Docker | Separate `server/Dockerfile` | Different base image (node:22-alpine, no nginx) |
| Docker Compose | Single `docker-compose.yml` with `web` + `api` services | Local development convenience |
| Domain engine | Symlinked or path-aliased from `src/engine/` | No code duplication; server and client use identical validation logic |
| Cloud Functions | Not used | Avoids Blaze billing requirement for Functions; leverages existing K8s |

---

## 3. Repository Structure

```
hitung-kilat-game-matematika/
├── src/                              # Frontend React app (existing)
│   └── engine/competitive/           # Shared domain engine
│       ├── types.ts
│       ├── validator.ts
│       ├── stateMachine.ts
│       ├── questionGenerator.ts
│       ├── scoring.ts
│       ├── crypto.ts
│       ├── projection.ts
│       └── modes/
│           ├── sprint.ts
│           ├── survival.ts
│           └── daily.ts
├── server/                           # NEW: Backend Express app
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                    # Express app setup
│       ├── server.ts                 # HTTP listener entrypoint
│       ├── config/
│       │   └── firebaseAdmin.ts      # Admin SDK initialization
│       ├── middleware/
│       │   ├── firebaseAuth.ts       # Token verification middleware
│       │   ├── rateLimiter.ts        # Per-UID rate limiting
│       │   └── errorHandler.ts       # Global error handler
│       ├── routes/
│       │   └── competitive.ts        # Route definitions
│       ├── controllers/
│       │   └── competitiveController.ts
│       ├── services/
│       │   ├── sessionService.ts     # Session lifecycle
│       │   ├── validationService.ts  # Wraps domain validator
│       │   └── leaderboardService.ts # Leaderboard CRUD
│       └── utils/
│           ├── idempotency.ts        # Idempotency key logic
│           └── logger.ts             # Structured JSON logger
├── Dockerfile                        # Frontend (existing, unchanged)
├── docker-compose.yml                # Updated: web + api services
├── values-hitung-kilat-web.yaml      # Existing
├── values-hitung-kilat-web-prod.yaml # Existing
├── values-hitung-kilat-api.yaml      # NEW
├── values-hitung-kilat-api-prod.yaml # NEW
└── hitung-kilat.sh                   # Updated: support TARGET=api|web
```

### Shared engine access

The backend `server/tsconfig.json` uses TypeScript path aliases to import from `../src/engine/competitive/` without duplicating code:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@engine/*": ["../src/engine/*"]
    },
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "../src/engine/**/*"]
}
```

Build output resolves these paths via `tsc-alias` or bundler (esbuild/tsup). The Docker build copies both `server/` and `src/engine/` into the build context.

---

## 4. API Contract

All endpoints are prefixed with `/api`. All mutating endpoints require a valid Firebase ID token in the `Authorization: Bearer <token>` header.

### 4.1. Health Check

```
GET /api/health
```

- **Auth:** None
- **Response:** `200 { "status": "ok", "timestamp": "<ISO>" }`
- **Purpose:** Kubernetes liveness/readiness probes

### 4.2. Create Competitive Session

```
POST /api/competitive/sessions
```

- **Auth:** Required (Firebase ID token)
- **Rate limit:** 5 requests per UID per minute
- **Request body:**

```json
{
  "mode": "sprint" | "survival" | "daily",
  "idempotencyKey": "string (UUID v4, max 64 chars)"
}
```

- **Server behavior:**
  1. Verify Firebase ID token → extract `uid`.
  2. Check idempotency: if `idempotencyKey` already used for this `uid`, return existing session.
  3. For `daily` mode: check if user already has a ranked result for today (WIB). If yes, create session with `isRanked: false`.
  4. Generate `sessionId` (server-side UUID).
  5. Compute `serverStartedAt = Date.now()`.
  6. Generate questions using `generateCompetitiveQuestions()` with server-side PRNG seed.
  7. For `daily` mode: seed derived from `generateDailyChallengeId(dateStr, contentVersion)` via `hashDailySeed()`.
  8. Create `CompetitiveSessionContract` via `createCompetitiveSession()`.
  9. Write session document to Firestore `competitiveSessions/{sessionId}`.
  10. Return session contract + question views (without server-side answers).

- **Response:** `201`

```json
{
  "session": {
    "sessionId": "string",
    "mode": "sprint",
    "rulesVersion": "2.0",
    "contentVersion": "72L-v1",
    "serverStartedAt": 1727200000000,
    "serverDeadlineAt": 1727200060000,
    "isRanked": true
  },
  "questions": [
    {
      "questionInstanceId": "string",
      "sequence": 1,
      "renderedPrompt": "12 + 7 = ?",
      "answerInputKind": "numeric",
      "questionToken": "tok_abc123_1"
    }
  ]
}
```

- **Error responses:**
  - `401` — Invalid or expired token
  - `429` — Rate limit exceeded
  - `400` — Invalid mode or missing idempotencyKey

### 4.3. Submit Session Answers

```
POST /api/competitive/sessions/:sessionId/submit
```

- **Auth:** Required
- **Rate limit:** 3 requests per session (idempotent)
- **Request body:**

```json
{
  "answers": [
    {
      "sequence": 1,
      "questionToken": "tok_abc123_1",
      "rawInput": "19",
      "clientAnsweredAt": 2500,
      "inputLatencyMs": 350,
      "idempotencyKey": "answer_uuid"
    }
  ],
  "clientFinalizedAt": 58000,
  "submissionIdempotencyKey": "submit_uuid"
}
```

- **Server behavior:**
  1. Verify token → extract `uid`.
  2. Load session from Firestore; verify `userId === uid` and `status === 'ACTIVE'`.
  3. Check submission idempotency: if already processed, return cached result.
  4. Set `serverTimestamps.finalizedAt = Date.now()`.
  5. Build `ValidationInput` from session, stored server questions, and submitted answers.
  6. Run `validateCompetitiveSession(input, secret)` using the shared domain engine.
  7. Write `CompetitiveResultDoc` to Firestore `competitiveResults/{resultId}`.
  8. If `leaderboardEligible === true`, write/update `leaderboardEntries/{entryId}`.
  9. Update session document status to `VALIDATED` or `REJECTED`.
  10. Return validation result.

- **Response:** `200`

```json
{
  "status": "VALIDATED",
  "result": {
    "resultId": "res_abc123",
    "score": 980,
    "accuracy": 100,
    "correctCount": 10,
    "wrongCount": 0,
    "questionsAnswered": 10,
    "rankedActiveDurationMs": 45200,
    "maxStreak": 10,
    "difficultyReached": 3,
    "isRanked": true
  },
  "leaderboardPosition": 3
}
```

- **Error responses:**
  - `401` — Invalid token
  - `403` — Session belongs to another user
  - `404` — Session not found
  - `409` — Session already finalized (non-idempotent mismatch)
  - `410` — Session expired (past deadline + grace)
  - `422` — Validation rejected (returns `rejectionReasons[]`)

### 4.4. Get Leaderboard

```
GET /api/competitive/leaderboard/:periodKey?mode=daily&limit=20&offset=0
```

- **Auth:** Optional (public read)
- **Rate limit:** 30 requests per IP per minute
- **Path param:** `periodKey` — e.g. `2026-09-25` for daily, `2026-W39` for weekly sprint
- **Query params:**
  - `mode` — `sprint` | `survival` | `daily` (required)
  - `limit` — 1–100, default 20
  - `offset` — pagination offset, default 0
- **Response:** `200`

```json
{
  "periodKey": "2026-09-25",
  "mode": "daily",
  "entries": [
    {
      "rank": 1,
      "pseudonym": "Harimau Cerdas",
      "score": 1200,
      "accuracy": 100,
      "correctCount": 10,
      "durationMs": 32000,
      "finalizedAt": 1727200060000
    }
  ],
  "total": 42
}
```

### 4.5. Get My Results

```
GET /api/competitive/results/me?mode=daily&limit=10&offset=0
```

- **Auth:** Required
- **Response:** `200` — Array of `CompetitiveResultDoc` for the authenticated user, newest first.

---

## 5. Firestore Schema

### 5.1. Collections

| Collection | Document ID | Written by | Read by |
|-----------|-------------|------------|---------|
| `competitiveSessions/{sessionId}` | Server-generated UUID | Backend only | Backend only |
| `competitiveResults/{resultId}` | `res_<hash>` | Backend only | Backend + client (own results via rules) |
| `leaderboardEntries/{entryId}` | `lb_<mode>_<periodKey>_<hash>` | Backend only | Anyone (public read via rules) |

### 5.2. Document Schemas

#### competitiveSessions

```typescript
{
  sessionId: string;          // UUID
  userId: string;             // Firebase Auth UID
  mode: 'sprint' | 'survival' | 'daily';
  rulesVersion: string;       // e.g. "2.0"
  contentVersion: string;     // e.g. "72L-v1"
  challengeId?: string;       // Daily only: "2026-09-25@Asia/Jakarta:72L-v1"
  serverStartedAt: number;    // Unix ms
  serverDeadlineAt: number;   // Unix ms
  status: 'ACTIVE' | 'VALIDATED' | 'REJECTED' | 'ABANDONED';
  isRanked: boolean;
  idempotencyKey: string;
  // Server-internal fields (never sent to client):
  serverQuestions: object;    // Serialized Map<sequence, Question>
  serverSecret: string;       // HMAC secret for question tokens
  submissionIdempotencyKey?: string; // Set on first submit
  createdAt: number;
  updatedAt: number;
}
```

#### competitiveResults

Matches existing `CompetitiveResultDoc` type from `src/engine/competitive/types.ts`.

#### leaderboardEntries

Matches existing `LeaderboardEntryDoc` type from `src/engine/competitive/types.ts`.

### 5.3. Firestore Indexes

```
competitiveResults:
  - userId ASC, mode ASC, finalizedAt DESC

leaderboardEntries:
  - mode ASC, periodKey ASC, score DESC

competitiveSessions:
  - userId ASC, mode ASC, createdAt DESC
```

### 5.4. Firestore Rules

Existing rules already block all client writes to competitive collections. Rules remain unchanged:

```
match /competitiveSessions/{sessionId} {
  allow read, write: if false;
}
match /competitiveResults/{resultId} {
  allow read: if request.auth != null && resource.data.userId == request.auth.uid;
  allow write: if false;
}
match /leaderboardEntries/{entryId} {
  allow read: if true;
  allow write: if false;
}
```

---

## 6. Security & Anti-Cheat

### 6.1. Authentication

- Every mutating endpoint requires `Authorization: Bearer <Firebase ID Token>`.
- Backend calls `getAuth().verifyIdToken(token, true)` with revocation check.
- Token expiry and issuer are validated by the Admin SDK.

### 6.2. Rate Limiting

In-memory rate limiter per UID (or per IP for public endpoints):

| Endpoint | Limit |
|----------|-------|
| `POST /sessions` | 5/min per UID |
| `POST /sessions/:id/submit` | 3/session (idempotent) |
| `GET /leaderboard` | 30/min per IP |
| `GET /results/me` | 20/min per UID |

### 6.3. Anti-Replay & Idempotency

- Session creation: `idempotencyKey` is stored; duplicate key returns cached session.
- Submission: `submissionIdempotencyKey` is stored in session doc; duplicate returns cached result.
- Session finalization is atomic: Firestore transaction checks `status === 'ACTIVE'` before writing result.

### 6.4. Server-Side Validation Checks

Performed by `validateCompetitiveSession()` (from shared domain engine):

1. **Sequence contiguity** — answers must be 1, 2, 3, ...
2. **Token integrity** — each answer's `questionToken` must match server HMAC
3. **Deadline enforcement** — server-side timestamp vs `serverDeadlineAt` + 500ms grace
4. **Sub-human latency detection** — `inputLatencyMs < 120ms` → rejection
5. **Survival heartbeat gap** — gap between answers > `SURVIVAL_MAX_HEARTBEAT_GAP_MS` → rejection
6. **Non-empty submission** — zero answers → rejection
7. **Authoritative scoring** — server recalculates score using `evaluateAnswer()`, ignoring any client-claimed score

### 6.5. Server Secret

- A per-session HMAC secret is generated via `crypto.randomBytes(32)`.
- Used to generate question tokens that bind each question to its session.
- Stored only in the session document (never sent to client).
- The client receives question tokens but cannot forge them without the secret.

---

## 7. Kubernetes Deployment

### 7.1. Secret: `hitung-kilat-firebase-admin`

Created manually before first deployment:

```bash
kubectl --kubeconfig ~/.kube/htz-k8s.yml \
  -n hitung-kilat \
  create secret generic hitung-kilat-firebase-admin \
  --from-file=serviceAccount.json=/path/to/firebase-admin-key.json \
  --dry-run=client -o yaml | \
kubectl --kubeconfig ~/.kube/htz-k8s.yml apply -f -
```

### 7.2. Helm Release

| Property | Web | API |
|----------|-----|-----|
| Release name | `hitung-kilat-web` | `hitung-kilat-api` |
| Chart | `myindo:1.0.4` | `myindo:1.0.4` |
| Values file | `values-hitung-kilat-web-prod.yaml` | `values-hitung-kilat-api-prod.yaml` |
| Service port | 80 | 80 |
| Container port | 80 (nginx) | 3000 (Express, mapped via `service.containerPort`) |
| Image | `hitung-kilat-web` | `hitung-kilat-api` |
| Health path | `/actuator` | `/api/health` |
| Probes initial delay | 60s | 15s |
| Replicas | 2 | 2 |

### 7.3. HTTPRoute Split

The web HTTPRoute changes from catch-all `/` to explicit non-`/api` routing. The API gets its own HTTPRoute for `/api`:

**API HTTPRoute (values-hitung-kilat-api-prod.yaml):**

```yaml
httpRoute:
  enabled: true
  routes:
    - name: api
      parentRefs:
        - kind: Gateway
          name: apisix
          namespace: ingress-apisix
          sectionName: https
          port: 443
      hostnames:
        - hitung-kilat.k8s.web.id
      rules:
        - matches:
            - path:
                type: PathPrefix
                value: /api
          backendRefs:
            - name: hitung-kilat-api
              port: 80
```

**Web HTTPRoute (values-hitung-kilat-web-prod.yaml) — unchanged:**

The existing catch-all `/` route for web continues to work because APISIX matches the more specific `/api` prefix first.

### 7.4. Volume Mount for Firebase Admin Credential

```yaml
env:
  - name: NODE_ENV
    value: "production"
  - name: GOOGLE_APPLICATION_CREDENTIALS
    value: /var/run/secrets/firebase/serviceAccount.json
  - name: PORT
    value: "3000"

envFrom: []

extraVolumes:
  - name: firebase-admin
    secret:
      secretName: hitung-kilat-firebase-admin
      optional: false

volumeMounts:
  - name: firebase-admin
    mountPath: /var/run/secrets/firebase
    readOnly: true
```

---

## 8. Docker

### 8.1. Backend Dockerfile (`server/Dockerfile`)

```dockerfile
# 1. Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy backend package files
COPY server/package*.json ./server/
RUN cd server && npm ci --ignore-scripts

# Copy shared engine + backend source
COPY src/engine/ ./src/engine/
COPY server/ ./server/

# Build TypeScript
RUN cd server && npm run build

# 2. Production stage
FROM node:22-alpine AS runner

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
```

### 8.2. Docker Compose (`docker-compose.yml` — updated)

```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    image: "${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}/${DOCKER_USER:-myindo}/${DOCKER_IMAGE_WEB:-hitung-kilat-web}:${DOCKER_VERSION:-latest}"
    restart: unless-stopped
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
    networks:
      - myindo-net

  api:
    build:
      context: .
      dockerfile: server/Dockerfile
    image: "${DOCKER_REGISTRY:-docker-hub.solusi-k8s.com}/${DOCKER_USER:-myindo}/${DOCKER_IMAGE_API:-hitung-kilat-api}:${DOCKER_VERSION:-latest}"
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: "3000"
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase_admin
    secrets:
      - firebase_admin
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - myindo-net

secrets:
  firebase_admin:
    file: ${FIREBASE_ADMIN_KEY_PATH:-/home/cachak/secrets/hitung-kilat-firebase-admin.json}

networks:
  myindo-net:
    name: myindo-net
    external: true
```

---

## 9. CI/CD Script Update (`hitung-kilat.sh`)

The deployment script is extended with a `TARGET` environment variable:

```bash
# TARGET=web (default) or TARGET=api
TARGET="${TARGET:-web}"

if [ "$TARGET" = "api" ]; then
  DOCKER_IMAGE="${DOCKER_IMAGE:-hitung-kilat-api}"
  HELM_NAME="${HELM_NAME:-hitung-kilat-api}"
  HELM_VALUES="${HELM_VALUES:-values-hitung-kilat-api-prod.yaml}"
fi
```

Usage:

```bash
# Build + push + deploy web (default, unchanged)
./hitung-kilat.sh build --push --deploy

# Build + push + deploy API
TARGET=api ./hitung-kilat.sh build --push --deploy

# Deploy API only (config change, reuse existing image)
TARGET=api DOCKER_VERSION=v12.9.24.11 ./hitung-kilat.sh deploy
```

---

## 10. Frontend Integration Points

The frontend changes are minimal — only wiring fetch calls to the new endpoints:

### 10.1. API Client Module

New file: `src/lib/competitiveApi.ts`

```typescript
const API_BASE = '/api';

export async function createCompetitiveSession(
  token: string,
  mode: CompetitiveMode,
  idempotencyKey: string
): Promise<SessionResponse> { ... }

export async function submitSessionAnswers(
  token: string,
  sessionId: string,
  payload: SubmitPayload
): Promise<ValidationResponse> { ... }

export async function fetchLeaderboard(
  periodKey: string,
  mode: CompetitiveMode,
  limit?: number
): Promise<LeaderboardResponse> { ... }

export async function fetchMyResults(
  token: string,
  mode: CompetitiveMode,
  limit?: number
): Promise<ResultsResponse> { ... }
```

### 10.2. Daily Hub Integration

`DailyHubView` currently calls `getLeaderboardForDate(selectedDate)` which returns deterministic bot entries. After integration:

1. Leaderboard data fetched from `GET /api/competitive/leaderboard/{date}?mode=daily`.
2. Bot entries are removed.
3. Real player pseudonyms appear.
4. Fallback to empty leaderboard if API is unreachable (graceful degradation).

### 10.3. Competitive Session Flow

Current client-only flow → new server-backed flow:

```
Before:
  Client generates questions → Client evaluates → Client displays score

After:
  Client calls POST /api/competitive/sessions → receives questions
  Client displays questions → user answers
  Client calls POST /api/competitive/sessions/:id/submit → receives validated result
  Client displays server-validated score
```

---

## 11. Observability

### 11.1. Structured Logging

All logs are JSON to stdout for Kubernetes log collection:

```json
{
  "level": "info",
  "msg": "session_created",
  "sessionId": "abc-123",
  "userId": "uid_xyz",
  "mode": "daily",
  "timestamp": "2026-09-25T10:00:00.000Z"
}
```

### 11.2. Metrics Endpoint

Optional: `GET /api/metrics` exposing Prometheus-compatible counters:

- `competitive_sessions_created_total{mode}`
- `competitive_submissions_total{mode,status}`
- `competitive_rejections_total{mode,reason}`
- `http_request_duration_seconds{method,path,status}`

### 11.3. Elastic APM

Values include Elastic APM environment variables (consistent with web deployment):

```yaml
- name: ELASTIC_APM_SERVICE_NAME
  value: "hitung-kilat-api"
```

---

## 12. Testing Strategy

### 12.1. Backend Unit Tests (Vitest)

- Controller unit tests with mocked Firestore and Auth.
- Service layer tests with mocked Firestore.
- Middleware tests (auth verification, rate limiter).
- Integration tests with Firebase Emulator (optional, not required for MVP).

### 12.2. Shared Engine Tests

Existing 860+ tests in `src/engine/competitive/` continue to pass unchanged. The backend imports the same code.

### 12.3. API Contract Tests

Supertest-based HTTP tests against the Express app:

- Valid session creation flow.
- Token rejection.
- Rate limit enforcement.
- Idempotency behavior.
- Submission validation (VALIDATED/REJECTED paths).

---

## 13. Rollout Plan

### Phase 1: Infrastructure (this spec)

1. Create Firebase Admin service account key.
2. Create Kubernetes Secret `hitung-kilat-firebase-admin`.
3. Build backend: Dockerfile, Express app, routes, middleware.
4. Create Helm values files.
5. Update `docker-compose.yml`.
6. Update `hitung-kilat.sh`.
7. Deploy backend to Kubernetes.
8. Verify health endpoint reachable at `https://hitung-kilat.k8s.web.id/api/health`.

### Phase 2: Frontend Integration (separate spec)

1. Create `competitiveApi.ts` client module.
2. Wire Sprint 60s to server session flow.
3. Wire Survival Kilat to server session flow.
4. Wire Daily Challenge to server session flow.
5. Replace `getLeaderboardForDate()` bot data with real API data.
6. Graceful degradation when API is unreachable.

### Phase 3: Hardening (future)

1. Firebase App Check integration.
2. Workload Identity (replace JSON key with federated identity).
3. Firestore TTL for abandoned sessions.
4. Prometheus/Grafana dashboard.

---

## 14. Constraints

- Node.js 22 LTS.
- TypeScript strict mode.
- Zero frontend dependency additions for API client (native `fetch`).
- Backend bundle must not include frontend React/Vite code.
- Firebase Admin SDK is the only new backend dependency beyond Express.
- All competitive writes go through the backend; Firestore rules continue blocking client writes.
- Backend must not log tokens, credentials, or answer content.
- Backend must not expose internal server questions or HMAC secrets in responses.
- Health check endpoint must not require authentication.
- Rate limiter state is in-memory (acceptable for 2 replicas; distributed rate limiting is Phase 3).

---

## 15. Dependency List

### Backend (`server/package.json`)

**Production:**
- `express` ^4.21
- `firebase-admin` ^13 (latest)
- `cors` ^2.8
- `helmet` ^8
- `uuid` ^11

**Dev:**
- `typescript` ~5.8
- `vitest` ^5.0
- `supertest` ^7
- `@types/express` ^4.17
- `@types/cors` ^2.8
- `@types/supertest` ^6
- `@types/uuid` ^10
- `tsup` or `esbuild` (bundler)
- `tsc-alias` (path alias resolution)
