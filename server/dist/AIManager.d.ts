import { Vec2 } from '@snake-king/shared';
import { Snake } from './Physics';
export type AIState = 'foraging' | 'hunting' | 'evading';
export type DifficultyTier = 'easy' | 'medium' | 'hard';
export interface AIBotConfig {
    tier: DifficultyTier;
    reactionTime: number;
    detectionRange: number;
}
export declare class AIBot {
    id: number;
    state: AIState;
    targetId: number | null;
    reactionTimer: number;
    boostTimer: number;
    boostCooldown: number;
    config: AIBotConfig;
    lastTargetDistance: number;
    constructor(id: number, tier: DifficultyTier);
    /**
     * Update AI decision-making.
     * Returns the desired direction angle and whether to boost.
     */
    update(dt: number, selfSnake: Snake, allSnakes: Snake[], nearbyOrbs: Vec2[]): {
        targetDirection: number;
        shouldBoost: boolean;
    };
    private transitionState;
    private findThreats;
    private findPrey;
    private executeForaging;
    private executeHunting;
    private executeEvading;
    private updateBoostTimers;
    private canBoost;
    /**
     * Called externally to signal that a boost was started this frame.
     * Starts the boost timer tracking.
     */
    startBoost(): void;
}
export declare class AIManager {
    private bots;
    private respawnQueue;
    /** Add a new AI bot with randomized difficulty tier */
    addBot(snakeId: number): void;
    /** Remove a bot (on elimination), queue respawn */
    removeBot(snakeId: number): void;
    /** Get a bot by snake ID */
    getBot(snakeId: number): AIBot | undefined;
    /** Get the number of active bots */
    get botCount(): number;
    /**
     * Tick all bots and respawn queue.
     * Returns a map of snake ID → decision for each active bot.
     */
    tick(dt: number, getSnake: (id: number) => Snake | undefined, allSnakes: Snake[], nearbyOrbs: (pos: Vec2) => Vec2[]): Map<number, {
        targetDirection: number;
        shouldBoost: boolean;
    }>;
    /** Get pending respawns (bots ready to spawn) and remove them from queue */
    getPendingRespawns(): number;
    /** Randomize tier: ~50% Easy, ~30% Medium, ~20% Hard */
    private randomTier;
}
//# sourceMappingURL=AIManager.d.ts.map