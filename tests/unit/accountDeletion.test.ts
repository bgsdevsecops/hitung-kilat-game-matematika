// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDeletionReceipt,
  purgeAllLocalData,
  purgeCloudUserData,
  executeAccountDeletion,
} from '../../src/utils/privacy/accountDeletion';
import { deleteDoc, doc } from 'firebase/firestore';
import { logoutUser } from '../../src/lib/firebase';

vi.mock('../../src/lib/firebase', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, coll, id) => ({ coll, id })),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

describe('accountDeletion engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('hitung_kilat_campaign_v2', '{"test": 1}');
    localStorage.setItem('hitung_kilat_stats_v1', '{"test": 2}');
    localStorage.setItem('mastery_taxonomy_v1', '{"test": 3}');
    localStorage.setItem('other_app_key', '{"test": 4}');
  });

  it('generates an auditable DeletionReceipt matching DEL-XXXXXX format', () => {
    const receipt = generateDeletionReceipt();
    expect(receipt.receiptId).toMatch(/^DEL-[0-9A-Z]{6,12}$/);
    expect(receipt.status).toBe('COMPLETED');
    expect(receipt.scopesPurged).toContain('cloud_firestore');
    expect(receipt.scopesPurged).toContain('auth_session');
    expect(receipt.scopesPurged).toContain('local_progress');
    expect(receipt.policyNotice).toBeDefined();
    expect(receipt.timestamp).toBeDefined();
  });

  it('purges all Hitung Kilat local storage partitions', () => {
    purgeAllLocalData();
    expect(localStorage.getItem('hitung_kilat_campaign_v2')).toBeNull();
    expect(localStorage.getItem('hitung_kilat_stats_v1')).toBeNull();
    expect(localStorage.getItem('mastery_taxonomy_v1')).toBeNull();
    // Non-game key should remain untouched
    expect(localStorage.getItem('other_app_key')).toBe('{"test": 4}');
  });

  it('purges cloud user data from firestore users and timeAttackLeaderboard collections', async () => {
    await purgeCloudUserData('mock_uid_123');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'mock_uid_123');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'timeAttackLeaderboard', 'mock_uid_123');
    expect(deleteDoc).toHaveBeenCalledTimes(2);
  });

  it('handles empty userId in purgeCloudUserData gracefully without throwing', async () => {
    await expect(purgeCloudUserData('')).resolves.toBeUndefined();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('executes full account deletion workflow with userId and returns receipt', async () => {
    const receipt = await executeAccountDeletion('mock_uid_123');
    expect(receipt.receiptId).toMatch(/^DEL-[0-9A-Z]{6,12}$/);
    expect(receipt.status).toBe('COMPLETED');
    expect(localStorage.getItem('hitung_kilat_campaign_v2')).toBeNull();
    expect(logoutUser).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledTimes(2);
  });

  it('executes account deletion without userId (anonymous/local only)', async () => {
    const receipt = await executeAccountDeletion();
    expect(receipt.receiptId).toMatch(/^DEL-[0-9A-Z]{6,12}$/);
    expect(localStorage.getItem('hitung_kilat_campaign_v2')).toBeNull();
    expect(logoutUser).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
