import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LeaderboardManager } from '../LeaderboardManager';

// ─── Property 26: Leaderboard Ordering ───────────────────────────────────────

describe('Property 26: Leaderboard Ordering', () => {
  it('leaderboard is sorted descending by mass, ties broken by earliest timestamp', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            name: fc.string({ minLength: 1, maxLength: 10 }),
            mass: fc.integer({ min: 1, max: 10000 }),
            evolutionStage: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (snakes) => {
          // Ensure unique IDs
          const uniqueSnakes = snakes.filter(
            (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
          );
          if (uniqueSnakes.length === 0) return;

          const manager = new LeaderboardManager();
          manager.update(uniqueSnakes);

          const top10 = manager.getTop10();

          // Verify descending order by mass, ties by earliest achievedAt
          for (let i = 0; i < top10.length - 1; i++) {
            const current = top10[i];
            const next = top10[i + 1];

            if (current.mass !== next.mass) {
              expect(current.mass).toBeGreaterThan(next.mass);
            } else {
              // Equal mass: earlier achievedAt comes first
              expect(current.achievedAt).toBeLessThanOrEqual(next.achievedAt);
            }
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('only top 10 entries are returned regardless of input size', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 1, maxLength: 8 }),
            mass: fc.integer({ min: 1, max: 50000 }),
            evolutionStage: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 0, maxLength: 100 }
        ),
        (snakes) => {
          // Ensure unique IDs
          const uniqueSnakes = snakes.filter(
            (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
          );

          const manager = new LeaderboardManager();
          manager.update(uniqueSnakes);

          const top10 = manager.getTop10();

          expect(top10.length).toBeLessThanOrEqual(10);
          expect(top10.length).toBe(Math.min(uniqueSnakes.length, 10));
        }
      ),
      { numRuns: 300 }
    );
  });

  it('top 10 contains the highest mass entries', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 1, maxLength: 8 }),
            mass: fc.integer({ min: 1, max: 50000 }),
            evolutionStage: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 11, maxLength: 50 }
        ),
        (snakes) => {
          // Ensure unique IDs
          const uniqueSnakes = snakes.filter(
            (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
          );
          if (uniqueSnakes.length <= 10) return;

          const manager = new LeaderboardManager();
          manager.update(uniqueSnakes);

          const top10 = manager.getTop10();
          const minMassInTop10 = Math.min(...top10.map((e) => e.mass));

          // Every snake NOT in top 10 should have mass ≤ the minimum mass in top 10
          const top10Ids = new Set(top10.map((e) => e.snakeId));
          for (const snake of uniqueSnakes) {
            if (!top10Ids.has(snake.id)) {
              expect(snake.mass).toBeLessThanOrEqual(minMassInTop10);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('tie-breaking by earliest timestamp is consistent', () => {
    // Create snakes with identical masses and verify ordering by achievedAt
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 100, max: 5000 }),
        (count, sharedMass) => {
          const snakes = Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Snake_${i}`,
            mass: sharedMass,
            evolutionStage: 1,
          }));

          const manager = new LeaderboardManager();
          manager.update(snakes);

          const top10 = manager.getTop10();

          // All entries have the same mass, so they should be ordered by achievedAt
          for (let i = 0; i < top10.length - 1; i++) {
            expect(top10[i].achievedAt).toBeLessThanOrEqual(top10[i + 1].achievedAt);
          }

          // All should have the same mass
          for (const entry of top10) {
            expect(entry.mass).toBe(sharedMass);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('leaderboard updates correctly when masses change', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            mass: fc.integer({ min: 1, max: 10000 }),
            evolutionStage: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.array(
          fc.integer({ min: 1, max: 10000 }),
          { minLength: 2, maxLength: 20 }
        ),
        (initialSnakes, newMasses) => {
          // Ensure unique IDs
          const uniqueSnakes = initialSnakes.filter(
            (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
          );
          if (uniqueSnakes.length < 2) return;

          const snakesWithNames = uniqueSnakes.map((s) => ({
            ...s,
            name: `Snake_${s.id}`,
          }));

          const manager = new LeaderboardManager();
          manager.update(snakesWithNames);

          // Update with new masses
          const updatedSnakes = snakesWithNames.map((s, i) => ({
            ...s,
            mass: newMasses[i % newMasses.length],
          }));

          manager.update(updatedSnakes);

          const top10 = manager.getTop10();

          // Verify ordering is still correct after mass changes
          for (let i = 0; i < top10.length - 1; i++) {
            const current = top10[i];
            const next = top10[i + 1];

            if (current.mass !== next.mass) {
              expect(current.mass).toBeGreaterThan(next.mass);
            } else {
              expect(current.achievedAt).toBeLessThanOrEqual(next.achievedAt);
            }
          }

          // Size constraint still holds
          expect(top10.length).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 200 }
    );
  });
});
