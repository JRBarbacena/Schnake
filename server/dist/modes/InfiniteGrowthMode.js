import { GameMode } from '@snake-king/shared';
export function getInfiniteGrowthModeConfig() {
    return {
        mode: GameMode.InfiniteGrowth,
        maxPlayers: 50,
        timeLimit: null,
        arenaShrinksPerTick: 0,
        powerOrbSpawnMultiplier: 1,
        boostDrainEnabled: false, // no mass drain while boosting
        orbSpawnRateMultiplier: 3, // 200% increase = 3x base (50 * 3 = 150/s)
        friendlyFireDisabled: false,
    };
}
//# sourceMappingURL=InfiniteGrowthMode.js.map