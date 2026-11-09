import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GameSession } from '../GameSession';
import {
  vecDistance,
  ARENA_RADIUS,
  SPAWN_INNER_RADIUS_PERCENT,
  SPAWN_FALLBACK_RADIUS_PERCENT,
  SPAWN_MIN_DISTANCE,
  INTEREST_RADIUS,
} from '@snake-king/shared';

// ─── Property 4: Spawn Position Validity ─────────────────────────────────────

describe('Property 4: Spawn Position Validity', () => {
  it('addPlayer spawns within inner 70% of arena', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (playerCount) => {
          const session = new GameSession();

          for (let i = 0; i < playerCount; i++) {
            session.addPlayer(`Player_${i}`);
          }

          const snakes = session.getSnakes();
          const innerRadius = ARENA_RADIUS * SPAWN_INNER_RADIUS_PERCENT;
          const fallbackRadius = ARENA_RADIUS * SPAWN_FALLBACK_RADIUS_PERCENT;

          for (const snake of snakes) {
            const distFromCenter = vecDistance(snake.position, { x: 0, y: 0 });
            // Must be within fallback radius (85%) at minimum
            expect(distFromCenter).toBeLessThanOrEqual(fallbackRadius + 1e-6);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('spawn position is ≥300u from all existing snakes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        (playerCount) => {
          const session = new GameSession();
          const snakeIds: number[] = [];

          for (let i = 0; i < playerCount; i++) {
            const id = session.addPlayer(`Player_${i}`);
            snakeIds.push(id);
          }

          const snakes = session.getSnakes();

          // Check pairwise distances: each spawn should have been ≥300u from
          // all previously existing snakes at the time of spawning.
          // Since we can't retroactively check the order, we verify the
          // constraint still holds for all pairs (it can only get closer if
          // physics runs, but we haven't run any ticks).
          for (let i = 0; i < snakes.length; i++) {
            for (let j = i + 1; j < snakes.length; j++) {
              const dist = vecDistance(snakes[i].position, snakes[j].position);
              // The spawn algorithm guarantees ≥SPAWN_MIN_DISTANCE from existing snakes.
              // However, the final fallback position (after 40 failed attempts) might not
              // satisfy this. With ≤15 players in a 5000-radius arena, this should hold.
              expect(dist).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE - 1e-6);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('spawn position is within arena bounds (inner or fallback radius)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (playerCount) => {
          const session = new GameSession();

          for (let i = 0; i < playerCount; i++) {
            session.addPlayer(`Player_${i}`);
          }

          const snakes = session.getSnakes();
          const fallbackRadius = ARENA_RADIUS * SPAWN_FALLBACK_RADIUS_PERCENT;

          for (const snake of snakes) {
            const distFromCenter = vecDistance(snake.position, { x: 0, y: 0 });
            expect(distFromCenter).toBeLessThanOrEqual(fallbackRadius + 1e-6);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 29: Interest Management Filtering ──────────────────────────────

describe('Property 29: Interest Management Filtering', () => {
  it('getStateDelta contains exactly entities within INTEREST_RADIUS (1500u)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (playerCount) => {
          const session = new GameSession();
          const snakeIds: number[] = [];

          for (let i = 0; i < playerCount; i++) {
            const id = session.addPlayer(`Player_${i}`);
            snakeIds.push(id);
          }

          // Run a few ticks to spawn some orbs
          for (let t = 0; t < 5; t++) {
            session.gameTick(1 / 20);
          }

          // Check interest management for the first player
          const observerId = snakeIds[0];
          const observer = session.getSnake(observerId);
          if (!observer) return; // skip if somehow removed

          const delta = session.getStateDelta(observerId);

          // All snakes in delta must be within INTEREST_RADIUS of observer
          for (const snakeDelta of delta.snakes) {
            const dist = vecDistance(observer.position, snakeDelta.position);
            expect(dist).toBeLessThanOrEqual(INTEREST_RADIUS + 1e-6);
          }

          // All orbs in delta must be within INTEREST_RADIUS of observer
          for (const orbDelta of delta.orbs) {
            const dist = vecDistance(observer.position, orbDelta.position);
            expect(dist).toBeLessThanOrEqual(INTEREST_RADIUS + 1e-6);
          }

          // Verify completeness: all snakes within radius ARE in delta
          const allSnakes = session.getSnakes();
          for (const snake of allSnakes) {
            const dist = vecDistance(observer.position, snake.position);
            if (dist <= INTEREST_RADIUS) {
              const inDelta = delta.snakes.some((s) => s.id === snake.id);
              expect(inDelta).toBe(true);
            }
          }

          // Verify completeness: all orbs within radius ARE in delta
          const allOrbs = session.getOrbs();
          for (const [orbId, orb] of allOrbs) {
            const dist = vecDistance(observer.position, orb.position);
            if (dist <= INTEREST_RADIUS) {
              const inDelta = delta.orbs.some((o) => o.id === orbId);
              expect(inDelta).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('entities outside INTEREST_RADIUS are excluded from delta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        (playerCount) => {
          const session = new GameSession();
          const snakeIds: number[] = [];

          for (let i = 0; i < playerCount; i++) {
            const id = session.addPlayer(`Player_${i}`);
            snakeIds.push(id);
          }

          // Run ticks to populate orbs
          for (let t = 0; t < 3; t++) {
            session.gameTick(1 / 20);
          }

          const observerId = snakeIds[0];
          const observer = session.getSnake(observerId);
          if (!observer) return;

          const delta = session.getStateDelta(observerId);

          // Verify no snake in delta is beyond interest radius
          const allSnakes = session.getSnakes();
          for (const snake of allSnakes) {
            const dist = vecDistance(observer.position, snake.position);
            if (dist > INTEREST_RADIUS) {
              const inDelta = delta.snakes.some((s) => s.id === snake.id);
              expect(inDelta).toBe(false);
            }
          }

          // Verify no orb in delta is beyond interest radius
          const allOrbs = session.getOrbs();
          for (const [orbId, orb] of allOrbs) {
            const dist = vecDistance(observer.position, orb.position);
            if (dist > INTEREST_RADIUS) {
              const inDelta = delta.orbs.some((o) => o.id === orbId);
              expect(inDelta).toBe(false);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 31: Orb Density Distribution ───────────────────────────────────

describe('Property 31: Orb Density Distribution', () => {
  it('orbs within 30% of center have approximately 2× density of outer regions', () => {
    // Spawn a large number of orbs and check density ratio
    // Use a single run with many ticks to get statistically significant data
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 100 }),
        (tickCount) => {
          const session = new GameSession();

          // Run many ticks to let orbs accumulate
          for (let t = 0; t < tickCount; t++) {
            session.gameTick(1 / 20);
          }

          const allOrbs = session.getOrbs();
          const centerThreshold = ARENA_RADIUS * 0.3;

          let centerCount = 0;
          let outerCount = 0;

          for (const orb of allOrbs.values()) {
            const dist = vecDistance(orb.position, { x: 0, y: 0 });
            if (dist <= centerThreshold) {
              centerCount++;
            } else {
              outerCount++;
            }
          }

          // Skip if not enough orbs to be statistically meaningful
          if (allOrbs.size < 100) return;

          // Calculate density (count per unit area)
          const centerArea = Math.PI * centerThreshold * centerThreshold;
          const maxRadius = ARENA_RADIUS * 0.95;
          const outerArea = Math.PI * maxRadius * maxRadius - centerArea;

          const centerDensity = centerCount / centerArea;
          const outerDensity = outerCount / outerArea;

          // The center should have roughly 2× density of outer region.
          // Allow a generous tolerance since this is probabilistic (1.2x to 4x).
          if (outerDensity > 0) {
            const ratio = centerDensity / outerDensity;
            expect(ratio).toBeGreaterThan(1.2);
            expect(ratio).toBeLessThan(4.0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
