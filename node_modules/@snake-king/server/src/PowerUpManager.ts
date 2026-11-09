import {
  Vec2,
  PowerUpType,
  POWER_ORB_SPAWN_INTERVAL,
  MAX_POWER_ORBS,
  POWER_UP_DURATIONS,
  ARENA_RADIUS,
  vecDistance,
} from '@snake-king/shared';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ActivePowerUp {
  type: PowerUpType;
  remainingTime: number; // seconds
  shieldUsed?: boolean; // for Shield: has the collision been absorbed
}

export interface PowerOrbEntity {
  id: number;
  position: Vec2;
  type: PowerUpType;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Power orbs spawn within the inner 80% of the arena */
const SPAWN_RADIUS_FRACTION = 0.8;

/** Freeze aura effect radius in units */
const FREEZE_AURA_RADIUS = 200;

/** Freeze aura speed multiplier (50% slow) */
const FREEZE_AURA_SPEED_MULTIPLIER = 0.5;

// ─── All PowerUpType values for uniform random selection ─────────────────────

const ALL_POWER_UP_TYPES: PowerUpType[] = [
  PowerUpType.Shield,
  PowerUpType.Magnet,
  PowerUpType.Ghost,
  PowerUpType.SpeedSurge,
  PowerUpType.MassDrain,
  PowerUpType.FreezeAura,
];

// ─── PowerUpManager ──────────────────────────────────────────────────────────

export class PowerUpManager {
  private nextOrbId: number = 1;
  private spawnTimer: number = 0;
  private powerOrbs: PowerOrbEntity[] = [];
  private activePowerUps: Map<number, ActivePowerUp> = new Map(); // snakeId → active power-up

  // ─── Spawn Logic ─────────────────────────────────────────────────────────

  /**
   * Tick the spawn timer and spawn new power orbs if needed.
   * Returns any newly spawned orbs this tick.
   */
  tickSpawning(dt: number): PowerOrbEntity[] {
    const spawned: PowerOrbEntity[] = [];

    this.spawnTimer += dt;

    while (
      this.spawnTimer >= POWER_ORB_SPAWN_INTERVAL &&
      this.powerOrbs.length < MAX_POWER_ORBS
    ) {
      this.spawnTimer -= POWER_ORB_SPAWN_INTERVAL;

      const orb = this.spawnOrb();
      this.powerOrbs.push(orb);
      spawned.push(orb);
    }

    // If at max capacity, just consume the timer without spawning
    if (this.spawnTimer >= POWER_ORB_SPAWN_INTERVAL) {
      this.spawnTimer = 0;
    }

    return spawned;
  }

  private spawnOrb(): PowerOrbEntity {
    const position = this.randomPositionInArena();
    const type = this.randomPowerUpType();

    return {
      id: this.nextOrbId++,
      position,
      type,
    };
  }

  private randomPositionInArena(): Vec2 {
    // Uniform distribution within a circle of radius ARENA_RADIUS * 0.8
    const maxRadius = ARENA_RADIUS * SPAWN_RADIUS_FRACTION;
    const angle = Math.random() * 2 * Math.PI;
    // Use sqrt for uniform area distribution
    const r = Math.sqrt(Math.random()) * maxRadius;
    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    };
  }

  private randomPowerUpType(): PowerUpType {
    const index = Math.floor(Math.random() * ALL_POWER_UP_TYPES.length);
    return ALL_POWER_UP_TYPES[index];
  }

  // ─── Activation & State Machine ─────────────────────────────────────────

  /**
   * Activate a power-up for a snake. Handles state machine logic:
   * - Same type as current → reset duration to full
   * - Different type → replace current with new
   */
  activatePowerUp(snakeId: number, type: PowerUpType): void {
    const current = this.activePowerUps.get(snakeId);

    if (current && current.type === type) {
      // Same type: reset duration
      current.remainingTime = POWER_UP_DURATIONS[type];
    } else {
      // Different type or no current: replace
      const newPowerUp: ActivePowerUp = {
        type,
        remainingTime: POWER_UP_DURATIONS[type],
      };

      if (type === PowerUpType.Shield) {
        newPowerUp.shieldUsed = false;
      }

      this.activePowerUps.set(snakeId, newPowerUp);
    }
  }

  // ─── Tick Active Power-Ups ──────────────────────────────────────────────

  /**
   * Tick all active power-ups, decrement durations.
   * Returns array of snakeIds whose power-ups expired this tick.
   */
  tickActivePowerUps(dt: number): number[] {
    const expired: number[] = [];

    for (const [snakeId, powerUp] of this.activePowerUps) {
      powerUp.remainingTime -= dt;

      if (powerUp.remainingTime <= 0) {
        expired.push(snakeId);
        this.activePowerUps.delete(snakeId);
      }
    }

    return expired;
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  /** Get active power-up for a snake (or undefined) */
  getActivePowerUp(snakeId: number): ActivePowerUp | undefined {
    return this.activePowerUps.get(snakeId);
  }

  /** Remove a snake's active power-up (on death or manual removal) */
  removeActivePowerUp(snakeId: number): void {
    this.activePowerUps.delete(snakeId);
  }

  /** Get all power orbs currently on the field */
  getPowerOrbs(): PowerOrbEntity[] {
    return this.powerOrbs;
  }

  /** Remove a power orb by ID (when collected) */
  removePowerOrb(orbId: number): void {
    this.powerOrbs = this.powerOrbs.filter((orb) => orb.id !== orbId);
  }

  // ─── Effect Helpers ─────────────────────────────────────────────────────

  /**
   * Check if snake has shield active and absorb collision.
   * Returns true if the collision was absorbed (shield consumed).
   */
  tryAbsorbCollision(snakeId: number): boolean {
    const powerUp = this.activePowerUps.get(snakeId);

    if (
      powerUp &&
      powerUp.type === PowerUpType.Shield &&
      !powerUp.shieldUsed
    ) {
      powerUp.shieldUsed = true;
      // Remove the power-up after absorption (one-use)
      this.activePowerUps.delete(snakeId);
      return true;
    }

    return false;
  }

  /**
   * Check if snake has ghost active (phase-through).
   * Returns true if the snake can pass through others.
   */
  isGhostActive(snakeId: number): boolean {
    const powerUp = this.activePowerUps.get(snakeId);
    return powerUp !== undefined && powerUp.type === PowerUpType.Ghost;
  }

  /**
   * Get freeze aura effect: returns array of affected snakes with their
   * speed multiplier for snakes within 200 units of the freezer.
   * The freezer itself is not affected.
   */
  getFreezeAuraEffects(
    freezerPosition: Vec2,
    allSnakePositions: Array<{ id: number; position: Vec2 }>
  ): Array<{ snakeId: number; speedMultiplier: number }> {
    const affected: Array<{ snakeId: number; speedMultiplier: number }> = [];

    for (const snake of allSnakePositions) {
      const dist = vecDistance(freezerPosition, snake.position);
      if (dist <= FREEZE_AURA_RADIUS) {
        affected.push({
          snakeId: snake.id,
          speedMultiplier: FREEZE_AURA_SPEED_MULTIPLIER,
        });
      }
    }

    return affected;
  }
}
