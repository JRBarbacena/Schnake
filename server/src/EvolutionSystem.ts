import { EVOLUTION_THRESHOLDS, EVOLUTION_DEVOLUTION_PERCENT } from '@snake-king/shared';

export interface StageModifiers {
  /** Multiplier on snake body width */
  widthMultiplier: number;
  /** Multiplicative speed bonus (e.g., 1.05 = 5% faster) */
  speedBonus: number;
  /** Multiplier on head collision radius (e.g., 0.9 = 10% smaller) */
  headRadiusMultiplier: number;
  /** Multiplier on boost mass drain (lower = less drain) */
  boostEfficiency: number;
  /** Extra orb collection radius in units */
  orbCollectionRadius: number;
}

const STAGE_NAMES = ['Hatchling', 'Serpent', 'Wyrm', 'Dragon', 'Leviathan'] as const;

export class EvolutionSystem {
  private static readonly STAGE_MODIFIERS: StageModifiers[] = [
    // Stage 1 — Hatchling: base values
    { widthMultiplier: 1.0, speedBonus: 1.0, headRadiusMultiplier: 1.0, boostEfficiency: 1.0, orbCollectionRadius: 0 },
    // Stage 2 — Serpent: wider body, slight speed bonus
    { widthMultiplier: 1.3, speedBonus: 1.05, headRadiusMultiplier: 1.0, boostEfficiency: 1.0, orbCollectionRadius: 0 },
    // Stage 3 — Wyrm: wider, faster, smaller head hitbox
    { widthMultiplier: 1.5, speedBonus: 1.05, headRadiusMultiplier: 0.9, boostEfficiency: 1.0, orbCollectionRadius: 0 },
    // Stage 4 — Dragon: wider, faster, smaller head, efficient boost
    { widthMultiplier: 1.7, speedBonus: 1.05, headRadiusMultiplier: 0.9, boostEfficiency: 0.85, orbCollectionRadius: 0 },
    // Stage 5 — Leviathan: maximum bonuses + orb magnet radius
    { widthMultiplier: 2.0, speedBonus: 1.05, headRadiusMultiplier: 0.9, boostEfficiency: 0.85, orbCollectionRadius: 50 },
  ];

  /**
   * Check if a snake should evolve to a higher stage based on mass.
   * Returns the highest stage (1-indexed) where mass >= threshold.
   */
  checkEvolution(mass: number, _currentStage: number): number {
    let stage = 1;
    for (let i = EVOLUTION_THRESHOLDS.length - 1; i >= 0; i--) {
      if (mass >= EVOLUTION_THRESHOLDS[i]) {
        stage = i + 1;
        break;
      }
    }
    return stage;
  }

  /**
   * Check if a snake should devolve. Evaluates recursively for multi-stage drops.
   * Returns the new stage (1-indexed).
   */
  checkDevolution(mass: number, currentStage: number): number {
    if (currentStage <= 1) {
      return 1;
    }

    const currentThreshold = EVOLUTION_THRESHOLDS[currentStage - 1];
    const devolutionThreshold = currentThreshold * EVOLUTION_DEVOLUTION_PERCENT;

    if (mass < devolutionThreshold) {
      // Drop one stage and recursively check if we should drop further
      return this.checkDevolution(mass, currentStage - 1);
    }

    return currentStage;
  }

  /**
   * Get the stage modifiers for a given stage (1-5).
   * Clamps to valid range.
   */
  applyStageModifiers(stage: number): StageModifiers {
    const index = Math.max(0, Math.min(stage - 1, EvolutionSystem.STAGE_MODIFIERS.length - 1));
    return EvolutionSystem.STAGE_MODIFIERS[index];
  }

  /** Get the display name for a given stage (1-5). */
  getStageName(stage: number): string {
    const index = Math.max(0, Math.min(stage - 1, STAGE_NAMES.length - 1));
    return STAGE_NAMES[index];
  }
}
