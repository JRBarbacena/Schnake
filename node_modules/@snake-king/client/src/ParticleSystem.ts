import { Vec2 } from '@snake-king/shared';
import { ObjectPool } from './ObjectPool';

interface Particle {
  position: Vec2;
  velocity: Vec2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: ObjectPool<Particle>;
  private densityMultiplier: number = 1.0;
  private ambientParticles: Particle[] = [];

  constructor() {
    this.pool = new ObjectPool<Particle>(
      () => ({
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        life: 0,
        maxLife: 0,
        size: 0,
        color: '',
        alpha: 1,
      }),
      (p) => {
        p.position.x = 0;
        p.position.y = 0;
        p.velocity.x = 0;
        p.velocity.y = 0;
        p.life = 0;
        p.maxLife = 0;
        p.size = 0;
        p.color = '';
        p.alpha = 1;
      },
      100
    );
  }

  /** Update all particles (move, age, remove dead) */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.pool.release(p);
        this.particles.splice(i, 1);
        continue;
      }

      // Move particle
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;

      // Fade out based on remaining life
      p.alpha = Math.max(0, p.life / p.maxLife);

      // Apply drag
      p.velocity.x *= 0.98;
      p.velocity.y *= 0.98;
    }

    // Update ambient particles
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const p = this.ambientParticles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.pool.release(p);
        this.ambientParticles.splice(i, 1);
        continue;
      }

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.alpha = 0.3 + 0.2 * Math.sin((p.life / p.maxLife) * Math.PI);
    }
  }

  /** Render all particles to a canvas context */
  render(ctx: CanvasRenderingContext2D, worldToScreen: (p: Vec2) => Vec2): void {
    // Render ambient particles first (background layer)
    for (const p of this.ambientParticles) {
      const screenPos = worldToScreen(p.position);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render active effect particles
    for (const p of this.particles) {
      const screenPos = worldToScreen(p.position);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /** Spawn death explosion at segment positions (5-10 particles per segment, radiate over 1.5s) */
  spawnDeathExplosion(segments: Vec2[]): void {
    const colors = ['#ff4444', '#ff8800', '#ffcc00', '#ffffff'];

    for (const segment of segments) {
      const count = Math.floor((5 + Math.random() * 6) * this.densityMultiplier);

      for (let i = 0; i < count; i++) {
        const particle = this.pool.acquire();
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 150;

        particle.position.x = segment.x + (Math.random() - 0.5) * 4;
        particle.position.y = segment.y + (Math.random() - 0.5) * 4;
        particle.velocity.x = Math.cos(angle) * speed;
        particle.velocity.y = Math.sin(angle) * speed;
        particle.life = 1.5;
        particle.maxLife = 1.5;
        particle.size = 2 + Math.random() * 4;
        particle.color = colors[Math.floor(Math.random() * colors.length)];
        particle.alpha = 1;

        this.particles.push(particle);
      }
    }
  }

  /** Spawn collection effect at position (300ms absorption with color matching) */
  spawnCollectionEffect(position: Vec2, color: string): void {
    const count = Math.floor(8 * this.densityMultiplier);

    for (let i = 0; i < count; i++) {
      const particle = this.pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * 30;

      // Start particles away from position and move them inward (absorption)
      particle.position.x = position.x + Math.cos(angle) * distance;
      particle.position.y = position.y + Math.sin(angle) * distance;
      particle.velocity.x = -Math.cos(angle) * (distance / 0.3);
      particle.velocity.y = -Math.sin(angle) * (distance / 0.3);
      particle.life = 0.3;
      particle.maxLife = 0.3;
      particle.size = 2 + Math.random() * 3;
      particle.color = color;
      particle.alpha = 1;

      this.particles.push(particle);
    }
  }

  /** Spawn boost trail behind snake (motion blur lines, 2x density) */
  spawnBoostTrail(position: Vec2, direction: number): void {
    const count = Math.floor(4 * this.densityMultiplier * 2); // 2x density for boost

    for (let i = 0; i < count; i++) {
      const particle = this.pool.acquire();
      const spread = (Math.random() - 0.5) * 0.8;
      const trailAngle = direction + Math.PI + spread; // Behind the snake
      const speed = 30 + Math.random() * 60;

      particle.position.x = position.x + (Math.random() - 0.5) * 6;
      particle.position.y = position.y + (Math.random() - 0.5) * 6;
      particle.velocity.x = Math.cos(trailAngle) * speed;
      particle.velocity.y = Math.sin(trailAngle) * speed;
      particle.life = 0.4 + Math.random() * 0.3;
      particle.maxLife = 0.7;
      particle.size = 1 + Math.random() * 2;
      particle.color = '#88ccff';
      particle.alpha = 0.8;

      this.particles.push(particle);
    }
  }

  /** Spawn evolution transformation effect (2s transformation particles) */
  spawnEvolutionEffect(position: Vec2): void {
    const colors = ['#ffdd00', '#ff8800', '#ff00ff', '#00ffcc', '#ffffff'];
    const count = Math.floor(30 * this.densityMultiplier);

    for (let i = 0; i < count; i++) {
      const particle = this.pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 100;

      particle.position.x = position.x;
      particle.position.y = position.y;
      particle.velocity.x = Math.cos(angle) * speed;
      particle.velocity.y = Math.sin(angle) * speed;
      particle.life = 1.5 + Math.random() * 0.5; // Up to 2s total
      particle.maxLife = 2.0;
      particle.size = 3 + Math.random() * 5;
      particle.color = colors[Math.floor(Math.random() * colors.length)];
      particle.alpha = 1;

      this.particles.push(particle);
    }
  }

  /** Manage ambient background particles within viewport (50-200 floating) */
  updateAmbient(viewportBounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const targetCount = Math.floor(
      (50 + 150 * this.densityMultiplier) * Math.min(1, this.densityMultiplier)
    );
    const width = viewportBounds.maxX - viewportBounds.minX;
    const height = viewportBounds.maxY - viewportBounds.minY;

    // Remove particles outside viewport bounds (with margin)
    const margin = 100;
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const p = this.ambientParticles[i];
      if (
        p.position.x < viewportBounds.minX - margin ||
        p.position.x > viewportBounds.maxX + margin ||
        p.position.y < viewportBounds.minY - margin ||
        p.position.y > viewportBounds.maxY + margin
      ) {
        this.pool.release(p);
        this.ambientParticles.splice(i, 1);
      }
    }

    // Spawn new ambient particles to reach target count
    const ambientColors = ['#ffffff', '#aaddff', '#ffddaa', '#ddffdd', '#ffaaff'];
    while (this.ambientParticles.length < targetCount) {
      const particle = this.pool.acquire();

      particle.position.x = viewportBounds.minX + Math.random() * width;
      particle.position.y = viewportBounds.minY + Math.random() * height;
      particle.velocity.x = (Math.random() - 0.5) * 10;
      particle.velocity.y = (Math.random() - 0.5) * 10;
      particle.life = 5 + Math.random() * 10;
      particle.maxLife = 15;
      particle.size = 1 + Math.random() * 2;
      particle.color = ambientColors[Math.floor(Math.random() * ambientColors.length)];
      particle.alpha = 0.3;

      this.ambientParticles.push(particle);
    }
  }

  /** Set density multiplier for performance scaling */
  setDensityMultiplier(multiplier: number): void {
    this.densityMultiplier = Math.max(0.1, Math.min(2.0, multiplier));
  }

  /** Get active particle count */
  getParticleCount(): number {
    return this.particles.length + this.ambientParticles.length;
  }
}
