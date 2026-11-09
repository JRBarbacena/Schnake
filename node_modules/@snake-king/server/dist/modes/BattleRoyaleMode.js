import { GameMode, ARENA_RADIUS, MAX_PLAYERS_PER_SESSION } from '@snake-king/shared';
export function getBattleRoyaleModeConfig() {
    return {
        mode: GameMode.BattleRoyale,
        maxPlayers: MAX_PLAYERS_PER_SESSION,
        timeLimit: null,
        arenaShrinksPerTick: 0, // handled by BattleRoyaleController
        powerOrbSpawnMultiplier: 3, // every 5s instead of 15s
        boostDrainEnabled: true,
        orbSpawnRateMultiplier: 1,
        friendlyFireDisabled: false,
    };
}
/**
 * Controls arena shrinking for Battle Royale mode.
 *
 * The arena shrinks 5% of the original radius every 30 seconds:
 *   radius = originalRadius × (1 - 0.05 × floor(totalElapsed / 30))
 *
 * Snakes outside the current boundary after a shrink are eliminated.
 * Power orbs spawn at 3× rate (every 5s) with a max of 30 active orbs.
 */
export class BattleRoyaleController {
    constructor() {
        this.originalRadius = ARENA_RADIUS;
        this.currentRadius = ARENA_RADIUS;
        this.totalElapsed = 0;
        this.shrinkCount = 0;
        /** Shrink interval in seconds */
        this.shrinkInterval = 30;
        /** Fraction of original radius lost per shrink step */
        this.shrinkPercent = 0.05;
        /** Minimum radius the arena can shrink to */
        this.minimumRadius = 100;
    }
    /**
     * Advance the controller by `dt` seconds.
     * Returns whether the radius changed and the current radius.
     */
    tick(dt) {
        this.totalElapsed += dt;
        const expectedShrinks = Math.floor(this.totalElapsed / this.shrinkInterval);
        if (expectedShrinks > this.shrinkCount) {
            this.shrinkCount = expectedShrinks;
            const newRadius = this.originalRadius * (1 - this.shrinkPercent * this.shrinkCount);
            this.currentRadius = Math.max(newRadius, this.minimumRadius);
            return { radiusChanged: true, newRadius: this.currentRadius };
        }
        return { radiusChanged: false, newRadius: this.currentRadius };
    }
    /** Get the current arena radius. */
    getCurrentRadius() {
        return this.currentRadius;
    }
    /** Maximum number of power orbs allowed in Battle Royale. */
    getMaxPowerOrbs() {
        return 30;
    }
    /** Get total elapsed time in seconds. */
    getTotalElapsed() {
        return this.totalElapsed;
    }
    /** Get how many shrink steps have occurred. */
    getShrinkCount() {
        return this.shrinkCount;
    }
    /** Reset the controller to initial state. */
    reset() {
        this.currentRadius = this.originalRadius;
        this.totalElapsed = 0;
        this.shrinkCount = 0;
    }
}
//# sourceMappingURL=BattleRoyaleMode.js.map