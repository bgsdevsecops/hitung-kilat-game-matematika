# Task 5 — Leaderboard Service

## Status

Implemented the Firestore-backed `LeaderboardService` for public leaderboard reads and authenticated result history.

## Implementation

- Added `server/src/services/leaderboardService.ts`.
- Added `getLeaderboard()` with sprint/survival/daily mode validation, period validation, bounded pagination, score ordering, one-based ranks, and public-safe projection fields only.
- Added `getUserResults()` with authenticated user filtering, optional mode filtering, finalized-at ordering, and bounded pagination.
- Added service errors with status/error codes for invalid mode, period, and user identifiers.
- Public leaderboard output deliberately excludes entry IDs, result IDs, user IDs, session IDs, and rejection metadata.

## Tests

- Added `server/tests/services/leaderboardService.test.ts`.
- Backend suite: 7 test files, 45 tests passed.
- Backend TypeScript lint: passed.

## Concerns

- Firestore composite indexes for the mode/period/score leaderboard query and user/mode/finalizedAt history query must be provisioned before production use.
- `total` currently reports the number of returned leaderboard entries, matching the existing API brief; it is not a count of all matching documents.
