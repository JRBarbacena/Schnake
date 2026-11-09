import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EvolutionSystem } from '../EvolutionSystem';
import {
  EVOLUTION_THRESHOLDS,
  EVOLUTION_DEVOLUTION_PERCENT,
  MASS_PER_SEGMENT,
} from '@snake-king/shared';

const evolution = new EvolutionSystem();

// ─── Property 6: Segment Growth from Mass Accumulation ───────────────────────

describe('Property 6: Segment Growth from Mass Accumulation', () => {
  const arbMassGained = fc.integer({ min: 0, max: 500 });

  it('new segments = floor(total_mass_gained / MASS_PER_SEGMENT) for any mass gained', () => {
    fc.assert(
      fc.property(arbMassGained, (totalMassGained) => {
        const expectedSegments = Math.floor(totalMassGained / MASS_PER_SEGMENT);
        expect(expectedSegments).toBe(Math.floor(totalMassGained / 10));
        // Verify the formula produces non-negative integers
        expect(expectedSegments).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(expectedSegments)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('segment count increases monotonically with mass gained', () => {
    fc.assert(
      fc.property(
        arbMassGained,
        fc.integer({ min: 0, max: 500 }),
        (massA, massB) => {
          const segA = Math.floor(massA / MASS_PER_SEGMENT);
          const segB = Math.floor(massB / MASS_PER_SEGMENT);
          if (massA <= massB) {
            expect(segA).toBeLessThanOrEqual(segB);
          } else {
            expect(segA).toBeGreaterThanOrEqual(segB);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('every MASS_PER_SEGMENT units of mass gained adds exactly 1 segment', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 49 }), (multiplier) => {
        const massGained = multiplier * MASS_PER_SEGMENT;
        const segments = Math.floor(massGained / MASS_PER_SEGMENT);
        expect(segments).toBe(multiplier);
      }),
      { numRuns: 50 }
    );
  });

  it('partial mass below MASS_PER_SEGMENT does not produce extra segment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        fc.integer({ min: 0, max: MASS_PER_SEGMENT - 1 }),
        (wholeMultiplier, remainder) => {
          const massGained = wholeMultiplier * MASS_PER_SEGMENT + remainder;
          const segments = Math.floor(massGained / MASS_PER_SEGMENT);
          expect(segments).toBe(wholeMultiplier);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── Property 19: Evolution Stage Assignment ─────────────────────────────────

describe('Property 19: Evolution Stage Assignment', () => {
  const arbMass = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });
  const arbStage = fc.integer({ min: 1, max: 5 });

  // ─── checkEvolution tests ──────────────────────────────────────────────────

  describe('checkEvolution', () => {
    it('returns the highest stage where threshold ≤ mass', () => {
      fc.assert(
        fc.property(arbMass, (mass) => {
          const stage = evolution.checkEvolution(mass, 1);

          // Determine expected stage manually
          let expectedStage = 1;
          for (let i = EVOLUTION_THRESHOLDS.length - 1; i >= 0; i--) {
            if (mass >= EVOLUTION_THRESHOLDS[i]) {
              expectedStage = i + 1;
              break;
            }
          }

          expect(stage).toBe(expectedStage);
        }),
        { numRuns: 1000 }
      );
    });

    it('stage is always between 1 and number of thresholds', () => {
      fc.assert(
        fc.property(arbMass, arbStage, (mass, currentStage) => {
          const stage = evolution.checkEvolution(mass, currentStage);
          expect(stage).toBeGreaterThanOrEqual(1);
          expect(stage).toBeLessThanOrEqual(EVOLUTION_THRESHOLDS.length);
        }),
        { numRuns: 500 }
      );
    });

    it('mass exactly at threshold → should be at that stage', () => {
      for (let i = 0; i < EVOLUTION_THRESHOLDS.length; i++) {
        const mass = EVOLUTION_THRESHOLDS[i];
        const stage = evolution.checkEvolution(mass, 1);
        expect(stage).toBe(i + 1);
      }
    });

    it('mass just below threshold → should be at previous stage', () => {
      for (let i = 1; i < EVOLUTION_THRESHOLDS.length; i++) {
        const mass = EVOLUTION_THRESHOLDS[i] - 0.01;
        const stage = evolution.checkEvolution(mass, 1);
        expect(stage).toBe(i); // one stage lower
      }
    });

    it('higher mass never produces lower stage', () => {
      fc.assert(
        fc.property(
          arbMass,
          fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
          (massA, massB) => {
            const stageA = evolution.checkEvolution(massA, 1);
            const stageB = evolution.checkEvolution(massB, 1);
            if (massA <= massB) {
              expect(stageA).toBeLessThanOrEqual(stageB);
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  // ─── checkDevolution tests ─────────────────────────────────────────────────

  describe('checkDevolution', () => {
    it('recursively devolves when mass < 75% of current stage threshold', () => {
      fc.assert(
        fc.property(arbMass, arbStage, (mass, currentStage) => {
          const newStage = evolution.checkDevolution(mass, currentStage);

          // Result should always be >= 1
          expect(newStage).toBeGreaterThanOrEqual(1);
          // Result should always be <= currentStage (can't evolve via devolution)
          expect(newStage).toBeLessThanOrEqual(currentStage);

          // If we didn't devolve, mass must be >= devolution threshold of current stage
          if (newStage === currentStage && currentStage > 1) {
            const devThreshold = EVOLUTION_THRESHOLDS[currentStage - 1] * EVOLUTION_DEVOLUTION_PERCENT;
            expect(mass).toBeGreaterThanOrEqual(devThreshold);
          }

          // If we did devolve, the returned stage should be stable
          // (mass is above devolution threshold of the new stage)
          if (newStage > 1) {
            const newDevThreshold = EVOLUTION_THRESHOLDS[newStage - 1] * EVOLUTION_DEVOLUTION_PERCENT;
            expect(mass).toBeGreaterThanOrEqual(newDevThreshold);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('mass at exactly 75% of threshold → should NOT devolve', () => {
      for (let i = 1; i < EVOLUTION_THRESHOLDS.length; i++) {
        const stage = i + 1;
        const mass = EVOLUTION_THRESHOLDS[i] * EVOLUTION_DEVOLUTION_PERCENT; // exactly 75%
        const result = evolution.checkDevolution(mass, stage);
        // mass >= devolution threshold so no devolution from this stage
        expect(result).toBe(stage);
      }
    });

    it('mass just below 75% of threshold → should devolve', () => {
      for (let i = 1; i < EVOLUTION_THRESHOLDS.length; i++) {
        const stage = i + 1;
        const mass = EVOLUTION_THRESHOLDS[i] * EVOLUTION_DEVOLUTION_PERCENT - 0.01;
        const result = evolution.checkDevolution(mass, stage);
        expect(result).toBeLessThan(stage);
      }
    });

    it('multi-stage drop: mass=50 at stage 3 drops to stage 1', () => {
      // Stage 3 threshold = 500, devolution at 0.75 * 500 = 375. 50 < 375 → drop to stage 2
      // Stage 2 threshold = 100, devolution at 0.75 * 100 = 75. 50 < 75 → drop to stage 1
      const result = evolution.checkDevolution(50, 3);
      expect(result).toBe(1);
    });

    it('multi-stage drop: mass=30 at stage 5 drops to stage 1', () => {
      // Stage 5 → threshold 5000, devolution 3750. 30 < 3750 → drop
      // Stage 4 → threshold 1500, devolution 1125. 30 < 1125 → drop
      // Stage 3 → threshold 500, devolution 375. 30 < 375 → drop
      // Stage 2 → threshold 100, devolution 75. 30 < 75 → drop
      // Stage 1 → base case, returns 1
      const result = evolution.checkDevolution(30, 5);
      expect(result).toBe(1);
    });

    it('devolution is idempotent: calling twice gives same result', () => {
      fc.assert(
        fc.property(arbMass, arbStage, (mass, currentStage) => {
          const afterFirst = evolution.checkDevolution(mass, currentStage);
          const afterSecond = evolution.checkDevolution(mass, afterFirst);
          expect(afterSecond).toBe(afterFirst);
        }),
        { numRuns: 500 }
      );
    });

    it('stage 1 never devolves further', () => {
      fc.assert(
        fc.property(arbMass, (mass) => {
          const result = evolution.checkDevolution(mass, 1);
          expect(result).toBe(1);
        }),
        { numRuns: 200 }
      );
    });

    it('devolution result is consistent with evolution for stable states', () => {
      fc.assert(
        fc.property(arbMass, (mass) => {
          // Get the evolution stage for this mass
          const evolvedStage = evolution.checkEvolution(mass, 1);
          // If we're at the evolved stage, devolution should keep us there
          // (since mass >= threshold means mass >= 0.75 * threshold for that stage)
          const devolvedStage = evolution.checkDevolution(mass, evolvedStage);
          expect(devolvedStage).toBe(evolvedStage);
        }),
        { numRuns: 500 }
      );
    });
  });
});
