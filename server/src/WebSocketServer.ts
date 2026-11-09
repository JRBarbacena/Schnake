// WebSocketServer - handles WebSocket connections, binary message routing,
// per-tick delta broadcast with interest management, and latency monitoring.

import WebSocket, { WebSocketServer as WSServer } from 'ws';
import {
  decodeInput,
} from '@snake-king/shared';
import { GameSession } from './GameSession';

// ─── Client Info ─────────────────────────────────────────────────────────────

interface ClientInfo {
  snakeId: number;
  latency: number;
  highLatencyStart: number; // timestamp when high latency began, 0 if normal
  lastPingSent: number;     // timestamp of last ping sent
}

// ─── GameWebSocketServer ─────────────────────────────────────────────────────

export class GameWebSocketServer {
  private wss: WSServer;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private session: GameSession;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(port: number, session: GameSession) {
    this.wss = new WSServer({ port });
    this.session = session;
  }

  /** Start listening for connections */
  start(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });
    // Removed ping monitoring - browser WebSocket doesn't support ws-style ping/pong
  }

  /** Broadcast state deltas to all connected clients */
  broadcastDeltas(): void {
    for (const [ws, client] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      const sessionDelta = this.session.getStateDelta(client.snakeId);
      // Send as JSON for now (includes full segments)
      ws.send(JSON.stringify(sessionDelta));
    }
  }

  /** Handle incoming message from a client */
  handleMessage(ws: WebSocket, data: Buffer | ArrayBuffer | string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      if (typeof data === 'string') {
        // JSON input fallback
        const input = JSON.parse(data);
        this.session.processInput(client.snakeId, input);
      } else {
        // Binary input
        const buf = data instanceof ArrayBuffer
          ? data
          : new Uint8Array(data).buffer as ArrayBuffer;
        const input = decodeInput(buf);
        this.session.processInput(client.snakeId, input);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  /** Gracefully shut down */
  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    for (const [ws, client] of this.clients) {
      this.session.removePlayer(client.snakeId);
      ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();
    this.wss.close();
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private handleConnection(ws: WebSocket): void {
    // Assign a snake to the new player
    const snakeId = this.session.addPlayer(`Player_${Date.now()}`, false);

    const clientInfo: ClientInfo = {
      snakeId,
      latency: 0,
      highLatencyStart: 0,
      lastPingSent: 0,
    };

    this.clients.set(ws, clientInfo);

    // Set binary type
    ws.binaryType = 'arraybuffer';

    // Handle messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    // Handle close
    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client) {
        this.session.removePlayer(client.snakeId);
        this.clients.delete(ws);
      }
    });

    // Handle errors
    ws.on('error', () => {
      const client = this.clients.get(ws);
      if (client) {
        this.session.removePlayer(client.snakeId);
        this.clients.delete(ws);
      }
    });
  }
}
