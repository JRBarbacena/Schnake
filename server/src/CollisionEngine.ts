import {
  Vec2,
  SPATIAL_GRID_CELL_SIZE,
  HEAD_COLLISION_RADIUS,
  BODY_COLLISION_RADIUS,
  ORB_COLLECTION_DISTANCE,
  HEAD_TO_HEAD_DISTANCE,
} from '@snake-king/shared';

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
export class SpatialHashGrid {
  private readonly cellSize: number;
  /** Map from cell key "cellX,cellY" to set of entity IDs in that cell */
  private readonly cells: Map<string, Set<number>> = new Map();
  /** Track entity data by ID for distance verification during query */
  private readonly entities: Map<number, SpatialEntity> = new Map();

  constructor(cellSize: number = SPATIAL_GRID_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  /** Insert an entity into the grid */
  insert(entity: SpatialEntity): void {
    this.entities.set(entity.id, entity);

    const cells = this.getCoveredCells(entity.position, entity.radius);
    for (const key of cells) {
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(entity.id);
    }
  }

  /** Remove an entity from the grid by ID */
  remove(id: number): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    const cells = this.getCoveredCells(entity.position, entity.radius);
    for (const key of cells) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(id);
        if (cell.size === 0) {
          this.cells.delete(key);
        }
      }
    }

    this.entities.delete(id);
  }

  /** Update an entity's position and radius (remove + re-insert) */
  update(entity: SpatialEntity): void {
    this.remove(entity.id);
    this.insert(entity);
  }

  /**
   * Query all entities within a given radius of a position.
   * Returns deduplicated results filtered by actual distance.
   */
  query(position: Vec2, radius: number): SpatialEntity[] {
    const cells = this.getCoveredCells(position, radius);
    const seen = new Set<number>();
    const results: SpatialEntity[] = [];

    for (const key of cells) {
      const cell = this.cells.get(key);
      if (!cell) continue;

      for (const id of cell) {
        if (seen.has(id)) continue;
        seen.add(id);

        const entity = this.entities.get(id);
        if (!entity) continue;

        // Verify actual distance: entity is within range if the circles overlap
        const dx = entity.position.x - position.x;
        const dy = entity.position.y - position.y;
        const distSq = dx * dx + dy * dy;
        const maxDist = radius + entity.radius;

        if (distSq <= maxDist * maxDist) {
          results.push(entity);
        }
      }
    }

    return results;
  }

  /** Clear all entities and cells from the grid */
  clear(): void {
    this.cells.clear();
    this.entities.clear();
  }

  /** Get the cell key for a world position */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /** Get all cell keys that a circle (position + radius) overlaps */
  private getCoveredCells(position: Vec2, radius: number): string[] {
    const minCellX = Math.floor((position.x - radius) / this.cellSize);
    const maxCellX = Math.floor((position.x + radius) / this.cellSize);
    const minCellY = Math.floor((position.y - radius) / this.cellSize);
    const maxCellY = Math.floor((position.y + radius) / this.cellSize);

    const keys: string[] = [];
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  }
}


// ─── Collision Result ────────────────────────────────────────────────────────

export interface CollisionResult {
  eliminated: number[];
  headToBodyCollisions: Array<{ killerId: number; victimId: number }>;
  headToHeadCollisions: Array<{ snake1Id: number; snake2Id: number }>;
  orbCollections: Array<{ snakeId: number; orbId: number }>;
  powerOrbCollections: Array<{ snakeId: number; orbId: number }>;
  boundaryEliminations: number[];
}

// ─── Collision Engine ────────────────────────────────────────────────────────

/**
 * High-level collision detection engine that uses SpatialHashGrid
 * for broad-phase and exact distance checks for narrow-phase.
 */
export class CollisionEngine {
  private bodyGrid: SpatialHashGrid;
  private orbGrid: SpatialHashGrid;

  /** Maps compound body entity IDs back to the owning snake ID */
  private bodyOwnerMap: Map<number, number> = new Map();

  constructor() {
    this.bodyGrid = new SpatialHashGrid();
    this.orbGrid = new SpatialHashGrid();
  }

  /**
   * Rebuild the spatial grids with current entity data.
   * Body segments are inserted into bodyGrid with compound IDs (snakeId * 100000 + segIndex)
   * to allow tracing back to the owning snake.
   * Orbs are inserted into orbGrid by their natural IDs.
   */
  rebuildGrid(snakes: Snake[], orbs: Array<{ id: number; position: Vec2 }>): void {
    this.bodyGrid.clear();
    this.orbGrid.clear();
    this.bodyOwnerMap.clear();

    // Insert all snake body segments into the body grid
    for (const snake of snakes) {
      for (let segIdx = 0; segIdx < snake.segments.length; segIdx++) {
        const compoundId = snake.id * 100000 + segIdx;
        this.bodyOwnerMap.set(compoundId, snake.id);
        this.bodyGrid.insert({
          id: compoundId,
          position: snake.segments[segIdx],
          radius: BODY_COLLISION_RADIUS,
        });
      }
    }

    // Insert all orbs into the orb grid
    for (const orb of orbs) {
      this.orbGrid.insert({
        id: orb.id,
        position: orb.position,
        radius: 0, // Orbs are treated as points; collection distance is checked on the query side
      });
    }
  }

  /**
   * Detect head-to-body collisions.
   * For each snake's head, queries the bodyGrid for segments within
   * HEAD_COLLISION_RADIUS + BODY_COLLISION_RADIUS = 27 units.
   * Self-collisions (snake hitting its own body) are excluded.
   * The snake whose head collided is the victim; the body owner is the killer.
   */
  detectHeadToBody(snakes: Snake[]): Array<{ killerId: number; victimId: number }> {
    const collisions: Array<{ killerId: number; victimId: number }> = [];
    const eliminated = new Set<number>();

    for (const snake of snakes) {
      if (eliminated.has(snake.id)) continue;

      const nearby = this.bodyGrid.query(snake.position, HEAD_COLLISION_RADIUS);

      for (const entity of nearby) {
        const ownerId = this.bodyOwnerMap.get(entity.id);
        if (ownerId === undefined) continue;

        // Skip self-collision
        if (ownerId === snake.id) continue;

        // Narrow-phase: exact distance check
        const dx = snake.position.x - entity.position.x;
        const dy = snake.position.y - entity.position.y;
        const distSq = dx * dx + dy * dy;
        const threshold = HEAD_COLLISION_RADIUS + BODY_COLLISION_RADIUS;

        if (distSq < threshold * threshold) {
          collisions.push({ killerId: ownerId, victimId: snake.id });
          eliminated.add(snake.id);
          break; // This snake is already eliminated, no need to check further
        }
      }
    }

    return collisions;
  }

  /**
   * Detect head-to-head collisions.
   * Checks all pairs of snakes: if distance(head1, head2) < HEAD_TO_HEAD_DISTANCE (30),
   * both snakes are mutually eliminated.
   */
  detectHeadToHead(snakes: Snake[]): Array<{ snake1Id: number; snake2Id: number }> {
    const collisions: Array<{ snake1Id: number; snake2Id: number }> = [];
    const thresholdSq = HEAD_TO_HEAD_DISTANCE * HEAD_TO_HEAD_DISTANCE;

    for (let i = 0; i < snakes.length; i++) {
      for (let j = i + 1; j < snakes.length; j++) {
        const dx = snakes[i].position.x - snakes[j].position.x;
        const dy = snakes[i].position.y - snakes[j].position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < thresholdSq) {
          collisions.push({ snake1Id: snakes[i].id, snake2Id: snakes[j].id });
        }
      }
    }

    return collisions;
  }

  /**
   * Detect boundary eliminations.
   * A snake is eliminated if its head is further than (arenaRadius - HEAD_COLLISION_RADIUS)
   * from the arena center (0,0).
   */
  detectHeadToBoundary(snakes: Snake[], arenaRadius: number): number[] {
    const eliminated: number[] = [];
    const maxDistSq = (arenaRadius - HEAD_COLLISION_RADIUS) * (arenaRadius - HEAD_COLLISION_RADIUS);

    for (const snake of snakes) {
      const distSq = snake.position.x * snake.position.x + snake.position.y * snake.position.y;
      if (distSq > maxDistSq) {
        eliminated.push(snake.id);
      }
    }

    return eliminated;
  }

  /**
   * Detect orb collections.
   * For each snake, queries the orbGrid for orbs within ORB_COLLECTION_DISTANCE of the head.
   * First-come-first-served: once an orb is claimed by a snake in this tick, no other snake
   * can collect it.
   */
  detectOrbCollection(
    snakes: Snake[],
    orbs: Array<{ id: number; position: Vec2 }>,
  ): Array<{ snakeId: number; orbId: number }> {
    const collections: Array<{ snakeId: number; orbId: number }> = [];
    const collectedOrbs = new Set<number>();

    for (const snake of snakes) {
      const nearby = this.orbGrid.query(snake.position, ORB_COLLECTION_DISTANCE);

      for (const entity of nearby) {
        if (collectedOrbs.has(entity.id)) continue;

        // Narrow-phase distance check (entity radius is 0, so just check point distance)
        const dx = snake.position.x - entity.position.x;
        const dy = snake.position.y - entity.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < ORB_COLLECTION_DISTANCE * ORB_COLLECTION_DISTANCE) {
          collections.push({ snakeId: snake.id, orbId: entity.id });
          collectedOrbs.add(entity.id);
        }
      }
    }

    return collections;
  }

  /**
   * Detect power orb collections.
   * Same logic as regular orb collection — first snake within ORB_COLLECTION_DISTANCE claims it.
   */
  detectPowerOrbCollection(
    snakes: Snake[],
    powerOrbs: Array<{ id: number; position: Vec2 }>,
  ): Array<{ snakeId: number; orbId: number }> {
    // Build a temporary grid for power orbs
    const powerOrbGrid = new SpatialHashGrid();
    for (const orb of powerOrbs) {
      powerOrbGrid.insert({
        id: orb.id,
        position: orb.position,
        radius: 0,
      });
    }

    const collections: Array<{ snakeId: number; orbId: number }> = [];
    const collectedOrbs = new Set<number>();

    for (const snake of snakes) {
      const nearby = powerOrbGrid.query(snake.position, ORB_COLLECTION_DISTANCE);

      for (const entity of nearby) {
        if (collectedOrbs.has(entity.id)) continue;

        const dx = snake.position.x - entity.position.x;
        const dy = snake.position.y - entity.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < ORB_COLLECTION_DISTANCE * ORB_COLLECTION_DISTANCE) {
          collections.push({ snakeId: snake.id, orbId: entity.id });
          collectedOrbs.add(entity.id);
        }
      }
    }

    return collections;
  }
}
