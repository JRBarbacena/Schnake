/**
 * @snake-king/server - Game server entry point
 * Wires all server components, starts WebSocket server at port 8080,
 * runs 20Hz tick loop, broadcasts state deltas, and manages matchmaking.
 */

import { GameSession } from './GameSession';
import { GameWebSocketServer } from './WebSocketServer';
import { MatchmakingService } from './Matchmaking';
import { DailyChallengeGenerator } from './DailyChallenge';
import { GameMode, TICK_RATE, TICK_DURATION_MS } from '@snake-king/shared';

// ─── Configuration ───────────────────────────────────────────────────────────

const WS_PORT = 8080;
const INITIAL_BOT_COUNT = 20;

// ─── Server Bootstrap ────────────────────────────────────────────────────────

class GameServer {
  private session: GameSession;
  private wsServer: GameWebSocketServer;
  private matchmaking: MatchmakingService;
  private dailyChallenge: DailyChallengeGenerator;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = Date.now();

  constructor() {
    // Create the main game session
    this.session = new GameSession();

    // Create WebSocket server bound to the session
    this.wsServer = new GameWebSocketServer(WS_PORT, this.session);

    // Create matchmaking service
    this.matchmaking = new MatchmakingService();

    // Create daily challenge generator
    this.dailyChallenge = new DailyChallengeGenerator();
  }

  start(): void {
    console.log(`[SnakeKing] Starting server...`);

    // Start WebSocket server
    this.wsServer.start();
    console.log(`[SnakeKing] WebSocket server listening on port ${WS_PORT}`);

    // Generate today's daily challenge
    const challenge = this.dailyChallenge.getCurrentChallenge();
    console.log(`[SnakeKing] Daily Challenge: ${challenge.objective} (Reward: ${challenge.reward})`);

    // Add initial AI bots
    this.addInitialBots();
    console.log(`[SnakeKing] Added ${INITIAL_BOT_COUNT} AI bots to the arena`);

    // Create an initial matchmaking session
    this.matchmaking.createSession(GameMode.Classic);
    console.log(`[SnakeKing] Created initial Classic mode session`);

    // Start the game tick loop at 20Hz (50ms interval)
    this.startTickLoop();
    console.log(`[SnakeKing] Game loop running at ${TICK_RATE}Hz (${TICK_DURATION_MS}ms per tick)`);

    // Handle graceful shutdown
    this.setupShutdown();

    console.log(`[SnakeKing] Server ready! Waiting for players...`);
  }

  private startTickLoop(): void {
    this.lastTickTime = Date.now();

    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTickTime) / 1000; // seconds
      this.lastTickTime = now;

      // Run game simulation tick
      this.session.gameTick(dt);

      // Broadcast state deltas to all connected clients
      this.wsServer.broadcastDeltas();
    }, TICK_DURATION_MS);
  }

  private addInitialBots(): void {
    for (let i = 0; i < INITIAL_BOT_COUNT; i++) {
      this.session.addPlayer(`Bot_${i + 1}`, true);
    }
  }

  private setupShutdown(): void {
    const shutdown = () => {
      console.log(`\n[SnakeKing] Shutting down...`);

      // Stop tick loop
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }

      // Close WebSocket server
      this.wsServer.close();

      console.log(`[SnakeKing] Server stopped.`);
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

// ─── Start Server ────────────────────────────────────────────────────────────

const server = new GameServer();
server.start();
