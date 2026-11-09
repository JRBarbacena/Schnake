// PhysicsEngine - handles snake movement, boosting, and death orb spawning
import { vecFromAngle, vecAdd, vecScale, vecDistance, vecLerp, angleDifference, wrapAngle, BASE_SPEED, BOOST_SPEED, MAX_TURN_RATE, SEGMENT_SPACING, BOOST_MASS_DRAIN, BOOST_TRAIL_INTERVAL, MAX_SPEED_CAP, BOOST_LOCKOUT_MASS, } from '@snake-king/shared';
// ─── PhysicsEngine ───────────────────────────────────────────────────────────
export class PhysicsEngine {
    /**
     * Rotate snake direction toward targetDirection at max MAX_TURN_RATE rad/s.
     * Snaps to target if the remaining angle is within one frame's rotation.
     */
    applyTurnRate(snake, dt) {
        const diff = angleDifference(snake.direction, snake.targetDirection);
        const maxRotation = MAX_TURN_RATE * dt;
        if (Math.abs(diff) <= maxRotation) {
            snake.direction = snake.targetDirection;
        }
        else {
            const rotationSign = diff > 0 ? 1 : -1;
            snake.direction = wrapAngle(snake.direction + rotationSign * maxRotation);
        }
    }
    /**
     * Move snake head forward by speed × dt along current direction.
     * Prepends the new position to pathHistory for segment following.
     */
    moveSnake(snake, dt) {
        const displacement = vecScale(vecFromAngle(snake.direction), snake.speed * dt);
        snake.position = vecAdd(snake.position, displacement);
        snake.pathHistory.unshift({ x: snake.position.x, y: snake.position.y });
    }
    /**
     * Update segment positions to follow pathHistory with SEGMENT_SPACING between each.
     * Each segment is placed at (segIndex + 1) * SEGMENT_SPACING distance along the path.
     */
    updateSegments(snake) {
        const { pathHistory, segments } = snake;
        if (pathHistory.length < 2)
            return;
        for (let segIndex = 0; segIndex < segments.length; segIndex++) {
            const targetDistance = (segIndex + 1) * SEGMENT_SPACING;
            let accumulated = 0;
            let placed = false;
            for (let i = 0; i < pathHistory.length - 1; i++) {
                const segmentLength = vecDistance(pathHistory[i], pathHistory[i + 1]);
                if (accumulated + segmentLength >= targetDistance) {
                    // Interpolate between pathHistory[i] and pathHistory[i+1]
                    const remaining = targetDistance - accumulated;
                    const t = segmentLength > 0 ? remaining / segmentLength : 0;
                    segments[segIndex] = vecLerp(pathHistory[i], pathHistory[i + 1], t);
                    placed = true;
                    break;
                }
                accumulated += segmentLength;
            }
            // If path isn't long enough yet, keep segment at last known path point
            if (!placed) {
                segments[segIndex] = { ...pathHistory[pathHistory.length - 1] };
            }
        }
        // Trim pathHistory to avoid unbounded growth.
        // Keep enough points to cover all segments plus some buffer.
        const maxNeededDistance = (segments.length + 1) * SEGMENT_SPACING;
        let totalDist = 0;
        let trimIndex = pathHistory.length;
        for (let i = 0; i < pathHistory.length - 1; i++) {
            totalDist += vecDistance(pathHistory[i], pathHistory[i + 1]);
            if (totalDist > maxNeededDistance * 1.5) {
                trimIndex = i + 2; // keep one extra point beyond
                break;
            }
        }
        if (trimIndex < pathHistory.length) {
            pathHistory.length = trimIndex;
        }
    }
    /**
     * Calculate effective speed: base × stageBonus × zoneMultiplier + boostBonus, capped at MAX_SPEED_CAP.
     */
    calculateEffectiveSpeed(snake, stageBonus, zoneMultiplier, isBoosting) {
        const baseEffective = BASE_SPEED * stageBonus * zoneMultiplier;
        let result;
        if (isBoosting) {
            result = baseEffective + (BOOST_SPEED - BASE_SPEED);
        }
        else {
            result = baseEffective;
        }
        return Math.min(result, MAX_SPEED_CAP);
    }
    /**
     * Apply boost mechanics: drain mass, lock boost if mass too low, spawn trail orbs on interval.
     * Returns array of trail orbs spawned this frame.
     */
    applyBoost(snake, dt, efficiency) {
        const trailOrbs = [];
        if (!snake.isBoosting)
            return trailOrbs;
        // Drain mass
        const drain = BOOST_MASS_DRAIN * dt * efficiency;
        snake.mass -= drain;
        // Lockout check
        if (snake.mass <= BOOST_LOCKOUT_MASS) {
            snake.isBoosting = false;
            snake.boostLocked = true;
            return trailOrbs;
        }
        // Trail orb spawning
        snake.boostTrailTimer += dt * 1000; // convert dt (seconds) to ms
        while (snake.boostTrailTimer >= BOOST_TRAIL_INTERVAL) {
            snake.boostTrailTimer -= BOOST_TRAIL_INTERVAL;
            // Spawn trail orb at the tail end of the snake
            const spawnPos = snake.segments.length > 0
                ? { ...snake.segments[snake.segments.length - 1] }
                : { ...snake.position };
            trailOrbs.push({
                position: spawnPos,
                value: Math.ceil(drain * (BOOST_TRAIL_INTERVAL / 1000) * efficiency),
            });
        }
        return trailOrbs;
    }
    /**
     * Generate death orbs from an eliminated snake.
     * 80% of mass is distributed as orbs placed at segment positions.
     */
    spawnDeathOrbs(snake) {
        const deathOrbs = [];
        const totalValue = Math.floor(0.8 * snake.mass);
        if (totalValue <= 0)
            return deathOrbs;
        // Include head position + all segment positions
        const positions = [{ ...snake.position }, ...snake.segments.map(s => ({ ...s }))];
        if (positions.length === 0)
            return deathOrbs;
        // Distribute value across positions with random 1-5 per orb, summing to total
        const orbCount = positions.length;
        let remaining = totalValue;
        for (let i = 0; i < orbCount; i++) {
            let value;
            if (i === orbCount - 1) {
                // Last orb gets whatever remains
                value = remaining;
            }
            else {
                // Evenly distribute with some randomness
                const avgPerRemaining = remaining / (orbCount - i);
                value = Math.max(1, Math.min(5, Math.round(avgPerRemaining)));
                // Clamp to ensure we don't exceed remaining
                value = Math.min(value, remaining);
            }
            if (value > 0) {
                deathOrbs.push({
                    position: positions[i],
                    value,
                });
                remaining -= value;
            }
            if (remaining <= 0)
                break;
        }
        return deathOrbs;
    }
}
//# sourceMappingURL=Physics.js.map