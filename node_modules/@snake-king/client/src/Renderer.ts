import { Vec2 } from '@snake-king/shared';
import { Camera } from './Camera';

export interface RenderableSnake {
  id: number;
  position: Vec2;
  direction: number;
  segments: Vec2[];
  mass: number;
  evolutionStage: number;
  isBoosting: boolean;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface RenderableOrb {
  id: number;
  position: Vec2;
  size: number;
  colorIndex: number;
}

export interface RenderableZone {
  id: number;
  position: Vec2;
  radius: number;
  type: string;
  fadeState: string;
  fadeProgress: number;
}

/** 12-color palette for orbs */
const ORB_COLORS: string[] = [
  '#ff4444', '#ff8844', '#ffcc44', '#88ff44',
  '#44ff88', '#44ffcc', '#44ccff', '#4488ff',
  '#8844ff', '#cc44ff', '#ff44cc', '#ff4488',
];

/** Zone type to color mapping */
const ZONE_COLORS: Record<string, string> = {
  speed: '#44ccff',
  danger: '#ff4444',
  bonus: '#ffcc44',
  stealth: '#8844ff',
};

/** Glow intensity per evolution stage (0-based index) */
const STAGE_GLOW: number[] = [0, 4, 8, 14, 20, 28];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private time: number = 0;
  private readonly CULL_BUFFER = 200;
  private readonly GRID_SPACING = 80;
  private readonly PARALLAX_FACTOR = 0.5;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;
    this.camera = camera;
  }

  /** Clear and render a full frame */
  render(
    dt: number,
    snakes: RenderableSnake[],
    orbs: RenderableOrb[],
    zones: RenderableZone[],
  ): void {
    this.time += dt;

    const { ctx } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.renderBackground();
    this.renderZones(zones);
    this.renderOrbs(orbs);
    this.renderSnakes(snakes);
  }

  /** Draw grid pattern with 0.5x parallax scroll */
  private renderBackground(): void {
    const { ctx, camera } = this;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Dark background fill
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    // Grid lines with parallax offset
    const parallaxX = camera.position.x * this.PARALLAX_FACTOR;
    const parallaxY = camera.position.y * this.PARALLAX_FACTOR;

    const gridSpacing = this.GRID_SPACING * camera.zoom;

    // Calculate offset so grid appears to scroll at 0.5x rate
    const offsetX = -(parallaxX * camera.zoom) % gridSpacing;
    const offsetY = -(parallaxY * camera.zoom) % gridSpacing;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;

    // Vertical lines
    ctx.beginPath();
    for (let x = offsetX; x <= width; x += gridSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // Horizontal lines
    for (let y = offsetY; y <= height; y += gridSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  /** Render zones as colored gradient circles with animated borders */
  private renderZones(zones: RenderableZone[]): void {
    const { ctx, camera } = this;

    for (const zone of zones) {
      if (!this.isVisible(zone.position, zone.radius)) continue;

      const screen = camera.worldToScreen(zone.position);
      const screenRadius = zone.radius * camera.zoom;
      const color = ZONE_COLORS[zone.type] || '#ffffff';

      // Alpha based on fade state
      let alpha = 0.25;
      if (zone.fadeState === 'fading_in') {
        alpha = 0.25 * zone.fadeProgress;
      } else if (zone.fadeState === 'fading_out') {
        alpha = 0.25 * (1 - zone.fadeProgress);
      }

      // Filled gradient circle
      const gradient = ctx.createRadialGradient(
        screen.x, screen.y, 0,
        screen.x, screen.y, screenRadius,
      );
      gradient.addColorStop(0, this.colorWithAlpha(color, alpha));
      gradient.addColorStop(1, this.colorWithAlpha(color, 0));

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Animated border
      const borderPulse = 0.5 + 0.5 * Math.sin(this.time * 2);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this.colorWithAlpha(color, alpha * borderPulse);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /** Render orbs with pulsing glow at 1.5Hz */
  private renderOrbs(orbs: RenderableOrb[]): void {
    const { ctx, camera } = this;
    const pulseFrequency = 1.5; // Hz

    for (const orb of orbs) {
      if (!this.isVisible(orb.position, orb.size)) continue;

      const screen = camera.worldToScreen(orb.position);
      const color = ORB_COLORS[orb.colorIndex % ORB_COLORS.length];

      // Pulse size using sin(time * 1.5Hz * 2PI), range 8-24u
      const pulse = Math.sin(this.time * pulseFrequency * Math.PI * 2);
      const baseSize = orb.size; // already 8-24u from server
      const pulsedSize = baseSize * (1 + 0.15 * pulse);
      const screenSize = pulsedSize * camera.zoom;

      // Glow effect
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = screenSize * 0.8;

      // Draw orb
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, screenSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.restore();
    }
  }

  /** Render snakes: head at position, body from segments array, glow aura per stage */
  private renderSnakes(snakes: RenderableSnake[]): void {
    const { ctx, camera } = this;

    for (const snake of snakes) {
      // Check if any part is visible (check head + rough bounding)
      if (!this.isVisible(snake.position, snake.mass * 0.1 + 50)) continue;

      const segmentRadius = Math.max(6, Math.min(24, 4 + snake.mass * 0.02));
      const screenRadius = segmentRadius * camera.zoom;
      const glowIntensity = STAGE_GLOW[Math.min(snake.evolutionStage, STAGE_GLOW.length - 1)] || 0;

      // Build full body list: head (position) + body segments
      const allSegments = [snake.position, ...snake.segments];

      // Draw segments from tail to head (head on top)
      for (let i = allSegments.length - 1; i >= 0; i--) {
        const seg = allSegments[i];
        if (!this.isVisible(seg, segmentRadius)) continue;

        const screen = camera.worldToScreen(seg);
        const isHead = i === 0;
        const color = i % 2 === 0 ? snake.primaryColor : snake.secondaryColor;

        // Glow aura based on evolution stage
        if (glowIntensity > 0) {
          ctx.save();
          ctx.shadowColor = snake.primaryColor;
          ctx.shadowBlur = glowIntensity * camera.zoom;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'transparent';
          ctx.fill();
          ctx.restore();
        }

        // Draw segment body
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Boost effect: brighter outline
        if (snake.isBoosting) {
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, screenRadius + 2, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw eyes on head
        if (isHead) {
          this.drawSnakeHead(screen, snake.direction, screenRadius);
        }
      }

      // Draw name above head
      const headScreen = camera.worldToScreen(snake.position);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(12, 14 * camera.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(snake.name, headScreen.x, headScreen.y - screenRadius - 8);
    }
  }

  /** Draw snake eyes on the head segment */
  private drawSnakeHead(screen: Vec2, direction: number, radius: number): void {
    const { ctx } = this;
    const eyeOffset = radius * 0.4;
    const eyeRadius = radius * 0.25;
    const perpAngle = direction + Math.PI / 2;

    // Two eyes offset perpendicular to direction
    for (const side of [-1, 1]) {
      const eyeX = screen.x + Math.cos(direction) * eyeOffset * 0.5
        + Math.cos(perpAngle) * eyeOffset * side;
      const eyeY = screen.y + Math.sin(direction) * eyeOffset * 0.5
        + Math.sin(perpAngle) * eyeOffset * side;

      // White of eye
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Pupil
      ctx.beginPath();
      ctx.arc(
        eyeX + Math.cos(direction) * eyeRadius * 0.3,
        eyeY + Math.sin(direction) * eyeRadius * 0.3,
        eyeRadius * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
  }

  /** Check if a point is within the visible viewport + buffer */
  private isVisible(pos: Vec2, radius: number = 0): boolean {
    const bounds = this.camera.getVisibleBounds();
    const buffer = this.CULL_BUFFER + radius;

    return (
      pos.x >= bounds.minX - buffer &&
      pos.x <= bounds.maxX + buffer &&
      pos.y >= bounds.minY - buffer &&
      pos.y <= bounds.maxY + buffer
    );
  }

  /** Helper: convert a hex color to one with alpha */
  private colorWithAlpha(hex: string, alpha: number): string {
    // Parse hex color
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
