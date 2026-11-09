export type QualityLevel = 'high' | 'medium' | 'low' | 'minimum';

export interface QualitySettings {
  particleDensity: number; // 0-1
  drawDistance: number;    // units
  enableParticles: boolean;
  enableAnimations: boolean;
  enableHUDAnimations: boolean;
}

const HIGH_SETTINGS: QualitySettings = {
  particleDensity: 1,
  drawDistance: 1600,
  enableParticles: true,
  enableAnimations: true,
  enableHUDAnimations: true,
};

const MEDIUM_SETTINGS: QualitySettings = {
  particleDensity: 0.5,
  drawDistance: 800,
  enableParticles: true,
  enableAnimations: true,
  enableHUDAnimations: true,
};

const LOW_SETTINGS: QualitySettings = {
  particleDensity: 0,
  drawDistance: 800,
  enableParticles: false,
  enableAnimations: false,
  enableHUDAnimations: true,
};

const MINIMUM_SETTINGS: QualitySettings = {
  particleDensity: 0,
  drawDistance: 400,
  enableParticles: false,
  enableAnimations: false,
  enableHUDAnimations: false,
};

/** Thresholds for quality degradation */
const LOW_FPS_THRESHOLD = 50;
const VERY_LOW_FPS_THRESHOLD = 30;

/** Duration thresholds in seconds */
const MEDIUM_DEGRADE_TIME = 1;
const LOW_DEGRADE_TIME = 2;
const MINIMUM_DEGRADE_TIME = 5;

/** FPS history window size */
const FPS_HISTORY_SIZE = 60;

/** Recovery threshold - fps must be above this for upgrade */
const RECOVERY_FPS = 55;
const RECOVERY_TIME = 3;

export class PerformanceManager {
  private fps: number = 60;
  private fpsHistory: number[] = [];
  private qualityLevel: QualityLevel = 'high';
  private lowFpsTimer: number = 0;
  private veryLowFpsTimer: number = 0;
  private recoveryTimer: number = 0;

  /** Call every frame with delta time in seconds */
  update(dt: number): void {
    // Calculate instantaneous FPS from delta
    const instantFps = dt > 0 ? 1 / dt : 60;

    // Track FPS history for smoothing
    this.fpsHistory.push(instantFps);
    if (this.fpsHistory.length > FPS_HISTORY_SIZE) {
      this.fpsHistory.shift();
    }

    // Compute smoothed FPS as average of history
    this.fps = this.fpsHistory.reduce((sum, f) => sum + f, 0) / this.fpsHistory.length;

    // Update degradation timers
    if (this.fps < VERY_LOW_FPS_THRESHOLD) {
      this.veryLowFpsTimer += dt;
      this.lowFpsTimer += dt;
      this.recoveryTimer = 0;
    } else if (this.fps < LOW_FPS_THRESHOLD) {
      this.lowFpsTimer += dt;
      this.veryLowFpsTimer = 0;
      this.recoveryTimer = 0;
    } else {
      // FPS is acceptable
      this.lowFpsTimer = 0;
      this.veryLowFpsTimer = 0;
      if (this.fps >= RECOVERY_FPS) {
        this.recoveryTimer += dt;
      } else {
        this.recoveryTimer = 0;
      }
    }

    // Determine quality level based on timers (degrade)
    this.updateQualityLevel();
  }

  private updateQualityLevel(): void {
    // Degrade quality based on how long fps has been low
    if (this.veryLowFpsTimer >= MINIMUM_DEGRADE_TIME) {
      this.setQuality('minimum');
    } else if (this.veryLowFpsTimer >= LOW_DEGRADE_TIME) {
      this.setQuality('low');
    } else if (this.lowFpsTimer >= MEDIUM_DEGRADE_TIME) {
      if (this.qualityLevel === 'high') {
        this.setQuality('medium');
      }
    }

    // Attempt recovery when fps is good
    if (this.recoveryTimer >= RECOVERY_TIME) {
      this.tryUpgrade();
      this.recoveryTimer = 0;
    }
  }

  private setQuality(level: QualityLevel): void {
    const order: QualityLevel[] = ['high', 'medium', 'low', 'minimum'];
    const currentIdx = order.indexOf(this.qualityLevel);
    const targetIdx = order.indexOf(level);

    // Only degrade, never skip recovery steps
    if (targetIdx > currentIdx) {
      this.qualityLevel = level;
    }
  }

  private tryUpgrade(): void {
    switch (this.qualityLevel) {
      case 'minimum':
        this.qualityLevel = 'low';
        break;
      case 'low':
        this.qualityLevel = 'medium';
        break;
      case 'medium':
        this.qualityLevel = 'high';
        break;
    }
  }

  /** Get current quality settings */
  getSettings(): QualitySettings {
    switch (this.qualityLevel) {
      case 'high':
        return { ...HIGH_SETTINGS };
      case 'medium':
        return { ...MEDIUM_SETTINGS };
      case 'low':
        return { ...LOW_SETTINGS };
      case 'minimum':
        return { ...MINIMUM_SETTINGS };
    }
  }

  /** Get current FPS (smoothed) */
  getFps(): number {
    return Math.round(this.fps);
  }

  /** Get current quality level */
  getQualityLevel(): QualityLevel {
    return this.qualityLevel;
  }
}
