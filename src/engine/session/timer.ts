export class MonotonicTimer {
  private startedAt = 0;
  private deadline = 0;
  private totalPausedMs = 0;
  private pauseStartedAt: number | null = null;
  private isRunning = false;

  constructor(private timeLimitSec: number) {}

  start(): void {
    const now = performance.now();
    this.startedAt = now;
    this.deadline = now + this.timeLimitSec * 1000;
    this.totalPausedMs = 0;
    this.pauseStartedAt = null;
    this.isRunning = true;
  }

  pause(): void {
    if (!this.isRunning || this.pauseStartedAt !== null) return;
    this.pauseStartedAt = performance.now();
  }

  resume(): void {
    if (!this.isRunning || this.pauseStartedAt === null) return;
    const now = performance.now();
    const pausedDuration = now - this.pauseStartedAt;
    this.totalPausedMs += pausedDuration;
    this.deadline += pausedDuration; // extend deadline by pause duration
    this.pauseStartedAt = null;
  }

  getElapsedActiveMs(): number {
    if (!this.isRunning) return 0;
    const now = performance.now();
    const currentPause = this.pauseStartedAt !== null ? now - this.pauseStartedAt : 0;
    return Math.max(0, now - this.startedAt - this.totalPausedMs - currentPause);
  }

  getRemainingMs(): number {
    if (!this.isRunning) return this.timeLimitSec * 1000;
    const now = performance.now();
    const currentPause = this.pauseStartedAt !== null ? now - this.pauseStartedAt : 0;
    const effectiveDeadline = this.deadline + currentPause;
    return Math.max(0, effectiveDeadline - now);
  }

  isExpired(): boolean {
    return this.getRemainingMs() <= 0;
  }

  getStartedAt(): number {
    return this.startedAt;
  }

  getDeadline(): number {
    return this.deadline;
  }
}
