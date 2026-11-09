import { PowerUpType, ZoneType } from './types.js';
/** Server simulation tick rate in Hz */
export declare const TICK_RATE = 20;
/** Duration of a single tick in milliseconds */
export declare const TICK_DURATION_MS: number;
/** Base snake speed in units/second */
export declare const BASE_SPEED = 200;
/** Boosting snake speed in units/second */
export declare const BOOST_SPEED = 350;
/** Maximum turn rate in radians/second */
export declare const MAX_TURN_RATE = 3;
/** Distance between consecutive segments */
export declare const SEGMENT_SPACING = 20;
/** Absolute maximum speed cap in units/second */
export declare const MAX_SPEED_CAP = 525;
/** Radius of the circular arena in units */
export declare const ARENA_RADIUS = 5000;
/** Collision radius for a snake's head */
export declare const HEAD_COLLISION_RADIUS = 15;
/** Collision radius for a snake's body segments */
export declare const BODY_COLLISION_RADIUS = 12;
/** Distance at which orbs can be collected */
export declare const ORB_COLLECTION_DISTANCE = 30;
/** Distance threshold for head-to-head collisions */
export declare const HEAD_TO_HEAD_DISTANCE = 30;
/** Minimum number of orbs in the arena at any time */
export declare const MIN_ORBS = 3000;
/** Orb spawn rate per second */
export declare const ORB_SPAWN_RATE = 50;
/** Orb size probabilities indexed by (size - 1) */
export declare const ORB_SIZE_PROBABILITIES: readonly [0.4, 0.3, 0.15, 0.1, 0.05];
/** Mass drained per second while boosting */
export declare const BOOST_MASS_DRAIN = 14;
/** Interval between boost trail orb drops in ms */
export declare const BOOST_TRAIL_INTERVAL = 100;
/** Mass at or below which boost becomes locked */
export declare const BOOST_LOCKOUT_MASS = 10;
/** Mass at or above which boost is re-unlocked */
export declare const BOOST_UNLOCK_MASS = 15;
/** Interval between power orb spawns in seconds */
export declare const POWER_ORB_SPAWN_INTERVAL = 15;
/** Maximum number of power orbs in the arena */
export declare const MAX_POWER_ORBS = 10;
/** Duration of each power-up in seconds, keyed by type */
export declare const POWER_UP_DURATIONS: Record<PowerUpType, number>;
/** Preferred spawn radius as a fraction of arena radius */
export declare const SPAWN_INNER_RADIUS_PERCENT = 0.7;
/** Fallback spawn radius as a fraction of arena radius */
export declare const SPAWN_FALLBACK_RADIUS_PERCENT = 0.85;
/** Minimum distance from other snakes when spawning */
export declare const SPAWN_MIN_DISTANCE = 300;
/** Number of segments a new snake starts with */
export declare const INITIAL_SEGMENTS = 10;
/** Starting mass for a new snake */
export declare const INITIAL_MASS = 100;
/** Mass required per additional segment */
export declare const MASS_PER_SEGMENT = 10;
/** Mass thresholds for evolution stages (index = stage - 1) */
export declare const EVOLUTION_THRESHOLDS: readonly [0, 100, 500, 1500, 5000];
/** Percentage of mass retained on devolution */
export declare const EVOLUTION_DEVOLUTION_PERCENT = 0.75;
/** Number of entries shown on the leaderboard */
export declare const LEADERBOARD_SIZE = 10;
/** Leaderboard update broadcast interval in ms */
export declare const LEADERBOARD_UPDATE_INTERVAL = 500;
/** Radius around a player within which entities are sent to client */
export declare const INTEREST_RADIUS = 1500;
/** Time between zone rotations in seconds */
export declare const ZONE_ROTATION_INTERVAL = 120;
/** Duration of zone fade-in/fade-out transition in seconds */
export declare const ZONE_FADE_DURATION = 3;
/** All available zone types */
export declare const ZONE_TYPES: ZoneType[];
/** Maximum number of players per game session */
export declare const MAX_PLAYERS_PER_SESSION = 50;
/** Cell size for spatial hash grid in units */
export declare const SPATIAL_GRID_CELL_SIZE = 100;
//# sourceMappingURL=constants.d.ts.map