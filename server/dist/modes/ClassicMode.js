import { GameMode, MAX_PLAYERS_PER_SESSION } from '@snake-king/shared';
export function getClassicModeConfig() {
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
//# sourceMappingURL=ClassicMode.js.map