import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonotonicTimer } from '../../src/engine/session/timer';

describe('MonotonicTimer', () => {
  let mockNow = 1000;

  beforeEach(() => {
    mockNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow);
  });

  it('calculates remaining and elapsed time correctly', () => {
    const timer = new MonotonicTimer(30); // 30 seconds
    timer.start();

    mockNow += 5000; // 5 seconds passed
    expect(timer.getElapsedActiveMs()).toBe(5000);
    expect(timer.getRemainingMs()).toBe(25000);
    expect(timer.isExpired()).toBe(false);

    mockNow += 26000; // past deadline
    expect(timer.isExpired()).toBe(true);
    expect(timer.getRemainingMs()).toBe(0);
  });

  it('excludes pause duration from active elapsed time', () => {
    const timer = new MonotonicTimer(30);
    timer.start();

    mockNow += 2000; // 2 seconds active
    timer.pause();

    mockNow += 10000; // 10 seconds paused
    timer.resume();

    mockNow += 3000; // 3 seconds active after resume
    expect(timer.getElapsedActiveMs()).toBe(5000); // 2s + 3s = 5s active
    expect(timer.getRemainingMs()).toBe(25000);
  });

  it('handles state before start is called', () => {
    const timer = new MonotonicTimer(30);
    expect(timer.getElapsedActiveMs()).toBe(0);
    expect(timer.getRemainingMs()).toBe(30000);
    expect(timer.isExpired()).toBe(false);
    expect(timer.getStartedAt()).toBe(0);
    expect(timer.getDeadline()).toBe(0);
  });

  it('accurately reports active elapsed time and remaining time while currently paused', () => {
    const timer = new MonotonicTimer(30);
    timer.start();

    mockNow += 4000;
    timer.pause();

    mockNow += 7000; // 7 seconds elapse while in paused state
    expect(timer.getElapsedActiveMs()).toBe(4000);
    expect(timer.getRemainingMs()).toBe(26000);
    expect(timer.isExpired()).toBe(false);
  });

  it('handles redundant pause and resume calls gracefully', () => {
    const timer = new MonotonicTimer(30);

    // Pause / resume before start should be no-ops
    timer.pause();
    timer.resume();
    expect(timer.getElapsedActiveMs()).toBe(0);

    timer.start();
    mockNow += 1000;

    // Redundant resume when not paused
    timer.resume();
    expect(timer.getElapsedActiveMs()).toBe(1000);

    // Redundant pause when already paused
    timer.pause();
    mockNow += 2000;
    timer.pause(); // second pause should not reset pauseStartedAt
    mockNow += 3000;
    timer.resume();

    // Total paused was 5000ms, active was 1000ms
    expect(timer.getElapsedActiveMs()).toBe(1000);
    expect(timer.getRemainingMs()).toBe(29000);
  });

  it('exposes startedAt and deadline values', () => {
    const timer = new MonotonicTimer(15);
    timer.start();

    expect(timer.getStartedAt()).toBe(1000);
    expect(timer.getDeadline()).toBe(16000);

    // Pausing and resuming should adjust deadline by pause duration
    mockNow += 1000;
    timer.pause();
    mockNow += 5000;
    timer.resume();

    expect(timer.getDeadline()).toBe(21000);
  });
});
