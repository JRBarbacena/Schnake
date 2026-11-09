import { Vec2 } from '@snake-king/shared';

export class Camera {
  position: Vec2 = { x: 0, y: 0 };
  zoom: number = 1.0;
  viewportWidth: number;
  viewportHeight: number;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  /** Update camera to follow a target position */
  follow(target: Vec2, mass: number): void {
    this.position.x = target.x;
    this.position.y = target.y;

    // Dynamic zoom: 1.0x at mass<100, scales linearly to 0.5x at mass>=3000
    const t = Math.max(0, Math.min((mass - 100) / (3000 - 100), 1));
    this.zoom = 1.0 - 0.5 * t;
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(worldPos: Vec2): Vec2 {
    return {
      x: (worldPos.x - this.position.x) * this.zoom + this.viewportWidth / 2,
      y: (worldPos.y - this.position.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(screenPos: Vec2): Vec2 {
    return {
      x: (screenPos.x - this.viewportWidth / 2) / this.zoom + this.position.x,
      y: (screenPos.y - this.viewportHeight / 2) / this.zoom + this.position.y,
    };
  }

  /** Get visible world bounds (for culling) */
  getVisibleBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const halfWidth = (this.viewportWidth / 2) / this.zoom;
    const halfHeight = (this.viewportHeight / 2) / this.zoom;

    return {
      minX: this.position.x - halfWidth,
      maxX: this.position.x + halfWidth,
      minY: this.position.y - halfHeight,
      maxY: this.position.y + halfHeight,
    };
  }

  /** Update viewport size (on resize) */
  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }
}
