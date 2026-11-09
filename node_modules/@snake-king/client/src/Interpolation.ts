import { Vec2, vecLerp } from '@snake-king/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SnakeSnapshot {
  id: number;
  position: Vec2;
  direction: number;
  segments: Vec2[];
  mass: number;
  speed: number;
  isBoosting: boolean;
  evolutionStage: number;
  timestamp: number; // when this snapshot arrived
}

// ─── Interpolation Buffer ────────────────────────────────────────────────────

/**
 * Maintains a buffer of recent server snapshots for each remote snake and
 * provides smooth interpolation between them. A 100ms buffer absorbs network
 * jitter so rendering can use a consistent, slightly-delayed view of each
 * snake's position.
 */
export class InterpolationBuffer {
  private buffers: Map<number, SnakeSnapshot[]> = new Map(); // snakeId → snapshots
  private bufferDuration: number = 100; // ms of buffering

  /** Add a new snapshot for a snake */
  pushSnapshot(snapshot: SnakeSnapshot): void {
    let buffer = this.buffers.get(snapshot.id);
    if (!buffer) {
      buffer = [];
      this.buffers.set(snapshot.id, buffer);
    }
    buffer.push(snapshot);
  }

  /** Get interpolated state for a snake at the current render time */
  getInterpolatedState(snakeId: number, renderTime: number): SnakeSnapshot | null {
    const buffer = this.buffers.get(snakeId);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // Interpolation time is renderTime minus the buffer duration.
    // This gives us a target point slightly in the past, which should fall
    // between two buffered snapshots.
    const interpTime = renderTime - this.bufferDuration;

    // If we only have one snapshot, return it directly (no interpolation possible)
    if (buffer.length === 1) {
      return buffer[0];
    }

    // Find the two snapshots that bracket interpTime
    let snap1: SnakeSnapshot | null = null;
    let snap2: SnakeSnapshot | null = null;

    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].timestamp <= interpTime && buffer[i + 1].timestamp >= interpTime) {
        snap1 = buffer[i];
        snap2 = buffer[i + 1];
        break;
      }
    }

    // If interpTime is before all snapshots, return the oldest
    if (!snap1 || !snap2) {
      if (interpTime <= buffer[0].timestamp) {
        return buffer[0];
      }
      // If interpTime is after all snapshots, return the newest
      return buffer[buffer.length - 1];
    }

    // Calculate interpolation factor t ∈ [0, 1]
    const timeDelta = snap2.timestamp - snap1.timestamp;
    const t = timeDelta === 0 ? 1 : (interpTime - snap1.timestamp) / timeDelta;
    const clampedT = Math.max(0, Math.min(1, t));

    // Lerp position
    const position = vecLerp(snap1.position, snap2.position, clampedT);

    // Lerp direction (using shortest-arc interpolation)
    const direction = lerpAngle(snap1.direction, snap2.direction, clampedT);

    // Lerp segments — match length to snap2 (the newer state)
    const segments = interpolateSegments(snap1.segments, snap2.segments, clampedT);

    // Scalar lerps
    const mass = lerp(snap1.mass, snap2.mass, clampedT);
    const speed = lerp(snap1.speed, snap2.speed, clampedT);

    // Non-interpolatable fields use snap2's values (newest)
    return {
      id: snakeId,
      position,
      direction,
      segments,
      mass,
      speed,
      isBoosting: snap2.isBoosting,
      evolutionStage: snap2.evolutionStage,
      timestamp: interpTime,
    };
  }

  /** Remove all data for a snake (on death/disconnect) */
  removeSnake(snakeId: number): void {
    this.buffers.delete(snakeId);
  }

  /** Clear old snapshots to prevent memory growth (removes anything older than 500ms) */
  cleanup(currentTime: number): void {
    const cutoff = currentTime - 500;

    for (const [snakeId, buffer] of this.buffers.entries()) {
      // Find the index of the first snapshot that's within the retention window
      let firstValidIndex = 0;
      while (firstValidIndex < buffer.length && buffer[firstValidIndex].timestamp < cutoff) {
        firstValidIndex++;
      }

      // Keep at least one snapshot before the cutoff for interpolation continuity
      const keepFrom = Math.max(0, firstValidIndex - 1);

      if (keepFrom > 0) {
        buffer.splice(0, keepFrom);
      }

      // Remove empty buffers entirely
      if (buffer.length === 0) {
        this.buffers.delete(snakeId);
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Scalar linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate angles via shortest arc */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;

  // Wrap to [-π, π]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  return a + diff * t;
}

/** Interpolate segment arrays, handling length differences */
function interpolateSegments(segsA: Vec2[], segsB: Vec2[], t: number): Vec2[] {
  const maxLen = Math.max(segsA.length, segsB.length);
  const result: Vec2[] = [];

  for (let i = 0; i < maxLen; i++) {
    if (i < segsA.length && i < segsB.length) {
      // Both have this segment — lerp between them
      result.push(vecLerp(segsA[i], segsB[i], t));
    } else if (i < segsB.length) {
      // Only snap2 has this segment (snake grew) — use snap2's position
      result.push(segsB[i]);
    } else {
      // Only snap1 has this segment (snake shrunk) — fade towards last valid
      // Use snap1's segment but it will be dropped next tick
      result.push(segsA[i]);
    }
  }

  return result;
}
