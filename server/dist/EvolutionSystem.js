import { EVOLUTION_THRESHOLDS, EVOLUTION_DEVOLUTION_PERCENT } from '@snake-king/shared';
const STAGE_NAMES = ['Hatchling', 'Serpent', 'Wyrm', 'Dragon', 'Leviathan'];
export class EvolutionSystem {
    /**
     * Check if a snake should evolve to a higher stage based on mass.
     * Returns the highest stage (1-indexed) where mass >= threshold.
     */
    checkEvolution(mass, _currentStage) {
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
    checkDevolution(mass, currentStage) {
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
    applyStageModifiers(stage) {
        const index = Math.max(0, Math.min(stage - 1, EvolutionSystem.STAGE_MODIFIERS.length - 1));
        return EvolutionSystem.STAGE_MODIFIERS[index];
    }
    /** Get the display name for a given stage (1-5). */
    getStageName(stage) {
        const index = Math.max(0, Math.min(stage - 1, STAGE_NAMES.length - 1));
        return STAGE_NAMES[index];
    }
}
EvolutionSystem.STAGE_MODIFIERS = [
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
//# sourceMappingURL=EvolutionSystem.js.map