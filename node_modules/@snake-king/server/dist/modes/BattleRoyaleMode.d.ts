import { ModeConfig } from './ClassicMode';
export declare function getBattleRoyaleModeConfig(): ModeConfig;
/**
 * Controls arena shrinking for Battle Royale mode.
 *
 * The arena shrinks 5% of the original radius every 30 seconds:
 *   radius = originalRadius × (1 - 0.05 × floor(totalElapsed / 30))
 *
 * Snakes outside the current boundary after a shrink are eliminated.
 * Power orbs spawn at 3× rate (every 5s) with a max of 30 active orbs.
 */
export declare class BattleRoyaleController {
    private readonly originalRadius;
    private currentRadius;
    private totalElapsed;
    private shrinkCount;
    /** Shrink interval in seconds */
    private readonly shrinkInterval;
    /** Fraction of original radius lost per shrink step */
    private readonly shrinkPercent;
    /** Minimum radius the arena can shrink to */
    private readonly minimumRadius;
    /**
     * Advance the controller by `dt` seconds.
     * Returns whether the radius changed and the current radius.
     */
    tick(dt: number): {
        radiusChanged: boolean;
        newRadius: number;
    };
    /** Get the current arena radius. */
    getCurrentRadius(): number;
    /** Maximum number of power orbs allowed in Battle Royale. */
    getMaxPowerOrbs(): number;
    /** Get total elapsed time in seconds. */
    getTotalElapsed(): number;
    /** Get how many shrink steps have occurred. */
    getShrinkCount(): number;
    /** Reset the controller to initial state. */
    reset(): void;
}
//# sourceMappingURL=BattleRoyaleMode.d.ts.map