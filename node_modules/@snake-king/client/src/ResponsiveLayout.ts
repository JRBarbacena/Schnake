/** Transition duration for layout changes in ms */
const LAYOUT_TRANSITION_MS = 500;

/** Crown bob animation speed */
const CROWN_BOB_SPEED = 3;
const CROWN_BOB_AMPLITUDE = 3;

/** Crown visual parameters */
const CROWN_SIZE = 20;
const CROWN_COLOR = '#FFD700';
const CROWN_JEWEL_COLOR = '#FF4444';
const CROWN_OUTLINE_COLOR = '#B8860B';

export interface LayoutInfo {
  isLandscape: boolean;
  width: number;
  height: number;
  scale: number;
}

export class ResponsiveLayout {
  private canvas: HTMLCanvasElement;
  private isLandscape: boolean = true;
  private width: number = 0;
  private height: number = 0;
  private scale: number = 1;
  private resizeTimeout: number | null = null;
  private animationTime: number = 0;
  private lastTimestamp: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.lastTimestamp = performance.now();

    // Initial layout calculation
    this.computeLayout();

    // Listen for resize and orientation changes
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  /** Handle resize/orientation change - re-layout within 500ms, no pause */
  handleResize(): void {
    this.onResize();
  }

  private onResize = (): void => {
    // Debounce to stay within 500ms response time
    if (this.resizeTimeout !== null) {
      window.clearTimeout(this.resizeTimeout);
    }

    // Apply layout quickly (within 500ms budget)
    this.resizeTimeout = window.setTimeout(() => {
      this.computeLayout();
      this.resizeTimeout = null;
    }, 50) as unknown as number;
  };

  private computeLayout(): void {
    const dpr = window.devicePixelRatio || 1;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    this.isLandscape = screenWidth >= screenHeight;
    this.width = screenWidth;
    this.height = screenHeight;

    // Scale factor for UI elements based on screen size
    // Reference resolution: 1920x1080
    const refWidth = this.isLandscape ? 1920 : 1080;
    this.scale = Math.min(screenWidth / refWidth, 2);

    // Update canvas dimensions to match screen
    this.canvas.width = screenWidth * dpr;
    this.canvas.height = screenHeight * dpr;
    this.canvas.style.width = `${screenWidth}px`;
    this.canvas.style.height = `${screenHeight}px`;
  }

  /** Get current layout mode */
  getLayout(): LayoutInfo {
    return {
      isLandscape: this.isLandscape,
      width: this.width,
      height: this.height,
      scale: this.scale,
    };
  }

  /** Render rank 1 crown effect above the snake head */
  renderCrownEffect(ctx: CanvasRenderingContext2D, headScreenPos: { x: number; y: number }): void {
    const now = performance.now();
    const dt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    this.animationTime += dt;

    const bobOffset = Math.sin(this.animationTime * CROWN_BOB_SPEED) * CROWN_BOB_AMPLITUDE;
    const x = headScreenPos.x;
    const y = headScreenPos.y - CROWN_SIZE - 10 + bobOffset;

    ctx.save();

    // Crown body
    ctx.fillStyle = CROWN_COLOR;
    ctx.strokeStyle = CROWN_OUTLINE_COLOR;
    ctx.lineWidth = 2;

    ctx.beginPath();
    // Base of crown
    ctx.moveTo(x - CROWN_SIZE * 0.6, y + CROWN_SIZE * 0.4);
    // Left peak
    ctx.lineTo(x - CROWN_SIZE * 0.5, y - CROWN_SIZE * 0.2);
    // Left valley
    ctx.lineTo(x - CROWN_SIZE * 0.2, y + CROWN_SIZE * 0.1);
    // Center peak (tallest)
    ctx.lineTo(x, y - CROWN_SIZE * 0.5);
    // Right valley
    ctx.lineTo(x + CROWN_SIZE * 0.2, y + CROWN_SIZE * 0.1);
    // Right peak
    ctx.lineTo(x + CROWN_SIZE * 0.5, y - CROWN_SIZE * 0.2);
    // Base right
    ctx.lineTo(x + CROWN_SIZE * 0.6, y + CROWN_SIZE * 0.4);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Crown base band
    ctx.fillStyle = CROWN_OUTLINE_COLOR;
    ctx.fillRect(
      x - CROWN_SIZE * 0.6,
      y + CROWN_SIZE * 0.25,
      CROWN_SIZE * 1.2,
      CROWN_SIZE * 0.15
    );

    // Jewel on center peak
    ctx.fillStyle = CROWN_JEWEL_COLOR;
    ctx.beginPath();
    ctx.arc(x, y - CROWN_SIZE * 0.3, CROWN_SIZE * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    const glowIntensity = 0.3 + Math.sin(this.animationTime * 4) * 0.15;
    ctx.shadowColor = CROWN_COLOR;
    ctx.shadowBlur = 10 * glowIntensity;
    ctx.beginPath();
    ctx.arc(x, y, CROWN_SIZE * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, ${glowIntensity})`;
    ctx.fill();

    ctx.restore();
  }

  /** Clean up event listeners */
  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    if (this.resizeTimeout !== null) {
      window.clearTimeout(this.resizeTimeout);
    }
  }
}
