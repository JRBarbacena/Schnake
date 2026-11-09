import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ClientPrediction, PendingInput, PredictedState } from '../Prediction';

/**
 * Property 28: Prediction Reconciliation Determinism
 *
 * Replaying the same pending inputs on the same server state always produces
 * the same reconciled position, regardless of when reconciliation is triggered.
 */

// Arbitrary for a Vec2 position within reasonable game bounds
const arbVec2 = fc.record({
  x: fc.double({ min: -5000, max: 5000, noNaN: true }),
  y: fc.double({ min: -5000, max: 5000, noNaN: true }),
});

// Arbitrary for a direction angle in [-π, π]
const arbDirection = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true });

// Arbitrary for a server state
const arbServerState: fc.Arbitrary<PredictedState> = fc.record({
  position: arbVec2,
  direction: arbDirection,
  speed: fc.double({ min: 100, max: 525, noNaN: true }),
  isBoosting: fc.boolean(),
});

// Arbitrary for a single pending input
const arbPendingInput: fc.Arbitrary<PendingInput> = fc.oneof(
  // direction input
  fc.record({
    sequenceNumber: fc.integer({ min: 1, max: 10000 }),
    type: fc.constant('direction' as const),
    targetDirection: arbDirection,
    timestamp: fc.integer({ min: 0, max: 100000 }),
  }),
  // boost_start input
  fc.record({
    sequenceNumber: fc.integer({ min: 1, max: 10000 }),
    type: fc.constant('boost_start' as const),
    targetDirection: fc.constant(undefined),
    timestamp: fc.integer({ min: 0, max: 100000 }),
  }),
  // boost_end input
  fc.record({
    sequenceNumber: fc.integer({ min: 1, max: 10000 }),
    type: fc.constant('boost_end' as const),
    targetDirection: fc.constant(undefined),
    timestamp: fc.integer({ min: 0, max: 100000 }),
  })
);

// Arbitrary for a queue of pending inputs with strictly increasing sequence numbers
const arbPendingInputQueue = fc
  .array(arbPendingInput, { minLength: 0, maxLength: 20 })
  .map((inputs) =>
    inputs.map((input, i) => ({
      ...input,
      sequenceNumber: i + 1,
    }))
  );

describe('ClientPrediction - Property Tests', () => {
  it('Property 28: replaying inputs on server state produces deterministic position', () => {
    fc.assert(
      fc.property(
        arbServerState,
        arbPendingInputQueue,
        fc.integer({ min: 0, max: 20 }),
        (serverState, pendingInputs, lastProcessedSeq) => {
          // Clamp lastProcessedSeq to be within valid range
          const maxSeq = pendingInputs.length;
          const clampedLastProcessedSeq = Math.min(lastProcessedSeq, maxSeq);

          // First reconciliation
          const prediction1 = new ClientPrediction();
          for (const input of pendingInputs) {
            prediction1.addPendingInput(input);
          }
          const result1 = prediction1.reconcile(serverState, clampedLastProcessedSeq);

          // Second reconciliation with same inputs and state
          const prediction2 = new ClientPrediction();
          for (const input of pendingInputs) {
            prediction2.addPendingInput(input);
          }
          const result2 = prediction2.reconcile(serverState, clampedLastProcessedSeq);

          // Results must be identical (deterministic)
          expect(result1.position.x).toBeCloseTo(result2.position.x, 10);
          expect(result1.position.y).toBeCloseTo(result2.position.y, 10);
          expect(result1.direction).toBeCloseTo(result2.direction, 10);
          expect(result1.speed).toBeCloseTo(result2.speed, 10);
          expect(result1.isBoosting).toBe(result2.isBoosting);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Property: reconcile with no pending inputs returns server state unchanged', () => {
    fc.assert(
      fc.property(arbServerState, (serverState) => {
        const prediction = new ClientPrediction();
        // No pending inputs added
        const result = prediction.reconcile(serverState, 0);

        // With no pending inputs, reconciled state should equal server state
        expect(result.position.x).toBeCloseTo(serverState.position.x, 10);
        expect(result.position.y).toBeCloseTo(serverState.position.y, 10);
        expect(result.direction).toBeCloseTo(serverState.direction, 10);
        expect(result.speed).toBeCloseTo(serverState.speed, 10);
        expect(result.isBoosting).toBe(serverState.isBoosting);
      }),
      { numRuns: 100 }
    );
  });

  it('Property: acknowledged inputs are discarded after reconciliation', () => {
    fc.assert(
      fc.property(
        arbServerState,
        arbPendingInputQueue,
        (serverState, pendingInputs) => {
          if (pendingInputs.length === 0) return; // skip trivial case

          const prediction = new ClientPrediction();
          for (const input of pendingInputs) {
            prediction.addPendingInput(input);
          }

          // Acknowledge all inputs
          const lastSeq = pendingInputs[pendingInputs.length - 1].sequenceNumber;
          prediction.reconcile(serverState, lastSeq);

          // After acknowledging all, pending count should be 0
          expect(prediction.getPendingCount()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: partially acknowledged inputs leaves only unacknowledged ones', () => {
    fc.assert(
      fc.property(
        arbServerState,
        arbPendingInputQueue,
        fc.integer({ min: 0, max: 19 }),
        (serverState, pendingInputs, ackIndex) => {
          if (pendingInputs.length < 2) return; // need at least 2 inputs

          const clampedAckIndex = Math.min(ackIndex, pendingInputs.length - 2);
          const ackSeq = pendingInputs[clampedAckIndex].sequenceNumber;

          const prediction = new ClientPrediction();
          for (const input of pendingInputs) {
            prediction.addPendingInput(input);
          }

          prediction.reconcile(serverState, ackSeq);

          // Remaining pending count should equal inputs after the acknowledged sequence
          const expectedRemaining = pendingInputs.filter(
            (i) => i.sequenceNumber > ackSeq
          ).length;
          expect(prediction.getPendingCount()).toBe(expectedRemaining);
        }
      ),
      { numRuns: 100 }
    );
  });
});
