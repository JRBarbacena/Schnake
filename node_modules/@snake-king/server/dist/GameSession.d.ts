import { Vec2, InputMessage, PowerUpType } from '@snake-king/shared';
import { Snake } from './Physics';
import { LeaderboardManager } from './LeaderboardManager';
export interface OrbEntity {
    id: number;
    position: Vec2;
    size: number;
    value: number;
    colorIndex: number;
}
export interface PlayerInfo {
    snakeId: number;
    name: string;
    isBot: boolean;
}
export interface StateDelta {
    tick: number;
    snakes: SnakeDelta[];
    orbs: OrbDelta[];
    removedSnakeIds: number[];
    removedOrbIds: number[];
    powerOrbs: PowerOrbDelta[];
    removedPowerOrbIds: number[];
}
export interface SnakeDelta {
    id: number;
    position: Vec2;
    direction: number;
    segments: Vec2[];
    mass: number;
    speed: number;
    isBoosting: boolean;
    evolutionStage: number;
    name: string;
}
export interface OrbDelta {
    id: number;
    position: Vec2;
    size: number;
    value: number;
    colorIndex: number;
}
export interface PowerOrbDelta {
    id: number;
    position: Vec2;
    type: PowerUpType;
}
export declare class GameSession {
    private snakes;
    private orbs;
    private players;
    private physics;
    private collisionEngine;
    private evolutionSystem;
    private powerUpManager;
    private zoneManager;
    private aiManager;
    private leaderboard;
    private currentTick;
    private nextSnakeId;
    private nextOrbId;
    private inputQueue;
    private removedSnakeIds;
    private removedOrbIds;
    private removedPowerOrbIds;
    constructor();
    /** Run one game tick (called at 20Hz) */
    gameTick(dt: number): void;
    private applyInputs;
    private updateAI;
    private applyPhysics;
    private applyZones;
    private runCollisions;
    private processPowerUps;
    private checkEvolution;
    private updateLeaderboard;
    private spawnOrbs;
    /** Add a player and spawn their snake. Returns snakeId. */
    addPlayer(name: string, isBot?: boolean): number;
    /** Remove a player and their snake */
    removePlayer(snakeId: number): void;
    /** Queue an input for processing next tick */
    processInput(snakeId: number, input: InputMessage): void;
    /** Get interest-managed state delta for a specific player */
    getStateDelta(snakeId: number): StateDelta;
    /** Get all active snakes as an array */
    getSnakes(): Snake[];
    /** Get all orbs */
    getOrbs(): Map<number, OrbEntity>;
    /** Get current tick number */
    getTick(): number;
    /** Get leaderboard manager */
    getLeaderboard(): LeaderboardManager;
    /** Get a snake by ID */
    getSnake(snakeId: number): Snake | undefined;
    /** Get player info */
    getPlayer(snakeId: number): PlayerInfo | undefined;
    private eliminateSnake;
    private findSpawnPosition;
    private isSafeSpawnPosition;
    private randomPositionInRadius;
    private randomOrbPosition;
    private randomOrbSize;
    private addOrb;
    private adjustSegments;
    private getNearbyOrbPositions;
}
//# sourceMappingURL=GameSession.d.ts.map