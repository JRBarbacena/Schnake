import { LEADERBOARD_SIZE, LEADERBOARD_UPDATE_INTERVAL } from '@snake-king/shared';

export interface LeaderboardEntry {
  snakeId: number;
  name: string;
  mass: number;
  evolutionStage: number;
  achievedAt: number; // timestamp when this mass was first reached
}

interface MassTracking {
  lastMass: number;
  achievedAt: number;
}

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];
  private broadcastTimer: number = 0;
  private massTracker: Map<number, MassTracking> = new Map();

  /**
   * Update leaderboard with current snake data. Call every tick.
   * Tracks when each snake first reached its current mass level to break ties.
   */
  update(
    snakes: Array<{ id: number; name: string; mass: number; evolutionStage: number }>
  ): void {
    const now = Date.now();

    const scored: LeaderboardEntry[] = snakes.map((snake) => {
      const tracked = this.massTracker.get(snake.id);

      if (!tracked) {
        // First time seeing this snake
        const entry: MassTracking = { lastMass: snake.mass, achievedAt: now };
        this.massTracker.set(snake.id, entry);
        return {
          snakeId: snake.id,
          name: snake.name,
          mass: snake.mass,
          evolutionStage: snake.evolutionStage,
          achievedAt: now,
        };
      }

      if (snake.mass !== tracked.lastMass) {
        // Mass changed — update timestamp
        tracked.lastMass = snake.mass;
        tracked.achievedAt = now;
      }

      return {
        snakeId: snake.id,
        name: snake.name,
        mass: snake.mass,
        evolutionStage: snake.evolutionStage,
        achievedAt: tracked.achievedAt,
      };
    });

    // Sort descending by mass, ties broken by earliest achievedAt
    scored.sort((a, b) => {
      if (b.mass !== a.mass) return b.mass - a.mass;
      return a.achievedAt - b.achievedAt;
    });

    this.entries = scored.slice(0, LEADERBOARD_SIZE);

    // Clean up tracker for snakes no longer present
    const activeIds = new Set(snakes.map((s) => s.id));
    for (const id of this.massTracker.keys()) {
      if (!activeIds.has(id)) {
        this.massTracker.delete(id);
      }
    }
  }

  /**
   * Tick broadcast timer. Returns true if it's time to broadcast.
   * @param dt Delta time in milliseconds since last tick.
   */
  tickBroadcast(dt: number): boolean {
    this.broadcastTimer += dt;
    if (this.broadcastTimer >= LEADERBOARD_UPDATE_INTERVAL) {
      this.broadcastTimer -= LEADERBOARD_UPDATE_INTERVAL;
      return true;
    }
    return false;
  }

  /** Get current top 10 entries */
  getTop10(): LeaderboardEntry[] {
    return this.entries;
  }

  /** Get a specific player's rank (1-indexed, or -1 if not found) */
  getPlayerRank(snakeId: number): number {
    const index = this.entries.findIndex((e) => e.snakeId === snakeId);
    return index === -1 ? -1 : index + 1;
  }
}
