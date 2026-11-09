// MiniMap for "Who's the Snake King"
// 150×150px bottom-right corner overlay
// Shows player dot, boundary, zones, nearby snakes, power orbs
// Updates at 10fps, boundary flashes red at 2Hz when within 15% of edge
// Toggle with M key / tap

import { Vec2, ARENA_RADIUS } from '@snake-king/shared';

export interface MiniMapData {
  playerPosition: Vec2;
  nearbySnakes: Array<{ position: Vec2; teamColor?: string }>;
  zones: Array<{ position: Vec2; radius: number; type: string }>;
  powerOrbs: Array<{ position: Vec2 }>;
  distanceToEdge: number; // as fraction of arena radius (0 = at edge, 1 = center)
}

/** Size of the mini-map in pixels */
const MAP_SIZE = 150;

/** Margin from edge of canvas */
const MAP_MARGIN = 12;

/** Fraction of arena radius at which border starts flashing */
const EDGE_WARNING_THRESHOLD = 0.15;

/** Flash frequency in Hz */
const FLASH_FREQUENCY = 2;

/** Zone type to color mapping */
const ZONE_COLORS: Record<string, string> = {
  speed: 'rgba(0, 200, 255, 0.4)',
  danger: 'rgba(255, 60, 60, 0.4)',
  bonus: 'rgba(255, 215, 0, 0.4)',
  stealth: 'rgba(128, 0, 255, 0.4)',
};

export class MiniMap {
  private ctx: CanvasRenderingContext2D;
  private visible: boolean = true;
  private flashTimer: number = 0;
  private lastUpdateTime: number = 0;
  private readonly updateInterval: number = 1000 / 10; // 10fps

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.setupToggle();
  }

  render(data: MiniMapData): void {
    if (!this.visible) return;

    // Throttle to 10fps
    const now = performance.now();
    if (now - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = now;

    // Advance flash timer
    this.flashTimer = (now / 1000) * FLASH_FREQUENCY * Math.PI * 2;

    const ctx = this.ctx;
    const canvas = ctx.canvas;

    // Position: bottom-right corner
    const mapX = canvas.width - MAP_SIZE - MAP_MARGIN;
    const mapY = canvas.height - MAP_SIZE - MAP_MARGIN;
    const centerX = mapX + MAP_SIZE / 2;
    const centerY = mapY + MAP_SIZE / 2;

    ctx.save();

    // Clip to circular map area
    ctx.beginPath();
    ctx.arc(centerX, centerY, MAP_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(mapX, mapY, MAP_SIZE, MAP_SIZE);

    // Scale factor: map arena to mini-map pixels
    const scale = (MAP_SIZE / 2) / ARENA_RADIUS;

    // ─── Zones ────────────────────────────────────────────────────────
    for (const zone of data.zones) {
      const zoneMapX = centerX + zone.position.x * scale;
      const zoneMapY = centerY + zone.position.y * scale;
      const zoneRadius = zone.radius * scale;

      ctx.fillStyle = ZONE_COLORS[zone.type] || 'rgba(128, 128, 128, 0.4)';
      ctx.beginPath();
      ctx.arc(zoneMapX, zoneMapY, zoneRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── Power Orbs ───────────────────────────────────────────────────
    ctx.fillStyle = '#ff00ff';
    for (const orb of data.powerOrbs) {
      const orbMapX = centerX + orb.position.x * scale;
      const orbMapY = centerY + orb.position.y * scale;
      ctx.beginPath();
      ctx.arc(orbMapX, orbMapY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── Nearby Snakes ────────────────────────────────────────────────
    for (const snake of data.nearbySnakes) {
      const snakeMapX = centerX + snake.position.x * scale;
      const snakeMapY = centerY + snake.position.y * scale;

      ctx.fillStyle = snake.teamColor || '#ff4444';
      ctx.beginPath();
      ctx.arc(snakeMapX, snakeMapY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── Player Dot (white, larger) ───────────────────────────────────
    const playerMapX = centerX + data.playerPosition.x * scale;
    const playerMapY = centerY + data.playerPosition.y * scale;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playerMapX, playerMapY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ─── Boundary Circle ──────────────────────────────────────────────
    ctx.save();
    const isNearEdge = data.distanceToEdge <= EDGE_WARNING_THRESHOLD;

    if (isNearEdge) {
      // Flash red at 2Hz
      const flashAlpha = (Math.sin(this.flashTimer) + 1) / 2; // 0-1
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + flashAlpha * 0.5})`;
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, MAP_SIZE / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  private setupToggle(): void {
    // Keyboard toggle: M key
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        this.toggle();
      }
    });

    // Tap toggle: tap in the mini-map area
    const canvas = this.ctx.canvas;
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;

      const mapX = canvas.width - MAP_SIZE - MAP_MARGIN;
      const mapY = canvas.height - MAP_SIZE - MAP_MARGIN;

      if (
        tapX >= mapX &&
        tapX <= mapX + MAP_SIZE &&
        tapY >= mapY &&
        tapY <= mapY + MAP_SIZE
      ) {
        this.toggle();
      }
    });
  }
}
