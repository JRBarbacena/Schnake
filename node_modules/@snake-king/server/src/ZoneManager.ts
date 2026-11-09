import {
  Vec2,
  ZoneType,
  ZONE_ROTATION_INTERVAL,
  ZONE_FADE_DURATION,
  ARENA_RADIUS,
  ZONE_TYPES,
  vecDistance,
} from '@snake-king/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FadeState = 'none' | 'fading_out' | 'fading_in';

export interface ZoneEntity {
  id: number;
  position: Vec2;
  radius: number; // 200-500 units
  type: ZoneType;
  fadeState: FadeState;
  fadeTimer: number; // seconds into current fade
}

export interface ZoneEffect {
  snakeId: number;
  type: ZoneType;
  speedMultiplier?: number; // Speed zone: 1.5
  massDrain?: number; // Danger zone: 3/s
  orbValueMultiplier?: number; // Bonus zone: 2x
  opacity?: number; // Stealth zone: 0.3
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_ZONES = 5;
const MAX_ZONES = 8;
const MIN_ZONE_RADIUS = 200;
const MAX_ZONE_RADIUS = 500;
const BOUNDARY_BUFFER = 600;
const MAX_PLACEMENT_ATTEMPTS = 100;

// ─── ZoneManager ─────────────────────────────────────────────────────────────

export class ZoneManager {
  private zones: ZoneEntity[] = [];
  private rotationTimer: number = 0;
  private nextId: number = 1;

  constructor() {
    this.generateZones();
  }

  /** Generate initial zones (5-8 zones, at least one of each type, no overlap, 600u from boundary) */
  generateZones(): void {
    this.zones = [];

    const count = MIN_ZONES + Math.floor(Math.random() * (MAX_ZONES - MIN_ZONES + 1));

    // At least one of each type (4 mandatory), rest are random
    const types: ZoneType[] = [...ZONE_TYPES];
    for (let i = types.length; i < count; i++) {
      types.push(ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)]);
    }

    // Shuffle the types array for randomized placement order
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    for (const type of types) {
      const radius = MIN_ZONE_RADIUS + Math.random() * (MAX_ZONE_RADIUS - MIN_ZONE_RADIUS);
      const position = this.findValidPosition(radius);

      if (position) {
        this.zones.push({
          id: this.nextId++,
          position,
          radius,
          type,
          fadeState: 'none',
          fadeTimer: 0,
        });
      }
    }
  }

  /** Tick zone timers: handle rotation every 120s, fade transitions */
  tick(dt: number): void {
    // Check if any zones are currently fading
    const fadingOut = this.zones.some((z) => z.fadeState === 'fading_out');
    const fadingIn = this.zones.some((z) => z.fadeState === 'fading_in');

    if (fadingOut) {
      // Progress fade-out timers
      let allDone = true;
      for (const zone of this.zones) {
        if (zone.fadeState === 'fading_out') {
          zone.fadeTimer += dt;
          if (zone.fadeTimer < ZONE_FADE_DURATION) {
            allDone = false;
          }
        }
      }

      if (allDone) {
        // Fade-out complete: generate new zones with fading_in state
        this.generateZones();
        for (const zone of this.zones) {
          zone.fadeState = 'fading_in';
          zone.fadeTimer = 0;
        }
      }
    } else if (fadingIn) {
      // Progress fade-in timers
      let allDone = true;
      for (const zone of this.zones) {
        if (zone.fadeState === 'fading_in') {
          zone.fadeTimer += dt;
          if (zone.fadeTimer < ZONE_FADE_DURATION) {
            allDone = false;
          }
        }
      }

      if (allDone) {
        // Fade-in complete: zones are now fully active
        for (const zone of this.zones) {
          zone.fadeState = 'none';
          zone.fadeTimer = 0;
        }
        this.rotationTimer = 0;
      }
    } else {
      // Normal state: count towards next rotation
      this.rotationTimer += dt;

      if (this.rotationTimer >= ZONE_ROTATION_INTERVAL) {
        // Start fade-out: effects removed immediately
        for (const zone of this.zones) {
          zone.fadeState = 'fading_out';
          zone.fadeTimer = 0;
        }
      }
    }
  }

  /** Get all zones */
  getZones(): ZoneEntity[] {
    return this.zones;
  }

  /** Calculate effects for a snake at a given position */
  getEffectsForSnake(snakeId: number, position: Vec2): ZoneEffect | null {
    const zone = this.isInsideActiveZone(position);
    if (!zone) return null;

    const effect: ZoneEffect = { snakeId, type: zone.type };

    switch (zone.type) {
      case ZoneType.Speed:
        effect.speedMultiplier = 1.5;
        break;
      case ZoneType.Danger:
        effect.massDrain = 3;
        break;
      case ZoneType.Bonus:
        effect.orbValueMultiplier = 2;
        break;
      case ZoneType.Stealth:
        effect.opacity = 0.3;
        break;
    }

    return effect;
  }

  /** Check if a position is inside any active zone (fadeState === 'none') */
  isInsideActiveZone(position: Vec2): ZoneEntity | null {
    for (const zone of this.zones) {
      if (zone.fadeState !== 'none') continue;
      if (vecDistance(position, zone.position) <= zone.radius) {
        return zone;
      }
    }
    return null;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /** Find a valid position for a zone using rejection sampling */
  private findValidPosition(radius: number): Vec2 | null {
    const maxCenterDistance = ARENA_RADIUS - BOUNDARY_BUFFER;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      // Random position within allowed area
      const angle = Math.random() * 2 * Math.PI;
      const dist = Math.random() * maxCenterDistance;
      const position: Vec2 = {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      };

      // Check overlap with existing zones
      let overlaps = false;
      for (const existing of this.zones) {
        const minDistance = radius + existing.radius;
        if (vecDistance(position, existing.position) < minDistance) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        return position;
      }
    }

    return null;
  }
}
