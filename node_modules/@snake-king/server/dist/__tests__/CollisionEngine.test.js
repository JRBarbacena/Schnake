import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpatialHashGrid } from '../CollisionEngine';
// Helper: Euclidean distance between two points
function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
// Arbitrary for a Vec2 position within [-5000, 5000]
const arbPosition = fc.record({
    x: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true }),
});
// Arbitrary for entity radius [5, 50]
const arbRadius = fc.double({ min: 5, max: 50, noNaN: true, noDefaultInfinity: true });
// Arbitrary for a query radius [5, 200]
const arbQueryRadius = fc.double({ min: 5, max: 200, noNaN: true, noDefaultInfinity: true });
// Arbitrary for a spatial entity (with unique ID assigned externally)
const arbEntityData = fc.record({
    position: arbPosition,
    radius: arbRadius,
});
// Generate a set of 1-50 entities with unique IDs
const arbEntitySet = fc.array(arbEntityData, { minLength: 1, maxLength: 50 }).map((items) => items.map((item, index) => ({
    id: index + 1,
    position: item.position,
    radius: item.radius,
})));
describe('SpatialHashGrid - Property-Based Tests', () => {
    describe('Property 11: Query correctness (no false positives / no false negatives)', () => {
        it('query returns exactly those entities within radius', () => {
            fc.assert(fc.property(arbEntitySet, arbPosition, arbQueryRadius, (entities, queryPos, queryRadius) => {
                const grid = new SpatialHashGrid(100);
                // Insert all entities
                for (const entity of entities) {
                    grid.insert(entity);
                }
                // Query results
                const results = grid.query(queryPos, queryRadius);
                const resultIds = new Set(results.map((e) => e.id));
                // Compute expected results via brute force
                const expectedIds = new Set();
                for (const entity of entities) {
                    const dist = distance(queryPos, entity.position);
                    if (dist <= queryRadius + entity.radius) {
                        expectedIds.add(entity.id);
                    }
                }
                // No false positives: every result must be within range
                for (const result of results) {
                    const dist = distance(queryPos, result.position);
                    expect(dist).toBeLessThanOrEqual(queryRadius + result.radius);
                }
                // No false negatives: every entity within range must be in results
                for (const entity of entities) {
                    const dist = distance(queryPos, entity.position);
                    if (dist <= queryRadius + entity.radius) {
                        expect(resultIds.has(entity.id)).toBe(true);
                    }
                }
                // Sets must be equal
                expect(resultIds.size).toBe(expectedIds.size);
            }), { numRuns: 200 });
        });
    });
    describe('Insert/Remove consistency', () => {
        it('removed entities are never returned by query', () => {
            fc.assert(fc.property(arbEntitySet, arbPosition, arbQueryRadius, fc.integer({ min: 0, max: 49 }), (entities, queryPos, queryRadius, removeIdx) => {
                const grid = new SpatialHashGrid(100);
                // Insert all entities
                for (const entity of entities) {
                    grid.insert(entity);
                }
                // Remove one entity (clamp index to valid range)
                const idx = removeIdx % entities.length;
                const removedId = entities[idx].id;
                grid.remove(removedId);
                // Query results should never contain the removed entity
                const results = grid.query(queryPos, queryRadius);
                const resultIds = new Set(results.map((e) => e.id));
                expect(resultIds.has(removedId)).toBe(false);
                // All remaining results should still be valid (within distance)
                for (const result of results) {
                    const dist = distance(queryPos, result.position);
                    expect(dist).toBeLessThanOrEqual(queryRadius + result.radius);
                }
            }), { numRuns: 100 });
        });
    });
    describe('Clear empties the grid', () => {
        it('after clear, query always returns empty results', () => {
            fc.assert(fc.property(arbEntitySet, arbPosition, arbQueryRadius, (entities, queryPos, queryRadius) => {
                const grid = new SpatialHashGrid(100);
                // Insert all entities
                for (const entity of entities) {
                    grid.insert(entity);
                }
                // Clear the grid
                grid.clear();
                // Query should always return empty
                const results = grid.query(queryPos, queryRadius);
                expect(results).toHaveLength(0);
            }), { numRuns: 100 });
        });
    });
    describe('Update moves entity to new position', () => {
        it('after update, entity is queryable at new position, not old', () => {
            fc.assert(fc.property(arbEntitySet, arbPosition, arbRadius, fc.integer({ min: 0, max: 49 }), (entities, newPosition, newRadius, updateIdx) => {
                const grid = new SpatialHashGrid(100);
                // Insert all entities
                for (const entity of entities) {
                    grid.insert(entity);
                }
                // Pick an entity to update
                const idx = updateIdx % entities.length;
                const targetEntity = entities[idx];
                const updatedEntity = {
                    id: targetEntity.id,
                    position: newPosition,
                    radius: newRadius,
                };
                // Update entity position
                grid.update(updatedEntity);
                // Query at new position with a tiny radius should find it
                // if the entity's own radius overlaps
                const pinpointResults = grid.query(newPosition, 0);
                const pinpointIds = new Set(pinpointResults.map((e) => e.id));
                // The updated entity should be found at its new position
                // (query radius 0 + entity radius means entity overlaps if dist <= entity.radius)
                const distToNew = distance(newPosition, updatedEntity.position);
                if (distToNew <= updatedEntity.radius) {
                    expect(pinpointIds.has(updatedEntity.id)).toBe(true);
                }
                // Verify with a broad query: updated entity should appear at new position
                const broadResults = grid.query(newPosition, 500);
                const broadIds = new Set(broadResults.map((e) => e.id));
                const distBroad = distance(newPosition, updatedEntity.position);
                if (distBroad <= 500 + updatedEntity.radius) {
                    expect(broadIds.has(updatedEntity.id)).toBe(true);
                }
                // Verify the full correctness property still holds after update
                const allEntitiesAfterUpdate = entities.map((e) => e.id === targetEntity.id ? updatedEntity : e);
                const queryPos = newPosition;
                const queryRadius = 200;
                const results = grid.query(queryPos, queryRadius);
                const resultIds = new Set(results.map((e) => e.id));
                for (const entity of allEntitiesAfterUpdate) {
                    const dist = distance(queryPos, entity.position);
                    if (dist <= queryRadius + entity.radius) {
                        expect(resultIds.has(entity.id)).toBe(true);
                    }
                    else {
                        expect(resultIds.has(entity.id)).toBe(false);
                    }
                }
            }), { numRuns: 100 });
        });
    });
});
//# sourceMappingURL=CollisionEngine.test.js.map