// AIManager - AI bot management with state machine, difficulty tiers, and respawn queue

import {
  Vec2,
  vecDistance,
  vecSubtract,
  vecNormalize,
  vecAdd,
  vecScale,
  vecAngle,
  vecFromAngle,
} from '@snake-king/shared';
import { Snake } from './Physics';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIState = 'foraging' | 'hunting' | 'evading';
export type DifficultyTier = 'easy' | 'medium' | 'hard';

export interface AIBotConfig {
  tier: DifficultyTier;
  reactionTime: number;   // ms between decisions (400, 200, 100)
  detectionRange: number; // units (300, 400, 500)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIER_CONFIGS: Record<DifficultyTier, Omit<AIBotConfig, 'tier'>> = {
  easy:   { reactionTime: 400, detectionRange: 300 },
  medium: { reactionTime: 200, detectionRange: 400 },
  hard:   { reactionTime: 100, detectionRange: 500 },
};

/** Mass ratio threshold to enter hunting state */
const HUNT_MASS_RATIO = 0.6;

/** Mass ratio threshold to enter evading state */
const EVADE_MASS_RATIO = 1.5;

/** Distance at which evading state triggers */
const EVADE_TRIGGER_DISTANCE = 300;

/** Hysteresis exit distance for hunting (exits when target > 500u away) */
const HUNT_EXIT_DISTANCE = 500;

/** Hysteresis exit distance for evading (exits when threat > 400u away) */
const EVADE_EXIT_DISTANCE = 400;

/** Maximum continuous boost duration in seconds */
const MAX_BOOST_DURATION = 2;

/** Minimum cooldown between boost bursts in seconds */
const BOOST_COOLDOWN = 3;

/** Respawn delay in seconds */
const RESPAWN_DELAY = 5;

// ─── AIBot ───────────────────────────────────────────────────────────────────

export class AIBot {
  id: number;
  state: AIState = 'foraging';
  targetId: number | null = null;
  reactionTimer: number = 0;
  boostTimer: number = 0;
  boostCooldown: number = 0;
  config: AIBotConfig;
  lastTargetDistance: number = Infinity;

  constructor(id: number, tier: DifficultyTier) {
    this.id = id;
    this.config = { tier, ...TIER_CONFIGS[tier] };
  }

  /**
   * Update AI decision-making.
   * Returns the desired direction angle and whether to boost.
   */
  update(
    dt: number,
    selfSnake: Snake,
    allSnakes: Snake[],
    nearbyOrbs: Vec2[],
  ): { targetDirection: number; shouldBoost: boolean } {
    // Update timers
    this.reactionTimer += dt * 1000; // dt in seconds → ms
    this.updateBoostTimers(dt);

    // Only make decisions at reaction rate
    if (this.reactionTimer < this.config.reactionTime) {
      return {
        targetDirection: selfSnake.targetDirection,
        shouldBoost: selfSnake.isBoosting,
      };
    }
    this.reactionTimer = 0;

    // Evaluate threats and prey
    const threats = this.findThreats(selfSnake, allSnakes);
    const prey = this.findPrey(selfSnake, allSnakes);

    // State transitions
    this.transitionState(selfSnake, threats, prey);

    // Execute current state behavior
    switch (this.state) {
      case 'evading':
        return this.executeEvading(selfSnake, threats);
      case 'hunting':
        return this.executeHunting(selfSnake, allSnakes);
      case 'foraging':
      default:
        return this.executeForaging(selfSnake, nearbyOrbs);
    }
  }

  // ─── State Transitions ───────────────────────────────────────────────────

  private transitionState(
    selfSnake: Snake,
    threats: Array<{ snake: Snake; distance: number }>,
    prey: Array<{ snake: Snake; distance: number }>,
  ): void {
    switch (this.state) {
      case 'foraging':
        // Check for threats first (higher priority)
        if (threats.length > 0 && threats[0].distance <= EVADE_TRIGGER_DISTANCE) {
          this.state = 'evading';
          this.targetId = threats[0].snake.id;
          break;
        }
        // Check for prey within detection range
        if (prey.length > 0 && prey[0].distance <= this.config.detectionRange) {
          this.state = 'hunting';
          this.targetId = prey[0].snake.id;
        }
        break;

      case 'hunting':
        // Check for threats (evade takes priority)
        if (threats.length > 0 && threats[0].distance <= EVADE_TRIGGER_DISTANCE) {
          this.state = 'evading';
          this.targetId = threats[0].snake.id;
          break;
        }
        // Exit hunting with hysteresis: no target within 500u
        if (this.targetId !== null) {
          const target = prey.find(p => p.snake.id === this.targetId);
          if (!target || target.distance > HUNT_EXIT_DISTANCE) {
            this.state = 'foraging';
            this.targetId = null;
          }
        } else {
          // Target lost, try to acquire new target
          if (prey.length > 0 && prey[0].distance <= this.config.detectionRange) {
            this.targetId = prey[0].snake.id;
          } else {
            this.state = 'foraging';
          }
        }
        break;

      case 'evading':
        // Exit evading with hysteresis: no threat within 400u
        if (threats.length === 0 || threats[0].distance > EVADE_EXIT_DISTANCE) {
          this.state = 'foraging';
          this.targetId = null;
        } else {
          // Update to closest threat
          this.targetId = threats[0].snake.id;
        }
        break;
    }
  }

  // ─── Threat/Prey Detection ─────────────────────────────────────────────

  private findThreats(
    selfSnake: Snake,
    allSnakes: Snake[],
  ): Array<{ snake: Snake; distance: number }> {
    const threats: Array<{ snake: Snake; distance: number }> = [];

    for (const other of allSnakes) {
      if (other.id === selfSnake.id) continue;
      const dist = vecDistance(selfSnake.position, other.position);
      // Threat: larger than 1.5x our mass
      if (other.mass > selfSnake.mass * EVADE_MASS_RATIO) {
        threats.push({ snake: other, distance: dist });
      }
    }

    // Sort by distance (closest first)
    threats.sort((a, b) => a.distance - b.distance);
    return threats;
  }

  private findPrey(
    selfSnake: Snake,
    allSnakes: Snake[],
  ): Array<{ snake: Snake; distance: number }> {
    const prey: Array<{ snake: Snake; distance: number }> = [];

    for (const other of allSnakes) {
      if (other.id === selfSnake.id) continue;
      const dist = vecDistance(selfSnake.position, other.position);
      // Prey: smaller than 0.6x our mass
      if (other.mass < selfSnake.mass * HUNT_MASS_RATIO) {
        prey.push({ snake: other, distance: dist });
      }
    }

    // Sort by distance (closest first)
    prey.sort((a, b) => a.distance - b.distance);
    return prey;
  }

  // ─── State Behaviors ───────────────────────────────────────────────────

  private executeForaging(
    selfSnake: Snake,
    nearbyOrbs: Vec2[],
  ): { targetDirection: number; shouldBoost: boolean } {
    if (nearbyOrbs.length === 0) {
      // Wander: keep current direction
      return { targetDirection: selfSnake.direction, shouldBoost: false };
    }

    // Find closest orb
    let closestOrb = nearbyOrbs[0];
    let closestDist = vecDistance(selfSnake.position, nearbyOrbs[0]);

    for (let i = 1; i < nearbyOrbs.length; i++) {
      const dist = vecDistance(selfSnake.position, nearbyOrbs[i]);
      if (dist < closestDist) {
        closestDist = dist;
        closestOrb = nearbyOrbs[i];
      }
    }

    const toOrb = vecSubtract(closestOrb, selfSnake.position);
    const targetDirection = vecAngle(toOrb);

    return { targetDirection, shouldBoost: false };
  }

  private executeHunting(
    selfSnake: Snake,
    allSnakes: Snake[],
  ): { targetDirection: number; shouldBoost: boolean } {
    const target = allSnakes.find(s => s.id === this.targetId);
    if (!target) {
      // Target gone, fall back to current direction
      return { targetDirection: selfSnake.direction, shouldBoost: false };
    }

    // Interception point prediction:
    // Steer toward a point ahead of the target's current heading
    const targetVelocity = vecFromAngle(target.direction);
    const targetFuturePos = vecAdd(
      target.position,
      vecScale(targetVelocity, target.speed * 0.5), // predict 0.5s ahead
    );

    const toTarget = vecSubtract(targetFuturePos, selfSnake.position);
    const targetDirection = vecAngle(toTarget);

    // Calculate distance to target for boost decisions
    const currentDistance = vecDistance(selfSnake.position, target.position);

    // Boost discipline: only boost if target distance is increasing (escaping)
    const distanceIncreasing = currentDistance > this.lastTargetDistance;
    this.lastTargetDistance = currentDistance;

    const shouldBoost = distanceIncreasing && this.canBoost();

    return { targetDirection, shouldBoost };
  }

  private executeEvading(
    selfSnake: Snake,
    threats: Array<{ snake: Snake; distance: number }>,
  ): { targetDirection: number; shouldBoost: boolean } {
    if (threats.length === 0) {
      return { targetDirection: selfSnake.direction, shouldBoost: false };
    }

    // Run away from the closest threat
    const threat = threats[0];
    const awayFromThreat = vecSubtract(selfSnake.position, threat.snake.position);
    const targetDirection = vecAngle(awayFromThreat);

    return { targetDirection, shouldBoost: false };
  }

  // ─── Boost Management ──────────────────────────────────────────────────

  private updateBoostTimers(dt: number): void {
    if (this.boostTimer > 0) {
      // Currently boosting
      this.boostTimer += dt;
      if (this.boostTimer >= MAX_BOOST_DURATION) {
        // End boost burst
        this.boostTimer = 0;
        this.boostCooldown = BOOST_COOLDOWN;
      }
    } else if (this.boostCooldown > 0) {
      // In cooldown
      this.boostCooldown -= dt;
      if (this.boostCooldown < 0) {
        this.boostCooldown = 0;
      }
    }
  }

  private canBoost(): boolean {
    return this.boostTimer === 0 && this.boostCooldown <= 0;
  }

  /**
   * Called externally to signal that a boost was started this frame.
   * Starts the boost timer tracking.
   */
  startBoost(): void {
    if (this.boostTimer === 0 && this.boostCooldown <= 0) {
      this.boostTimer = 0.001; // tiny value to indicate boost just started
    }
  }
}

// ─── AIManager ───────────────────────────────────────────────────────────────

export class AIManager {
  private bots: Map<number, AIBot> = new Map();
  private respawnQueue: Array<{ timer: number }> = [];

  /** Add a new AI bot with randomized difficulty tier */
  addBot(snakeId: number): void {
    const tier = this.randomTier();
    const bot = new AIBot(snakeId, tier);
    this.bots.set(snakeId, bot);
  }

  /** Remove a bot (on elimination), queue respawn */
  removeBot(snakeId: number): void {
    this.bots.delete(snakeId);
    this.respawnQueue.push({ timer: RESPAWN_DELAY });
  }

  /** Get a bot by snake ID */
  getBot(snakeId: number): AIBot | undefined {
    return this.bots.get(snakeId);
  }

  /** Get the number of active bots */
  get botCount(): number {
    return this.bots.size;
  }

  /**
   * Tick all bots and respawn queue.
   * Returns a map of snake ID → decision for each active bot.
   */
  tick(
    dt: number,
    getSnake: (id: number) => Snake | undefined,
    allSnakes: Snake[],
    nearbyOrbs: (pos: Vec2) => Vec2[],
  ): Map<number, { targetDirection: number; shouldBoost: boolean }> {
    const decisions = new Map<number, { targetDirection: number; shouldBoost: boolean }>();

    // Update each bot
    for (const [snakeId, bot] of this.bots) {
      const snake = getSnake(snakeId);
      if (!snake) continue;

      const orbs = nearbyOrbs(snake.position);
      const decision = bot.update(dt, snake, allSnakes, orbs);
      decisions.set(snakeId, decision);

      // Track boost state
      if (decision.shouldBoost && bot.boostTimer === 0 && bot.boostCooldown <= 0) {
        bot.startBoost();
      }
    }

    // Update respawn queue
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      this.respawnQueue[i].timer -= dt;
    }

    return decisions;
  }

  /** Get pending respawns (bots ready to spawn) and remove them from queue */
  getPendingRespawns(): number {
    let count = 0;
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      if (this.respawnQueue[i].timer <= 0) {
        this.respawnQueue.splice(i, 1);
        count++;
      }
    }
    return count;
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────

  /** Randomize tier: ~50% Easy, ~30% Medium, ~20% Hard */
  private randomTier(): DifficultyTier {
    const roll = Math.random();
    if (roll < 0.5) return 'easy';
    if (roll < 0.8) return 'medium';
    return 'hard';
  }
}
