import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { BattleRoyaleController } from '../modes/BattleRoyaleMode';
import { ARENA_RADIUS } from '@snake-king/shared';

describe('BattleRoyaleController - Property 22: Arena Shrink Formula', () => {
  it('radius = originalRadius × (1 - 0.05 × floor(T / 30))', () => {
    fc.assert(
      fc.property(
        // Generate elapsed time between 0 and 1200 seconds (enough for full shrink)
        fc.float({ min: 0, max: 1200, noNaN: true }),
        (totalTime) => {
          const controller = new BattleRoyaleController();

          // Advance to the target time in one tick
          controller.tick(totalTime);

          const expectedShrinks = Math.floor(totalTime / 30);
          const computedRadius = ARENA_RADIUS * (1 - 0.05 * expectedShrinks);
          const expectedRadius = Math.max(computedRadius, 100);

          expect(controller.getCurrentRadius()).toBeCloseTo(expectedRadius, 5);
          expect(controller.getShrinkCount()).toBe(expectedShrinks);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('after each shrink, radius decreases by 5% of original', () => {
    fc.assert(
      fc.property(
        // Number of 30-second intervals to simulate (1 to 20)
        fc.integer({ min: 1, max: 20 }),
        (intervals) => {
          const controller = new BattleRoyaleController();

          let previousRadius = controller.getCurrentRadius();

          for (let i = 1; i <= intervals; i++) {
            controller.tick(30);

            const currentRadius = controller.getCurrentRadius();
            const expectedDecrease = ARENA_RADIUS * 0.05;

            // If not at minimum, radius should have decreased by 5% of original
            if (previousRadius > 100) {
              const actualDecrease = previousRadius - currentRadius;
              // Either it decreased by 5% of original, or it hit the minimum
              if (currentRadius > 100) {
                expect(actualDecrease).toBeCloseTo(expectedDecrease, 5);
              } else {
                // Hit minimum - current radius should be exactly 100
                expect(currentRadius).toBe(100);
              }
            }

            previousRadius = currentRadius;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('minimum radius never goes below 100', () => {
    fc.assert(
      fc.property(
        // Generate large elapsed times that would push radius below 100
        fc.float({ min: 0, max: 10000, noNaN: true }),
        (totalTime) => {
          const controller = new BattleRoyaleController();
          controller.tick(totalTime);

          expect(controller.getCurrentRadius()).toBeGreaterThanOrEqual(100);
        }
      ),
      { numRuns: 200 }
    );
  });
});
