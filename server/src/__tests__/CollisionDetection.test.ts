import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CollisionEngine } from '../CollisionEngine';
import type { Snake } from '../Physics';
import {
  ARENA_RADIUS,
  HEAD_COLLISION_RADIUS,
  BODY_COLLISION_RADIUS,
  ORB_COLLECTION_DISTANCE,
  HEAD_TO_HEAD_DISTANCE,
} from '@snake-king/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Euclidean distance between two points */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Build a minimal Snake object for testing */
function makeSnake(id: number, position: { x: number; y: number }, segments: { x: number; y: number }[] = []): Snake {
  return {
    id,
    position,
    direction: 0,
    targetDirection: 0,
    segments,
    mass: 100,
    speed: 200,
    isBoosting: false,
    evolutionStage: 1,
    pathHistory: [position],
    boostLocked: false,
    massAccumulator: 0,
    boostTrailTimer: 0,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Position within the arena */
const arbPosition = fc.record({
  x: fc.double({ min: -4000, max: 4000, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -4000, max: 4000, noNaN: true, noDefaultInfinity: true }),
});

/** Position anywhere (including outside arena) */
const arbWidePosition = fc.record({
  x: fc.double({ min: -6000, max: 6000, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -6000, max: 6000, noNaN: true, noDefaultInfinity: true }),
});

/** Generate a segment array of 1-10 segments at known positions */
const arbSegments = fc.array(arbPosition, { minLength: 1, maxLength: 10 });

// ─── Property 5: Orb Collection Distance Threshold ──────────────────────────

describe('Property 5: Orb Collection Distance Threshold', () => {
  it('an orb is collected iff distance(snake.head, orb.position) < ORB_COLLECTION_DISTANCE', () => {
    fc.assert(
      fc.property(
        // Generate 1-5 snakes
        fc.array(arbPosition, { minLength: 1, maxLength: 5 }),
        // Generate 1-20 orbs
        fc.array(arbPosition, { minLength: 1, maxLength: 20 }),
        (snakePositions, orbPositions) => {
          const engine = new CollisionEngine();

          const snakes = snakePositions.map((pos, i) =>
            makeSnake(i + 1, pos, [{ x: pos.x - 20, y: pos.y }])
          );

          const orbs = orbPositions.map((pos, i) => ({
            id: i + 1,
            position: pos,
          }));

          engine.rebuildGrid(snakes, orbs);
          const collections = engine.detectOrbCollection(snakes, orbs);

          const collectedOrbIds = new Set(collections.map((c) => c.orbId));

          // For each orb, check if any snake head is within ORB_COLLECTION_DISTANCE
          for (const orb of orbs) {
            const anySnakeClose = snakes.some(
              (s) => distance(s.position, orb.position) < ORB_COLLECTION_DISTANCE
            );

            if (anySnakeClose) {
              // Orb should be collected
              expect(collectedOrbIds.has(orb.id)).toBe(true);
            } else {
              // Orb should NOT be collected
              expect(collectedOrbIds.has(orb.id)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('each orb is collected by at most one snake per tick', () => {
    fc.assert(
      fc.property(
        // Generate 2-5 snakes at similar positions to create contention
        fc.array(arbPosition, { minLength: 2, maxLength: 5 }),
        fc.array(arbPosition, { minLength: 1, maxLength: 20 }),
        (snakePositions, orbPositions) => {
          const engine = new CollisionEngine();

          const snakes = snakePositions.map((pos, i) =>
            makeSnake(i + 1, pos, [{ x: pos.x - 20, y: pos.y }])
          );

          const orbs = orbPositions.map((pos, i) => ({
            id: i + 1,
            position: pos,
          }));

          engine.rebuildGrid(snakes, orbs);
          const collections = engine.detectOrbCollection(snakes, orbs);

          // Check uniqueness: each orbId appears at most once
          const orbIdCounts = new Map<number, number>();
          for (const c of collections) {
            orbIdCounts.set(c.orbId, (orbIdCounts.get(c.orbId) ?? 0) + 1);
          }

          for (const [orbId, count] of orbIdCounts) {
            expect(count).toBe(1);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 7: Head-to-Body Collision Detection ───────────────────────────

describe('Property 7: Head-to-Body Collision Detection', () => {
  const HEAD_TO_BODY_THRESHOLD = HEAD_COLLISION_RADIUS + BODY_COLLISION_RADIUS; // 27

  it('collision detected iff distance(head, segment of other snake) < threshold', () => {
    fc.assert(
      fc.property(
        arbPosition, // snake1 head position
        arbSegments, // snake1 segments
        arbPosition, // snake2 head position
        arbSegments, // snake2 segments
        (pos1, segs1, pos2, segs2) => {
          const engine = new CollisionEngine();

          const snake1 = makeSnake(1, pos1, segs1);
          const snake2 = makeSnake(2, pos2, segs2);
          const snakes = [snake1, snake2];

          // Rebuild grid with no orbs (not needed for head-to-body)
          engine.rebuildGrid(snakes, []);
          const collisions = engine.detectHeadToBody(snakes);

          // Check snake1's head vs snake2's segments
          const snake1HitsSnake2 = segs2.some(
            (seg) => distance(pos1, seg) < HEAD_TO_BODY_THRESHOLD
          );

          // Check snake2's head vs snake1's segments
          const snake2HitsSnake1 = segs1.some(
            (seg) => distance(pos2, seg) < HEAD_TO_BODY_THRESHOLD
          );

          const victims = new Set(collisions.map((c) => c.victimId));

          // Note: if snake1 is already eliminated, snake2 won't be checked further
          // in the engine (break after first elimination), so we test directionally
          if (snake1HitsSnake2) {
            // Snake1 should be a victim (it ran into snake2's body)
            expect(victims.has(1)).toBe(true);
          }

          // If snake1 was not eliminated, snake2 hitting snake1's body should be detected
          if (!snake1HitsSnake2 && snake2HitsSnake1) {
            expect(victims.has(2)).toBe(true);
          }

          // No collision should list someone as a victim if they don't hit anything
          if (!snake1HitsSnake2) {
            expect(victims.has(1)).toBe(false);
          }
          if (!snake2HitsSnake1) {
            expect(victims.has(2)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('self-collision is never detected', () => {
    fc.assert(
      fc.property(
        arbPosition,
        arbSegments,
        (headPos, segments) => {
          const engine = new CollisionEngine();

          // Create a single snake whose segments overlap with its own head
          // Place a segment exactly at the head position to force potential self-collision
          const segmentsWithOverlap = [{ ...headPos }, ...segments];
          const snake = makeSnake(1, headPos, segmentsWithOverlap);

          engine.rebuildGrid([snake], []);
          const collisions = engine.detectHeadToBody([snake]);

          // No collisions should be detected (self-collision excluded)
          expect(collisions).toHaveLength(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 9: Arena Boundary Elimination ─────────────────────────────────

describe('Property 9: Arena Boundary Elimination', () => {
  const BOUNDARY_THRESHOLD = ARENA_RADIUS - HEAD_COLLISION_RADIUS; // 5000 - 15 = 4985

  it('snake is eliminated iff distance from center > (ARENA_RADIUS - HEAD_COLLISION_RADIUS)', () => {
    fc.assert(
      fc.property(
        fc.array(arbWidePosition, { minLength: 1, maxLength: 10 }),
        (positions) => {
          const engine = new CollisionEngine();

          const snakes = positions.map((pos, i) =>
            makeSnake(i + 1, pos, [{ x: pos.x - 20, y: pos.y }])
          );

          const eliminated = engine.detectHeadToBoundary(snakes, ARENA_RADIUS);
          const eliminatedSet = new Set(eliminated);

          for (const snake of snakes) {
            const distFromCenter = distance(snake.position, { x: 0, y: 0 });

            if (distFromCenter > BOUNDARY_THRESHOLD) {
              expect(eliminatedSet.has(snake.id)).toBe(true);
            } else {
              expect(eliminatedSet.has(snake.id)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('snake safely inside boundary is not eliminated', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: BOUNDARY_THRESHOLD - 1, noNaN: true, noDefaultInfinity: true }),
        (angle, dist) => {
          const engine = new CollisionEngine();

          // Place snake safely within boundary (at least 1 unit inside)
          const pos = {
            x: dist * Math.cos(angle),
            y: dist * Math.sin(angle),
          };
          const snake = makeSnake(1, pos);

          const eliminated = engine.detectHeadToBoundary([snake], ARENA_RADIUS);

          // Snake inside boundary should never be eliminated
          expect(eliminated).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('snake outside boundary is always eliminated', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: BOUNDARY_THRESHOLD + 1, max: 6000, noNaN: true, noDefaultInfinity: true }),
        (angle, dist) => {
          const engine = new CollisionEngine();

          // Place snake outside boundary (at least 1 unit beyond)
          const pos = {
            x: dist * Math.cos(angle),
            y: dist * Math.sin(angle),
          };
          const snake = makeSnake(1, pos);

          const eliminated = engine.detectHeadToBoundary([snake], ARENA_RADIUS);

          // Snake outside boundary should always be eliminated
          expect(eliminated).toHaveLength(1);
          expect(eliminated[0]).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Head-to-Head Mutual Elimination ───────────────────────────

describe('Property 10: Head-to-Head Mutual Elimination', () => {
  it('both snakes eliminated iff distance(head1, head2) < HEAD_TO_HEAD_DISTANCE', () => {
    fc.assert(
      fc.property(
        arbPosition,
        arbPosition,
        (pos1, pos2) => {
          const engine = new CollisionEngine();

          const snake1 = makeSnake(1, pos1);
          const snake2 = makeSnake(2, pos2);

          engine.rebuildGrid([snake1, snake2], []);
          const collisions = engine.detectHeadToHead([snake1, snake2]);

          const dist = distance(pos1, pos2);

          if (dist < HEAD_TO_HEAD_DISTANCE) {
            // Both should be eliminated
            expect(collisions.length).toBeGreaterThanOrEqual(1);
            const pair = collisions.find(
              (c) =>
                (c.snake1Id === 1 && c.snake2Id === 2) ||
                (c.snake1Id === 2 && c.snake2Id === 1)
            );
            expect(pair).toBeDefined();
          } else {
            // No collision between these two
            const pair = collisions.find(
              (c) =>
                (c.snake1Id === 1 && c.snake2Id === 2) ||
                (c.snake1Id === 2 && c.snake2Id === 1)
            );
            expect(pair).toBeUndefined();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('head-to-head collision is mutual (both snakes listed)', () => {
    fc.assert(
      fc.property(
        // Generate positions that are definitely within collision distance
        arbPosition,
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: HEAD_TO_HEAD_DISTANCE - 0.01, noNaN: true, noDefaultInfinity: true }),
        (basePos, angle, dist) => {
          const engine = new CollisionEngine();

          const pos1 = basePos;
          const pos2 = {
            x: basePos.x + dist * Math.cos(angle),
            y: basePos.y + dist * Math.sin(angle),
          };

          const snake1 = makeSnake(1, pos1);
          const snake2 = makeSnake(2, pos2);

          engine.rebuildGrid([snake1, snake2], []);
          const collisions = engine.detectHeadToHead([snake1, snake2]);

          // Should find a mutual collision
          expect(collisions.length).toBe(1);
          expect(collisions[0].snake1Id).toBe(1);
          expect(collisions[0].snake2Id).toBe(2);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('multiple pairs detected independently', () => {
    fc.assert(
      fc.property(
        fc.array(arbPosition, { minLength: 2, maxLength: 6 }),
        (positions) => {
          const engine = new CollisionEngine();

          const snakes = positions.map((pos, i) => makeSnake(i + 1, pos));

          engine.rebuildGrid(snakes, []);
          const collisions = engine.detectHeadToHead(snakes);

          // Verify: every pair in collisions actually has distance < threshold
          for (const collision of collisions) {
            const s1 = snakes.find((s) => s.id === collision.snake1Id)!;
            const s2 = snakes.find((s) => s.id === collision.snake2Id)!;
            const dist = distance(s1.position, s2.position);
            expect(dist).toBeLessThan(HEAD_TO_HEAD_DISTANCE);
          }

          // Verify: every pair with distance < threshold is in collisions
          for (let i = 0; i < snakes.length; i++) {
            for (let j = i + 1; j < snakes.length; j++) {
              const dist = distance(snakes[i].position, snakes[j].position);
              const found = collisions.some(
                (c) =>
                  (c.snake1Id === snakes[i].id && c.snake2Id === snakes[j].id) ||
                  (c.snake1Id === snakes[j].id && c.snake2Id === snakes[i].id)
              );

              if (dist < HEAD_TO_HEAD_DISTANCE) {
                expect(found).toBe(true);
              } else {
                expect(found).toBe(false);
              }
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
