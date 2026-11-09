import { GameMode } from '@snake-king/shared';
export interface ModeConfig {
    mode: GameMode;
    maxPlayers: number;
    timeLimit: number | null;
    arenaShrinksPerTick: number;
    powerOrbSpawnMultiplier: number;
    boostDrainEnabled: boolean;
    orbSpawnRateMultiplier: number;
    friendlyFireDisabled: boolean;
}
export declare function getClassicModeConfig(): ModeConfig;
//# sourceMappingURL=ClassicMode.d.ts.map