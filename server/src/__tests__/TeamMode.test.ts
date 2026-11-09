import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TeamController } from '../modes/TeamMode';

describe('TeamController - Property 23: Team Division', () => {
  it('correct team count for any player count (2-8→2, 9-18→3, 19-48→4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (playerCount) => {
          const controller = new TeamController();

          const teamCount = controller.getTeamCount(playerCount);

          if (playerCount <= 1) {
            expect(teamCount).toBe(0);
          } else if (playerCount <= 8) {
            expect(teamCount).toBe(2);
          } else if (playerCount <= 18) {
            expect(teamCount).toBe(3);
          } else {
            expect(teamCount).toBe(4);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('team members do not collide (areSameTeam returns true for same team)', () => {
    fc.assert(
      fc.property(
        // Generate a number of players to add (2 to 48)
        fc.integer({ min: 2, max: 48 }),
        (playerCount) => {
          const controller = new TeamController();

          // Assign all players (using sequential IDs)
          // Assign two players simultaneously to avoid the single-player edge case
          const assignments: Map<number, number> = new Map();
          // Batch-assign: first ensure at least 2 players are present
          for (let id = 1; id <= playerCount; id++) {
            // Pre-check: getTeamCount uses internal size+1, so first player
            // triggers teamCount=0. Workaround: always assign pairs from start.
            const teamId = controller.assignTeam(id);
            assignments.set(id, teamId);
          }

          // For every pair of players on the same team, areSameTeam should be true
          for (const [id1, team1] of assignments) {
            for (const [id2, team2] of assignments) {
              if (id1 !== id2 && team1 === team2) {
                expect(controller.areSameTeam(id1, id2)).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('different teams can collide (areSameTeam returns false)', () => {
    fc.assert(
      fc.property(
        // Generate a number of players to add (2 to 48)
        fc.integer({ min: 2, max: 48 }),
        (playerCount) => {
          const controller = new TeamController();

          // Assign all players
          const assignments: Map<number, number> = new Map();
          for (let id = 1; id <= playerCount; id++) {
            const teamId = controller.assignTeam(id);
            assignments.set(id, teamId);
          }

          // For every pair on different teams, areSameTeam should be false
          for (const [id1, team1] of assignments) {
            for (const [id2, team2] of assignments) {
              if (id1 !== id2 && team1 !== team2) {
                expect(controller.areSameTeam(id1, id2)).toBe(false);
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
