/**
 * Daily Challenge Tracker (Client Side) for "Who's the Snake King"
 * Displays progress in HUD, countdown timer, and tracks completion.
 */

export type ChallengeType = 'mass' | 'eliminations' | 'orbs' | 'survival' | 'evolution';

export interface DailyChallengeData {
  id: string;
  objective: string;
  targetValue: number;
  type: ChallengeType;
  reward: string;
}

interface DailyChallengeProgress {
  current: number;
  target: number;
  objective: string;
  timeRemaining: number;
}

const STORAGE_KEY = 'snake-king-daily-challenge';

interface StoredChallengeState {
  id: string;
  progress: number;
  completed: boolean;
  date: string;
}

export class DailyChallengeTracker {
  private challenge: DailyChallengeData | null = null;
  private currentProgress: number = 0;
  private completed: boolean = false;
  private challengeStartTime: number = 0;

  constructor() {
    this.loadState();
  }

  /**
   * Set the current daily challenge from server data.
   */
  setChallenge(challenge: DailyChallengeData): void {
    const today = this.getTodayString();

    // If the challenge ID changed (new day), reset progress
    if (this.challenge?.id !== challenge.id) {
      this.currentProgress = 0;
      this.completed = false;
    }

    this.challenge = challenge;
    this.challengeStartTime = this.getMidnightUTCTimestamp();
    this.saveState();
  }

  updateProgress(type: string, value: number): void {
    if (!this.challenge || this.completed) return;
    if (type !== this.challenge.type) return;

    this.currentProgress = Math.min(value, this.challenge.targetValue);

    if (this.currentProgress >= this.challenge.targetValue) {
      this.completed = true;
    }

    this.saveState();
  }

  isCompleted(): boolean {
    return this.completed;
  }

  getProgress(): DailyChallengeProgress {
    return {
      current: this.currentProgress,
      target: this.challenge?.targetValue ?? 0,
      objective: this.challenge?.objective ?? 'No challenge available',
      timeRemaining: this.getTimeRemaining(),
    };
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.challenge) return;

    const width = 280;
    const height = 90;
    const padding = 10;
    const radius = 6;

    ctx.save();

    // Background panel
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = this.completed ? '#00ff88' : '#4a9eff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚔️ DAILY CHALLENGE', x + padding, y + padding);

    // Objective text (wrapping if needed)
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    const maxTextWidth = width - padding * 2;
    const objectiveText = this.challenge.objective;
    if (ctx.measureText(objectiveText).width > maxTextWidth) {
      // Simple truncation with ellipsis
      let truncated = objectiveText;
      while (ctx.measureText(truncated + '...').width > maxTextWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      ctx.fillText(truncated + '...', x + padding, y + padding + 18);
    } else {
      ctx.fillText(objectiveText, x + padding, y + padding + 18);
    }

    // Progress bar
    const barX = x + padding;
    const barY = y + padding + 38;
    const barWidth = width - padding * 2;
    const barHeight = 14;
    const progressRatio = this.challenge.targetValue > 0
      ? Math.min(this.currentProgress / this.challenge.targetValue, 1)
      : 0;

    // Bar background
    ctx.fillStyle = '#333355';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 3);
    ctx.fill();

    // Bar fill
    if (progressRatio > 0) {
      const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth * progressRatio, barY);
      gradient.addColorStop(0, this.completed ? '#00ff88' : '#4a9eff');
      gradient.addColorStop(1, this.completed ? '#00cc66' : '#2d7fd4');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth * progressRatio, barHeight, 3);
      ctx.fill();
    }

    // Progress text on bar
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const progressText = this.completed
      ? '✓ COMPLETED!'
      : `${this.currentProgress} / ${this.challenge.targetValue}`;
    ctx.fillText(progressText, barX + barWidth / 2, barY + barHeight / 2);

    // Timer and reward row
    const bottomY = y + padding + 58;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '10px Arial';

    // Time remaining
    ctx.fillStyle = '#aaaacc';
    const timeStr = this.formatTimeRemaining(this.getTimeRemaining());
    ctx.fillText(`⏱ ${timeStr}`, x + padding, bottomY);

    // Reward
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'right';
    ctx.fillText(`🎁 ${this.challenge.reward}`, x + width - padding, bottomY);

    ctx.restore();
  }

  private getTimeRemaining(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return Math.max(0, tomorrow.getTime() - now.getTime());
  }

  private formatTimeRemaining(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private getMidnightUTCTimestamp(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  }

  private getTodayString(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  }

  private saveState(): void {
    if (!this.challenge) return;
    try {
      const state: StoredChallengeState = {
        id: this.challenge.id,
        progress: this.currentProgress,
        completed: this.completed,
        date: this.getTodayString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Silently fail - challenge progress is session-based as fallback
    }
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: StoredChallengeState = JSON.parse(stored);
        // Only restore if it's from today
        if (state.date === this.getTodayString()) {
          this.currentProgress = state.progress;
          this.completed = state.completed;
        }
      }
    } catch (e) {
      // Silently fail - start fresh
    }
  }
}
