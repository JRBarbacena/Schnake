import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { encodeInput, decodeInput, encodeStateDelta, decodeStateDelta, } from '../BinaryProtocol';
import { PowerUpType } from '../types';
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Float32 round-trip: value → Float32 → value (simulates precision loss) */
function toFloat32(value) {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setFloat32(0, value, true);
    return view.getFloat32(0, true);
}
/** Assert two numbers are equal after Float32 round-trip */
function expectFloat32Equal(actual, expected) {
    expect(actual).toBeCloseTo(toFloat32(expected), 5);
}
// ─── Arbitraries ─────────────────────────────────────────────────────────────
const inputTypeArb = fc.constantFrom('direction', 'boost_start', 'boost_end');
const directionInputArb = fc.record({
    type: fc.constant('direction'),
    targetDirection: fc.float({ min: Math.fround(-Math.PI), max: Math.fround(Math.PI), noNaN: true, noDefaultInfinity: true }),
    sequenceNumber: fc.nat(0xFFFFFFFF),
    timestamp: fc.nat(0xFFFFFFFF),
});
const boostInputArb = fc.record({
    type: fc.constantFrom('boost_start', 'boost_end'),
    sequenceNumber: fc.nat(0xFFFFFFFF),
    timestamp: fc.nat(0xFFFFFFFF),
});
const inputMessageArb = fc.oneof(directionInputArb, boostInputArb);
const powerUpTypeArb = fc.constantFrom(PowerUpType.Shield, PowerUpType.Magnet, PowerUpType.Ghost, PowerUpType.SpeedSurge, PowerUpType.MassDrain, PowerUpType.FreezeAura);
const snakeUpdateArb = fc.record({
    snakeId: fc.nat(65535),
    headX: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    headY: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    direction: fc.float({ min: Math.fround(-Math.PI), max: Math.fround(Math.PI), noNaN: true, noDefaultInfinity: true }),
    speed: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }),
    mass: fc.float({ min: Math.fround(0), max: Math.fround(100000), noNaN: true, noDefaultInfinity: true }),
    isBoosting: fc.boolean(),
    isAlive: fc.boolean(),
    hasActivePowerUp: fc.boolean(),
    evolutionStage: fc.nat(255),
    activePowerUpType: fc.oneof(fc.constant(null), powerUpTypeArb),
    activePowerUpRemainingTime: fc.float({ min: Math.fround(0), max: Math.fround(60), noNaN: true, noDefaultInfinity: true }),
});
const orbSpawnWithPowerArb = fc.record({
    orbId: fc.nat(65535),
    x: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    y: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    size: fc.nat(255),
    colorIndex: fc.nat(255),
    isPowerOrb: fc.constant(true),
    powerUpType: powerUpTypeArb,
});
const orbSpawnNoPowerArb = fc.record({
    orbId: fc.nat(65535),
    x: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    y: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true }),
    size: fc.nat(255),
    colorIndex: fc.nat(255),
    isPowerOrb: fc.constant(false),
});
const orbSpawnArb = fc.oneof(orbSpawnWithPowerArb, orbSpawnNoPowerArb);
const orbRemoveArb = fc.record({
    orbId: fc.nat(65535),
});
const stateDeltaArb = fc.record({
    tick: fc.nat(0xFFFFFFFF),
    snakeUpdates: fc.array(snakeUpdateArb, { minLength: 0, maxLength: 10 }),
    orbSpawns: fc.array(orbSpawnArb, { minLength: 0, maxLength: 20 }),
    orbRemovals: fc.array(orbRemoveArb, { minLength: 0, maxLength: 50 }),
});
// ─── Property Tests ──────────────────────────────────────────────────────────
describe('BinaryProtocol round-trip properties', () => {
    describe('InputMessage encode→decode', () => {
        it('direction messages round-trip with Float32 tolerance', () => {
            fc.assert(fc.property(directionInputArb, (msg) => {
                const encoded = encodeInput(msg);
                const decoded = decodeInput(encoded);
                expect(decoded.type).toBe(msg.type);
                expect(decoded.sequenceNumber).toBe(msg.sequenceNumber);
                expect(decoded.timestamp).toBe(msg.timestamp);
                expect(decoded.targetDirection).toBeDefined();
                expectFloat32Equal(decoded.targetDirection, msg.targetDirection);
            }), { numRuns: 500 });
        });
        it('boost messages round-trip exactly (no targetDirection)', () => {
            fc.assert(fc.property(boostInputArb, (msg) => {
                const encoded = encodeInput(msg);
                const decoded = decodeInput(encoded);
                expect(decoded.type).toBe(msg.type);
                expect(decoded.sequenceNumber).toBe(msg.sequenceNumber);
                expect(decoded.timestamp).toBe(msg.timestamp);
                expect(decoded.targetDirection).toBeUndefined();
            }), { numRuns: 500 });
        });
        it('all InputMessage types round-trip correctly', () => {
            fc.assert(fc.property(inputMessageArb, (msg) => {
                const encoded = encodeInput(msg);
                const decoded = decodeInput(encoded);
                expect(decoded.type).toBe(msg.type);
                expect(decoded.sequenceNumber).toBe(msg.sequenceNumber);
                expect(decoded.timestamp).toBe(msg.timestamp);
                if (msg.type === 'direction') {
                    expect(decoded.targetDirection).toBeDefined();
                    expectFloat32Equal(decoded.targetDirection, msg.targetDirection);
                }
                else {
                    expect(decoded.targetDirection).toBeUndefined();
                }
            }), { numRuns: 1000 });
        });
    });
    describe('StateDelta encode→decode', () => {
        it('round-trips snake updates with Float32 tolerance', () => {
            fc.assert(fc.property(stateDeltaArb, (delta) => {
                const encoded = encodeStateDelta(delta);
                const decoded = decodeStateDelta(encoded);
                expect(decoded.tick).toBe(delta.tick);
                expect(decoded.snakeUpdates.length).toBe(delta.snakeUpdates.length);
                for (let i = 0; i < delta.snakeUpdates.length; i++) {
                    const original = delta.snakeUpdates[i];
                    const result = decoded.snakeUpdates[i];
                    expect(result.snakeId).toBe(original.snakeId);
                    expectFloat32Equal(result.headX, original.headX);
                    expectFloat32Equal(result.headY, original.headY);
                    expectFloat32Equal(result.direction, original.direction);
                    expectFloat32Equal(result.speed, original.speed);
                    expectFloat32Equal(result.mass, original.mass);
                    expect(result.isBoosting).toBe(original.isBoosting);
                    expect(result.isAlive).toBe(original.isAlive);
                    expect(result.hasActivePowerUp).toBe(original.hasActivePowerUp);
                    expect(result.evolutionStage).toBe(original.evolutionStage);
                    expect(result.activePowerUpType).toBe(original.activePowerUpType);
                    expectFloat32Equal(result.activePowerUpRemainingTime, original.activePowerUpRemainingTime);
                }
            }), { numRuns: 500 });
        });
        it('round-trips orb spawns with Float32 tolerance', () => {
            fc.assert(fc.property(stateDeltaArb, (delta) => {
                const encoded = encodeStateDelta(delta);
                const decoded = decodeStateDelta(encoded);
                expect(decoded.orbSpawns.length).toBe(delta.orbSpawns.length);
                for (let i = 0; i < delta.orbSpawns.length; i++) {
                    const original = delta.orbSpawns[i];
                    const result = decoded.orbSpawns[i];
                    expect(result.orbId).toBe(original.orbId);
                    expectFloat32Equal(result.x, original.x);
                    expectFloat32Equal(result.y, original.y);
                    expect(result.size).toBe(original.size);
                    expect(result.colorIndex).toBe(original.colorIndex);
                    expect(result.isPowerOrb).toBe(original.isPowerOrb);
                    if (original.isPowerOrb && original.powerUpType) {
                        expect(result.powerUpType).toBe(original.powerUpType);
                    }
                    else {
                        expect(result.powerUpType).toBeUndefined();
                    }
                }
            }), { numRuns: 500 });
        });
        it('round-trips orb removals exactly', () => {
            fc.assert(fc.property(stateDeltaArb, (delta) => {
                const encoded = encodeStateDelta(delta);
                const decoded = decodeStateDelta(encoded);
                expect(decoded.orbRemovals.length).toBe(delta.orbRemovals.length);
                for (let i = 0; i < delta.orbRemovals.length; i++) {
                    expect(decoded.orbRemovals[i].orbId).toBe(delta.orbRemovals[i].orbId);
                }
            }), { numRuns: 500 });
        });
        it('complete StateDelta round-trips correctly', () => {
            fc.assert(fc.property(stateDeltaArb, (delta) => {
                const encoded = encodeStateDelta(delta);
                const decoded = decodeStateDelta(encoded);
                // Tick
                expect(decoded.tick).toBe(delta.tick);
                // Counts match
                expect(decoded.snakeUpdates.length).toBe(delta.snakeUpdates.length);
                expect(decoded.orbSpawns.length).toBe(delta.orbSpawns.length);
                expect(decoded.orbRemovals.length).toBe(delta.orbRemovals.length);
            }), { numRuns: 1000 });
        });
    });
});
//# sourceMappingURL=BinaryProtocol.test.js.map