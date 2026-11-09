// @snake-king/shared - Binary protocol encoder/decoder
// Compact binary serialization for game state over WebSocket

import { type InputMessage, type InputType } from './protocol';
import { PowerUpType } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const INPUT_MESSAGE_SIZE = 13;
const SNAKE_UPDATE_SIZE = 29;
const ORB_SPAWN_SIZE = 13;
const ORB_REMOVE_SIZE = 2;

// ─── Input Type Mapping ──────────────────────────────────────────────────────

const INPUT_TYPE_TO_BYTE: Record<InputType, number> = {
  direction: 0,
  boost_start: 1,
  boost_end: 2,
};

const BYTE_TO_INPUT_TYPE: InputType[] = ['direction', 'boost_start', 'boost_end'];

// ─── PowerUp Type Mapping ────────────────────────────────────────────────────

const POWER_UP_TYPE_TO_BYTE: Record<PowerUpType, number> = {
  [PowerUpType.Shield]: 1,
  [PowerUpType.Magnet]: 2,
  [PowerUpType.Ghost]: 3,
  [PowerUpType.SpeedSurge]: 4,
  [PowerUpType.MassDrain]: 5,
  [PowerUpType.FreezeAura]: 6,
};

const BYTE_TO_POWER_UP_TYPE: (PowerUpType | null)[] = [
  null, // 0 = none
  PowerUpType.Shield,
  PowerUpType.Magnet,
  PowerUpType.Ghost,
  PowerUpType.SpeedSurge,
  PowerUpType.MassDrain,
  PowerUpType.FreezeAura,
];

// ─── Snake Update Interface ──────────────────────────────────────────────────

export interface SnakeUpdate {
  snakeId: number;
  headX: number;
  headY: number;
  direction: number;
  speed: number;
  mass: number;
  isBoosting: boolean;
  isAlive: boolean;
  hasActivePowerUp: boolean;
  evolutionStage: number;
  activePowerUpType: PowerUpType | null;
  activePowerUpRemainingTime: number;
}

// ─── Orb Interfaces ──────────────────────────────────────────────────────────

export interface OrbSpawn {
  orbId: number;
  x: number;
  y: number;
  size: number;
  colorIndex: number;
  isPowerOrb: boolean;
  powerUpType?: PowerUpType;
}

export interface OrbRemove {
  orbId: number;
}

// ─── State Delta Interface ───────────────────────────────────────────────────

export interface StateDelta {
  tick: number;
  snakeUpdates: SnakeUpdate[];
  orbSpawns: OrbSpawn[];
  orbRemovals: OrbRemove[];
}

// ─── Input Encoding / Decoding ───────────────────────────────────────────────

/**
 * Encode an InputMessage to a 13-byte ArrayBuffer.
 */
export function encodeInput(msg: InputMessage): ArrayBuffer {
  const buffer = new ArrayBuffer(INPUT_MESSAGE_SIZE);
  const view = new DataView(buffer);

  view.setUint8(0, INPUT_TYPE_TO_BYTE[msg.type]);
  view.setFloat32(1, msg.targetDirection ?? 0, true);
  view.setUint32(5, msg.sequenceNumber, true);
  view.setUint32(9, msg.timestamp >>> 0, true); // lower 32 bits

  return buffer;
}

/**
 * Decode a 13-byte ArrayBuffer into an InputMessage.
 */
export function decodeInput(buffer: ArrayBuffer): InputMessage {
  const view = new DataView(buffer);

  const typeByte = view.getUint8(0);
  const type = BYTE_TO_INPUT_TYPE[typeByte];
  if (!type) {
    throw new Error(`Invalid input type byte: ${typeByte}`);
  }

  const targetDirection = view.getFloat32(1, true);
  const sequenceNumber = view.getUint32(5, true);
  const timestamp = view.getUint32(9, true);

  const msg: InputMessage = {
    type,
    sequenceNumber,
    timestamp,
  };

  // Only include targetDirection for direction messages
  if (type === 'direction') {
    msg.targetDirection = targetDirection;
  }

  return msg;
}

// ─── Snake Update Encoding / Decoding ────────────────────────────────────────

function encodeSnakeUpdate(view: DataView, offset: number, snake: SnakeUpdate): void {
  view.setUint16(offset, snake.snakeId, true);
  view.setFloat32(offset + 2, snake.headX, true);
  view.setFloat32(offset + 6, snake.headY, true);
  view.setFloat32(offset + 10, snake.direction, true);
  view.setFloat32(offset + 14, snake.speed, true);
  view.setFloat32(offset + 18, snake.mass, true);

  let flags = 0;
  if (snake.isBoosting) flags |= 0x01;
  if (snake.isAlive) flags |= 0x02;
  if (snake.hasActivePowerUp) flags |= 0x04;
  view.setUint8(offset + 22, flags);

  view.setUint8(offset + 23, snake.evolutionStage);
  view.setUint8(offset + 24, snake.activePowerUpType ? POWER_UP_TYPE_TO_BYTE[snake.activePowerUpType] : 0);
  view.setFloat32(offset + 25, snake.activePowerUpRemainingTime, true);
}

function decodeSnakeUpdate(view: DataView, offset: number): SnakeUpdate {
  const snakeId = view.getUint16(offset, true);
  const headX = view.getFloat32(offset + 2, true);
  const headY = view.getFloat32(offset + 6, true);
  const direction = view.getFloat32(offset + 10, true);
  const speed = view.getFloat32(offset + 14, true);
  const mass = view.getFloat32(offset + 18, true);

  const flags = view.getUint8(offset + 22);
  const isBoosting = (flags & 0x01) !== 0;
  const isAlive = (flags & 0x02) !== 0;
  const hasActivePowerUp = (flags & 0x04) !== 0;

  const evolutionStage = view.getUint8(offset + 23);
  const powerUpByte = view.getUint8(offset + 24);
  const activePowerUpType = BYTE_TO_POWER_UP_TYPE[powerUpByte] ?? null;
  const activePowerUpRemainingTime = view.getFloat32(offset + 25, true);

  return {
    snakeId,
    headX,
    headY,
    direction,
    speed,
    mass,
    isBoosting,
    isAlive,
    hasActivePowerUp,
    evolutionStage,
    activePowerUpType,
    activePowerUpRemainingTime,
  };
}

// ─── Orb Encoding / Decoding ─────────────────────────────────────────────────

function encodeOrbSpawn(view: DataView, offset: number, orb: OrbSpawn): void {
  view.setUint16(offset, orb.orbId, true);
  view.setFloat32(offset + 2, orb.x, true);
  view.setFloat32(offset + 6, orb.y, true);
  view.setUint8(offset + 10, orb.size);
  view.setUint8(offset + 11, orb.colorIndex);

  if (orb.isPowerOrb && orb.powerUpType) {
    view.setUint8(offset + 12, POWER_UP_TYPE_TO_BYTE[orb.powerUpType]);
  } else {
    view.setUint8(offset + 12, 0);
  }
}

function decodeOrbSpawn(view: DataView, offset: number): OrbSpawn {
  const orbId = view.getUint16(offset, true);
  const x = view.getFloat32(offset + 2, true);
  const y = view.getFloat32(offset + 6, true);
  const size = view.getUint8(offset + 10);
  const colorIndex = view.getUint8(offset + 11);
  const powerByte = view.getUint8(offset + 12);

  const isPowerOrb = powerByte !== 0;
  const powerUpType = BYTE_TO_POWER_UP_TYPE[powerByte] ?? undefined;

  return {
    orbId,
    x,
    y,
    size,
    colorIndex,
    isPowerOrb,
    ...(isPowerOrb && powerUpType ? { powerUpType } : {}),
  };
}

// ─── State Delta Encoding / Decoding ─────────────────────────────────────────

/**
 * Encode a StateDelta to a compact ArrayBuffer.
 *
 * Layout:
 *  - Bytes 0-3: tick (Uint32)
 *  - Byte 4: number of snake updates (Uint8)
 *  - Following: snake updates (each 29 bytes)
 *  - Next byte: number of orb spawns (Uint8)
 *  - Following: orb spawns (each 13 bytes)
 *  - Next 2 bytes: number of orb removals (Uint16)
 *  - Following: orb removals (each 2 bytes)
 */
export function encodeStateDelta(delta: StateDelta): ArrayBuffer {
  const snakeCount = delta.snakeUpdates.length;
  const orbSpawnCount = delta.orbSpawns.length;
  const orbRemoveCount = delta.orbRemovals.length;

  const totalSize =
    4 + // tick
    1 + // snake count
    snakeCount * SNAKE_UPDATE_SIZE +
    1 + // orb spawn count
    orbSpawnCount * ORB_SPAWN_SIZE +
    2 + // orb remove count (Uint16)
    orbRemoveCount * ORB_REMOVE_SIZE;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  // Tick
  view.setUint32(offset, delta.tick, true);
  offset += 4;

  // Snake updates
  view.setUint8(offset, snakeCount);
  offset += 1;
  for (const snake of delta.snakeUpdates) {
    encodeSnakeUpdate(view, offset, snake);
    offset += SNAKE_UPDATE_SIZE;
  }

  // Orb spawns
  view.setUint8(offset, orbSpawnCount);
  offset += 1;
  for (const orb of delta.orbSpawns) {
    encodeOrbSpawn(view, offset, orb);
    offset += ORB_SPAWN_SIZE;
  }

  // Orb removals
  view.setUint16(offset, orbRemoveCount, true);
  offset += 2;
  for (const removal of delta.orbRemovals) {
    view.setUint16(offset, removal.orbId, true);
    offset += ORB_REMOVE_SIZE;
  }

  return buffer;
}

/**
 * Decode a StateDelta from an ArrayBuffer.
 */
export function decodeStateDelta(buffer: ArrayBuffer): StateDelta {
  const view = new DataView(buffer);
  let offset = 0;

  // Tick
  const tick = view.getUint32(offset, true);
  offset += 4;

  // Snake updates
  const snakeCount = view.getUint8(offset);
  offset += 1;
  const snakeUpdates: SnakeUpdate[] = [];
  for (let i = 0; i < snakeCount; i++) {
    snakeUpdates.push(decodeSnakeUpdate(view, offset));
    offset += SNAKE_UPDATE_SIZE;
  }

  // Orb spawns
  const orbSpawnCount = view.getUint8(offset);
  offset += 1;
  const orbSpawns: OrbSpawn[] = [];
  for (let i = 0; i < orbSpawnCount; i++) {
    orbSpawns.push(decodeOrbSpawn(view, offset));
    offset += ORB_SPAWN_SIZE;
  }

  // Orb removals
  const orbRemoveCount = view.getUint16(offset, true);
  offset += 2;
  const orbRemovals: OrbRemove[] = [];
  for (let i = 0; i < orbRemoveCount; i++) {
    orbRemovals.push({ orbId: view.getUint16(offset, true) });
    offset += ORB_REMOVE_SIZE;
  }

  return { tick, snakeUpdates, orbSpawns, orbRemovals };
}

// ─── Full State Encoding / Decoding ──────────────────────────────────────────

/**
 * Encode a full game state as a binary message for initial sync.
 * This uses the same format as StateDelta but represents the complete
 * world state (all snakes + all orbs) rather than incremental changes.
 */
export function encodeFullState(state: StateDelta): ArrayBuffer {
  return encodeStateDelta(state);
}

/**
 * Decode a full game state from a binary message.
 */
export function decodeFullState(buffer: ArrayBuffer): StateDelta {
  return decodeStateDelta(buffer);
}
