import { PowerUpType, POWER_ORB_SPAWN_INTERVAL, MAX_POWER_ORBS, POWER_UP_DURATIONS, ARENA_RADIUS, vecDistance, } from '@snake-king/shared';
// ─── Constants ───────────────────────────────────────────────────────────────
/** Power orbs spawn within the inner 80% of the arena */
const SPAWN_RADIUS_FRACTION = 0.8;
/** Freeze aura effect radius in units */
const FREEZE_AURA_RADIUS = 200;
/** Freeze aura speed multiplier (50% slow) */
const FREEZE_AURA_SPEED_MULTIPLIER = 0.5;
// ─── All PowerUpType values for uniform random selection ─────────────────────
const ALL_POWER_UP_TYPES = [
    PowerUpType.Shield,
    PowerUpType.Magnet,
    PowerUpType.Ghost,
    PowerUpType.SpeedSurge,
    PowerUpType.MassDrain,
    PowerUpType.FreezeAura,
];
// ─── PowerUpManager ──────────────────────────────────────────────────────────
export class PowerUpManager {
    constructor() {
        this.nextOrbId = 1;
        this.spawnTimer = 0;
        this.powerOrbs = [];
        this.activePowerUps = new Map(); // snakeId → active power-up
    }
    // ─── Spawn Logic ─────────────────────────────────────────────────────────
    /**
     * Tick the spawn timer and spawn new power orbs if needed.
     * Returns any newly spawned orbs this tick.
     */
    tickSpawning(dt) {
        const spawned = [];
        this.spawnTimer += dt;
        while (this.spawnTimer >= POWER_ORB_SPAWN_INTERVAL &&
            this.powerOrbs.length < MAX_POWER_ORBS) {
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
    spawnOrb() {
        const position = this.randomPositionInArena();
        const type = this.randomPowerUpType();
        return {
            id: this.nextOrbId++,
            position,
            type,
        };
    }
    randomPositionInArena() {
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
    randomPowerUpType() {
        const index = Math.floor(Math.random() * ALL_POWER_UP_TYPES.length);
        return ALL_POWER_UP_TYPES[index];
    }
    // ─── Activation & State Machine ─────────────────────────────────────────
    /**
     * Activate a power-up for a snake. Handles state machine logic:
     * - Same type as current → reset duration to full
     * - Different type → replace current with new
     */
    activatePowerUp(snakeId, type) {
        const current = this.activePowerUps.get(snakeId);
        if (current && current.type === type) {
            // Same type: reset duration
            current.remainingTime = POWER_UP_DURATIONS[type];
        }
        else {
            // Different type or no current: replace
            const newPowerUp = {
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
    tickActivePowerUps(dt) {
        const expired = [];
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
    getActivePowerUp(snakeId) {
        return this.activePowerUps.get(snakeId);
    }
    /** Remove a snake's active power-up (on death or manual removal) */
    removeActivePowerUp(snakeId) {
        this.activePowerUps.delete(snakeId);
    }
    /** Get all power orbs currently on the field */
    getPowerOrbs() {
        return this.powerOrbs;
    }
    /** Remove a power orb by ID (when collected) */
    removePowerOrb(orbId) {
        this.powerOrbs = this.powerOrbs.filter((orb) => orb.id !== orbId);
    }
    // ─── Effect Helpers ─────────────────────────────────────────────────────
    /**
     * Check if snake has shield active and absorb collision.
     * Returns true if the collision was absorbed (shield consumed).
     */
    tryAbsorbCollision(snakeId) {
        const powerUp = this.activePowerUps.get(snakeId);
        if (powerUp &&
            powerUp.type === PowerUpType.Shield &&
            !powerUp.shieldUsed) {
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
    isGhostActive(snakeId) {
        const powerUp = this.activePowerUps.get(snakeId);
        return powerUp !== undefined && powerUp.type === PowerUpType.Ghost;
    }
    /**
     * Get freeze aura effect: returns array of affected snakes with their
     * speed multiplier for snakes within 200 units of the freezer.
     * The freezer itself is not affected.
     */
    getFreezeAuraEffects(freezerPosition, allSnakePositions) {
        const affected = [];
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
//# sourceMappingURL=PowerUpManager.js.map