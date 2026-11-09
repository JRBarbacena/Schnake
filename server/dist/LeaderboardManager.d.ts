export interface LeaderboardEntry {
    snakeId: number;
    name: string;
    mass: number;
    evolutionStage: number;
    achievedAt: number;
}
export declare class LeaderboardManager {
    private entries;
    private broadcastTimer;
    private massTracker;
    /**
     * Update leaderboard with current snake data. Call every tick.
     * Tracks when each snake first reached its current mass level to break ties.
     */
    update(snakes: Array<{
        id: number;
        name: string;
        mass: number;
        evolutionStage: number;
    }>): void;
    /**
     * Tick broadcast timer. Returns true if it's time to broadcast.
     * @param dt Delta time in milliseconds since last tick.
     */
    tickBroadcast(dt: number): boolean;
    /** Get current top 10 entries */
    getTop10(): LeaderboardEntry[];
    /** Get a specific player's rank (1-indexed, or -1 if not found) */
    getPlayerRank(snakeId: number): number;
}
//# sourceMappingURL=LeaderboardManager.d.ts.map