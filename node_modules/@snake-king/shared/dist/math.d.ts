import { Vec2 } from './types';
/** Add two vectors */
export declare function vecAdd(a: Vec2, b: Vec2): Vec2;
/** Subtract b from a */
export declare function vecSubtract(a: Vec2, b: Vec2): Vec2;
/** Multiply vector by scalar */
export declare function vecScale(v: Vec2, scalar: number): Vec2;
/** Length/magnitude of a vector */
export declare function vecLength(v: Vec2): number;
/** Normalize to unit vector. Returns {x:0, y:0} for zero-length vectors. */
export declare function vecNormalize(v: Vec2): Vec2;
/** Distance between two points */
export declare function vecDistance(a: Vec2, b: Vec2): number;
/** Linear interpolation between two vectors. t=0 returns a, t=1 returns b. */
export declare function vecLerp(a: Vec2, b: Vec2, t: number): Vec2;
/** Angle of vector in radians (atan2) */
export declare function vecAngle(v: Vec2): number;
/** Unit vector from angle (radians) */
export declare function vecFromAngle(angle: number): Vec2;
/** Dot product of two vectors */
export declare function vecDot(a: Vec2, b: Vec2): number;
/** Normalize angle to [-π, π] */
export declare function wrapAngle(angle: number): number;
/** Shortest signed angular difference from `from` to `to` (in [-π, π]) */
export declare function angleDifference(from: number, to: number): number;
/** Returns -1 or 1 indicating the shortest arc direction from current to target */
export declare function shortestArcDirection(current: number, target: number): number;
/** Check if a point is inside a circle */
export declare function isInsideCircle(point: Vec2, center: Vec2, radius: number): boolean;
/** Check if two circles overlap */
export declare function circlesOverlap(c1: Vec2, r1: number, c2: Vec2, r2: number): boolean;
/** Distance from a point to the edge of a circle (negative if inside) */
export declare function distanceToCircleEdge(point: Vec2, center: Vec2, radius: number): number;
//# sourceMappingURL=math.d.ts.map