import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ZoneManager } from '../ZoneManager';
import { ZoneType, ARENA_RADIUS, ZONE_ROTATION_INTERVAL, ZONE_FADE_DURATION, ZONE_TYPES, vecDistance, } from '@snake-king/shared';
// ─── Constants ───────────────────────────────────────────────────────────────
const MIN_ZONES = 5;
const MAX_ZONES = 8;
const BOUNDARY_BUFFER = 600;
// ─── Property 20: Zone Placement Constraints ─────────────────────────────────
describe('Property 20: Zone Placement Constraints', () => {
    it('zone count is always between 5 and 8 (inclusive)', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            expect(zones.length).toBeGreaterThanOrEqual(MIN_ZONES);
            expect(zones.length).toBeLessThanOrEqual(MAX_ZONES);
        }), { numRuns: 200 });
    });
    it('no two zones overlap (distance between centers > sum of radii)', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            for (let i = 0; i < zones.length; i++) {
                for (let j = i + 1; j < zones.length; j++) {
                    const dist = vecDistance(zones[i].position, zones[j].position);
                    const minSeparation = zones[i].radius + zones[j].radius;
                    expect(dist).toBeGreaterThanOrEqual(minSeparation);
                }
            }
        }), { numRuns: 200 });
    });
    it('all zone centers are at least 600u from arena boundary', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            for (const zone of zones) {
                const distFromCenter = vecDistance(zone.position, { x: 0, y: 0 });
                // Zone center must be within ARENA_RADIUS - BOUNDARY_BUFFER from arena center
                expect(distFromCenter).toBeLessThanOrEqual(ARENA_RADIUS - BOUNDARY_BUFFER);
            }
        }), { numRuns: 200 });
    });
    it('at least one zone of each type is present', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            const typesPresent = new Set(zones.map((z) => z.type));
            for (const type of ZONE_TYPES) {
                expect(typesPresent.has(type)).toBe(true);
            }
        }), { numRuns: 200 });
    });
    it('constraints hold after calling generateZones multiple times', () => {
        fc.assert(fc.property(fc.integer({ min: 2, max: 10 }), (regenerations) => {
            const mgr = new ZoneManager();
            for (let r = 0; r < regenerations; r++) {
                mgr.generateZones();
                const zones = mgr.getZones();
                // Count constraint
                expect(zones.length).toBeGreaterThanOrEqual(MIN_ZONES);
                expect(zones.length).toBeLessThanOrEqual(MAX_ZONES);
                // No overlap
                for (let i = 0; i < zones.length; i++) {
                    for (let j = i + 1; j < zones.length; j++) {
                        const dist = vecDistance(zones[i].position, zones[j].position);
                        const minSeparation = zones[i].radius + zones[j].radius;
                        expect(dist).toBeGreaterThanOrEqual(minSeparation);
                    }
                }
                // Boundary constraint
                for (const zone of zones) {
                    const distFromCenter = vecDistance(zone.position, { x: 0, y: 0 });
                    expect(distFromCenter).toBeLessThanOrEqual(ARENA_RADIUS - BOUNDARY_BUFFER);
                }
                // All types present
                const typesPresent = new Set(zones.map((z) => z.type));
                for (const type of ZONE_TYPES) {
                    expect(typesPresent.has(type)).toBe(true);
                }
            }
        }), { numRuns: 100 });
    });
});
// ─── Property 21: Zone Effect Application and Removal ────────────────────────
describe('Property 21: Zone Effect Application and Removal', () => {
    it('effect is applied when snake is inside a zone with fadeState === none', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (snakeId) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            // Pick the first zone and place the snake at its center
            const zone = zones[0];
            const position = { x: zone.position.x, y: zone.position.y };
            // Initially all zones have fadeState 'none'
            expect(zone.fadeState).toBe('none');
            const effect = mgr.getEffectsForSnake(snakeId, position);
            expect(effect).not.toBeNull();
            expect(effect.snakeId).toBe(snakeId);
            expect(effect.type).toBe(zone.type);
        }), { numRuns: 200 });
    });
    it('effects are NOT applied when fadeState is fading_out', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (snakeId) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            // Place snake inside the first zone
            const zone = zones[0];
            const position = { x: zone.position.x, y: zone.position.y };
            // Trigger rotation by ticking past ZONE_ROTATION_INTERVAL
            mgr.tick(ZONE_ROTATION_INTERVAL + 0.01);
            // All zones should now be fading_out
            const zonesAfterRotation = mgr.getZones();
            for (const z of zonesAfterRotation) {
                expect(z.fadeState).toBe('fading_out');
            }
            // Effects should NOT be applied during fade-out
            const effect = mgr.getEffectsForSnake(snakeId, position);
            expect(effect).toBeNull();
        }), { numRuns: 200 });
    });
    it('effects are NOT applied when fadeState is fading_in', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (snakeId) => {
            const mgr = new ZoneManager();
            // Trigger rotation: tick past ZONE_ROTATION_INTERVAL to start fading_out
            mgr.tick(ZONE_ROTATION_INTERVAL + 0.01);
            // Complete the fade-out phase to trigger new zone generation with fading_in
            mgr.tick(ZONE_FADE_DURATION + 0.01);
            // Now all zones should be fading_in
            const zones = mgr.getZones();
            for (const z of zones) {
                expect(z.fadeState).toBe('fading_in');
            }
            // Place snake inside the first new zone
            const zone = zones[0];
            const position = { x: zone.position.x, y: zone.position.y };
            // Effects should NOT be applied during fade-in
            const effect = mgr.getEffectsForSnake(snakeId, position);
            expect(effect).toBeNull();
        }), { numRuns: 200 });
    });
    it('effects resume after full transition (fade_out + fade_in)', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (snakeId) => {
            const mgr = new ZoneManager();
            // Trigger rotation: tick past ZONE_ROTATION_INTERVAL
            mgr.tick(ZONE_ROTATION_INTERVAL + 0.01);
            // Complete fade-out
            mgr.tick(ZONE_FADE_DURATION + 0.01);
            // Complete fade-in
            mgr.tick(ZONE_FADE_DURATION + 0.01);
            // Zones should be back to 'none' state
            const zones = mgr.getZones();
            for (const z of zones) {
                expect(z.fadeState).toBe('none');
            }
            // Place snake inside the first zone — effects should apply again
            const zone = zones[0];
            const position = { x: zone.position.x, y: zone.position.y };
            const effect = mgr.getEffectsForSnake(snakeId, position);
            expect(effect).not.toBeNull();
            expect(effect.snakeId).toBe(snakeId);
            expect(effect.type).toBe(zone.type);
        }), { numRuns: 200 });
    });
    it('effect type matches zone type correctly', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (snakeId) => {
            const mgr = new ZoneManager();
            const zones = mgr.getZones();
            for (const zone of zones) {
                const position = { x: zone.position.x, y: zone.position.y };
                const effect = mgr.getEffectsForSnake(snakeId, position);
                expect(effect).not.toBeNull();
                expect(effect.type).toBe(zone.type);
                switch (zone.type) {
                    case ZoneType.Speed:
                        expect(effect.speedMultiplier).toBe(1.5);
                        break;
                    case ZoneType.Danger:
                        expect(effect.massDrain).toBe(3);
                        break;
                    case ZoneType.Bonus:
                        expect(effect.orbValueMultiplier).toBe(2);
                        break;
                    case ZoneType.Stealth:
                        expect(effect.opacity).toBe(0.3);
                        break;
                }
            }
        }), { numRuns: 100 });
    });
    it('snake outside all zones gets no effect', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 1000 }), (snakeId) => {
            const mgr = new ZoneManager();
            // Position far from all zones (at the arena boundary buffer edge)
            // Since zones must be within ARENA_RADIUS - 600 = 4400u from center,
            // a position at ARENA_RADIUS - 100 = 4900u should be outside all zones
            const farPosition = { x: ARENA_RADIUS - 100, y: 0 };
            const effect = mgr.getEffectsForSnake(snakeId, farPosition);
            expect(effect).toBeNull();
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=ZoneManager.test.js.map