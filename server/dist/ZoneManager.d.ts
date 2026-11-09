import { Vec2, ZoneType } from '@snake-king/shared';
export type FadeState = 'none' | 'fading_out' | 'fading_in';
export interface ZoneEntity {
    id: number;
    position: Vec2;
    radius: number;
    type: ZoneType;
    fadeState: FadeState;
    fadeTimer: number;
}
export interface ZoneEffect {
    snakeId: number;
    type: ZoneType;
    speedMultiplier?: number;
    massDrain?: number;
    orbValueMultiplier?: number;
    opacity?: number;
}
export declare class ZoneManager {
    private zones;
    private rotationTimer;
    private nextId;
    constructor();
    /** Generate initial zones (5-8 zones, at least one of each type, no overlap, 600u from boundary) */
    generateZones(): void;
    /** Tick zone timers: handle rotation every 120s, fade transitions */
    tick(dt: number): void;
    /** Get all zones */
    getZones(): ZoneEntity[];
    /** Calculate effects for a snake at a given position */
    getEffectsForSnake(snakeId: number, position: Vec2): ZoneEffect | null;
    /** Check if a position is inside any active zone (fadeState === 'none') */
    isInsideActiveZone(position: Vec2): ZoneEntity | null;
    /** Find a valid position for a zone using rejection sampling */
    private findValidPosition;
}
//# sourceMappingURL=ZoneManager.d.ts.map