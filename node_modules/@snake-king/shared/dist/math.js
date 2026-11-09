// ─── Vector Operations ───────────────────────────────────────────────────────
/** Add two vectors */
export function vecAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
/** Subtract b from a */
export function vecSubtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
/** Multiply vector by scalar */
export function vecScale(v, scalar) {
    return { x: v.x * scalar, y: v.y * scalar };
}
/** Length/magnitude of a vector */
export function vecLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}
/** Normalize to unit vector. Returns {x:0, y:0} for zero-length vectors. */
export function vecNormalize(v) {
    const len = vecLength(v);
    if (len === 0)
        return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}
/** Distance between two points */
export function vecDistance(a, b) {
    return vecLength(vecSubtract(a, b));
}
/** Linear interpolation between two vectors. t=0 returns a, t=1 returns b. */
export function vecLerp(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    };
}
/** Angle of vector in radians (atan2) */
export function vecAngle(v) {
    return Math.atan2(v.y, v.x);
}
/** Unit vector from angle (radians) */
export function vecFromAngle(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
}
/** Dot product of two vectors */
export function vecDot(a, b) {
    return a.x * b.x + a.y * b.y;
}
// ─── Angle Operations ────────────────────────────────────────────────────────
/** Normalize angle to [-π, π] */
export function wrapAngle(angle) {
    let a = angle % (2 * Math.PI);
    if (a > Math.PI)
        a -= 2 * Math.PI;
    if (a < -Math.PI)
        a += 2 * Math.PI;
    return a;
}
/** Shortest signed angular difference from `from` to `to` (in [-π, π]) */
export function angleDifference(from, to) {
    return wrapAngle(to - from);
}
/** Returns -1 or 1 indicating the shortest arc direction from current to target */
export function shortestArcDirection(current, target) {
    return angleDifference(current, target) >= 0 ? 1 : -1;
}
// ─── Spatial Checks ──────────────────────────────────────────────────────────
/** Check if a point is inside a circle */
export function isInsideCircle(point, center, radius) {
    return vecDistance(point, center) <= radius;
}
/** Check if two circles overlap */
export function circlesOverlap(c1, r1, c2, r2) {
    return vecDistance(c1, c2) <= r1 + r2;
}
/** Distance from a point to the edge of a circle (negative if inside) */
export function distanceToCircleEdge(point, center, radius) {
    return vecDistance(point, center) - radius;
}
//# sourceMappingURL=math.js.map