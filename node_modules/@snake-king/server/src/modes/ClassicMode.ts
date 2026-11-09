import { GameMode, MAX_PLAYERS_PER_SESSION } from '@snake-king/shared';

export interface ModeConfig {
  mode: GameMode;
  maxPlayers: number;
  timeLimit: number | null; // null = no limit
  arenaShrinksPerTick: number;
  powerOrbSpawnMultiplier: number;
  boostDrainEnabled: boolean;
  orbSpawnRateMultiplier: number;
  friendlyFireDisabled: boolean;
}

export function getClassicModeConfig(): ModeConfig {
  return {
    mode: GameMode.Classic,
    maxPlayers: MAX_PLAYERS_PER_SESSION,
    timeLimit: null,
    arenaShrinksPerTick: 0,
    powerOrbSpawnMultiplier: 1,
    boostDrainEnabled: true,
    orbSpawnRateMultiplier: 1,
    friendlyFireDisabled: false,
  };
}
