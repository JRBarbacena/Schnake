// MatchmakingService - assigns players to lowest-ping session with open slots

import { MAX_PLAYERS_PER_SESSION, GameMode } from '@snake-king/shared';
import { GameSession } from './GameSession';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  session: GameSession;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum number of AI bots to populate a new session */
const MIN_INITIAL_BOTS = 20;

/** Maximum number of AI bots to populate a new session */
const MAX_INITIAL_BOTS = 30;

// ─── MatchmakingService ──────────────────────────────────────────────────────

export class MatchmakingService {
  private sessions: Map<string, SessionInfo> = new Map();
  private nextSessionId: number = 1;

  /** Find or create a session for a player based on mode and ping */
  findSession(mode: GameMode, playerPing: Map<string, number>): SessionInfo {
    // 1. Filter sessions by mode with open slots
    const available = Array.from(this.sessions.values()).filter(
      (info) => info.mode === mode && info.playerCount < info.maxPlayers,
    );

    if (available.length === 0) {
      // No sessions with open slots — create a new one
      return this.createSession(mode);
    }

    // 2. Sort by ping (lowest first from playerPing map)
    available.sort((a, b) => {
      const pingA = playerPing.get(a.id) ?? Infinity;
      const pingB = playerPing.get(b.id) ?? Infinity;
      return pingA - pingB;
    });

    // 3. Return first available (lowest ping)
    return available[0];
  }

  /** Create a new session for a mode, fill with AI bots */
  createSession(mode: GameMode): SessionInfo {
    const id = `session_${this.nextSessionId++}`;
    const session = new GameSession();

    // Populate with 20-30 AI bots
    const botCount = MIN_INITIAL_BOTS + Math.floor(Math.random() * (MAX_INITIAL_BOTS - MIN_INITIAL_BOTS + 1));
    for (let i = 0; i < botCount; i++) {
      session.addPlayer(`Bot_${i + 1}`, true);
    }

    const info: SessionInfo = {
      id,
      session,
      mode,
      playerCount: botCount,
      maxPlayers: MAX_PLAYERS_PER_SESSION,
    };

    this.sessions.set(id, info);
    return info;
  }

  /** Remove a player from their session */
  leaveSession(sessionId: string, snakeId: number): void {
    const info = this.sessions.get(sessionId);
    if (!info) return;

    info.session.removePlayer(snakeId);
    info.playerCount = Math.max(0, info.playerCount - 1);

    // Clean up empty sessions (no real players or bots left)
    if (info.playerCount <= 0) {
      this.sessions.delete(sessionId);
    }
  }

  /** Get all active sessions */
  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /** Get session count and player count for lobby display */
  getStats(): { sessionCount: number; totalPlayers: number } {
    let totalPlayers = 0;
    for (const info of this.sessions.values()) {
      totalPlayers += info.playerCount;
    }
    return {
      sessionCount: this.sessions.size,
      totalPlayers,
    };
  }
}
