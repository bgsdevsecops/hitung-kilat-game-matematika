import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules for Competitive Collections', () => {
  const rulesPath = path.resolve(__dirname, '../../firestore.rules');
  const content = fs.readFileSync(rulesPath, 'utf8');

  it('strictly forbids client write access to competitive collections', () => {
    // Verify /competitiveSessions deny-all
    expect(content).toContain('match /competitiveSessions/{sessionId}');
    expect(content).toMatch(/match \/competitiveSessions\/\{sessionId\}\s*\{\s*allow read, write:\s*if false;/);

    // Verify /competitiveResults client write denied
    expect(content).toContain('match /competitiveResults/{resultId}');
    expect(content).toMatch(/match \/competitiveResults\/\{resultId\}\s*\{[\s\S]*?allow write:\s*if false;/);

    // Verify /leaderboardEntries client write denied and public read allowed
    expect(content).toContain('match /leaderboardEntries/{entryId}');
    expect(content).toMatch(/match \/leaderboardEntries\/\{entryId\}\s*\{[\s\S]*?allow read:\s*if true;\s*allow write:\s*if false;/);
  });

  it('restricts competitiveResults read access to the authenticated owner', () => {
    expect(content).toMatch(/match \/competitiveResults\/\{resultId\}\s*\{[\s\S]*?allow read:\s*if request\.auth != null && resource\.data\.userId == request\.auth\.uid;/);
  });

  it('allows public read for leaderboardEntries and forbids all writes', () => {
    expect(content).toMatch(/match \/leaderboardEntries\/\{entryId\}\s*\{[\s\S]*?allow read:\s*if true;\s*allow write:\s*if false;/);
  });

  it('maintains read-only backwards compatibility for timeAttackLeaderboard', () => {
    expect(content).toMatch(/match \/timeAttackLeaderboard\/\{userId\}\s*\{[\s\S]*?allow read:\s*if true;\s*allow write:\s*if false;/);
  });
});
