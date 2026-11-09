import { Vec2 } from '@snake-king/shared';
import type { Snake } from './Physics';
/** Entity stored in the spatial hash grid */
export interface SpatialEntity {
    id: number;
    position: Vec2;
    radius: number;
}
/**
 * Spatial hash grid for efficient broad-phase collision detection.
 * Divides the world into fixed-size cells and tracks which entities
 * occupy which cells, enabling fast neighbor queries.
 */
export declare class SpatialHashGrid {
    private readonly cellSize;
    /** Map from cell key "cellX,cellY" to set of entity IDs in that cell */
    private readonly cells;
    /** Track entity data by ID for distance verification during query */
    private readonly entities;
    constructor(cellSize?: number);
    /** Insert an entity into the grid */
    insert(entity: SpatialEntity): void;
    /** Remove an entity from the grid by ID */
    remove(id: number): void;
    /** Update an entity's position and radius (remove + re-insert) */
    update(entity: SpatialEntity): void;
    /**
     * Query all entities within a given radius of a position.
     * Returns deduplicated results filtered by actual distance.
     */
    query(position: Vec2, radius: number): SpatialEntity[];
    /** Clear all entities and cells from the grid */
    clear(): void;
    /** Get the cell key for a world position */
    private getCellKey;
    /** Get all cell keys that a circle (position + radius) overlaps */
    private getCoveredCells;
}
export interface CollisionResult {
    eliminated: number[];
    headToBodyCollisions: Array<{
        killerId: number;
        victimId: number;
    }>;
    headToHeadCollisions: Array<{
        snake1Id: number;
        snake2Id: number;
    }>;
    orbCollections: Array<{
        snakeId: number;
        orbId: number;
    }>;
    powerOrbCollections: Array<{
        snakeId: number;
        orbId: number;
    }>;
    boundaryEliminations: number[];
}
/**
 * High-level collision detection engine that uses SpatialHashGrid
 * for broad-phase and exact distance checks for narrow-phase.
 */
export declare class CollisionEngine {
    private bodyGrid;
    private orbGrid;
    /** Maps compound body entity IDs back to the owning snake ID */
    private bodyOwnerMap;
    constructor();
    /**
     * Rebuild the spatial grids with current entity data.
     * Body segments are inserted into bodyGrid with compound IDs (snakeId * 100000 + segIndex)
     * to allow tracing back to the owning snake.
     * Orbs are inserted into orbGrid by their natural IDs.
     */
    rebuildGrid(snakes: Snake[], orbs: Array<{
        id: number;
        position: Vec2;
    }>): void;
    /**
     * Detect head-to-body collisions.
     * For each snake's head, queries the bodyGrid for segments within
     * HEAD_COLLISION_RADIUS + BODY_COLLISION_RADIUS = 27 units.
     * Self-collisions (snake hitting its own body) are excluded.
     * The snake whose head collided is the victim; the body owner is the killer.
     */
    detectHeadToBody(snakes: Snake[]): Array<{
        killerId: number;
        victimId: number;
    }>;
    /**
     * Detect head-to-head collisions.
     * Checks all pairs of snakes: if distance(head1, head2) < HEAD_TO_HEAD_DISTANCE (30),
     * both snakes are mutually eliminated.
     */
    detectHeadToHead(snakes: Snake[]): Array<{
        snake1Id: number;
        snake2Id: number;
    }>;
    /**
     * Detect boundary eliminations.
     * A snake is eliminated if its head is further than (arenaRadius - HEAD_COLLISION_RADIUS)
     * from the arena center (0,0).
     */
    detectHeadToBoundary(snakes: Snake[], arenaRadius: number): number[];
    /**
     * Detect orb collections.
     * For each snake, queries the orbGrid for orbs within ORB_COLLECTION_DISTANCE of the head.
     * First-come-first-served: once an orb is claimed by a snake in this tick, no other snake
     * can collect it.
     */
    detectOrbCollection(snakes: Snake[], orbs: Array<{
        id: number;
        position: Vec2;
    }>): Array<{
        snakeId: number;
        orbId: number;
    }>;
    /**
     * Detect power orb collections.
     * Same logic as regular orb collection — first snake within ORB_COLLECTION_DISTANCE claims it.
     */
    detectPowerOrbCollection(snakes: Snake[], powerOrbs: Array<{
        id: number;
        position: Vec2;
    }>): Array<{
        snakeId: number;
        orbId: number;
    }>;
}
//# sourceMappingURL=CollisionEngine.d.ts.map