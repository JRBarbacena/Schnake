import { ModeConfig } from './ClassicMode';
export declare function getTeamModeConfig(): ModeConfig;
export declare class TeamController {
    private teams;
    private snakeTeams;
    /** Calculate team count from player count */
    getTeamCount(playerCount: number): number;
    /** Assign a player to a team (smallest team first) */
    assignTeam(snakeId: number): number;
    /** Remove a player from their team */
    removePlayer(snakeId: number): void;
    /** Check if two snakes are on the same team */
    areSameTeam(snakeId1: number, snakeId2: number): boolean;
    /** Get combined mass for each team */
    getTeamMasses(snakeMasses: Map<number, number>): Map<number, number>;
    /** Get the team ID for a snake */
    getTeamId(snakeId: number): number | undefined;
}
//# sourceMappingURL=TeamMode.d.ts.map