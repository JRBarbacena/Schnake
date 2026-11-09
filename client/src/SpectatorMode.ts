import { ARENA_RADIUS } from '@snake-king/shared';

export interface SpectatorSnakeStats {
  mass: number;
  stage: number;
  powerUps?: string[];
}

export class SpectatorMode {
  private active: boolean = false;
  private followTarget: number | null = null;
  private freeCamera: boolean = false;
  private spectatedSnakes: number[] = [];
  private currentIndex: number = 0;

  // Free camera state
  private cameraX: number = 0;
  private cameraY: number = 0;
  private readonly CAMERA_SPEED = 400; // units/second
  private keys: Set<string> = new Set();

  // Touch/gesture state
  private panStartX: number = 0;
  private panStartY: number = 0;
  private lastTapTime: number = 0;
  private readonly DOUBLE_TAP_THRESHOLD = 300; // ms

  // Spectator count broadcast
  private spectatorCount: number = 0;
  private spectatorCountTimer: number = 0;
  private readonly SPECTATOR_COUNT_INTERVAL = 2000; // ms

  // Death prompt timing
  private deathPromptShown: boolean = false;
  private deathTime: number = 0;
  private readonly DEATH_PROMPT_DELAY = 2000; // ms

  // Match end state
  private matchEnded: boolean = false;

  // Bound event handlers
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(private onReturnToLobby: () => void) {
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
  }

  /** Activate spectator mode with surviving snake IDs */
  start(survivingSnakeIds: number[]): void {
    this.active = true;
    this.spectatedSnakes = [...survivingSnakeIds];
    this.currentIndex = 0;
    this.followTarget = this.spectatedSnakes[0] ?? null;
    this.freeCamera = false;
    this.matchEnded = false;
    this.deathPromptShown = false;
    this.deathTime = Date.now();

    this.attachListeners();
  }

  /** Deactivate spectator mode and clean up */
  stop(): void {
    this.active = false;
    this.followTarget = null;
    this.freeCamera = false;
    this.spectatedSnakes = [];
    this.currentIndex = 0;
    this.keys.clear();
    this.matchEnded = false;

    this.detachListeners();
  }

  /** Cycle to next surviving snake */
  cycleNext(): void {
    if (this.spectatedSnakes.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.spectatedSnakes.length;
    this.followTarget = this.spectatedSnakes[this.currentIndex];
    this.freeCamera = false;
  }

  /** Cycle to previous surviving snake */
  cyclePrevious(): void {
    if (this.spectatedSnakes.length === 0) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.spectatedSnakes.length) % this.spectatedSnakes.length;
    this.followTarget = this.spectatedSnakes[this.currentIndex];
    this.freeCamera = false;
  }

  /** Toggle between follow-camera and free-camera modes */
  toggleFreeCamera(): void {
    this.freeCamera = !this.freeCamera;
  }

  /** Update spectator state; returns camera target position */
  update(dt: number): { cameraTarget: { x: number; y: number } | null } {
    if (!this.active) return { cameraTarget: null };

    // Check death prompt timing
    if (!this.deathPromptShown && Date.now() - this.deathTime >= this.DEATH_PROMPT_DELAY) {
      this.deathPromptShown = true;
    }

    // Update spectator count timer
    this.spectatorCountTimer += dt * 1000;
    if (this.spectatorCountTimer >= this.SPECTATOR_COUNT_INTERVAL) {
      this.spectatorCountTimer = 0;
      // Spectator count would be broadcast to server here
    }

    // Handle free camera movement (WASD)
    if (this.freeCamera) {
      const speed = this.CAMERA_SPEED * dt;

      if (this.keys.has('w') || this.keys.has('W')) this.cameraY -= speed;
      if (this.keys.has('s') || this.keys.has('S')) this.cameraY += speed;
      if (this.keys.has('a') || this.keys.has('A')) this.cameraX -= speed;
      if (this.keys.has('d') || this.keys.has('D')) this.cameraX += speed;

      // Constrain to arena bounds
      this.cameraX = this.clampToArena(this.cameraX);
      this.cameraY = this.clampToArena(this.cameraY);

      return { cameraTarget: { x: this.cameraX, y: this.cameraY } };
    }

    // Follow mode: return null to indicate using follow target's position
    if (this.followTarget !== null) {
      return { cameraTarget: null };
    }

    return { cameraTarget: { x: this.cameraX, y: this.cameraY } };
  }

  /** Render spectator UI overlay */
  render(ctx: CanvasRenderingContext2D, snakeStats?: SpectatorSnakeStats): void {
    if (!this.active) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.save();

    // Spectator mode banner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const modeText = this.freeCamera ? '🎥 Free Camera' : '👁️ Spectating';
    ctx.fillText(modeText, width / 2, 20);

    // Spectated snake stats
    if (snakeStats && !this.freeCamera) {
      this.renderSnakeStats(ctx, snakeStats, width);
    }

    // Controls hint
    this.renderControlsHint(ctx, width, height);

    // Match ended overlay
    if (this.matchEnded) {
      this.renderMatchEndOverlay(ctx, width, height);
    }

    ctx.restore();
  }

  /** Whether spectator mode is currently active */
  isActive(): boolean {
    return this.active;
  }

  /** Get current follow target ID */
  getFollowTarget(): number | null {
    return this.freeCamera ? null : this.followTarget;
  }

  /** Update the list of surviving snakes (when one is eliminated) */
  updateSurvivingSnakes(snakeIds: number[]): void {
    this.spectatedSnakes = [...snakeIds];

    if (this.spectatedSnakes.length === 0) {
      this.matchEnded = true;
      return;
    }

    // Adjust index if needed
    if (this.currentIndex >= this.spectatedSnakes.length) {
      this.currentIndex = 0;
    }
    this.followTarget = this.spectatedSnakes[this.currentIndex];
  }

  /** Set spectator count for display to alive players */
  setSpectatorCount(count: number): void {
    this.spectatorCount = count;
  }

  /** Get spectator count (for alive players to display) */
  getSpectatorCount(): number {
    return this.spectatorCount;
  }

  /** Handle match end while spectating */
  handleMatchEnd(): void {
    this.matchEnded = true;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private clampToArena(value: number): number {
    return Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, value));
  }

  private attachListeners(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: false });
  }

  private detachListeners(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.active) return;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        this.cycleNext();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.cyclePrevious();
        break;
      case 'Tab':
        e.preventDefault();
        this.toggleFreeCamera();
        break;
      case 'Escape':
        e.preventDefault();
        this.stop();
        this.onReturnToLobby();
        break;
      case 'w':
      case 'W':
      case 'a':
      case 'A':
      case 's':
      case 'S':
      case 'd':
      case 'D':
        this.keys.add(e.key);
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key);
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.active) return;

    const touch = e.touches[0];
    if (!touch) return;

    this.panStartX = touch.clientX;
    this.panStartY = touch.clientY;

    // Double-tap detection for toggle free camera
    const now = Date.now();
    if (now - this.lastTapTime < this.DOUBLE_TAP_THRESHOLD) {
      this.toggleFreeCamera();
    }
    this.lastTapTime = now;
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.active || !this.freeCamera) return;
    e.preventDefault();

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - this.panStartX;
    const dy = touch.clientY - this.panStartY;

    // Pan gesture moves free camera
    this.cameraX -= dx * 2;
    this.cameraY -= dy * 2;
    this.cameraX = this.clampToArena(this.cameraX);
    this.cameraY = this.clampToArena(this.cameraY);

    this.panStartX = touch.clientX;
    this.panStartY = touch.clientY;
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.active) return;

    // Swipe detection for cycling snakes
    if (!this.freeCamera && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.panStartX;

      if (Math.abs(dx) > 50) {
        if (dx > 0) {
          this.cycleNext();
        } else {
          this.cyclePrevious();
        }
      }
    }
  }

  private renderSnakeStats(
    ctx: CanvasRenderingContext2D,
    stats: SpectatorSnakeStats,
    canvasWidth: number
  ): void {
    const y = 55;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(canvasWidth / 2 - 150, y - 12, 300, 30);

    ctx.fillStyle = '#ffcc00';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const statsText = `Mass: ${Math.floor(stats.mass)} | Stage: ${stats.stage}`;
    ctx.fillText(statsText, canvasWidth / 2, y);

    if (stats.powerUps && stats.powerUps.length > 0) {
      ctx.fillStyle = '#66ff66';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Power-ups: ${stats.powerUps.join(', ')}`, canvasWidth / 2, y + 22);
    }
  }

  private renderControlsHint(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const hints = this.freeCamera
      ? 'WASD: Pan | Tab: Follow mode | Esc: Lobby'
      : '← →: Cycle | Tab: Free cam | Esc: Lobby';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(canvasWidth / 2 - 180, canvasHeight - 40, 360, 30);

    ctx.fillStyle = '#cccccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hints, canvasWidth / 2, canvasHeight - 25);
  }

  private renderMatchEndOverlay(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Match Over', canvasWidth / 2, canvasHeight / 2 - 30);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Press Escape to return to lobby', canvasWidth / 2, canvasHeight / 2 + 10);
  }
}
