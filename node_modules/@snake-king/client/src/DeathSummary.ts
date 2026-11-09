export interface DeathStats {
  finalMass: number;
  finalRank: number;
  snakesEliminated: number;
  timeSurvived: number;
  orbsCollected: number;
}

export class DeathSummary {
  private visible: boolean = false;
  private stats: DeathStats | null = null;
  private onSpectate: () => void;
  private onLobby: () => void;

  // Button dimensions for click detection
  private readonly BUTTON_WIDTH = 180;
  private readonly BUTTON_HEIGHT = 44;
  private spectateButtonRect = { x: 0, y: 0, w: 0, h: 0 };
  private lobbyButtonRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(onSpectate: () => void, onLobby: () => void) {
    this.onSpectate = onSpectate;
    this.onLobby = onLobby;
  }

  /** Show the death summary with final stats */
  show(stats: DeathStats): void {
    this.stats = stats;
    this.visible = true;
  }

  /** Hide the death summary */
  hide(): void {
    this.visible = false;
    this.stats = null;
  }

  /** Whether the summary is currently visible */
  isVisible(): boolean {
    return this.visible;
  }

  /** Render the death summary overlay */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible || !this.stats) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.save();

    // Dimmed background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, width, height);

    // Panel
    const panelW = 400;
    const panelH = 360;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠️ Eliminated!', width / 2, panelY + 40);

    // Stats
    const stats = this.stats;
    const statLines = [
      { label: 'Final Mass', value: Math.floor(stats.finalMass).toString() },
      { label: 'Rank', value: `#${stats.finalRank}` },
      { label: 'Snakes Eliminated', value: stats.snakesEliminated.toString() },
      { label: 'Time Survived', value: this.formatTime(stats.timeSurvived) },
      { label: 'Orbs Collected', value: stats.orbsCollected.toString() },
    ];

    const startY = panelY + 80;
    const lineHeight = 36;

    statLines.forEach((stat, i) => {
      const y = startY + i * lineHeight;

      // Label
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, panelX + 40, y);

      // Value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(stat.value, panelX + panelW - 40, y);
    });

    // Buttons
    const buttonY = panelY + panelH - 70;
    const gap = 20;

    // Spectate button
    const spectBtnX = width / 2 - this.BUTTON_WIDTH - gap / 2;
    this.spectateButtonRect = {
      x: spectBtnX,
      y: buttonY,
      w: this.BUTTON_WIDTH,
      h: this.BUTTON_HEIGHT,
    };
    this.renderButton(ctx, spectBtnX, buttonY, '👁️ Spectate', '#4488ff');

    // Lobby button
    const lobbyBtnX = width / 2 + gap / 2;
    this.lobbyButtonRect = {
      x: lobbyBtnX,
      y: buttonY,
      w: this.BUTTON_WIDTH,
      h: this.BUTTON_HEIGHT,
    };
    this.renderButton(ctx, lobbyBtnX, buttonY, '🏠 Lobby', '#44aa44');

    ctx.restore();
  }

  /** Handle click events on the death summary */
  handleClick(x: number, y: number): void {
    if (!this.visible) return;

    if (this.isInsideRect(x, y, this.spectateButtonRect)) {
      this.hide();
      this.onSpectate();
    } else if (this.isInsideRect(x, y, this.lobbyButtonRect)) {
      this.hide();
      this.onLobby();
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private renderButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, this.BUTTON_WIDTH, this.BUTTON_HEIGHT, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + this.BUTTON_WIDTH / 2, y + this.BUTTON_HEIGHT / 2);
  }

  private isInsideRect(
    x: number,
    y: number,
    rect: { x: number; y: number; w: number; h: number }
  ): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
