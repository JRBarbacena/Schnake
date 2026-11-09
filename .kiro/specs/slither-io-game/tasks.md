# Implementation Plan: Slither.io Game

## Overview

This plan implements a premium slither.io-style browser game as a TypeScript monorepo with shared, server, and client modules. Tasks are ordered to build foundational types and utilities first, then core server logic, then client rendering and networking, then game modes and features, and finally integration testing. Property-based tests validate the 32 correctness properties defined in the design.

## Tasks

- [x] 1. Set up project structure and shared module
  - [x] 1.1 Initialize TypeScript monorepo with shared, server, and client packages
    - Create `package.json` at root with workspaces for `shared/`, `server/`, `client/`
    - Configure TypeScript `tsconfig.json` with project references for each package
    - Install dependencies: `fast-check`, `ws`, `vitest` for testing
    - Set up build scripts and path aliases
    - _Requirements: 17.1, 21.1_

  - [x] 1.2 Define shared types and constants
    - Create `shared/src/types.ts` with `Vec2`, `Color`, `Snake`, `Orb`, `PowerOrb`, `Zone`, `SkinConfig`, `GameMode`, `GameSessionState`, `LeaderboardEntry`, `StateDelta`, `SnakeUpdate`, `Achievement`, `DailyChallenge`, `SessionConfig`
    - Create `shared/src/constants.ts` with all game constants (TICK_RATE, BASE_SPEED, BOOST_SPEED, MAX_TURN_RATE, SEGMENT_SPACING, ARENA_RADIUS, etc.)
    - Create `shared/src/protocol.ts` with `MessageType` enum and `InputMessage` interface
    - _Requirements: 1.1, 1.4, 2.4, 4.1, 6.1, 6.2, 6.3, 6.4, 17.1_

  - [x] 1.3 Implement math utilities
    - Create `shared/src/math.ts` with vector operations (add, subtract, normalize, distance, lerp, angle between)
    - Implement `wrapAngle`, `angleDifference`, `shortestArcDirection` for turn calculations
    - Implement `isInsideCircle`, `circlesOverlap` for spatial checks
    - _Requirements: 1.3, 3.1, 3.4_

  - [x] 1.4 Implement binary protocol encoder/decoder
    - Create `shared/src/BinaryProtocol.ts` with `encodeInput`, `decodeInput`, `encodeStateDelta`, `decodeStateDelta`, `encodeFullState`, `decodeFullState`
    - Follow byte layout from design: InputMessage (13 bytes), SnakeUpdate (29 bytes), OrbSpawn (13 bytes), OrbRemove (2 bytes)
    - Use DataView for encoding/decoding ArrayBuffers
    - _Requirements: 17.1, 17.8_

  - [x]* 1.5 Write property test for binary protocol round-trip (Property 27)
    - **Property 27: Binary Protocol Round-Trip**
    - Generate random `InputMessage` and `StateDelta` objects with `fast-check`
    - Assert encode→decode produces identical/equivalent messages within floating-point tolerance
    - **Validates: Requirements 17.1**

- [x] 2. Implement server physics and collision engine

  - [x] 2.1 Implement SpatialHashGrid
    - Create `server/src/CollisionEngine.ts` with `SpatialHashGrid` class
    - Implement `insert`, `remove`, `update`, `query`, `getCellKey`, `clear` methods
    - Use 100-unit cell size as specified
    - _Requirements: 3.6, 21.1_

  - [x]* 2.2 Write property test for spatial hash grid (Property 11)
    - **Property 11: Spatial Hash Grid Query Correctness**
    - Generate random entity sets and query positions/radii
    - Assert query returns exactly those entities within radius (no false positives/negatives)
    - **Validates: Requirements 3.6**

  - [x] 2.3 Implement PhysicsEngine
    - Create `server/src/Physics.ts` with `PhysicsEngine` class
    - Implement `moveSnake` (advance head by speed × dt along direction)
    - Implement `applyTurnRate` (rotate toward target at max 3 rad/s)
    - Implement `updateSegments` (each segment follows path history, maintaining 20-unit spacing)
    - Implement `applyBoost` (drain mass at 14/s × efficiency, spawn trail orbs every 100ms)
    - Implement `calculateEffectiveSpeed` (base × stageBonus × zoneMultiplier + boostBonus, capped at 525)
    - Implement `spawnDeathOrbs` (80% mass as orbs at segment positions)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 6.8_

  - [x]* 2.4 Write property tests for physics (Properties 1, 2, 12, 13)
    - **Property 1: Segment Spacing Invariant** — After movement, all consecutive segments are 20 units apart (±0.001)
    - **Property 2: Turn Rate Bound** — Angular change ≤ 3 × dt radians, direction moves closer to target
    - **Property 12: Effective Speed Calculation** — Speed formula correct for all modifier combinations, capped at 525
    - **Property 13: Boost Mass Drain Invariant** — Mass drain = 14 × dt × efficiency, trail orbs = floor(dt / 0.1)
    - **Validates: Requirements 1.1, 1.3, 1.5, 4.1, 4.2, 4.3, 6.3, 6.8, 7.3**

  - [x] 2.5 Implement CollisionEngine detection methods
    - Implement `detectHeadToBody` — collision when distance < 27 units (15+12), exclude self-collision
    - Implement `detectHeadToHead` — mutual elimination when distance < 30 units
    - Implement `detectHeadToBoundary` — elimination when distance from center > (R - 15)
    - Implement `detectOrbCollection` — collection when distance < 30 units, first-come-first-served per tick
    - Implement `detectPowerOrbCollection` — same logic for power orbs
    - Implement `rebuildGrid` for full-grid reconstruction
    - _Requirements: 3.1, 3.4, 3.5, 3.8, 2.3_

  - [x]* 2.6 Write property tests for collision detection (Properties 5, 7, 9, 10)
    - **Property 5: Orb Collection Distance Threshold** — Collection iff distance < 30, single collector per tick
    - **Property 7: Head-to-Body Collision Detection** — Collision iff distance < 27 and different snakes
    - **Property 9: Arena Boundary Elimination** — Eliminated iff distance from center > (R - 15)
    - **Property 10: Head-to-Head Mutual Elimination** — Both eliminated iff distance < 30
    - **Validates: Requirements 2.3, 3.1, 3.4, 3.5, 3.8**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement server game systems (Evolution, Power-Ups, Zones)

  - [x] 4.1 Implement EvolutionSystem
    - Create `server/src/EvolutionSystem.ts`
    - Define 5 evolution stages with thresholds (0, 100, 500, 1500, 5000) and devolution at 75%
    - Implement `checkEvolution` — promote to highest stage where mass ≥ threshold
    - Implement `checkDevolution` — revert when mass < 75% of current threshold, evaluate recursively
    - Implement `applyStageModifiers` — width, speed bonus, head radius, boost efficiency, orb collection radius
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.8_

  - [x]* 4.2 Write property tests for evolution (Properties 6, 19)
    - **Property 6: Segment Growth from Mass Accumulation** — New segments = floor(total_mass_gained / 10)
    - **Property 19: Evolution Stage Assignment** — Stage = highest where threshold ≤ mass, devolution recursive at 75%
    - **Validates: Requirements 2.5, 6.1, 6.2, 6.3, 6.4, 6.6**

  - [x] 4.3 Implement PowerUpManager
    - Create `server/src/PowerUpManager.ts`
    - Implement spawn logic (one every 15s, max 10, random type with equal probability)
    - Implement `activatePowerUp` — Shield (8s absorb one collision), Magnet (10s attract 150u), Ghost (6s phase-through), Speed_Surge (8s base=300 no boost), Mass_Drain (12s steal 5/s on contact), Freeze_Aura (5s slow 50% within 200u)
    - Implement `tickActivePowerUps` — decrement durations, apply effects
    - Implement state machine: same type resets duration, different type replaces, expiry reverts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.11, 5.12, 5.13_

  - [x]* 4.4 Write property tests for power-ups (Properties 14, 15, 16, 17, 18)
    - **Property 14: Boost Lockout Hysteresis** — Boost locked at mass < 10, unlocked at mass > 15
    - **Property 15: Power-Up State Machine** — Same type resets, different replaces, expiry reverts
    - **Property 16: Shield Collision Absorption** — First collision absorbed, subsequent eliminate, boundary not absorbed
    - **Property 17: Ghost Phase-Through** — All collisions return no-collision during Ghost
    - **Property 18: Freeze Aura Range Effect** — Snakes within 200u at 50% speed, beyond unaffected
    - **Validates: Requirements 4.4, 5.3, 5.5, 5.8, 5.11, 5.12, 5.13**

  - [x] 4.5 Implement ZoneManager
    - Create `server/src/ZoneManager.ts`
    - Implement `generateZones` — 5-8 zones, no overlap, 600u from boundary, at least one of each type
    - Implement zone effects: Speed (1.5x), Danger (3 mass/s drain, kill at <10), Bonus (2x orb value), Stealth (30% opacity)
    - Implement `rotateZones` — every 120s, 3s fade-out/fade-in transition
    - Implement effect removal on fade-out start
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9_

  - [x]* 4.6 Write property tests for zones (Properties 20, 21)
    - **Property 20: Zone Placement Constraints** — No overlaps, 600u from boundary, one of each type, 5-8 total
    - **Property 21: Zone Effect Application and Removal** — Applied iff inside zone AND fadeState is 'none', removed on fade-out
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6, 7.9**

- [x] 5. Implement server AI and game session

  - [x] 5.1 Implement AIManager and AIBot
    - Create `server/src/AIManager.ts` with `AIBot` and `AIManager` classes
    - Implement three states: Foraging (seek nearest orbs), Hunting (target smaller snakes <0.6× mass), Evading (avoid larger snakes >1.5× mass within 300u)
    - Implement state transitions with hysteresis (hunt exits at 500u, evade exits at 400u)
    - Implement difficulty tiers: Easy (400ms reaction, 300u range), Medium (200ms, 400u), Hard (100ms, 500u)
    - Implement boost discipline: max 2s bursts, 3s cooldown between bursts
    - Implement interception point prediction for hunting
    - Implement respawn queue (new bot within 5s of elimination)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x]* 5.2 Write property tests for AI (Properties 24, 25)
    - **Property 24: AI State Transition Correctness** — Transitions to Hunting/Evading/Foraging based on mass ratios and distances
    - **Property 25: AI Boost Discipline** — Max 2s burst, min 3s cooldown
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

  - [x] 5.3 Implement GameSession and game loop
    - Create `server/src/GameSession.ts`
    - Implement 20Hz tick loop: process inputs → update AI → apply physics → check zones → run collisions → process power-ups → check evolution → update leaderboard → spawn orbs
    - Implement `addPlayer`/`removePlayer` with spawn logic (inner 70%, fallback 85%, min 300u from others)
    - Implement `processInput` — queue and apply player inputs
    - Implement `getStateDelta` — interest-managed delta (entities within 1500u of player)
    - Implement orb spawning (maintain 3000 minimum, 50/s spawn rate, 2x density near center)
    - _Requirements: 1.7, 1.8, 2.1, 2.2, 2.7, 17.2, 17.8, 21.1, 21.4_

  - [x]* 5.4 Write property tests for spawning and interest management (Properties 4, 29, 31)
    - **Property 4: Spawn Position Validity** — Within inner 70% (or 85% fallback), ≥300u from all existing snakes
    - **Property 29: Interest Management Filtering** — Delta contains exactly entities within 1500u of player
    - **Property 31: Orb Density Distribution** — Orbs within 30% of center have ~2× density of outer regions
    - **Validates: Requirements 1.7, 1.8, 2.7, 17.8, 21.4**

  - [x] 5.5 Implement LeaderboardManager
    - Create `server/src/LeaderboardManager.ts`
    - Track top 10 players sorted by mass descending, ties broken by earliest timestamp
    - Update every tick, broadcast every 500ms
    - _Requirements: 10.1, 10.2_

  - [x]* 5.6 Write property test for leaderboard ordering (Property 26)
    - **Property 26: Leaderboard Ordering**
    - Generate random mass/timestamp sets, assert correct ordering and top-10 extraction
    - **Validates: Requirements 10.1**

- [x] 6. Checkpoint - Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement game modes

  - [x] 7.1 Implement Classic mode configuration
    - Create `server/src/modes/ClassicMode.ts`
    - Apply base rules (Requirements 1-7), no time limit, max 50 players
    - _Requirements: 8.1, 8.2_

  - [x] 7.2 Implement Battle Royale mode
    - Create `server/src/modes/BattleRoyaleMode.ts`
    - Implement arena shrink: 5% of original radius every 30s
    - Eliminate snakes outside boundary after shrink
    - Spawn power orbs at 3x rate (every 5s, max 30)
    - _Requirements: 8.3, 8.4, 8.5_

  - [x]* 7.3 Write property test for Battle Royale shrink (Property 22)
    - **Property 22: Battle Royale Arena Shrink**
    - Assert radius = originalRadius × (1 - 0.05 × floor(T / 30)), snakes outside eliminated
    - **Validates: Requirements 8.3, 8.4**

  - [x] 7.4 Implement Team mode
    - Create `server/src/modes/TeamMode.ts`
    - Implement team division: 2-8→2 teams, 9-18→3 teams, 19-48→4 teams
    - Disable friendly collision, track combined team mass
    - _Requirements: 8.6, 8.7_

  - [x]* 7.5 Write property test for team division (Property 23)
    - **Property 23: Team Division Logic**
    - Assert correct team count for any player count, team members don't collide
    - **Validates: Requirements 8.6**

  - [x] 7.6 Implement Infinite Growth mode
    - Create `server/src/modes/InfiniteGrowthMode.ts`
    - Remove boost mass drain, increase orb spawn rate by 200% (150/s)
    - _Requirements: 8.8_

- [x] 8. Implement server networking and matchmaking

  - [x] 8.1 Implement WebSocket server
    - Create `server/src/WebSocketServer.ts`
    - Handle connections, authentication, binary message routing
    - Implement per-tick delta broadcast to connected clients using interest management
    - Implement latency monitoring (disconnect at >300ms for 5s)
    - _Requirements: 17.1, 17.2, 17.5, 17.8_

  - [x] 8.2 Implement Matchmaking service
    - Create `server/src/Matchmaking.ts`
    - Assign players to lowest-ping session with open slots
    - Reject when session is at 50 players, assign to next available
    - Create new session if none available, fill with AI bots
    - _Requirements: 17.6, 17.7, 17.10, 19.2, 19.3_

  - [x]* 8.3 Write property test for matchmaking (Property 32)
    - **Property 32: Matchmaking Lowest Ping Assignment**
    - Generate random session sets with varying pings, assert player assigned to lowest ping
    - **Validates: Requirements 17.7**

- [x] 9. Checkpoint - Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement client networking and prediction

  - [x] 10.1 Implement NetworkClient
    - Create `client/src/NetworkClient.ts`
    - WebSocket connection with binary encoding/decoding using shared protocol
    - Implement input sending with sequence numbers
    - Implement server state delta processing and event dispatching
    - Implement reconnection logic (3 attempts over 5s)
    - _Requirements: 17.1, 17.9_

  - [x] 10.2 Implement client-side prediction and reconciliation
    - Implement local snake prediction (apply inputs immediately)
    - Implement server reconciliation (re-apply pending inputs on authoritative state)
    - Smooth correction over 200ms when prediction diverges
    - Track pending inputs queue, discard acknowledged
    - _Requirements: 17.3_

  - [x]* 10.3 Write property test for prediction reconciliation (Property 28)
    - **Property 28: Client Prediction Reconciliation**
    - Generate random server states and pending input queues
    - Assert replaying inputs on server state produces deterministic position
    - **Validates: Requirements 17.3**

  - [x] 10.4 Implement entity interpolation
    - Implement 100ms interpolation buffer for remote snakes
    - Interpolate positions between buffered server states
    - Handle state arrival timing and jitter
    - _Requirements: 17.4_

  - [x]* 10.5 Write property test for interpolation (Property 3)
    - **Property 3: Position Interpolation Correctness**
    - Generate random state pairs and t values in [0,1]
    - Assert interpolated position lies on line segment, correct at t=0 and t=1
    - **Validates: Requirements 1.6, 17.4**

- [x] 11. Implement client renderer and visual systems

  - [x] 11.1 Implement Camera and ObjectPool
    - Create `client/src/Camera.ts` — viewport tracking, zoom (1.0x at mass<100, scales to 0.5x at mass≥3000)
    - Create `client/src/ObjectPool.ts` — generic pool for orbs, particles, segments (no GC pauses)
    - _Requirements: 14.6, 21.3_

  - [x] 11.2 Implement core Renderer
    - Create `client/src/Renderer.ts`
    - Implement viewport culling (only render entities in viewport + 200u buffer)
    - Implement `renderBackground` — grid pattern with 0.5x parallax scroll
    - Implement `renderOrbs` — pulsing glow at 1.5Hz, sized 8-24u, pooled sprites
    - Implement `renderSnakes` — connected segments with skins, glow aura per stage
    - Implement `renderZones` — colored gradients, animated borders, ground texture
    - _Requirements: 2.6, 7.10, 14.1, 14.5, 21.2_

  - [x]* 11.3 Write property test for viewport culling (Property 30)
    - **Property 30: Viewport Culling Correctness**
    - Generate random camera positions, zoom levels, and entity sets
    - Assert renderer draws exactly entities whose bounding circle intersects viewport + 200u buffer
    - **Validates: Requirements 21.2**

  - [x] 11.4 Implement ParticleSystem
    - Create `client/src/ParticleSystem.ts`
    - Implement `spawnDeathExplosion` — 5-10 particles per segment, radiate over 1.5s
    - Implement `spawnCollectionEffect` — 300ms absorption with color matching
    - Implement `spawnBoostTrail` — motion blur lines, 2x density
    - Implement `spawnEvolutionEffect` — 2s transformation particles
    - Implement ambient particles (50-200 floating in viewport)
    - Implement density multiplier for performance scaling
    - _Requirements: 3.7, 14.1, 14.2, 14.3, 14.4, 14.7_

  - [x] 11.5 Implement HUD and Mini-Map
    - Create `client/src/HUD.ts` — mass, peak mass, eliminations, survival time, evolution stage, progress bar, power-up timer
    - Create `client/src/MiniMap.ts` — 150×150px bottom-right, show player dot, boundary, zones, nearby snakes, power orbs
    - Implement mini-map update at 10fps, boundary flash when within 15% of edge
    - Implement toggle with M key / tap
    - _Requirements: 6.7, 10.2, 10.3, 10.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 12. Implement client input and audio

  - [x] 12.1 Implement InputHandler
    - Create `client/src/InputHandler.ts`
    - Desktop: mouse position → target angle, left click/spacebar → boost
    - Mobile: touch-and-drag → target angle (10px minimum drag), on-screen boost button (60×60px, lower-right)
    - Device type detection, responsive UI element sizing (min 44×44px on mobile)
    - _Requirements: 1.2, 4.1, 16.1, 16.2, 16.3, 16.4_

  - [x] 12.2 Implement AudioEngine
    - Create `client/src/AudioEngine.ts`
    - Background music: base exploration layer + intensity layer (crossfade in 1s when snake within 200u, out 2s)
    - Sound effects: orb collect (pitch by value), boost whoosh (loop), explosion (distance attenuation), evolution fanfare, power-up activation sounds
    - Volume controls: Music/SFX sliders 0-100%, master mute, persist in localStorage
    - Initialize on first user interaction, handle autoplay policy
    - Tab visibility: mute on blur, restore on focus
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

- [x] 13. Checkpoint - Ensure all client tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement lobby, customization, and progression features

  - [x] 14.1 Implement Lobby UI
    - Create `client/src/Lobby.ts`
    - Game mode selection (Classic, Battle Royale, Team, Infinite Growth)
    - Player name input (persisted in localStorage)
    - Play button triggering matchmaking
    - Display online player count, active sessions (updated every 5s)
    - Daily challenge card with objective, reward, countdown timer
    - _Requirements: 8.1, 19.1, 19.2, 19.4, 19.5, 19.6_

  - [x] 14.2 Implement Customization screen
    - Create `client/src/Customization.ts`
    - Skin selection (20+ base skins)
    - Primary/secondary color pickers, pattern selection (solid, striped, gradient, dotted, zigzag)
    - Head shape selection (8 options)
    - Trail effect selection (none, sparkles, flames, bubbles, lightning, rainbow)
    - Preview rendering, persist selections in localStorage
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7_

  - [x] 14.3 Implement Achievement system
    - Create `client/src/Achievements.ts`
    - Track 30+ achievements across categories (Growth, Combat, Survival, Collection, Mastery)
    - Notification banner (5s display) on completion
    - Persist progress in localStorage (fallback to in-memory with warning)
    - Achievements screen in Lobby grouped by category
    - Category completion unlocks special skin
    - HUD progress updates during match
    - _Requirements: 11.5, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 14.4 Implement Daily Challenge system
    - Create `server/src/DailyChallenge.ts` — generate challenge at 00:00 UTC daily, pool of 10+ objectives
    - Create `client/src/DailyChallenge.ts` — display progress in HUD, countdown timer, completion tracking
    - Award unique cosmetic per day, prevent duplicate rewards
    - Handle challenge reset during active session
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [x] 15. Implement spectator mode and death screen

  - [x] 15.1 Implement Spectator Mode
    - Create `client/src/SpectatorMode.ts`
    - Death prompt (spectate or lobby) within 2s of elimination
    - Cycle through surviving snakes with arrow keys / swipe
    - Free camera with WASD / pan gestures (constrained to arena)
    - Toggle follow-camera vs free-camera (Tab / double-tap)
    - Display spectated snake's stats (mass, stage, power-ups)
    - Display spectator count to alive players (updated every 2s)
    - Return to lobby (Escape / back gesture)
    - Handle match end while spectating
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 15.2 Implement Death Summary screen
    - Display final mass, rank, snakes eliminated, time survived, orbs collected
    - Options: enter Spectator Mode or return to Lobby
    - _Requirements: 10.7_

- [x] 16. Implement performance management and responsive design

  - [x] 16.1 Implement performance monitoring and adaptive quality
    - Create `client/src/PerformanceManager.ts`
    - Monitor frame rate, trigger quality reduction at <50fps (reduce particles 50%, draw distance 800u)
    - Further reduction at <30fps for 2s (disable particles, reduce animations)
    - Additional reduction at <30fps for 5s (halve draw distance, disable HUD animations)
    - Restore quality when fps recovers above threshold for required duration
    - Target 60fps on mid-range hardware
    - _Requirements: 14.8, 16.5, 21.5, 21.6_

  - [x] 16.2 Implement responsive layout and mobile adaptations
    - Handle orientation changes (re-layout within 500ms, no pause)
    - Support landscape and portrait
    - Leaderboard crown effect for rank 1 (visible to all)
    - _Requirements: 10.4, 10.5, 16.6, 16.7_

- [x] 17. Implement asset loading and game entry point

  - [x] 17.1 Implement asset loader and game bootstrap
    - Create `client/src/AssetLoader.ts` — load all textures, audio, fonts during loading screen
    - Display progress bar reflecting percentage of total bytes loaded
    - Target <10s load on 10Mbps connection
    - Create `client/src/main.ts` — wire all client components together (GameManager)
    - Create `server/src/main.ts` — wire all server components, start WebSocket server
    - Create `client/index.html` — canvas element, responsive meta tags
    - _Requirements: 21.7_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Write remaining property tests and integration tests

  - [ ]* 19.1 Write property test for death orb mass conservation (Property 8)
    - **Property 8: Death Orb Mass Conservation**
    - Generate random snake masses and lengths
    - Assert sum of death orbs = floor(0.8 × mass), one orb per segment position
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 19.2 Write integration test for multiplayer session lifecycle
    - Two clients connect, move, collect orbs, verify state sync via WebSocket
    - Test join → play → die → spectate → rejoin flow
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [ ]* 19.3 Write integration test for WebSocket binary protocol end-to-end
    - Full message round-trip over real WebSocket connection
    - Verify all message types encode/decode correctly in transit
    - _Requirements: 17.1_

  - [ ]* 19.4 Write integration test for performance benchmark
    - Simulate 50 snakes + 5000 orbs, assert tick completes within 30ms
    - _Requirements: 21.1_

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check`
- Unit tests validate specific examples and edge cases
- The shared module is built first so both server and client can depend on it
- Server systems are built before client to enable testing against real game logic
- Game modes extend the base GameSession with mode-specific configuration
- Client components are built modularly to support the performance manager's quality toggles

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5", "2.1"] },
    { "id": 4, "tasks": ["2.2", "2.3"] },
    { "id": 5, "tasks": ["2.4", "2.5"] },
    { "id": 6, "tasks": ["2.6", "4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3"] },
    { "id": 8, "tasks": ["4.4", "4.5"] },
    { "id": 9, "tasks": ["4.6", "5.1"] },
    { "id": 10, "tasks": ["5.2", "5.3", "5.5"] },
    { "id": 11, "tasks": ["5.4", "5.6", "7.1", "7.2", "7.4", "7.6"] },
    { "id": 12, "tasks": ["7.3", "7.5", "8.1", "8.2"] },
    { "id": 13, "tasks": ["8.3", "10.1"] },
    { "id": 14, "tasks": ["10.2", "10.4"] },
    { "id": 15, "tasks": ["10.3", "10.5", "11.1"] },
    { "id": 16, "tasks": ["11.2", "11.4", "11.5"] },
    { "id": 17, "tasks": ["11.3", "12.1", "12.2"] },
    { "id": 18, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 19, "tasks": ["15.1", "15.2", "16.1", "16.2"] },
    { "id": 20, "tasks": ["17.1"] },
    { "id": 21, "tasks": ["19.1", "19.2", "19.3", "19.4"] }
  ]
}
```
