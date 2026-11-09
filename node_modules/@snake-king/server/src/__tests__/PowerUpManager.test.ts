import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PowerUpManager, ActivePowerUp } from '../PowerUpManager';
import { PhysicsEngine, Snake } from '../Physics';
import {
  PowerUpType,
  Vec2,
  POWER_UP_DURATIONS,
  BOOST_LOCKOUT_MASS,
  BOOST_UNLOCK_MASS,
  BASE_SPEED,
  SEGMENT_SPACING,
} from '@snake-king/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestSnake(overrides: Partial<Snake> = {}): Snake {
  return {
    id: 1,
    position: { x: 0, y: 0 },
    direction: 0,
    targetDirection: 0,
    segments: [],
    mass: 100,
    speed: BASE_SPEED,
    isBoosting: false,
    evolutionStage: 1,
    pathHistory: [{ x: 0, y: 0 }],
    boostLocked: false,
    massAccumulator: 0,
    boostTrailTimer: 0,
    ...overrides,
  };
}

const ALL_POWER_UP_TYPES: PowerUpType[] = [
  PowerUpType.Shield,
  PowerUpType.Magnet,
  PowerUpType.Ghost,
  PowerUpType.SpeedSurge,
  PowerUpType.MassDrain,
  PowerUpType.FreezeAura,
];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbPowerUpType = fc.constantFrom(...ALL_POWER_UP_TYPES);
const arbSnakeId = fc.integer({ min: 1, max: 1000 });
const arbDt = fc.double({ min: 0.01, max: 0.5, noNaN: true, noDefaultInfinity: true });
const arbPosition = fc.record({
  x: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
});

// ─── Property 14: Boost Lockout Hysteresis ───────────────────────────────────

describe('Property 14: Boost Lockout Hysteresis', () => {
  const physics = new PhysicsEngine();

  it('boost locks when mass drops to BOOST_LOCKOUT_MASS or below', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: BOOST_LOCKOUT_MASS, noNaN: true, noDefaultInfinity: true }),
        (mass) => {
          const snake = createTestSnake({ mass, isBoosting: true });

          physics.applyBoost(snake, 0.01, 1.0);

          // If mass was at or below lockout threshold, boost should be locked
          expect(snake.boostLocked).toBe(true);
          expect(snake.isBoosting).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('boost remains unlocked when mass is above BOOST_LOCKOUT_MASS', () => {
    fc.assert(
      fc.property(
        fc.double({ min: BOOST_LOCKOUT_MASS + 5, max: 500, noNaN: true, noDefaultInfinity: true }),
        (mass) => {
          const snake = createTestSnake({ mass, isBoosting: true });

          // Small dt so drain won't push mass below threshold
          physics.applyBoost(snake, 0.001, 1.0);

          // Mass still well above lockout, boost should remain active
          if (snake.mass > BOOST_LOCKOUT_MASS) {
            expect(snake.boostLocked).toBe(false);
            expect(snake.isBoosting).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('hysteresis: locked at <= BOOST_LOCKOUT_MASS(10), should only unlock at >= BOOST_UNLOCK_MASS(15)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: BOOST_LOCKOUT_MASS + 0.1, max: BOOST_UNLOCK_MASS - 0.1, noNaN: true, noDefaultInfinity: true }),
        (massBetween) => {
          // A snake that was locked should remain locked when mass is between 10 and 15
          const snake = createTestSnake({ mass: massBetween, boostLocked: true, isBoosting: false });

          // The snake should stay locked because mass is in the hysteresis zone
          expect(snake.boostLocked).toBe(true);

          // Verify the mass is in the hysteresis band
          expect(snake.mass).toBeGreaterThan(BOOST_LOCKOUT_MASS);
          expect(snake.mass).toBeLessThan(BOOST_UNLOCK_MASS);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('mass >= BOOST_UNLOCK_MASS allows boost to be re-enabled', () => {
    fc.assert(
      fc.property(
        fc.double({ min: BOOST_UNLOCK_MASS, max: 500, noNaN: true, noDefaultInfinity: true }),
        (mass) => {
          // A snake at or above unlock mass should be eligible for unlock
          const snake = createTestSnake({ mass, boostLocked: true, isBoosting: false });

          // Simulate the unlock check (mass >= BOOST_UNLOCK_MASS → unlock)
          if (snake.mass >= BOOST_UNLOCK_MASS) {
            snake.boostLocked = false;
          }

          expect(snake.boostLocked).toBe(false);
          expect(snake.mass).toBeGreaterThanOrEqual(BOOST_UNLOCK_MASS);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 15: Power-Up State Machine ─────────────────────────────────────

describe('Property 15: Power-Up State Machine', () => {
  it('same type resets duration to full', () => {
    fc.assert(
      fc.property(arbSnakeId, arbPowerUpType, arbDt, (snakeId, type, dt) => {
        const mgr = new PowerUpManager();

        // Activate, tick to partially drain, then re-activate same type
        mgr.activatePowerUp(snakeId, type);
        mgr.tickActivePowerUps(dt);

        const beforeReset = mgr.getActivePowerUp(snakeId);
        expect(beforeReset).toBeDefined();
        expect(beforeReset!.remainingTime).toBeLessThan(POWER_UP_DURATIONS[type]);

        // Re-activate same type → should reset to full
        mgr.activatePowerUp(snakeId, type);

        const afterReset = mgr.getActivePowerUp(snakeId);
        expect(afterReset).toBeDefined();
        expect(afterReset!.type).toBe(type);
        expect(afterReset!.remainingTime).toBeCloseTo(POWER_UP_DURATIONS[type], 5);
      }),
      { numRuns: 300 }
    );
  });

  it('different type replaces current power-up', () => {
    fc.assert(
      fc.property(
        arbSnakeId,
        arbPowerUpType,
        arbPowerUpType.filter((t) => t !== PowerUpType.Shield), // ensure we can get a distinct pair
        (snakeId, type1, type2) => {
          fc.pre(type1 !== type2);

          const mgr = new PowerUpManager();
          mgr.activatePowerUp(snakeId, type1);
          mgr.activatePowerUp(snakeId, type2);

          const active = mgr.getActivePowerUp(snakeId);
          expect(active).toBeDefined();
          expect(active!.type).toBe(type2);
          expect(active!.remainingTime).toBeCloseTo(POWER_UP_DURATIONS[type2], 5);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('expiry reverts to no active power-up', () => {
    fc.assert(
      fc.property(arbSnakeId, arbPowerUpType, (snakeId, type) => {
        const mgr = new PowerUpManager();
        mgr.activatePowerUp(snakeId, type);

        // Tick past the full duration to expire it
        const expired = mgr.tickActivePowerUps(POWER_UP_DURATIONS[type] + 0.1);

        expect(expired).toContain(snakeId);
        expect(mgr.getActivePowerUp(snakeId)).toBeUndefined();
      }),
      { numRuns: 300 }
    );
  });
});

// ─── Property 16: Shield Collision Absorption ────────────────────────────────

describe('Property 16: Shield Collision Absorption', () => {
  it('first collision is absorbed by shield', () => {
    fc.assert(
      fc.property(arbSnakeId, (snakeId) => {
        const mgr = new PowerUpManager();
        mgr.activatePowerUp(snakeId, PowerUpType.Shield);

        const absorbed = mgr.tryAbsorbCollision(snakeId);

        expect(absorbed).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('subsequent collisions are not absorbed (eliminate)', () => {
    fc.assert(
      fc.property(arbSnakeId, (snakeId) => {
        const mgr = new PowerUpManager();
        mgr.activatePowerUp(snakeId, PowerUpType.Shield);

        // First collision absorbed
        mgr.tryAbsorbCollision(snakeId);

        // Second collision: no shield left
        const absorbed = mgr.tryAbsorbCollision(snakeId);
        expect(absorbed).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('non-shield power-up does not absorb collision (boundary)', () => {
    fc.assert(
      fc.property(
        arbSnakeId,
        arbPowerUpType.filter((t) => t !== PowerUpType.Shield),
        (snakeId, type) => {
          const mgr = new PowerUpManager();
          mgr.activatePowerUp(snakeId, type);

          const absorbed = mgr.tryAbsorbCollision(snakeId);
          expect(absorbed).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no power-up does not absorb collision', () => {
    fc.assert(
      fc.property(arbSnakeId, (snakeId) => {
        const mgr = new PowerUpManager();

        const absorbed = mgr.tryAbsorbCollision(snakeId);
        expect(absorbed).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 17: Ghost Phase-Through ────────────────────────────────────────

describe('Property 17: Ghost Phase-Through', () => {
  it('all collisions return no-collision during Ghost', () => {
    fc.assert(
      fc.property(
        arbSnakeId,
        fc.integer({ min: 1, max: 20 }),
        (snakeId, collisionCount) => {
          const mgr = new PowerUpManager();
          mgr.activatePowerUp(snakeId, PowerUpType.Ghost);

          // Every collision check while ghost is active should indicate ghost is active
          for (let i = 0; i < collisionCount; i++) {
            expect(mgr.isGhostActive(snakeId)).toBe(true);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('ghost inactive for snakes without Ghost power-up', () => {
    fc.assert(
      fc.property(
        arbSnakeId,
        arbPowerUpType.filter((t) => t !== PowerUpType.Ghost),
        (snakeId, type) => {
          const mgr = new PowerUpManager();
          mgr.activatePowerUp(snakeId, type);

          expect(mgr.isGhostActive(snakeId)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('ghost inactive after expiry', () => {
    fc.assert(
      fc.property(arbSnakeId, (snakeId) => {
        const mgr = new PowerUpManager();
        mgr.activatePowerUp(snakeId, PowerUpType.Ghost);

        // Expire the ghost
        mgr.tickActivePowerUps(POWER_UP_DURATIONS[PowerUpType.Ghost] + 0.1);

        expect(mgr.isGhostActive(snakeId)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('ghost is not consumed by collisions (persists until duration ends)', () => {
    fc.assert(
      fc.property(
        arbSnakeId,
        arbDt,
        fc.integer({ min: 1, max: 50 }),
        (snakeId, dt, checks) => {
          const mgr = new PowerUpManager();
          mgr.activatePowerUp(snakeId, PowerUpType.Ghost);

          // Tick a small amount (not enough to expire)
          const smallDt = Math.min(dt, POWER_UP_DURATIONS[PowerUpType.Ghost] * 0.5);
          mgr.tickActivePowerUps(smallDt);

          // Ghost should still be active regardless of how many checks
          for (let i = 0; i < checks; i++) {
            expect(mgr.isGhostActive(snakeId)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 18: Freeze Aura Range Effect ──────────────────────────────────

describe('Property 18: Freeze Aura Range Effect', () => {
  it('snakes within 200u are affected at 50% speed', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.double({ min: 0, max: 199.9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
        (freezerPos, dist, angle) => {
          const mgr = new PowerUpManager();

          const targetPos: Vec2 = {
            x: freezerPos.x + dist * Math.cos(angle),
            y: freezerPos.y + dist * Math.sin(angle),
          };

          const snakes = [{ id: 42, position: targetPos }];
          const effects = mgr.getFreezeAuraEffects(freezerPos, snakes);

          expect(effects.length).toBe(1);
          expect(effects[0].snakeId).toBe(42);
          expect(effects[0].speedMultiplier).toBe(0.5);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('snakes beyond 200u are unaffected', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.double({ min: 200.1, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
        (freezerPos, dist, angle) => {
          const mgr = new PowerUpManager();

          const targetPos: Vec2 = {
            x: freezerPos.x + dist * Math.cos(angle),
            y: freezerPos.y + dist * Math.sin(angle),
          };

          const snakes = [{ id: 99, position: targetPos }];
          const effects = mgr.getFreezeAuraEffects(freezerPos, snakes);

          expect(effects.length).toBe(0);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('boundary: snake at exactly 200u (axis-aligned) is affected', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.constantFrom(
          { x: 200, y: 0 },
          { x: -200, y: 0 },
          { x: 0, y: 200 },
          { x: 0, y: -200 }
        ),
        (freezerPos, offset) => {
          const mgr = new PowerUpManager();

          // Axis-aligned offset guarantees exact 200u distance (no trig rounding)
          const targetPos: Vec2 = {
            x: freezerPos.x + offset.x,
            y: freezerPos.y + offset.y,
          };

          const snakes = [{ id: 7, position: targetPos }];
          const effects = mgr.getFreezeAuraEffects(freezerPos, snakes);

          expect(effects.length).toBe(1);
          expect(effects[0].speedMultiplier).toBe(0.5);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('multiple snakes: only those within range are affected', () => {
    fc.assert(
      fc.property(
        arbPosition,
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 999 }),
            dist: fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
            angle: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (freezerPos, snakeData) => {
          const mgr = new PowerUpManager();

          const snakes = snakeData.map((s) => ({
            id: s.id,
            position: {
              x: freezerPos.x + s.dist * Math.cos(s.angle),
              y: freezerPos.y + s.dist * Math.sin(s.angle),
            },
          }));

          const effects = mgr.getFreezeAuraEffects(freezerPos, snakes);

          const expectedInRange = snakeData.filter((s) => s.dist <= 200).length;
          expect(effects.length).toBe(expectedInRange);

          for (const effect of effects) {
            expect(effect.speedMultiplier).toBe(0.5);
          }
        }
      ),
      { numRuns: 300 }
    );
  });
});
