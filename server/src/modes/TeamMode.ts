import { GameMode } from '@snake-king/shared';
import { ModeConfig } from './ClassicMode';

export function getTeamModeConfig(): ModeConfig {
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
  private teams: Map<number, Set<number>> = new Map(); // teamId → snakeIds
  private snakeTeams: Map<number, number> = new Map(); // snakeId → teamId

  /** Calculate team count from player count */
  getTeamCount(playerCount: number): number {
    if (playerCount <= 1) return 0;
    if (playerCount <= 8) return 2;
    if (playerCount <= 18) return 3;
    return 4;
  }

  /** Assign a player to a team (smallest team first) */
  assignTeam(snakeId: number): number {
    const playerCount = this.snakeTeams.size + 1;
    const teamCount = this.getTeamCount(playerCount);

    // If not enough players for teams yet, assign to team 1 as default
    if (teamCount === 0) {
      if (!this.teams.has(1)) {
        this.teams.set(1, new Set());
      }
      this.teams.get(1)!.add(snakeId);
      this.snakeTeams.set(snakeId, 1);
      return 1;
    }

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
      const teamSize = this.teams.get(i)!.size;
      if (teamSize < smallestSize) {
        smallestSize = teamSize;
        smallestTeamId = i;
      }
    }

    this.teams.get(smallestTeamId)!.add(snakeId);
    this.snakeTeams.set(snakeId, smallestTeamId);

    return smallestTeamId;
  }

  /** Remove a player from their team */
  removePlayer(snakeId: number): void {
    const teamId = this.snakeTeams.get(snakeId);
    if (teamId === undefined) return;

    this.teams.get(teamId)?.delete(snakeId);
    this.snakeTeams.delete(snakeId);
  }

  /** Check if two snakes are on the same team */
  areSameTeam(snakeId1: number, snakeId2: number): boolean {
    const team1 = this.snakeTeams.get(snakeId1);
    const team2 = this.snakeTeams.get(snakeId2);
    if (team1 === undefined || team2 === undefined) return false;
    return team1 === team2;
  }

  /** Get combined mass for each team */
  getTeamMasses(snakeMasses: Map<number, number>): Map<number, number> {
    const teamMasses = new Map<number, number>();

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
  getTeamId(snakeId: number): number | undefined {
    return this.snakeTeams.get(snakeId);
  }
}
