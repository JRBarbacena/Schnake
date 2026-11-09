/**
 * AssetLoader - Manages loading of game assets (fonts, canvas setup)
 * Displays progress bar reflecting percentage of total bytes loaded.
 * Since we use procedural audio and canvas rendering, the "assets"
 * are mainly font loading and canvas setup.
 */

export class AssetLoader {
  private progress: number = 0;
  private onProgress: (p: number) => void;

  constructor(onProgress: (p: number) => void) {
    this.onProgress = onProgress;
  }

  /** Load all assets, calling onProgress as loading advances */
  async load(): Promise<void> {
    // Step 1: Load and ensure the primary game font is available
    this.setProgress(0.1);

    try {
      // Attempt to load a sans-serif system font (used everywhere in the game)
      if (document.fonts) {
        // Preload the system font by rendering a test string
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        if (testCtx) {
          testCtx.font = 'bold 24px sans-serif';
          testCtx.fillText('Who\'s the Snake King', 0, 0);
        }
        this.setProgress(0.3);

        // Wait for any pending font loads
        await document.fonts.ready;
      }
    } catch {
      // Font loading is best-effort; game works with system fonts
    }

    this.setProgress(0.5);

    // Step 2: Verify canvas 2D context support
    const testCanvas = document.createElement('canvas');
    const ctx = testCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not supported in this browser.');
    }

    this.setProgress(0.7);

    // Step 3: Precompute any needed resources (color palettes, etc.)
    // This simulates a small async load for any future sprite/texture additions
    await this.delay(50);
    this.setProgress(0.9);

    // Step 4: Final initialization complete
    await this.delay(50);
    this.setProgress(1.0);
  }

  getProgress(): number {
    return this.progress;
  }

  /** Render a loading progress bar onto a canvas context */
  static renderProgressBar(
    ctx: CanvasRenderingContext2D,
    progress: number,
    width: number,
    height: number,
  ): void {
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Who's the Snake King", width / 2, height / 2 - 60);

    // Loading text
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Loading... ${Math.floor(progress * 100)}%`, width / 2, height / 2 - 20);

    // Progress bar background
    const barWidth = Math.min(400, width * 0.6);
    const barHeight = 16;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 8);
    ctx.fill();

    // Progress bar fill
    if (progress > 0) {
      const fillWidth = barWidth * Math.min(1, progress);
      const gradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(1, '#16a34a');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillWidth, barHeight, 8);
      ctx.fill();
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private setProgress(value: number): void {
    this.progress = value;
    this.onProgress(value);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
