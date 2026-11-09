import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AIBot } from '../AIManager';
import { BASE_SPEED } from '@snake-king/shared';
// ─── Constants (mirrored from AIManager for assertions) ──────────────────────
const HUNT_MASS_RATIO = 0.6;
const EVADE_MASS_RATIO = 1.5;
const EVADE_TRIGGER_DISTANCE = 300;
const MAX_BOOST_DURATION = 2;
const BOOST_COOLDOWN = 3;
// ─── Helpers ─────────────────────────────────────────────────────────────────
function createSnake(overrides) {
    return {
        direction: 0,
        targetDirection: 0,
        segments: [],
        speed: BASE_SPEED,
        isBoosting: false,
        evolutionStage: 1,
        pathHistory: [],
        boostLocked: false,
        massAccumulator: 0,
        boostTrailTimer: 0,
        ...overrides,
    };
}
// ─── Arbitraries ─────────────────────────────────────────────────────────────
const arbMass = fc.double({ min: 10, max: 5000, noNaN: true, noDefaultInfinity: true });
const arbDistance = fc.double({ min: 10, max: 1000, noNaN: true, noDefaultInfinity: true });
const arbDt = fc.double({ min: 0.016, max: 0.1, noNaN: true, noDefaultInfinity: true });
// ─── Property 24: AI State Transition Correctness ────────────────────────────
describe('Property 24: AI State Transition Correctness', () => {
    it('transitions to Hunting when nearby snake has mass < HUNT_MASS_RATIO × self mass', () => {
        fc.assert(fc.property(arbMass, fc.double({ min: 10, max: 299, noNaN: true, noDefaultInfinity: true }), // distance within detection range
        (selfMass, distance) => {
            const bot = new AIBot(1, 'hard'); // hard tier has 500u detection range
            bot.state = 'foraging';
            // Prey mass must be strictly less than HUNT_MASS_RATIO × selfMass
            const preyMass = selfMass * HUNT_MASS_RATIO * 0.5; // well below threshold
            const selfSnake = createSnake({
                id: 1,
                position: { x: 0, y: 0 },
                mass: selfMass,
            });
            const preySnake = createSnake({
                id: 2,
                position: { x: distance, y: 0 },
                mass: preyMass,
            });
            // Large dt to ensure reaction timer triggers (hard tier: 100ms)
            bot.update(0.5, selfSnake, [selfSnake, preySnake], []);
            expect(bot.state).toBe('hunting');
        }), { numRuns: 200 });
    });
    it('transitions to Evading when nearby snake has mass > EVADE_MASS_RATIO × self mass within EVADE_TRIGGER_DISTANCE', () => {
        fc.assert(fc.property(arbMass, fc.double({ min: 10, max: EVADE_TRIGGER_DISTANCE - 1, noNaN: true, noDefaultInfinity: true }), (selfMass, distance) => {
            const bot = new AIBot(1, 'hard');
            bot.state = 'foraging';
            // Threat mass must be strictly greater than EVADE_MASS_RATIO × selfMass
            const threatMass = selfMass * EVADE_MASS_RATIO * 2; // well above threshold
            const selfSnake = createSnake({
                id: 1,
                position: { x: 0, y: 0 },
                mass: selfMass,
            });
            const threatSnake = createSnake({
                id: 3,
                position: { x: distance, y: 0 },
                mass: threatMass,
            });
            bot.update(0.5, selfSnake, [selfSnake, threatSnake], []);
            expect(bot.state).toBe('evading');
        }), { numRuns: 200 });
    });
    it('Evading takes priority over Hunting when both triggers are present', () => {
        fc.assert(fc.property(arbMass, fc.double({ min: 10, max: EVADE_TRIGGER_DISTANCE - 1, noNaN: true, noDefaultInfinity: true }), (selfMass, distance) => {
            const bot = new AIBot(1, 'hard');
            bot.state = 'foraging';
            const preyMass = selfMass * HUNT_MASS_RATIO * 0.5;
            const threatMass = selfMass * EVADE_MASS_RATIO * 2;
            const selfSnake = createSnake({
                id: 1,
                position: { x: 0, y: 0 },
                mass: selfMass,
            });
            const preySnake = createSnake({
                id: 2,
                position: { x: distance, y: 0 },
                mass: preyMass,
            });
            const threatSnake = createSnake({
                id: 3,
                position: { x: -distance, y: 0 },
                mass: threatMass,
            });
            bot.update(0.5, selfSnake, [selfSnake, preySnake, threatSnake], []);
            // Evading should take priority
            expect(bot.state).toBe('evading');
        }), { numRuns: 200 });
    });
    it('remains in Foraging when no triggers are present', () => {
        fc.assert(fc.property(arbMass, fc.double({ min: 600, max: 2000, noNaN: true, noDefaultInfinity: true }), // far away
        (selfMass, distance) => {
            const bot = new AIBot(1, 'hard');
            bot.state = 'foraging';
            // Other snake has similar mass (neither prey nor threat)
            const otherMass = selfMass * 0.9; // between HUNT_MASS_RATIO and EVADE_MASS_RATIO
            const selfSnake = createSnake({
                id: 1,
                position: { x: 0, y: 0 },
                mass: selfMass,
            });
            const otherSnake = createSnake({
                id: 2,
                position: { x: distance, y: 0 },
                mass: otherMass,
            });
            bot.update(0.5, selfSnake, [selfSnake, otherSnake], []);
            expect(bot.state).toBe('foraging');
        }), { numRuns: 200 });
    });
    it('remains in Foraging when prey exists but is beyond detection range', () => {
        fc.assert(fc.property(arbMass, fc.double({ min: 501, max: 2000, noNaN: true, noDefaultInfinity: true }), // beyond hard tier's 500u range
        (selfMass, distance) => {
            const bot = new AIBot(1, 'hard');
            bot.state = 'foraging';
            const preyMass = selfMass * HUNT_MASS_RATIO * 0.5;
            const selfSnake = createSnake({
                id: 1,
                position: { x: 0, y: 0 },
                mass: selfMass,
            });
            const preySnake = createSnake({
                id: 2,
                position: { x: distance, y: 0 },
                mass: preyMass,
            });
            bot.update(0.5, selfSnake, [selfSnake, preySnake], []);
            expect(bot.state).toBe('foraging');
        }), { numRuns: 200 });
    });
    it('remains in Foraging when threat exists but is beyond EVADE_TRIGGER_DISTANCE', () => {
        fc.assert(fc.property(arbMass, fc.double({ min: EVADE_TRIGGER_DISTANCE + 1, max: 2000, noNaN: true, noDefaultInfinity: true }), (selfMass, distance) => {
            const bot = new AIBot(1, 'hard');
            bot.state = 'foraging';
            const threatMass = selfMass * EVADE_MASS_RATIO * 2;
            const selfSnake = createSnake({
                id: 1,
                position: { x: 0, y: 0 },
                mass: selfMass,
            });
            const threatSnake = createSnake({
                id: 3,
                position: { x: distance, y: 0 },
                mass: threatMass,
            });
            bot.update(0.5, selfSnake, [selfSnake, threatSnake], []);
            expect(bot.state).toBe('foraging');
        }), { numRuns: 200 });
    });
});
// ─── Property 25: AI Boost Discipline ────────────────────────────────────────
describe('Property 25: AI Boost Discipline', () => {
    it('continuous boost never exceeds MAX_BOOST_DURATION (2s)', () => {
        fc.assert(fc.property(fc.array(arbDt, { minLength: 10, maxLength: 200 }), (dts) => {
            const bot = new AIBot(1, 'hard');
            // Start a boost
            bot.startBoost();
            let continuousBoostTime = 0;
            for (const dt of dts) {
                const prevTimer = bot.boostTimer;
                // Simulate the internal timer update by calling update with conditions
                // that don't change state but advance timers
                const selfSnake = createSnake({
                    id: 1,
                    position: { x: 0, y: 0 },
                    mass: 100,
                });
                bot.update(dt, selfSnake, [selfSnake], []);
                // Track continuous boost time
                if (bot.boostTimer > 0) {
                    continuousBoostTime = bot.boostTimer;
                }
                else if (prevTimer > 0 && bot.boostTimer === 0) {
                    // Boost just ended - verify it didn't exceed MAX_BOOST_DURATION
                    expect(continuousBoostTime).toBeLessThanOrEqual(MAX_BOOST_DURATION + 0.1);
                    continuousBoostTime = 0;
                }
            }
            // If still boosting at the end, verify it hasn't exceeded limit
            if (bot.boostTimer > 0) {
                expect(bot.boostTimer).toBeLessThanOrEqual(MAX_BOOST_DURATION + 0.1);
            }
        }), { numRuns: 200 });
    });
    it('minimum BOOST_COOLDOWN (3s) between boost bursts', () => {
        fc.assert(fc.property(fc.array(fc.double({ min: 0.016, max: 0.5, noNaN: true, noDefaultInfinity: true }), { minLength: 20, maxLength: 100 }), (dts) => {
            const bot = new AIBot(1, 'hard');
            // Start initial boost
            bot.startBoost();
            const boostStartTimes = [];
            let elapsed = 0;
            let wasBoostingLastFrame = bot.boostTimer > 0;
            for (const dt of dts) {
                const selfSnake = createSnake({
                    id: 1,
                    position: { x: 0, y: 0 },
                    mass: 100,
                });
                bot.update(dt, selfSnake, [selfSnake], []);
                elapsed += dt;
                const isBoostingNow = bot.boostTimer > 0;
                // Detect boost start (transition from not boosting to boosting)
                if (isBoostingNow && !wasBoostingLastFrame) {
                    boostStartTimes.push(elapsed);
                }
                wasBoostingLastFrame = isBoostingNow;
                // Try to start a new boost after each tick
                // canBoost is private, but startBoost only works when allowed
                bot.startBoost();
            }
            // Verify minimum gap between consecutive boost starts
            for (let i = 1; i < boostStartTimes.length; i++) {
                const gap = boostStartTimes[i] - boostStartTimes[i - 1];
                // Gap must be at least MAX_BOOST_DURATION + BOOST_COOLDOWN
                // (boost runs for up to 2s, then 3s cooldown)
                expect(gap).toBeGreaterThanOrEqual(MAX_BOOST_DURATION + BOOST_COOLDOWN - 0.5);
            }
        }), { numRuns: 200 });
    });
    it('boost cannot be activated during cooldown period', () => {
        fc.assert(fc.property(fc.double({ min: 0.1, max: 2.9, noNaN: true, noDefaultInfinity: true }), (cooldownElapsed) => {
            const bot = new AIBot(1, 'hard');
            // Manually set up a state where boost just ended and cooldown is active
            bot.boostTimer = 0;
            bot.boostCooldown = BOOST_COOLDOWN - cooldownElapsed; // still in cooldown
            // Attempt to start boost - should not work
            bot.startBoost();
            // boostTimer should remain 0 (boost not started)
            expect(bot.boostTimer).toBe(0);
        }), { numRuns: 200 });
    });
    it('boost can be activated after cooldown expires', () => {
        fc.assert(fc.property(fc.double({ min: 0.001, max: 5, noNaN: true, noDefaultInfinity: true }), (extraTime) => {
            const bot = new AIBot(1, 'hard');
            // Cooldown has fully expired
            bot.boostTimer = 0;
            bot.boostCooldown = 0;
            // Should be able to start boost
            bot.startBoost();
            expect(bot.boostTimer).toBeGreaterThan(0);
        }), { numRuns: 100 });
    });
    it('boostTimer resets to 0 and cooldown starts after MAX_BOOST_DURATION', () => {
        fc.assert(fc.property(fc.array(fc.double({ min: 0.016, max: 0.1, noNaN: true, noDefaultInfinity: true }), { minLength: 50, maxLength: 150 }), (dts) => {
            const bot = new AIBot(1, 'hard');
            bot.startBoost();
            let totalBoostTime = 0;
            let boostEnded = false;
            for (const dt of dts) {
                if (boostEnded)
                    break;
                const selfSnake = createSnake({
                    id: 1,
                    position: { x: 0, y: 0 },
                    mass: 100,
                });
                const prevTimer = bot.boostTimer;
                bot.update(dt, selfSnake, [selfSnake], []);
                if (bot.boostTimer > 0) {
                    totalBoostTime = bot.boostTimer;
                }
                // Detect when boost ends
                if (prevTimer > 0 && bot.boostTimer === 0) {
                    boostEnded = true;
                    // Cooldown should now be active
                    expect(bot.boostCooldown).toBeCloseTo(BOOST_COOLDOWN, 0);
                    // Total boost time should be approximately MAX_BOOST_DURATION
                    expect(totalBoostTime).toBeGreaterThanOrEqual(MAX_BOOST_DURATION - 0.1);
                }
            }
        }), { numRuns: 200 });
    });
});
//# sourceMappingURL=AIManager.test.js.map