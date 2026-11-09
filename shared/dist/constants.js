// @snake-king/shared - Game constants
import { PowerUpType, ZoneType } from './types.js';
// ─── Tick & Timing ───────────────────────────────────────────────────────────
/** Server simulation tick rate in Hz */
export const TICK_RATE = 20;
/** Duration of a single tick in milliseconds */
export const TICK_DURATION_MS = 1000 / TICK_RATE;
// ─── Movement ────────────────────────────────────────────────────────────────
/** Base snake speed in units/second */
export const BASE_SPEED = 200;
/** Boosting snake speed in units/second */
export const BOOST_SPEED = 350;
/** Maximum turn rate in radians/second */
export const MAX_TURN_RATE = 3;
/** Distance between consecutive segments */
export const SEGMENT_SPACING = 20;
/** Absolute maximum speed cap in units/second */
export const MAX_SPEED_CAP = 525;
// ─── Arena ───────────────────────────────────────────────────────────────────
/** Radius of the circular arena in units */
export const ARENA_RADIUS = 5000;
// ─── Collision ───────────────────────────────────────────────────────────────
/** Collision radius for a snake's head */
export const HEAD_COLLISION_RADIUS = 15;
/** Collision radius for a snake's body segments */
export const BODY_COLLISION_RADIUS = 12;
/** Distance at which orbs can be collected */
export const ORB_COLLECTION_DISTANCE = 30;
/** Distance threshold for head-to-head collisions */
export const HEAD_TO_HEAD_DISTANCE = 30;
// ─── Orbs ────────────────────────────────────────────────────────────────────
/** Minimum number of orbs in the arena at any time */
export const MIN_ORBS = 3000;
/** Orb spawn rate per second */
export const ORB_SPAWN_RATE = 50;
/** Orb size probabilities indexed by (size - 1) */
export const ORB_SIZE_PROBABILITIES = [0.4, 0.3, 0.15, 0.10, 0.05];
// ─── Boosting ────────────────────────────────────────────────────────────────
/** Mass drained per second while boosting */
export const BOOST_MASS_DRAIN = 14;
/** Interval between boost trail orb drops in ms */
export const BOOST_TRAIL_INTERVAL = 100;
/** Mass at or below which boost becomes locked */
export const BOOST_LOCKOUT_MASS = 10;
/** Mass at or above which boost is re-unlocked */
export const BOOST_UNLOCK_MASS = 15;
// ─── Power Orbs ──────────────────────────────────────────────────────────────
/** Interval between power orb spawns in seconds */
export const POWER_ORB_SPAWN_INTERVAL = 15;
/** Maximum number of power orbs in the arena */
export const MAX_POWER_ORBS = 10;
/** Duration of each power-up in seconds, keyed by type */
export const POWER_UP_DURATIONS = {
    [PowerUpType.Shield]: 8,
    [PowerUpType.Magnet]: 10,
    [PowerUpType.Ghost]: 6,
    [PowerUpType.SpeedSurge]: 8,
    [PowerUpType.MassDrain]: 12,
    [PowerUpType.FreezeAura]: 5,
};
// ─── Spawning ────────────────────────────────────────────────────────────────
/** Preferred spawn radius as a fraction of arena radius */
export const SPAWN_INNER_RADIUS_PERCENT = 0.7;
/** Fallback spawn radius as a fraction of arena radius */
export const SPAWN_FALLBACK_RADIUS_PERCENT = 0.85;
/** Minimum distance from other snakes when spawning */
export const SPAWN_MIN_DISTANCE = 300;
// ─── Snake Defaults ──────────────────────────────────────────────────────────
/** Number of segments a new snake starts with */
export const INITIAL_SEGMENTS = 10;
/** Starting mass for a new snake */
export const INITIAL_MASS = 100;
/** Mass required per additional segment */
export const MASS_PER_SEGMENT = 10;
// ─── Evolution ───────────────────────────────────────────────────────────────
/** Mass thresholds for evolution stages (index = stage - 1) */
export const EVOLUTION_THRESHOLDS = [0, 100, 500, 1500, 5000];
/** Percentage of mass retained on devolution */
export const EVOLUTION_DEVOLUTION_PERCENT = 0.75;
// ─── Leaderboard ─────────────────────────────────────────────────────────────
/** Number of entries shown on the leaderboard */
export const LEADERBOARD_SIZE = 10;
/** Leaderboard update broadcast interval in ms */
export const LEADERBOARD_UPDATE_INTERVAL = 500;
// ─── Interest / Visibility ───────────────────────────────────────────────────
/** Radius around a player within which entities are sent to client */
export const INTEREST_RADIUS = 1500;
// ─── Zones ───────────────────────────────────────────────────────────────────
/** Time between zone rotations in seconds */
export const ZONE_ROTATION_INTERVAL = 120;
/** Duration of zone fade-in/fade-out transition in seconds */
export const ZONE_FADE_DURATION = 3;
/** All available zone types */
export const ZONE_TYPES = [
    ZoneType.Speed,
    ZoneType.Danger,
    ZoneType.Bonus,
    ZoneType.Stealth,
];
// ─── Session ─────────────────────────────────────────────────────────────────
/** Maximum number of players per game session */
export const MAX_PLAYERS_PER_SESSION = 50;
// ─── Spatial Grid ────────────────────────────────────────────────────────────
/** Cell size for spatial hash grid in units */
export const SPATIAL_GRID_CELL_SIZE = 100;
//# sourceMappingURL=constants.js.map