import { GameMode } from '@snake-king/shared';
export function getTeamModeConfig() {
    return {
        mode: GameMode.Team,
        maxPlayers: 48,
        timeLimit: null,
        arenaShrinksPerTick: 0,
        powerOrbSpawnMultiplier: 1,
        boostDrainEnabled: true,
        orbSpawnRateMultiplier: 1,
        friendlyFireDisabled: true,
    };
}
export class TeamController {
    constructor() {
        this.teams = new Map(); // teamId → snakeIds
        this.snakeTeams = new Map(); // snakeId → teamId
    }
    /** Calculate team count from player count */
    getTeamCount(playerCount) {
        if (playerCount <= 1)
            return 0;
        if (playerCount <= 8)
            return 2;
        if (playerCount <= 18)
            return 3;
        return 4;
    }
    /** Assign a player to a team (smallest team first) */
    assignTeam(snakeId) {
        const playerCount = this.snakeTeams.size + 1;
        const teamCount = this.getTeamCount(playerCount);
        // Ensure all teams exist
        for (let i = 1; i <= teamCount; i++) {
            if (!this.teams.has(i)) {
                this.teams.set(i, new Set());
            }
        }
        // If team count increased, rebalance might be needed but for now
        // just assign to the smallest team
        let smallestTeamId = 1;
        let smallestSize = Infinity;
        for (let i = 1; i <= teamCount; i++) {
            const teamSize = this.teams.get(i).size;
            if (teamSize < smallestSize) {
                smallestSize = teamSize;
                smallestTeamId = i;
            }
        }
        this.teams.get(smallestTeamId).add(snakeId);
        this.snakeTeams.set(snakeId, smallestTeamId);
        return smallestTeamId;
    }
    /** Remove a player from their team */
    removePlayer(snakeId) {
        const teamId = this.snakeTeams.get(snakeId);
        if (teamId === undefined)
            return;
        this.teams.get(teamId)?.delete(snakeId);
        this.snakeTeams.delete(snakeId);
    }
    /** Check if two snakes are on the same team */
    areSameTeam(snakeId1, snakeId2) {
        const team1 = this.snakeTeams.get(snakeId1);
        const team2 = this.snakeTeams.get(snakeId2);
        if (team1 === undefined || team2 === undefined)
            return false;
        return team1 === team2;
    }
    /** Get combined mass for each team */
    getTeamMasses(snakeMasses) {
        const teamMasses = new Map();
        for (const [teamId, members] of this.teams) {
            let totalMass = 0;
            for (const snakeId of members) {
                totalMass += snakeMasses.get(snakeId) ?? 0;
            }
            teamMasses.set(teamId, totalMass);
        }
        return teamMasses;
    }
    /** Get the team ID for a snake */
    getTeamId(snakeId) {
        return this.snakeTeams.get(snakeId);
    }
}
//# sourceMappingURL=TeamMode.js.map