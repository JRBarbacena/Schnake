import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PhysicsEngine, Snake } from '../Physics';
import {
  Vec2,
  vecDistance,
  vecFromAngle,
  angleDifference,
  SEGMENT_SPACING,
  MAX_TURN_RATE,
  BASE_SPEED,
  BOOST_SPEED,
  MAX_SPEED_CAP,
  BOOST_MASS_DRAIN,
  BOOST_TRAIL_INTERVAL,
} from '@snake-king/shared';

const physics = new PhysicsEngine();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a snake moving in a straight line with correct initial pathHistory
 * and properly spaced segments.
 */
function createStraightSnake(segmentCount: number, direction: number = 0): Snake {
  const startX = 0;
  const startY = 0;
  const dx = Math.cos(direction);
  const dy = Math.sin(direction);

  // Head position
  const position: Vec2 = { x: startX, y: startY };

  // Segments spaced behind the head along the opposite direction
  const segments: Vec2[] = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      x: startX - dx * SEGMENT_SPACING * (i + 1),
      y: startY - dy * SEGMENT_SPACING * (i + 1),
    });
  }

  // Build pathHistory: head position plus points behind at segment spacing
  // Enough points to cover all segments with buffer
  const pathHistory: Vec2[] = [];
  const totalPoints = segmentCount + 5;
  for (let i = 0; i < totalPoints; i++) {
    pathHistory.push({
      x: startX - dx * SEGMENT_SPACING * i,
      y: startY - dy * SEGMENT_SPACING * i,
    });
  }

  return {
    id: 1,
    position,
    direction,
    targetDirection: direction,
    segments,
    mass: 100,
    speed: BASE_SPEED,
    isBoosting: false,
    evolutionStage: 1,
    pathHistory,
    boostLocked: false,
    massAccumulator: 0,
    boostTrailTimer: 0,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbAngle = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true, noDefaultInfinity: true });
const arbDt = fc.double({ min: 0.01, max: 0.1, noNaN: true, noDefaultInfinity: true });
const arbSegmentCount = fc.integer({ min: 5, max: 20 });
const arbDirection = arbAngle;

// ─── Property 1: Segment Spacing Invariant ───────────────────────────────────

describe('Property 1: Segment Spacing Invariant', () => {
  it('after movement, all consecutive segments are ~SEGMENT_SPACING apart', () => {
    fc.assert(
      fc.property(
        arbSegmentCount,
        arbDirection,
        fc.array(arbDt, { minLength: 3, maxLength: 10 }),
        (segCount, direction, dts) => {
          const snake = createStraightSnake(segCount, direction);

          // Simulate multiple ticks
          for (const dt of dts) {
            physics.moveSnake(snake, dt);
            physics.updateSegments(snake);
          }

          // Verify: head to first segment distance ≈ SEGMENT_SPACING
          const headToFirst = vecDistance(snake.position, snake.segments[0]);
          expect(headToFirst).toBeCloseTo(SEGMENT_SPACING, 0);
          expect(headToFirst).toBeLessThanOrEqual(SEGMENT_SPACING + 1.0);
          expect(headToFirst).toBeGreaterThanOrEqual(SEGMENT_SPACING - 1.0);

          // Verify: consecutive segments are SEGMENT_SPACING apart
          for (let i = 0; i < snake.segments.length - 1; i++) {
            const dist = vecDistance(snake.segments[i], snake.segments[i + 1]);
            expect(dist).toBeCloseTo(SEGMENT_SPACING, 0);
            expect(dist).toBeLessThanOrEqual(SEGMENT_SPACING + 1.0);
            expect(dist).toBeGreaterThanOrEqual(SEGMENT_SPACING - 1.0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('spacing holds after turning maneuvers', () => {
    fc.assert(
      fc.property(
        arbSegmentCount,
        arbDirection,
        arbAngle,
        fc.array(arbDt, { minLength: 5, maxLength: 15 }),
        (segCount, direction, targetDir, dts) => {
          const snake = createStraightSnake(segCount, direction);
          snake.targetDirection = targetDir;

          // Simulate multiple ticks with turning
          for (const dt of dts) {
            physics.applyTurnRate(snake, dt);
            physics.moveSnake(snake, dt);
            physics.updateSegments(snake);
          }

          // Verify head to first segment
          const headToFirst = vecDistance(snake.position, snake.segments[0]);
          expect(headToFirst).toBeLessThanOrEqual(SEGMENT_SPACING + 1.0);
          expect(headToFirst).toBeGreaterThanOrEqual(SEGMENT_SPACING - 1.0);

          // Verify consecutive segments
          for (let i = 0; i < snake.segments.length - 1; i++) {
            const dist = vecDistance(snake.segments[i], snake.segments[i + 1]);
            expect(dist).toBeLessThanOrEqual(SEGMENT_SPACING + 1.0);
            expect(dist).toBeGreaterThanOrEqual(SEGMENT_SPACING - 1.0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 2: Turn Rate Bound ────────────────────────────────────────────

describe('Property 2: Turn Rate Bound', () => {
  it('angular change never exceeds MAX_TURN_RATE × dt', () => {
    fc.assert(
      fc.property(arbAngle, arbAngle, arbDt, (currentDir, targetDir, dt) => {
        const snake = createStraightSnake(5, currentDir);
        snake.targetDirection = targetDir;
        const oldDirection = snake.direction;

        physics.applyTurnRate(snake, dt);

        const angularChange = Math.abs(angleDifference(oldDirection, snake.direction));
        const maxAllowed = MAX_TURN_RATE * dt + 1e-9; // epsilon for floating point

        expect(angularChange).toBeLessThanOrEqual(maxAllowed);
      }),
      { numRuns: 500 }
    );
  });

  it('direction moves closer to target (or reaches it)', () => {
    fc.assert(
      fc.property(arbAngle, arbAngle, arbDt, (currentDir, targetDir, dt) => {
        const snake = createStraightSnake(5, currentDir);
        snake.targetDirection = targetDir;

        const distBefore = Math.abs(angleDifference(snake.direction, snake.targetDirection));

        physics.applyTurnRate(snake, dt);

        const distAfter = Math.abs(angleDifference(snake.direction, snake.targetDirection));

        // Direction should have moved closer to target or reached it
        expect(distAfter).toBeLessThanOrEqual(distBefore + 1e-9);
      }),
      { numRuns: 500 }
    );
  });

  it('snaps to target when remaining angle is within one frame rotation', () => {
    fc.assert(
      fc.property(arbAngle, arbDt, (baseDir, dt) => {
        // Create a target that's within one frame's max rotation
        const smallOffset = (MAX_TURN_RATE * dt) * 0.5;
        const targetDir = baseDir + smallOffset;

        const snake = createStraightSnake(5, baseDir);
        snake.targetDirection = targetDir;

        physics.applyTurnRate(snake, dt);

        // Should snap exactly to target
        const remaining = Math.abs(angleDifference(snake.direction, snake.targetDirection));
        expect(remaining).toBeLessThan(1e-9);
      }),
      { numRuns: 200 }
    );
  });
});

// ─── Property 12: Effective Speed Calculation ────────────────────────────────

describe('Property 12: Effective Speed Calculation', () => {
  const arbStageBonus = fc.double({ min: 1.0, max: 1.15, noNaN: true, noDefaultInfinity: true });
  const arbZoneMultiplier = fc.double({ min: 1.0, max: 1.5, noNaN: true, noDefaultInfinity: true });
  const arbIsBoosting = fc.boolean();

  it('speed formula is correct for all modifier combinations, capped at MAX_SPEED_CAP', () => {
    fc.assert(
      fc.property(
        arbStageBonus,
        arbZoneMultiplier,
        arbIsBoosting,
        (stageBonus, zoneMultiplier, isBoosting) => {
          const snake = createStraightSnake(5);

          const result = physics.calculateEffectiveSpeed(snake, stageBonus, zoneMultiplier, isBoosting);

          // Expected calculation
          const baseEffective = BASE_SPEED * stageBonus * zoneMultiplier;
          const boostBonus = isBoosting ? (BOOST_SPEED - BASE_SPEED) : 0;
          const expected = Math.min(baseEffective + boostBonus, MAX_SPEED_CAP);

          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('result is always capped at MAX_SPEED_CAP', () => {
    fc.assert(
      fc.property(
        arbStageBonus,
        arbZoneMultiplier,
        arbIsBoosting,
        (stageBonus, zoneMultiplier, isBoosting) => {
          const snake = createStraightSnake(5);
          const result = physics.calculateEffectiveSpeed(snake, stageBonus, zoneMultiplier, isBoosting);
          expect(result).toBeLessThanOrEqual(MAX_SPEED_CAP);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('without boost, speed equals BASE_SPEED × stageBonus × zoneMultiplier (capped)', () => {
    fc.assert(
      fc.property(arbStageBonus, arbZoneMultiplier, (stageBonus, zoneMultiplier) => {
        const snake = createStraightSnake(5);
        const result = physics.calculateEffectiveSpeed(snake, stageBonus, zoneMultiplier, false);
        const expected = Math.min(BASE_SPEED * stageBonus * zoneMultiplier, MAX_SPEED_CAP);
        expect(result).toBeCloseTo(expected, 10);
      }),
      { numRuns: 200 }
    );
  });

  it('with boost, speed adds exactly (BOOST_SPEED - BASE_SPEED) bonus', () => {
    fc.assert(
      fc.property(arbStageBonus, arbZoneMultiplier, (stageBonus, zoneMultiplier) => {
        const snake = createStraightSnake(5);
        const withBoost = physics.calculateEffectiveSpeed(snake, stageBonus, zoneMultiplier, true);
        const withoutBoost = physics.calculateEffectiveSpeed(snake, stageBonus, zoneMultiplier, false);

        // If neither is capped, the difference should be exactly BOOST_SPEED - BASE_SPEED
        if (withBoost < MAX_SPEED_CAP && withoutBoost < MAX_SPEED_CAP) {
          expect(withBoost - withoutBoost).toBeCloseTo(BOOST_SPEED - BASE_SPEED, 10);
        }
      }),
      { numRuns: 200 }
    );
  });
});

// ─── Property 13: Boost Mass Drain Invariant ─────────────────────────────────

describe('Property 13: Boost Mass Drain Invariant', () => {
  const arbBoostDt = fc.double({ min: 0.01, max: 0.5, noNaN: true, noDefaultInfinity: true });
  const arbEfficiency = fc.double({ min: 0.5, max: 1.0, noNaN: true, noDefaultInfinity: true });
  const arbMass = fc.double({ min: 20, max: 1000, noNaN: true, noDefaultInfinity: true });

  it('mass drains by exactly BOOST_MASS_DRAIN × dt × efficiency', () => {
    fc.assert(
      fc.property(arbBoostDt, arbEfficiency, arbMass, (dt, efficiency, initialMass) => {
        const snake = createStraightSnake(5);
        snake.mass = initialMass;
        snake.isBoosting = true;
        snake.boostTrailTimer = 0;

        const massBefore = snake.mass;
        physics.applyBoost(snake, dt, efficiency);

        // If snake didn't get locked out, mass should decrease by drain amount
        const expectedDrain = BOOST_MASS_DRAIN * dt * efficiency;

        if (massBefore - expectedDrain > 10) {
          // Snake should still be boosting, mass decreased by expected drain
          expect(snake.mass).toBeCloseTo(massBefore - expectedDrain, 5);
        }
      }),
      { numRuns: 500 }
    );
  });

  it('trail orbs count matches floor(dt × 1000 / BOOST_TRAIL_INTERVAL) for fresh timer', () => {
    fc.assert(
      fc.property(arbBoostDt, arbEfficiency, arbMass, (dt, efficiency, initialMass) => {
        const snake = createStraightSnake(5);
        snake.mass = initialMass;
        snake.isBoosting = true;
        snake.boostTrailTimer = 0;

        const trailOrbs = physics.applyBoost(snake, dt, efficiency);

        // Only check if snake didn't get locked out
        if (snake.isBoosting || snake.mass > 10) {
          const expectedOrbs = Math.floor((dt * 1000) / BOOST_TRAIL_INTERVAL);
          expect(trailOrbs.length).toBe(expectedOrbs);
        }
      }),
      { numRuns: 500 }
    );
  });

  it('trail orb count accounts for existing timer accumulation', () => {
    fc.assert(
      fc.property(
        arbBoostDt,
        arbEfficiency,
        arbMass,
        fc.double({ min: 0, max: 99, noNaN: true, noDefaultInfinity: true }),
        (dt, efficiency, initialMass, existingTimer) => {
          const snake = createStraightSnake(5);
          snake.mass = initialMass;
          snake.isBoosting = true;
          snake.boostTrailTimer = existingTimer;

          const trailOrbs = physics.applyBoost(snake, dt, efficiency);

          // Only check if snake didn't get locked out
          if (snake.isBoosting) {
            const totalTimerMs = existingTimer + dt * 1000;
            const expectedOrbs = Math.floor(totalTimerMs / BOOST_TRAIL_INTERVAL);
            expect(trailOrbs.length).toBe(expectedOrbs);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('boost locks when mass drops to BOOST_LOCKOUT_MASS or below', () => {
    fc.assert(
      fc.property(arbEfficiency, (efficiency) => {
        const snake = createStraightSnake(5);
        // Set mass just above lockout so a single tick drains below
        snake.mass = 11;
        snake.isBoosting = true;
        snake.boostTrailTimer = 0;

        const dt = 0.1; // enough to drain below 10
        physics.applyBoost(snake, dt, efficiency);

        // Mass drained: 14 * 0.1 * efficiency >= 0.7, so mass <= 10.3
        // If mass drops to ≤ 10, boost should lock
        if (snake.mass <= 10) {
          expect(snake.isBoosting).toBe(false);
          expect(snake.boostLocked).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
