# Trusted Competitive API Phase 2 — Frontend Integration Design

**Date:** 2026-09-26  
**Status:** Design revision pending review; implementation plan pending  
**Parent spec:** `docs/superpowers/specs/2026-09-25-trusted-competitive-api-design.md`

## 1. Goal

Connect the Sprint 60s, Survival Kilat, and Daily Challenge V2 frontend flows to the Trusted Competitive API while preserving local play as a safe, clearly labeled fallback. Authenticated users aged 13 and above may enter server-validated ranked sessions; users under 13 always remain in full local practice mode.

## 2. Scope

### In scope

- A typed, native-fetch client at `src/lib/competitiveApi.ts`.
- Firebase ID-token attachment for authenticated competitive requests.
- A centralized competitive eligibility policy based on the existing privacy state and Firebase auth state.
- An adapter in `useCompetitiveSession` that selects server-ranked or local-practice execution before a run begins.
- Server-backed Sprint, Survival, and Daily session creation, per-answer receipt, and final submission.
- Server-backed leaderboard reads for eligible users.
- Authoritative per-answer receipt flow that replenishes the question buffer without exposing answer keys.
- Explicit ranked/practice status in gameplay and result UI.
- Graceful local-practice fallback when the API is unavailable before a run starts.
- A hard under-13 guard that prevents all competitive API calls.
- Unit, hook, component, contract, and browser smoke coverage for the eligibility and fallback matrix.
- A feature flag and kill switch for controlled ranked rollout.

### Out of scope

- Firebase App Check.
- Workload Identity migration.
- Firestore TTL policies.
- Prometheus/Grafana implementation.
- Offline submission queues.
- Rewriting the existing competitive reducer, timer, keypad, or local question engine.
- Adding frontend dependencies for the API client.
- Promoting a local result to a ranked result after the fact.

## 3. Existing Context

The Phase 1 backend exposes:

- `POST /api/competitive/sessions`
- `POST /api/competitive/sessions/:sessionId/answers`
- `POST /api/competitive/sessions/:sessionId/submit`
- `GET /api/competitive/leaderboard/:periodKey?mode=<mode>`
- `GET /api/competitive/results/me`
- `GET /api/health`

The existing frontend competitive hook currently creates questions and validates results in the browser. `DailyHubView` currently obtains deterministic bot leaderboard entries from `getLeaderboardForDate()`. The existing privacy model stores `AgeEligibility` as `unspecified | under13 | 13plus`, along with `leaderboardOptOut` and pseudonym state.

## 4. User and Privacy Policy

### 4.1 Eligibility matrix

| Condition | API calls | Execution mode | Leaderboard |
| --- | --- | --- | --- |
| `under13` | None to competitive API | Full local practice | Never available |
| `unspecified` | None until age gate resolves | Not started | Not available |
| `13plus`, guest | None | Full local practice | Not available |
| `13plus`, leaderboard opt-out | None for ranked flow | Full local practice | Not available |
| `13plus`, authenticated, API available | Create, answer receipts, and submit session | Ranked | Available after server validation |
| `13plus`, authenticated, API unavailable before start | Create attempt only | Local practice | Not available |
| Ranked session submit fails | No replacement session | Unvalidated result | Not available |

### 4.2 Under-13 hard guard

The under-13 policy is enforced in the API adapter and session hook, not only in UI controls. When `ageEligibility === 'under13'`:

1. Never call `POST /api/competitive/sessions`.
2. Never retrieve a Firebase ID token for competitive API use.
3. Never call the submit, leaderboard, or personal-results endpoints.
4. Never expose a ranked entry point or ranked label.
5. Use the existing local question generator and validator for all three modes.
6. Show `Mode Lokal Aman · Tidak Berperingkat` in the result flow.
7. Keep all local scores local; do not promote them when API availability changes.

The same guard applies when the user is under 13 at the moment a new run is started. A privacy-state change during an already active ranked session cannot convert that session into a ranked result; its result is treated as unvalidated and excluded from leaderboard use.

### 4.3 Age-gate behavior

If age is `unspecified`, the competitive start action must resolve the existing age gate before choosing an execution mode. Confirming `under13` enters local practice. Confirming `13plus` proceeds to the normal authenticated/guest eligibility check.

## 5. Architecture

The frontend retains the existing local engine and UI state flow. A single API adapter is introduced between the UI hook and the backend:

```text
Sprint / Survival / Daily UI
             |
             v
    useCompetitiveSession
             |
       eligibility policy
          /          \
 ranked API path     local engine path
          |          |
 server session       local session
 server questions + receipts  generated questions
 server validation             local-only result
```

### 5.1 API client

Create `src/lib/competitiveApi.ts` with native `fetch` and no new frontend dependency. Components and hooks must not call `fetch` directly.

The client exposes typed operations equivalent to:

```ts
createCompetitiveSession(params): Promise<CompetitiveSessionResponse>
submitCompetitiveAnswer(
  sessionId: string,
  params: SubmitCompetitiveAnswerRequest,
): Promise<CompetitiveAnswerReceiptResponse>
submitCompetitiveSession(
  sessionId: string,
  params: SubmitCompetitiveSessionRequest,
): Promise<CompetitiveSubmitResponse>
getCompetitiveLeaderboard(
  periodKey: string,
  mode: CompetitiveMode,
): Promise<LeaderboardResponse>
getMyCompetitiveResults(
  mode?: CompetitiveMode,
): Promise<MyResultsResponse>
```

The exact request and response types must be runtime-validated at the boundary. Invalid JSON or missing required fields becomes `INVALID_RESPONSE` rather than flowing into the game state.

The answer-receipt contract is:

```text
POST /api/competitive/sessions/:sessionId/answers
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
Idempotency-Key: <same value as body.idempotencyKey>

{
  "sequence": 1,
  "questionToken": "tok_...",
  "rawInput": "19",
  "clientAnsweredAt": 2500,
  "inputLatencyMs": 350,
  "idempotencyKey": "answer_uuid"
}
```

The successful response is a safe, runtime-validated object:

```json
{
  "status": "ACCEPTED",
  "sequence": 1,
  "isCorrect": true,
  "serverReceivedAt": 1727200002500,
  "timeRemainingMs": 57400,
  "nextQuestion": {
    "questionInstanceId": "q2",
    "sequence": 2,
    "renderedPrompt": "…",
    "answerInputKind": "numeric",
    "questionToken": "tok_..."
  }
}
```

`nextQuestion` is `null` when the mode has no remaining question or the session has reached its hard deadline. The response MUST NOT contain an answer key, `answerSpec`, server secret, raw Firebase UID, internal Firestore document, or any field from which those values can be derived. The client treats `serverReceivedAt`, `isCorrect`, and (for Survival) `timeRemainingMs` as authoritative; it may render optimistic feedback before the response, but must reconcile to the receipt and never use a client-computed answer as the official result.

The client maintains a small server-provided question buffer. It removes the acknowledged view immediately so input stays responsive, then sends each receipt through a serialized per-session queue. The next question returned by the server is appended when its receipt resolves. A ranked run does not use browser-generated replenishment. A temporary receipt timeout or network failure does not silently downgrade the active session to practice: the hook stops accepting ranked answers, marks the run unavailable/unvalidated, and preserves the stable session ID for a bounded retry or final submit according to the final-submit rules below.

### 5.2 API base URL

Use:

```ts
const API_BASE_URL = import.meta.env.VITE_COMPETITIVE_API_URL ?? '/api';
```

Production uses the same-origin `/api` default. Development may override the value with `VITE_COMPETITIVE_API_URL`.

### 5.3 Authentication

For authenticated requests only:

1. Check eligibility before retrieving a token.
2. Read the current Firebase user.
3. Call `getIdToken()` only for an eligible authenticated ranked request.
4. Send `Authorization: Bearer <id-token>`.
5. Never persist the token in localStorage, sessionStorage, application state, logs, error text, or test artifacts.

Missing user or token acquisition failure selects local practice before any ranked request is attempted.

### 5.4 Authoritative answer receipts

The backend adds `POST /api/competitive/sessions/:sessionId/answers`. The authenticated user must own an `ACTIVE` session. The route validates the body shape, stable idempotency key, sequence, question token, and session deadline before recording the receipt. The server records `serverReceivedAt` at the request-processing boundary, evaluates `rawInput` with the server-only `answerSpec`, and updates the session's authoritative progress in a Firestore transaction.

The persisted session state must include, at minimum:

- `acknowledgedSequences` for accepted answer sequences;
- `answerReceipts/<sequence>` records containing the idempotency key, token digest, sanitized correctness outcome, and server receipt time;
- the authoritative Survival timer and last-answer/heartbeat timestamps;
- the next server question sequence and server-generated question data needed for validation;
- a bounded receipt history sufficient for final validation and idempotent replay.

Receipt idempotency and concurrency rules are strict:

1. Repeating the same session, sequence, and idempotency key returns the original safe receipt and does not score or advance the session twice.
2. Reusing an idempotency key with different answer content, token, or sequence returns a conflict and does not mutate state.
3. A sequence already acknowledged with a different idempotency key returns a conflict; it is never evaluated twice.
4. A sequence other than the session's current expected sequence is rejected as out-of-order; the response must not reveal the answer key or future question data.
5. Invalid or expired tokens, inactive sessions, expired deadlines, and wrong ownership produce safe typed errors without leaking server state.
6. Transaction retries must preserve one authoritative receipt and one state transition even if concurrent requests race.

Receipt documents are server-only. Client responses expose only the safe receipt fields and the next `CompetitiveQuestionView`. The server secret, answer specifications, full server question map, raw UID, and internal Firestore paths never cross the API boundary. The receipt route has its own bounded rate limiter and request body limit, and logs only session-safe metadata with answer content and tokens redacted.

### 5.5 API errors

Use a typed error code:

```ts
type CompetitiveApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'AGE_RESTRICTED'
  | 'NETWORK_UNAVAILABLE'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE';
```

Use `AbortController` for bounded create-session, answer-receipt, and final-submit timeouts. Map HTTP 401, 403, 409, 429, and 5xx responses to safe user-facing messages without forwarding raw server details, tokens, authorization headers, secrets, UIDs, or answer content.

### 5.6 Session adapter

Extend `useCompetitiveSession` without rewriting the existing timer, keypad, reducer, or local generator. The hook must distinguish execution mode from validator status:

```ts
type CompetitiveExecutionMode = 'ranked' | 'practice';

type CompetitiveIntegrationStatus =
  | 'checking'
  | 'ranked_active'
  | 'practice_active'
  | 'submitting'
  | 'validated'
  | 'rejected'
  | 'unavailable';
```

A result is officially ranked only when:

```ts
executionMode === 'ranked'
&& serverSessionId !== undefined
&& server validation returned VALIDATED
&& server result is leaderboard-eligible
```

The server response supplies the ranked session ID, timing contract, question views/tokens, and authoritative final result. The browser may calculate instant correctness feedback for responsiveness, but it must not use that calculation as the official ranked result.

### 5.7 Start flow

Before a run starts, read current privacy state and auth state rather than relying only on values captured at component mount:

```text
under13                         -> local practice
unspecified                     -> age gate
13plus + guest                  -> local practice
13plus + opt-out               -> local practice
13plus + authenticated + flag on
  -> create server session
     success                    -> ranked
     timeout/network/HTTP error -> local practice
```

The create request includes only the required mode, challenge identifier when applicable, and a fresh idempotency key. Client secrets and server HMAC secrets are never sent or stored.

### 5.8 Submit flow

For ranked sessions, every accepted answer is first sent to the receipt endpoint with a stable per-answer idempotency key. The client keeps the complete accepted receipt/payload history needed by final validation, but does not treat local correctness or local timer calculations as official. Receipt writes are serialized per session and bounded; they are not an offline queue and must not continue after the session is finalized.

Final submit remains the session-closing and result-persistence operation. It uses the same session ID and a stable submission idempotency key and includes the accepted answer payloads plus the server receipt references/metadata required by the backend. Before final submit, the hook waits for already-enqueued receipt requests to settle. If a receipt is still pending, the UI remains in `submitting` until the bounded wait ends; it must not close the session with an unobserved answer and must not create a replacement session. The backend finalizer validates against the persisted authoritative receipts, rejects a missing or inconsistent receipt history, and writes the final result and leaderboard projection only once.

If the final submit is retried, it reuses the same submission idempotency key. If the receipt endpoint fails before finalization, the client offers a bounded retry using the same answer idempotency key. If the bounded retry cannot succeed, the run ends as `Hasil belum tervalidasi server`; it is never converted to local practice and never enters a leaderboard.

On final-submit success, use the server result for status, score, rejection reasons, and leaderboard eligibility.

If submit fails:

- do not create another session;
- do not retry as local practice;
- do not place the local result in a leaderboard;
- show `Hasil belum tervalidasi server` or equivalent safe wording;
- allow the user to return or start a new run.

A retry, if supported, must reuse the same submission idempotency key and remain bounded. Local practice never submits to the API.

## 6. Mode Integration

### Sprint 60s

Use the server-provided initial question views and tokens for ranked runs. Preserve the existing 60-second HUD and local fallback behavior. On each answer, immediately advance the local display from the server question buffer and enqueue the receipt; append only the server-returned next question. Submit on timer expiry or explicit completion after queued receipts settle. A receipt failure pauses ranked input and cannot trigger browser question generation.

### Survival Kilat

Use server-provided questions/tokens for ranked runs. The client may display a smoothly ticking estimate between receipts, but after each receipt it reconciles to the server's `isCorrect`, `serverReceivedAt`, and `timeRemainingMs`. The server applies `+2s/-4s`, maximum timer, hard cap, deadline, and heartbeat integrity rules. Client heartbeats remain UI timing aids only; the backend result remains authoritative. No ranked Survival answer is accepted as official until its receipt is acknowledged.

### Daily Challenge V2

Pass the challenge/date identifier when creating the server session. Use the server's deterministic question contract for ranked runs and send each answer through the same receipt flow; the fixed ten-question run ends when the server returns no `nextQuestion`. Replace real-player leaderboard display with API data. On under-13, guest, opt-out, API failure, or local practice, do not fetch a competitive leaderboard and do not present deterministic bots as real players. Local Daily play remains available.

## 7. UI Contract

### 7.1 Mode indicators

The gameplay and result views must visibly distinguish:

- `Ranked · Server Validated`
- `Mode Lokal Aman · Tidak Berperingkat`
- `Hasil belum tervalidasi server`

The ranked label may only appear after successful server validation. A local score must never be styled or worded as a ranked result.

### 7.2 Leaderboard visibility

Hide or replace competitive leaderboard actions for under-13, guest, leaderboard-opt-out, and practice contexts. Do not issue a leaderboard request in those states. Show a safe explanation that leaderboard access is limited to eligible authenticated players.

### 7.3 Loading and duplicate submission

Show a submit/loading state and prevent duplicate user submissions while a ranked submit request is active. Preserve a usable back/exit path if the API is unavailable.

## 8. Feature Flag and Rollout

Ranked frontend integration is controlled by a feature flag defaulting off until the rollout is explicitly enabled. A kill switch must disable ranked API entry while leaving local practice available.

When disabled, all users use the existing local path. When enabled:

- only authenticated, `13plus`, non-opted-out users may attempt ranked mode;
- guests and under-13 users remain local;
- API failure before start falls back to local practice;
- submit failure never promotes or queues a local result.

## 9. Testing Requirements

### 9.1 API client and receipt-contract tests

Cover default/override base URL, Bearer token attachment, no token persistence/logging, timeout, network failure, 401/403/429/5xx mapping, invalid response, idempotency keys, and absence of server secrets in client-visible data. Contract tests must also cover accepted receipt parsing, `nextQuestion: null`, malformed receipt responses, safe error mapping, and rejection of answer keys, `answerSpec`, server secrets, raw UIDs, or internal Firestore fields in fixtures.

### 9.2 Hook tests

Cover under-13 zero API calls, unspecified age gate, guest and opt-out local paths, authenticated 13plus ranked success, create timeout/error fallback, responsive buffer advancement before receipt completion, serialized answer receipts, server-returned replenishment, duplicate answer prevention, receipt timeout/retry with the same idempotency key, Survival timer reconciliation from authoritative receipts, final submit waiting for queued receipts, ranked submit success, ranked submit failure without replacement session, local no-submit behavior, and age-state changes before start.

### 9.3 Component tests

Cover ranked/practice labels, under-13 safe-mode wording, hidden leaderboard actions for ineligible users, loading/double-submit prevention, safe API errors, and no bot-as-real-player rendering when Daily API is unavailable.

### 9.4 Browser smoke tests

At minimum:

1. Under-13 Sprint has no competitive API network request and ends as local practice.
2. Authenticated 13plus Sprint creates a session and displays the server result.
3. Authenticated 13plus with API unavailable falls back to local practice.
4. Ranked receipt or final-submit failure shows unvalidated status without creating a second session.
5. Ranked gameplay advances from a local server-question buffer while receipt writes are pending, then reconciles to the authoritative server response.
6. Guest play remains local.
7. Eligible leaderboard reads server data.
8. Under-13 and opt-out leaderboard views make no competitive API request.

No test artifact may contain credentials, ID tokens, raw Authorization headers, server secrets, or answer payloads beyond what is necessary for a redacted fixture.

## 10. Acceptance Criteria

1. Under-13 users can play all three modes locally without any competitive API request.
2. No local-practice result enters a leaderboard.
3. Ranked sessions start from the backend, use only server-provided question replenishment, and submit with the server session ID.
4. Every ranked answer is evaluated by the server and has an idempotent authoritative receipt before it contributes to the official result.
5. Server validation is the source of truth for ranked status, official score, and Survival timer state.
6. API failure before start falls back to local practice.
7. API failure during receipt or final submit does not create a replacement session or promote the local result.
8. Guests and leaderboard-opt-out users do not enter ranked mode.
9. Daily no longer presents bot entries as real competitive players.
10. Existing frontend and backend tests remain green.
11. New unit, hook, component, contract, and browser smoke tests pass.
12. Feature flag and kill switch can disable ranked integration while preserving local play.
13. No token, secret, raw UID, or sensitive answer content is logged or placed in test artifacts.

## 11. Operational Follow-ups

Before enabling ranked integration in production:

- Verify the deployed API health endpoint.
- Create and verify the required Firestore composite indexes.
- Add the `/results/me` rate limiter specified by the Phase 1 security design, or record an explicit accepted exception.
- Confirm a staging Firebase project and rollback procedure.

## 12. Implementation Order

1. Add shared eligibility/policy helpers and typed API client.
2. Add API client and policy tests.
3. Add server/local adapter state to `useCompetitiveSession`.
4. Integrate Sprint and its tests.
5. Integrate Survival and its tests.
6. Integrate Daily and replace bot leaderboard reads.
7. Add mode indicators, result states, feature flag, and kill switch.
8. Add browser smoke coverage and run all existing verification gates.
9. Perform a controlled rollout only after the acceptance criteria and operational follow-ups are verified.
