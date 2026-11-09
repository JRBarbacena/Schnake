// HUD (Heads-Up Display) for "Who's the Snake King"
// Displays mass, peak mass, eliminations, survival time, evolution stage,
// progress bar, power-up timer, and player rank.

export interface HUDState {
  mass: number;
  peakMass: number;
  eliminations: number;
  survivalTime: number; // seconds
  evolutionStage: number;
  evolutionProgress: number; // 0-1
  activePowerUp?: { type: string; remainingTime: number };
  playerRank: number;
}

export class HUD {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(state: HUDState): void {
    const ctx = this.ctx;
    const canvas = ctx.canvas;

    ctx.save();

    // ─── Top-Left: Mass & Peak Mass ───────────────────────────────────
    this.renderMassPanel(state, 16, 16);

    // ─── Top-Left below mass: Eliminations & Survival Time ────────────
    this.renderStatsPanel(state, 16, 80);

    // ─── Top-Left below stats: Evolution Stage & Progress Bar ─────────
    this.renderEvolutionPanel(state, 16, 130);

    // ─── Top-Right: Player Rank ───────────────────────────────────────
    this.renderRank(state, canvas.width - 16, 16);

    // ─── Top-Center: Active Power-Up Timer ────────────────────────────
    if (state.activePowerUp) {
      this.renderPowerUpTimer(state.activePowerUp, canvas.width / 2, 16);
    }

    ctx.restore();
  }

  private renderMassPanel(state: HUDState, x: number, y: number): void {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, 180, 56, 8);
    ctx.fill();

    // Mass label
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Mass: ${Math.floor(state.mass)}`, x + 10, y + 8);

    // Peak mass
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Peak: ${Math.floor(state.peakMass)}`, x + 10, y + 34);
  }

  private renderStatsPanel(state: HUDState, x: number, y: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, 180, 40, 8);
    ctx.fill();

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const timeStr = this.formatTime(state.survivalTime);
    ctx.fillText(`Eliminations: ${state.eliminations}`, x + 10, y + 8);
    ctx.fillText(`Time: ${timeStr}`, x + 10, y + 24);
  }

  private renderEvolutionPanel(state: HUDState, x: number, y: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, 180, 48, 8);
    ctx.fill();

    // Stage label
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Stage ${state.evolutionStage}`, x + 10, y + 6);

    // Progress bar background
    const barX = x + 10;
    const barY = y + 26;
    const barWidth = 160;
    const barHeight = 14;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 4);
    ctx.fill();

    // Progress bar fill
    const progress = Math.max(0, Math.min(1, state.evolutionProgress));
    if (progress > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth * progress, barHeight, 4);
      ctx.fill();
    }

    // Progress percentage text
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${Math.floor(progress * 100)}%`,
      barX + barWidth / 2,
      barY + barHeight / 2
    );
  }

  private renderRank(state: HUDState, x: number, y: number): void {
    const ctx = this.ctx;

    const text = `#${state.playerRank}`;
    ctx.font = 'bold 24px sans-serif';
    const metrics = ctx.measureText(text);
    const width = metrics.width + 24;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x - width, y, width, 38, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x - 12, y + 8);
  }

  private renderPowerUpTimer(
    powerUp: { type: string; remainingTime: number },
    centerX: number,
    y: number
  ): void {
    const ctx = this.ctx;

    const label = `${powerUp.type} (${powerUp.remainingTime.toFixed(1)}s)`;
    ctx.font = 'bold 16px sans-serif';
    const metrics = ctx.measureText(label);
    const width = metrics.width + 24;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(centerX - width / 2, y, width, 32, 8);
    ctx.fill();

    // Timer bar background
    const barX = centerX - width / 2 + 6;
    const barY = y + 26;
    const barWidth = width - 12;
    const barHeight = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 2);
    ctx.fill();

    // Timer bar fill (assume max 15s for visual)
    const fraction = Math.min(1, powerUp.remainingTime / 15);
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth * fraction, barHeight, 2);
    ctx.fill();

    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, centerX, y + 6);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
