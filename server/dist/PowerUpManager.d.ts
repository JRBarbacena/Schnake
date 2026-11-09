import { Vec2, PowerUpType } from '@snake-king/shared';
export interface ActivePowerUp {
    type: PowerUpType;
    remainingTime: number;
    shieldUsed?: boolean;
}
export interface PowerOrbEntity {
    id: number;
    position: Vec2;
    type: PowerUpType;
}
export declare class PowerUpManager {
    private nextOrbId;
    private spawnTimer;
    private powerOrbs;
    private activePowerUps;
    /**
     * Tick the spawn timer and spawn new power orbs if needed.
     * Returns any newly spawned orbs this tick.
     */
    tickSpawning(dt: number): PowerOrbEntity[];
    private spawnOrb;
    private randomPositionInArena;
    private randomPowerUpType;
    /**
     * Activate a power-up for a snake. Handles state machine logic:
     * - Same type as current → reset duration to full
     * - Different type → replace current with new
     */
    activatePowerUp(snakeId: number, type: PowerUpType): void;
    /**
     * Tick all active power-ups, decrement durations.
     * Returns array of snakeIds whose power-ups expired this tick.
     */
    tickActivePowerUps(dt: number): number[];
    /** Get active power-up for a snake (or undefined) */
    getActivePowerUp(snakeId: number): ActivePowerUp | undefined;
    /** Remove a snake's active power-up (on death or manual removal) */
    removeActivePowerUp(snakeId: number): void;
    /** Get all power orbs currently on the field */
    getPowerOrbs(): PowerOrbEntity[];
    /** Remove a power orb by ID (when collected) */
    removePowerOrb(orbId: number): void;
    /**
     * Check if snake has shield active and absorb collision.
     * Returns true if the collision was absorbed (shield consumed).
     */
    tryAbsorbCollision(snakeId: number): boolean;
    /**
     * Check if snake has ghost active (phase-through).
     * Returns true if the snake can pass through others.
     */
    isGhostActive(snakeId: number): boolean;
    /**
     * Get freeze aura effect: returns array of affected snakes with their
     * speed multiplier for snakes within 200 units of the freezer.
     * The freezer itself is not affected.
     */
    getFreezeAuraEffects(freezerPosition: Vec2, allSnakePositions: Array<{
        id: number;
        position: Vec2;
    }>): Array<{
        snakeId: number;
        speedMultiplier: number;
    }>;
}
//# sourceMappingURL=PowerUpManager.d.ts.map