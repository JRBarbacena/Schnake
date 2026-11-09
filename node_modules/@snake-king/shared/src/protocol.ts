// @snake-king/shared - Network protocol definitions

// ─── Message Types ───────────────────────────────────────────────────────────

export enum MessageType {
  // Client → Server
  Join = 'join',
  Input = 'input',
  Ping = 'ping',

  // Server → Client
  Welcome = 'welcome',
  StateDelta = 'state_delta',
  FullState = 'full_state',
  Pong = 'pong',
  Eliminated = 'eliminated',
  LeaderboardUpdate = 'leaderboard_update',
}

// ─── Input Messages (Client → Server) ────────────────────────────────────────

export type InputType = 'direction' | 'boost_start' | 'boost_end';

export interface InputMessage {
  type: InputType;
  targetDirection?: number;
  sequenceNumber: number;
  timestamp: number;
}
