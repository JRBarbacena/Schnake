import { Vec2 } from '@snake-king/shared';
export interface Snake {
    id: number;
    position: Vec2;
    direction: number;
    targetDirection: number;
    segments: Vec2[];
    mass: number;
    speed: number;
    isBoosting: boolean;
    evolutionStage: number;
    pathHistory: Vec2[];
    boostLocked: boolean;
    massAccumulator: number;
    boostTrailTimer: number;
}
export interface TrailOrb {
    position: Vec2;
    value: number;
}
export interface DeathOrb {
    position: Vec2;
    value: number;
}
export declare class PhysicsEngine {
    /**
     * Rotate snake direction toward targetDirection at max MAX_TURN_RATE rad/s.
     * Snaps to target if the remaining angle is within one frame's rotation.
     */
    applyTurnRate(snake: Snake, dt: number): void;
    /**
     * Move snake head forward by speed × dt along current direction.
     * Prepends the new position to pathHistory for segment following.
     */
    moveSnake(snake: Snake, dt: number): void;
    /**
     * Update segment positions to follow pathHistory with SEGMENT_SPACING between each.
     * Each segment is placed at (segIndex + 1) * SEGMENT_SPACING distance along the path.
     */
    updateSegments(snake: Snake): void;
    /**
     * Calculate effective speed: base × stageBonus × zoneMultiplier + boostBonus, capped at MAX_SPEED_CAP.
     */
    calculateEffectiveSpeed(snake: Snake, stageBonus: number, zoneMultiplier: number, isBoosting: boolean): number;
    /**
     * Apply boost mechanics: drain mass, lock boost if mass too low, spawn trail orbs on interval.
     * Returns array of trail orbs spawned this frame.
     */
    applyBoost(snake: Snake, dt: number, efficiency: number): TrailOrb[];
    /**
     * Generate death orbs from an eliminated snake.
     * 80% of mass is distributed as orbs placed at segment positions.
     */
    spawnDeathOrbs(snake: Snake): DeathOrb[];
}
//# sourceMappingURL=Physics.d.ts.map