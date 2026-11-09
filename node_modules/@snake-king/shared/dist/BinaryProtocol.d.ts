import { type InputMessage } from './protocol';
import { PowerUpType } from './types';
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
export interface StateDelta {
    tick: number;
    snakeUpdates: SnakeUpdate[];
    orbSpawns: OrbSpawn[];
    orbRemovals: OrbRemove[];
}
/**
 * Encode an InputMessage to a 13-byte ArrayBuffer.
 */
export declare function encodeInput(msg: InputMessage): ArrayBuffer;
/**
 * Decode a 13-byte ArrayBuffer into an InputMessage.
 */
export declare function decodeInput(buffer: ArrayBuffer): InputMessage;
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
export declare function encodeStateDelta(delta: StateDelta): ArrayBuffer;
/**
 * Decode a StateDelta from an ArrayBuffer.
 */
export declare function decodeStateDelta(buffer: ArrayBuffer): StateDelta;
/**
 * Encode a full game state as a binary message for initial sync.
 * This uses the same format as StateDelta but represents the complete
 * world state (all snakes + all orbs) rather than incremental changes.
 */
export declare function encodeFullState(state: StateDelta): ArrayBuffer;
/**
 * Decode a full game state from a binary message.
 */
export declare function decodeFullState(buffer: ArrayBuffer): StateDelta;
//# sourceMappingURL=BinaryProtocol.d.ts.map