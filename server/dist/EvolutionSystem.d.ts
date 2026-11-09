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
export declare class EvolutionSystem {
    private static readonly STAGE_MODIFIERS;
    /**
     * Check if a snake should evolve to a higher stage based on mass.
     * Returns the highest stage (1-indexed) where mass >= threshold.
     */
    checkEvolution(mass: number, _currentStage: number): number;
    /**
     * Check if a snake should devolve. Evaluates recursively for multi-stage drops.
     * Returns the new stage (1-indexed).
     */
    checkDevolution(mass: number, currentStage: number): number;
    /**
     * Get the stage modifiers for a given stage (1-5).
     * Clamps to valid range.
     */
    applyStageModifiers(stage: number): StageModifiers;
    /** Get the display name for a given stage (1-5). */
    getStageName(stage: number): string;
}
//# sourceMappingURL=EvolutionSystem.d.ts.map