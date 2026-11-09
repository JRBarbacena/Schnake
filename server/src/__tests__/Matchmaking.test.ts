import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MatchmakingService, SessionInfo } from '../Matchmaking';
import { GameMode, MAX_PLAYERS_PER_SESSION } from '@snake-king/shared';

// ─── Property 32: Matchmaking assigns player to lowest-ping session ──────────

describe('Property 32: Matchmaking assigns player to lowest-ping session', () => {
  const allModes = [
    GameMode.Classic,
    GameMode.BattleRoyale,
    GameMode.Team,
    GameMode.InfiniteGrowth,
  ];

  /** Arbitrary for a random GameMode */
  const arbGameMode = fc.constantFrom(...allModes);

  it('player is assigned to the session with lowest ping among available sessions', () => {
    fc.assert(
      fc.property(
        arbGameMode,
        fc.integer({ min: 2, max: 10 }),
        fc.array(fc.integer({ min: 10, max: 300 }), { minLength: 2, maxLength: 10 }),
        (mode, sessionCount, pings) => {
          const service = new MatchmakingService();

          // Create multiple sessions for the same mode
          const sessions: SessionInfo[] = [];
          for (let i = 0; i < sessionCount; i++) {
            const session = service.createSession(mode);
            sessions.push(session);
          }

          // Build a ping map: session id -> ping value
          // Use the pings array (cycling if needed)
          const playerPing = new Map<string, number>();
          for (let i = 0; i < sessions.length; i++) {
            playerPing.set(sessions[i].id, pings[i % pings.length]);
          }

          // Find the expected lowest-ping session with open slots
          const availableSessions = sessions.filter(
            (s) => s.playerCount < s.maxPlayers,
          );

          let expectedSession: SessionInfo | undefined;
          let lowestPing = Infinity;
          for (const s of availableSessions) {
            const ping = playerPing.get(s.id) ?? Infinity;
            if (ping < lowestPing) {
              lowestPing = ping;
              expectedSession = s;
            }
          }

          // Call findSession
          const assigned = service.findSession(mode, playerPing);

          // The assigned session should be the one with the lowest ping
          expect(assigned.id).toBe(expectedSession!.id);
          expect(playerPing.get(assigned.id)).toBe(lowestPing);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('when a session is full (50 players), player gets assigned to next available', () => {
    fc.assert(
      fc.property(
        arbGameMode,
        fc.integer({ min: 2, max: 5 }),
        (mode, extraSessionCount) => {
          const service = new MatchmakingService();

          // Create a session and fill it to capacity
          const fullSession = service.createSession(mode);
          // Force the session to max capacity
          fullSession.playerCount = MAX_PLAYERS_PER_SESSION;

          // Create additional sessions that have open slots
          const openSessions: SessionInfo[] = [];
          for (let i = 0; i < extraSessionCount; i++) {
            const session = service.createSession(mode);
            openSessions.push(session);
          }

          // Build ping map: full session has the lowest ping,
          // open sessions have higher pings
          const playerPing = new Map<string, number>();
          playerPing.set(fullSession.id, 10); // lowest ping but full

          // Assign increasing pings to open sessions
          for (let i = 0; i < openSessions.length; i++) {
            playerPing.set(openSessions[i].id, 50 + i * 20);
          }

          const assigned = service.findSession(mode, playerPing);

          // Should NOT be assigned to the full session
          expect(assigned.id).not.toBe(fullSession.id);

          // Should be assigned to the open session with lowest ping (first open session)
          expect(assigned.id).toBe(openSessions[0].id);
          expect(assigned.playerCount).toBeLessThan(MAX_PLAYERS_PER_SESSION);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when no sessions exist for the mode, a new one is created', () => {
    fc.assert(
      fc.property(
        arbGameMode,
        (mode) => {
          const service = new MatchmakingService();

          // No sessions exist yet
          expect(service.getSessions().length).toBe(0);

          // Player pings are irrelevant since no sessions exist
          const playerPing = new Map<string, number>();

          const assigned = service.findSession(mode, playerPing);

          // A new session should be created
          expect(assigned).toBeDefined();
          expect(assigned.id).toBeTruthy();
          expect(assigned.mode).toBe(mode);

          // The service should now have exactly one session
          expect(service.getSessions().length).toBe(1);
          expect(service.getSessions()[0].id).toBe(assigned.id);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('when all sessions for a mode are full, a new one is created', () => {
    fc.assert(
      fc.property(
        arbGameMode,
        fc.integer({ min: 1, max: 5 }),
        (mode, sessionCount) => {
          const service = new MatchmakingService();

          // Create sessions and fill them all
          for (let i = 0; i < sessionCount; i++) {
            const session = service.createSession(mode);
            session.playerCount = MAX_PLAYERS_PER_SESSION;
          }

          const initialCount = service.getSessions().length;
          const playerPing = new Map<string, number>();

          const assigned = service.findSession(mode, playerPing);

          // A new session should have been created
          expect(service.getSessions().length).toBe(initialCount + 1);
          expect(assigned.mode).toBe(mode);
          expect(assigned.playerCount).toBeLessThan(MAX_PLAYERS_PER_SESSION);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sessions for a different mode are not considered', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ...[
            [GameMode.Classic, GameMode.BattleRoyale],
            [GameMode.Team, GameMode.InfiniteGrowth],
            [GameMode.BattleRoyale, GameMode.Team],
          ] as const,
        ),
        ([requestedMode, otherMode]) => {
          const service = new MatchmakingService();

          // Create sessions for a different mode only
          const otherSession = service.createSession(otherMode);
          const playerPing = new Map<string, number>();
          playerPing.set(otherSession.id, 10); // low ping but wrong mode

          const assigned = service.findSession(requestedMode, playerPing);

          // Should NOT be assigned to the other mode's session
          expect(assigned.id).not.toBe(otherSession.id);
          expect(assigned.mode).toBe(requestedMode);
        },
      ),
      { numRuns: 50 },
    );
  });
});
