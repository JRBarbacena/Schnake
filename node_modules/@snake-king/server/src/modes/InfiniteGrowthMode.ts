import { GameMode } from '@snake-king/shared';
import { ModeConfig } from './ClassicMode';

export function getInfiniteGrowthModeConfig(): ModeConfig {
  return {
    mode: GameMode.InfiniteGrowth,
    maxPlayers: 50,
    timeLimit: null,
    arenaShrinksPerTick: 0,
    powerOrbSpawnMultiplier: 1,
    boostDrainEnabled: false,  // no mass drain while boosting
    orbSpawnRateMultiplier: 3, // 200% increase = 3x base (50 * 3 = 150/s)
    friendlyFireDisabled: false,
  };
}
