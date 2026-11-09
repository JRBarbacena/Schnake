import {
  Vec2,
  vecAdd,
  vecScale,
  vecFromAngle,
  vecLerp,
  vecDistance,
  MAX_TURN_RATE,
  SEGMENT_SPACING,
  wrapAngle,
  angleDifference,
} from '@snake-king/shared';

export interface PendingInput {
  sequenceNumber: number;
  type: 'direction' | 'boost_start' | 'boost_end';
  targetDirection?: number;
  timestamp: number;
}

export interface PredictedState {
  position: Vec2;
  direction: number;
  speed: number;
  isBoosting: boolean;
}

export class ClientPrediction {
  private pendingInputs: PendingInput[] = [];
  private lastAcknowledgedSeq: number = 0;
  private correctionTarget: Vec2 | null = null;
  private correctionStart: Vec2 | null = null;
  private correctionTimer: number = 0;
  private correctionDuration: number = 200; // ms

  /** Record an input that was sent to the server */
  addPendingInput(input: PendingInput): void {
    this.pendingInputs.push(input);
  }

  /** Predict the local snake position based on current state + pending inputs */
  predict(currentState: PredictedState, dt: number): PredictedState {
    // Find the latest direction input from pending queue
    let targetDirection: number | undefined;
    let isBoosting = currentState.isBoosting;

    for (const input of this.pendingInputs) {
      if (input.type === 'direction' && input.targetDirection !== undefined) {
        targetDirection = input.targetDirection;
      } else if (input.type === 'boost_start') {
        isBoosting = true;
      } else if (input.type === 'boost_end') {
        isBoosting = false;
      }
    }

    // Apply turn rate toward target direction
    let direction = currentState.direction;
    if (targetDirection !== undefined) {
      const diff = angleDifference(direction, targetDirection);
      const maxTurn = MAX_TURN_RATE * dt;

      if (Math.abs(diff) <= maxTurn) {
        direction = targetDirection;
      } else {
        direction = wrapAngle(direction + Math.sign(diff) * maxTurn);
      }
    }

    // Compute movement
    const speed = currentState.speed;
    const moveDistance = speed * dt;
    const moveVector = vecScale(vecFromAngle(direction), moveDistance);
    const position = vecAdd(currentState.position, moveVector);

    return {
      position,
      direction,
      speed,
      isBoosting,
    };
  }

  /** Reconcile with server state: discard acknowledged inputs, replay remaining */
  reconcile(serverState: PredictedState, lastProcessedSeq: number): PredictedState {
    // Discard all inputs that have been acknowledged by the server
    this.lastAcknowledgedSeq = lastProcessedSeq;
    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.sequenceNumber > lastProcessedSeq
    );

    // Start from authoritative server state
    let reconciledState: PredictedState = { ...serverState };

    // Replay all remaining pending inputs on top of server state
    for (const input of this.pendingInputs) {
      reconciledState = this.applyInput(reconciledState, input);
    }

    // Detect divergence and initiate smooth correction
    const divergence = vecDistance(reconciledState.position, serverState.position);
    if (divergence > SEGMENT_SPACING * 0.5) {
      // Start a smooth correction toward the reconciled position
      this.correctionStart = serverState.position;
      this.correctionTarget = reconciledState.position;
      this.correctionTimer = 0;
    }

    return reconciledState;
  }

  /** Get smoothed position (blending correction over 200ms) */
  getSmoothedPosition(predicted: Vec2, dt: number): Vec2 {
    if (this.correctionStart === null || this.correctionTarget === null) {
      return predicted;
    }

    this.correctionTimer += dt * 1000; // convert dt (seconds) to ms
    const t = Math.min(this.correctionTimer / this.correctionDuration, 1);

    if (t >= 1) {
      // Correction complete
      this.correctionStart = null;
      this.correctionTarget = null;
      this.correctionTimer = 0;
      return predicted;
    }

    // Lerp between correction start and the predicted (target) position
    return vecLerp(this.correctionStart, predicted, t);
  }

  /** Get count of pending inputs */
  getPendingCount(): number {
    return this.pendingInputs.length;
  }

  /** Apply a single input to a predicted state (used during reconciliation replay) */
  private applyInput(state: PredictedState, input: PendingInput): PredictedState {
    let { position, direction, speed, isBoosting } = state;

    if (input.type === 'direction' && input.targetDirection !== undefined) {
      // Simulate one tick of turning toward target
      const dt = 1 / 20; // assume one server tick (TICK_RATE = 20)
      const diff = angleDifference(direction, input.targetDirection);
      const maxTurn = MAX_TURN_RATE * dt;

      if (Math.abs(diff) <= maxTurn) {
        direction = input.targetDirection;
      } else {
        direction = wrapAngle(direction + Math.sign(diff) * maxTurn);
      }

      // Move forward one tick
      const moveDistance = speed * dt;
      const moveVector = vecScale(vecFromAngle(direction), moveDistance);
      position = vecAdd(position, moveVector);
    } else if (input.type === 'boost_start') {
      isBoosting = true;
    } else if (input.type === 'boost_end') {
      isBoosting = false;
    }

    return { position, direction, speed, isBoosting };
  }
}
