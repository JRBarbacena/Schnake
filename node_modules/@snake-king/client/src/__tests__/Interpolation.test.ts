import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { InterpolationBuffer, SnakeSnapshot } from '../Interpolation';

/**
 * Property 3: Interpolation Correctness
 *
 * Given two snapshots and a render time that falls between them (after buffer offset),
 * the interpolated position lies on the line segment between the two snapshot positions.
 * At t=0 (renderTime maps to snap1), result equals snap1 position.
 * At t=1 (renderTime maps to snap2), result equals snap2 position.
 */

// Arbitrary for a Vec2 position
const arbVec2 = fc.record({
  x: fc.double({ min: -5000, max: 5000, noNaN: true }),
  y: fc.double({ min: -5000, max: 5000, noNaN: true }),
});

// Arbitrary for a direction angle
const arbDirection = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true });

// Arbitrary for segments array (small for performance)
const arbSegments = fc.array(arbVec2, { minLength: 1, maxLength: 5 });

// Helper to create a snapshot from components
function makeSnapshot(
  id: number,
  position: { x: number; y: number },
  direction: number,
  segments: { x: number; y: number }[],
  mass: number,
  speed: number,
  timestamp: number
): SnakeSnapshot {
  return {
    id,
    position,
    direction,
    segments,
    mass,
    speed,
    isBoosting: false,
    evolutionStage: 1,
    timestamp,
  };
}

describe('InterpolationBuffer - Property Tests', () => {
  it('Property 3: interpolated position lies on line segment between two states', () => {
    fc.assert(
      fc.property(
        arbVec2,
        arbVec2,
        arbDirection,
        arbDirection,
        arbSegments,
        arbSegments,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 100, max: 1000, noNaN: true }), // mass1
        fc.double({ min: 100, max: 1000, noNaN: true }), // mass2
        fc.double({ min: 100, max: 525, noNaN: true }), // speed1
        fc.double({ min: 100, max: 525, noNaN: true }), // speed2
        (pos1, pos2, dir1, dir2, segs1, segs2, t, mass1, mass2, speed1, speed2) => {
          const snakeId = 1;
          const bufferDuration = 100; // default buffer is 100ms
          const baseTime = 1000;
          const timeDelta = 200; // 200ms between snapshots

          const snap1 = makeSnapshot(snakeId, pos1, dir1, segs1, mass1, speed1, baseTime);
          const snap2 = makeSnapshot(
            snakeId,
            pos2,
            dir2,
            segs2,
            mass2,
            speed2,
            baseTime + timeDelta
          );

          const buffer = new InterpolationBuffer();
          buffer.pushSnapshot(snap1);
          buffer.pushSnapshot(snap2);

          // renderTime such that interpTime = renderTime - bufferDuration
          // falls at t fraction between snap1.timestamp and snap2.timestamp
          // interpTime = baseTime + t * timeDelta
          // renderTime = interpTime + bufferDuration
          const renderTime = baseTime + t * timeDelta + bufferDuration;

          const result = buffer.getInterpolatedState(snakeId, renderTime);
          expect(result).not.toBeNull();

          if (result) {
            // The interpolated position should lie on the line segment between pos1 and pos2
            // i.e., result.position = pos1 + t * (pos2 - pos1)
            const expectedX = pos1.x + t * (pos2.x - pos1.x);
            const expectedY = pos1.y + t * (pos2.y - pos1.y);

            expect(result.position.x).toBeCloseTo(expectedX, 5);
            expect(result.position.y).toBeCloseTo(expectedY, 5);

            // Verify the position is on the segment by checking it's a convex combination
            // For any coordinate c: min(a,b) <= c <= max(a,b)
            const minX = Math.min(pos1.x, pos2.x);
            const maxX = Math.max(pos1.x, pos2.x);
            const minY = Math.min(pos1.y, pos2.y);
            const maxY = Math.max(pos1.y, pos2.y);

            expect(result.position.x).toBeGreaterThanOrEqual(minX - 1e-9);
            expect(result.position.x).toBeLessThanOrEqual(maxX + 1e-9);
            expect(result.position.y).toBeGreaterThanOrEqual(minY - 1e-9);
            expect(result.position.y).toBeLessThanOrEqual(maxY + 1e-9);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property 3a: at t=0, interpolated state equals first snapshot position', () => {
    fc.assert(
      fc.property(
        arbVec2,
        arbVec2,
        arbDirection,
        arbDirection,
        arbSegments,
        arbSegments,
        (pos1, pos2, dir1, dir2, segs1, segs2) => {
          const snakeId = 1;
          const bufferDuration = 100;
          const baseTime = 1000;
          const timeDelta = 200;

          const snap1 = makeSnapshot(snakeId, pos1, dir1, segs1, 100, 200, baseTime);
          const snap2 = makeSnapshot(snakeId, pos2, dir2, segs2, 200, 300, baseTime + timeDelta);

          const buffer = new InterpolationBuffer();
          buffer.pushSnapshot(snap1);
          buffer.pushSnapshot(snap2);

          // t=0 means interpTime = snap1.timestamp = baseTime
          // renderTime = baseTime + bufferDuration
          const renderTime = baseTime + bufferDuration;
          const result = buffer.getInterpolatedState(snakeId, renderTime);

          expect(result).not.toBeNull();
          if (result) {
            expect(result.position.x).toBeCloseTo(pos1.x, 5);
            expect(result.position.y).toBeCloseTo(pos1.y, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3b: at t=1, interpolated state equals second snapshot position', () => {
    fc.assert(
      fc.property(
        arbVec2,
        arbVec2,
        arbDirection,
        arbDirection,
        arbSegments,
        arbSegments,
        (pos1, pos2, dir1, dir2, segs1, segs2) => {
          const snakeId = 1;
          const bufferDuration = 100;
          const baseTime = 1000;
          const timeDelta = 200;

          const snap1 = makeSnapshot(snakeId, pos1, dir1, segs1, 100, 200, baseTime);
          const snap2 = makeSnapshot(snakeId, pos2, dir2, segs2, 200, 300, baseTime + timeDelta);

          const buffer = new InterpolationBuffer();
          buffer.pushSnapshot(snap1);
          buffer.pushSnapshot(snap2);

          // t=1 means interpTime = snap2.timestamp = baseTime + timeDelta
          // renderTime = baseTime + timeDelta + bufferDuration
          const renderTime = baseTime + timeDelta + bufferDuration;
          const result = buffer.getInterpolatedState(snakeId, renderTime);

          expect(result).not.toBeNull();
          if (result) {
            expect(result.position.x).toBeCloseTo(pos2.x, 5);
            expect(result.position.y).toBeCloseTo(pos2.y, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: interpolated mass and speed are linear interpolations', () => {
    fc.assert(
      fc.property(
        arbVec2,
        arbVec2,
        fc.double({ min: 10, max: 5000, noNaN: true }), // mass1
        fc.double({ min: 10, max: 5000, noNaN: true }), // mass2
        fc.double({ min: 100, max: 525, noNaN: true }), // speed1
        fc.double({ min: 100, max: 525, noNaN: true }), // speed2
        fc.double({ min: 0, max: 1, noNaN: true }), // t
        (pos1, pos2, mass1, mass2, speed1, speed2, t) => {
          const snakeId = 1;
          const bufferDuration = 100;
          const baseTime = 1000;
          const timeDelta = 200;

          const snap1 = makeSnapshot(snakeId, pos1, 0, [pos1], mass1, speed1, baseTime);
          const snap2 = makeSnapshot(
            snakeId,
            pos2,
            0,
            [pos2],
            mass2,
            speed2,
            baseTime + timeDelta
          );

          const buffer = new InterpolationBuffer();
          buffer.pushSnapshot(snap1);
          buffer.pushSnapshot(snap2);

          const renderTime = baseTime + t * timeDelta + bufferDuration;
          const result = buffer.getInterpolatedState(snakeId, renderTime);

          expect(result).not.toBeNull();
          if (result) {
            const expectedMass = mass1 + t * (mass2 - mass1);
            const expectedSpeed = speed1 + t * (speed2 - speed1);

            expect(result.mass).toBeCloseTo(expectedMass, 5);
            expect(result.speed).toBeCloseTo(expectedSpeed, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
