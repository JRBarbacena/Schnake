# Requirements Document

## Introduction

This document defines the requirements for a premium-quality slither.io game clone with creative unique twists, designed as a web-based real-time multiplayer and single-player experience. The game differentiates itself through an evolution system, power-up mechanics, multiple game modes, special map zones, deep customization, and polished visual/audio presentation. The goal is a "5-star game of the year" quality browser game playable on both desktop and mobile devices.

## Glossary

- **Game_Client**: The browser-based frontend application responsible for rendering, input handling, and communicating with the Game_Server
- **Game_Server**: The Node.js backend application managing authoritative game state, physics, matchmaking, and WebSocket communication
- **Snake**: The player-controlled or AI-controlled entity that moves on the game arena, grows by consuming orbs, and dies on collision
- **Head**: The leading segment of a Snake that determines direction and detects collisions
- **Body_Segment**: An individual segment of a Snake's body that trails behind the Head following the path history
- **Orb**: A collectible entity on the game arena that increases a Snake's mass when consumed
- **Power_Orb**: A special Orb that grants temporary abilities when consumed
- **Arena**: The circular 2D playing field with a defined boundary
- **Arena_Boundary**: The circular outer edge of the Arena; contact results in Snake death
- **Mass**: The numerical value representing a Snake's accumulated size and score
- **Boost**: A speed increase mechanic that consumes Mass and leaves behind a trail of Orbs
- **Leaderboard**: A ranked display of the top players by Mass in the current game session
- **Evolution_System**: The mechanic by which a Snake transforms visually and gains passive bonuses at specific Mass thresholds
- **Zone**: A defined area within the Arena that applies special effects to Snakes within it
- **Game_Mode**: A distinct ruleset variant (Classic, Battle Royale, Team, Infinite Growth)
- **AI_Bot**: A computer-controlled Snake using pathfinding and decision-making algorithms
- **Lobby**: The pre-game interface where players select Game_Mode, customize their Snake, and connect to a match
- **Spectator_Mode**: A view-only mode allowing eliminated players to observe the ongoing match
- **Mini_Map**: A small navigational overlay showing the player's position relative to the full Arena
- **Particle_System**: The visual effects engine for rendering explosions, trails, glows, and ambient effects
- **Matchmaking_Service**: The server component that assigns players to game sessions based on availability and skill
- **Skin**: A visual customization applied to a Snake's appearance
- **Achievement_System**: A persistent progression tracker for completing challenges and milestones
- **Input_Handler**: The component that processes mouse, touch, and keyboard input into game commands
- **Collision_Engine**: The server-side system responsible for detecting and resolving Snake-to-Snake and Snake-to-Orb interactions
- **Tick_Rate**: The frequency at which the Game_Server updates authoritative game state (measured in Hz)

## Requirements

### Requirement 1: Core Snake Movement

**User Story:** As a player, I want to control a snake that moves smoothly and responsively on a 2D plane, so that I feel precise control over my gameplay.

#### Acceptance Criteria

1. THE Game_Client SHALL render the Snake as a series of connected Body_Segments following the Head along its recorded path history, with each segment center separated by exactly 20 units
2. WHEN the player moves the mouse cursor or touches the screen, THE Input_Handler SHALL calculate the target direction as the angle from the Snake Head to the cursor/touch position
3. WHILE a target direction differs from the Snake Head's current direction, THE Game_Server SHALL rotate the Snake Head toward the target direction at a maximum turn rate of 3 radians per second
4. THE Game_Server SHALL move the Snake Head forward continuously at a base speed of 200 units per second
5. WHEN the Snake Head moves, THE Game_Server SHALL update each Body_Segment to follow the recorded path of the segment ahead of it, maintaining a fixed spacing of 20 units between each segment center
6. THE Game_Client SHALL interpolate Snake positions between server updates to produce smooth 60fps rendering
7. WHEN a new player joins, THE Game_Server SHALL spawn a Snake with 10 initial Body_Segments and a starting Mass of 100 at a random position within the inner 70% of the Arena, at least 300 units away from any existing Snake
8. IF no valid spawn position is found within the inner 70% of the Arena (all candidate positions are within 300 units of an existing Snake), THEN THE Game_Server SHALL expand the spawn search to the inner 85% of the Arena

### Requirement 2: Orb Spawning and Collection

**User Story:** As a player, I want to eat orbs scattered across the arena to grow my snake, so that I can become larger and compete against other players.

#### Acceptance Criteria

1. THE Game_Server SHALL maintain a minimum of 3000 Orbs distributed across the Arena at all times
2. WHEN the total Orb count falls below 3000, THE Game_Server SHALL spawn new Orbs at random positions within the Arena at a rate of 50 Orbs per second
3. WHEN the Snake Head comes within 30 units of an Orb center, THE Collision_Engine SHALL register a collection event and assign the Orb to the first Snake detected within range during that tick, removing the Orb from play immediately so that no other Snake can collect the same Orb
4. WHEN an Orb is collected, THE Game_Server SHALL increase the collecting Snake's Mass by the Orb's value, where Orbs exist in 5 discrete sizes: size 1 (value 1), size 2 (value 2), size 3 (value 3), size 4 (value 4), and size 5 (value 5), with spawn probability weighted as 40%, 30%, 15%, 10%, and 5% respectively
5. WHEN a Snake's cumulative Mass gained since its last Body_Segment addition reaches 10 points, THE Game_Server SHALL add one new Body_Segment to the end of the Snake and reset the cumulative counter to zero
6. THE Game_Client SHALL render Orbs with a pulsing glow animation cycling at 1.5 Hz and randomized color from a palette of 12 distinct hues, with Orb rendered diameter proportional to its size (ranging from 8 units for size 1 to 24 units for size 5)
7. THE Game_Server SHALL spawn Orbs with higher density near the center of the Arena (2x spawn weight within 30% of center radius)

### Requirement 3: Snake Collision and Death

**User Story:** As a player, I want clear collision rules so that I can strategize around eliminating opponents and avoiding death.

#### Acceptance Criteria

1. WHEN a Snake Head center comes within the sum of the Head collision radius (15 units) and the Body_Segment collision radius (12 units) of any Body_Segment of another Snake, THE Collision_Engine SHALL eliminate the colliding Snake (the one whose Head made contact)
2. WHEN a Snake is eliminated, THE Game_Server SHALL convert the eliminated Snake's accumulated Mass into Orbs distributed evenly along the path of the Snake's body, with one Orb placed per Body_Segment position
3. WHEN a Snake is eliminated, THE Game_Server SHALL generate Orbs with a combined value equal to 80% of the eliminated Snake's Mass, with each generated Orb assigned a random value between 1 and 5
4. WHEN a Snake Head center comes within 15 units of the Arena_Boundary, THE Collision_Engine SHALL eliminate that Snake
5. WHEN two Snake Heads come within the sum of their collision radii (30 units total) during the same server tick, THE Collision_Engine SHALL eliminate both Snakes
6. THE Collision_Engine SHALL use a spatial hash grid with 100-unit cells for broad-phase collision detection to maintain performance with 100+ simultaneous Snakes
7. WHEN a Snake is eliminated, THE Game_Client SHALL display a particle explosion effect lasting 1.5 seconds at the death location
8. THE Collision_Engine SHALL NOT detect collisions between a Snake Head and its own Body_Segments (self-collision does not cause elimination)

### Requirement 4: Boost Mechanic

**User Story:** As a player, I want to boost my snake's speed at the cost of mass, so that I can make aggressive plays and escape dangerous situations.

#### Acceptance Criteria

1. WHILE the player holds the left mouse button or spacebar or taps-and-holds on mobile, THE Game_Server SHALL increase the Snake's speed to 350 units per second (1.75x base speed), and SHALL return the Snake to base speed within the next server tick when the input is released
2. WHILE a Snake is boosting, THE Game_Server SHALL decrease the Snake's Mass by 14 points per second
3. WHILE a Snake is boosting, THE Game_Server SHALL spawn one small Orb (value 1) at the position of the Snake's last Body_Segment every 100 milliseconds
4. IF a Snake's Mass falls below 10 while boosting, THEN THE Game_Server SHALL deactivate the boost and prevent further boosting until Mass exceeds 15
5. WHEN boost is activated, THE Game_Client SHALL render a speed-line particle trail and increase the glow intensity around the Snake Head to 2x the base glow level
6. WHILE a Snake is boosting, THE Game_Client SHALL display a visual indicator showing remaining Mass (pulsing body segments shrinking)
7. WHILE a Snake is boosting inside a Speed_Zone, THE Game_Server SHALL cap the Snake's speed at 350 units per second (boost speed does not stack with Zone speed multipliers or Speed_Surge power-up)

### Requirement 5: Power-Up System

**User Story:** As a player, I want to collect special power-up orbs that grant temporary abilities, so that gameplay has more variety and strategic depth.

#### Acceptance Criteria

1. THE Game_Server SHALL spawn one Power_Orb every 15 seconds at a random position within the inner 80% of the Arena radius, up to a maximum of 10 active Power_Orbs
2. THE Game_Server SHALL assign each Power_Orb one of six types with equal probability: Shield, Magnet, Ghost, Speed_Surge, Mass_Drain, or Freeze_Aura
3. WHEN a Snake Head collects a Shield Power_Orb, THE Game_Server SHALL grant the Snake immunity to one Body_Segment collision (not Arena_Boundary contact) for 8 seconds, whichever is consumed first
4. WHEN a Snake Head collects a Magnet Power_Orb, THE Game_Server SHALL move all Orbs within 150 units toward the Snake Head at a rate of 200 units per second for 10 seconds
5. WHEN a Snake Head collects a Ghost Power_Orb, THE Game_Server SHALL allow the Snake to pass through other Snake bodies without collision for 6 seconds
6. WHEN a Snake Head collects a Speed_Surge Power_Orb, THE Game_Server SHALL set the Snake's base speed to 300 units per second for 8 seconds without Mass cost, and the Snake SHALL NOT be able to activate Boost while Speed_Surge is active
7. WHEN a Snake Head collects a Mass_Drain Power_Orb, THE Game_Server SHALL cause any Snake that touches the collector's body to lose 5 Mass per second to the collector for 12 seconds
8. WHEN a Snake Head collects a Freeze_Aura Power_Orb, THE Game_Server SHALL reduce the speed of all Snakes within 200 units of the collector to 50% for 5 seconds
9. THE Game_Client SHALL render each Power_Orb type with a unique icon, distinct color, and a rotating animation to distinguish them from regular Orbs
10. WHEN a power-up is active, THE Game_Client SHALL display a timer bar and icon near the Snake Head showing remaining duration
11. IF a Snake collects a Power_Orb of the same type as an already active power-up, THEN THE Game_Server SHALL reset that power-up's duration to its full value without stacking effects
12. IF a Snake collects a Power_Orb of a different type than the currently active power-up, THEN THE Game_Server SHALL replace the active power-up with the newly collected one, immediately ending the previous effect
13. WHEN a power-up duration expires, THE Game_Server SHALL revert the Snake to its normal state within the same server tick

### Requirement 6: Evolution System

**User Story:** As a player, I want my snake to evolve and transform as it grows, so that I feel a sense of progression during a match and gain visual distinction.

#### Acceptance Criteria

1. WHEN a Snake's Mass reaches 100, THE Evolution_System SHALL transform the Snake to Stage 2 (Serpent) with a body width increased to 1.3x the base width and a 5% speed bonus applied multiplicatively to the Snake's current base speed (200 units per second)
2. WHEN a Snake's Mass reaches 500, THE Evolution_System SHALL transform the Snake to Stage 3 (Wyrm) with a segmented armored appearance and a 10% collision radius reduction on the head
3. WHEN a Snake's Mass reaches 1500, THE Evolution_System SHALL transform the Snake to Stage 4 (Dragon) with wing particle effects and a 15% boost efficiency improvement (Mass drain reduced from 14 to 11.9 points per second while boosting)
4. WHEN a Snake's Mass reaches 5000, THE Evolution_System SHALL transform the Snake to Stage 5 (Leviathan) with a full visual overhaul, ambient particle aura, and automatic collection of any Orbs within 50 units of the Snake Head without requiring direct contact
5. WHEN an evolution occurs, THE Game_Client SHALL play a 2-second transformation animation with particle effects and a sound cue, during which the Snake continues to move and remains vulnerable to collisions
6. IF a Snake's Mass falls below 75% of the threshold for its current stage, THEN THE Evolution_System SHALL revert the Snake to the previous evolution stage, evaluating each stage's threshold in sequence so that multiple stage losses may occur in a single tick if mass drops below multiple thresholds
7. THE Game_Client SHALL display the current evolution stage name and a progress bar showing the Snake's current Mass as a percentage of the Mass required for the next evolution stage in the player HUD
8. WHEN evolution speed bonuses apply, THE Evolution_System SHALL multiply the Snake's base speed by the stage bonus factor before applying other speed modifiers (boost, Speed_Zone, Speed_Surge), and only the current stage's bonus SHALL apply (bonuses do not stack across stages)

### Requirement 7: Arena Zones

**User Story:** As a player, I want special zones on the map that create different gameplay conditions, so that positioning and map awareness become important strategies.

#### Acceptance Criteria

1. THE Game_Server SHALL generate 5 to 8 circular Zones across the Arena at match start, each with a radius between 200 and 500 units, positioned so that no Zone overlaps another Zone and every Zone center is at least 600 units from the Arena_Boundary
2. THE Game_Server SHALL assign each Zone one of four types: Speed_Zone (1.5x movement speed), Danger_Zone (continuous 3 Mass loss per second), Bonus_Zone (2x Orb value), or Stealth_Zone (Snake becomes 30% opacity to other players), with at least one Zone of each type present
3. WHILE a Snake is inside a Speed_Zone, THE Game_Server SHALL multiply the Snake's base speed by 1.5, applying additively with boost (base speed x 1.5 + boost bonus) up to a maximum speed cap of 525 units per second
4. WHILE a Snake is inside a Danger_Zone, THE Game_Server SHALL decrease the Snake's Mass by 3 points per second
5. IF a Snake's Mass falls below 10 while inside a Danger_Zone, THEN THE Game_Server SHALL eliminate the Snake
6. WHILE a Snake is inside a Bonus_Zone, THE Game_Server SHALL double the value of all Orbs collected by that Snake
7. WHILE a Snake is inside a Stealth_Zone, THE Game_Client SHALL render that Snake at 30% opacity for other players (full opacity for the Snake's own player)
8. WHEN 120 seconds have elapsed since the last Zone rotation, THE Game_Server SHALL move each Zone to a new random valid position (non-overlapping, within Arena bounds) with a 3-second fade-out and fade-in transition
9. IF a Snake is inside a Zone when that Zone begins its fade-out transition, THEN THE Game_Server SHALL remove the Zone's effect from that Snake at the start of the fade-out
10. THE Game_Client SHALL render each Zone type with a distinct color gradient, animated border, and ground texture overlay

### Requirement 8: Game Modes

**User Story:** As a player, I want to choose between different game modes, so that I can enjoy varied gameplay experiences.

#### Acceptance Criteria

1. THE Lobby SHALL present four Game_Mode options: Classic, Battle_Royale, Team, and Infinite_Growth
2. WHEN Classic mode is selected, THE Game_Server SHALL run the base game rules (as defined in Requirements 1-7) with no time limit and a maximum of 50 players per session
3. WHEN Battle_Royale mode is selected, THE Game_Server SHALL shrink the Arena_Boundary by 5% of its original radius every 30 seconds until only one Snake remains
4. IF a Snake is located outside the Arena_Boundary after a Battle_Royale shrink step, THEN THE Collision_Engine SHALL eliminate that Snake as if it contacted the Arena_Boundary
5. WHEN Battle_Royale mode is selected, THE Game_Server SHALL spawn Power_Orbs at 3x the base rate (one every 5 seconds) up to a maximum of 30 active Power_Orbs within the playable area
6. WHEN Team mode is selected, THE Game_Server SHALL divide players into teams of equal size (2 teams for 2-8 players, 3 teams for 9-18 players, 4 teams for 19-48 players) with team members unable to collide with each other
7. WHEN Team mode is selected, THE Game_Server SHALL track and display combined team Mass on the Leaderboard, and declare the team with the highest combined Mass as the winner when all members of every other team have been eliminated
8. WHEN Infinite_Growth mode is selected, THE Game_Server SHALL remove the boost Mass drain mechanic and increase Orb spawn rate by 200% (150 Orbs per second when below minimum count)
9. THE Game_Server SHALL maintain separate Leaderboards for each Game_Mode

### Requirement 9: AI Bot System

**User Story:** As a player, I want to play against intelligent AI opponents in single-player mode, so that I can practice and enjoy the game offline.

#### Acceptance Criteria

1. WHEN single-player mode is selected, THE Game_Server SHALL spawn between 20 and 40 AI_Bots to populate the Arena, each with an initial Mass randomly assigned between 10 and 200
2. THE AI_Bot SHALL implement three behavior states: Foraging (seeking nearest Orbs), Hunting (targeting smaller Snakes), and Evading (avoiding larger Snakes within 300 units), with Foraging as the default state
3. WHEN a Snake with Mass less than 60% of the AI_Bot's Mass is detected within 400 units, THE AI_Bot SHALL switch from Foraging to Hunting
4. WHEN a Snake with Mass greater than 150% of the AI_Bot's Mass is detected within 300 units, THE AI_Bot SHALL switch to Evading
5. IF the AI_Bot is in Hunting state and no target Snake remains within 500 units, THEN THE AI_Bot SHALL switch back to Foraging
6. IF the AI_Bot is in Evading state and no threatening Snake remains within 400 units, THEN THE AI_Bot SHALL switch back to Foraging
7. WHILE an AI_Bot is in Hunting state and the distance to the target Snake is increasing between consecutive ticks, THE AI_Bot SHALL activate boost in bursts of no more than 2 seconds with a minimum 3-second cooldown between bursts
8. WHILE an AI_Bot is in Hunting state targeting a Snake with Mass less than 60% of the AI_Bot's Mass, THE AI_Bot SHALL steer toward a predicted interception point ahead of the target Snake's current heading
9. THE Game_Server SHALL assign each AI_Bot a difficulty tier (Easy, Medium, Hard) distributed as approximately 50% Easy, 30% Medium, and 20% Hard, where tier affects reaction time (400ms, 200ms, 100ms respectively) and target selection range (300 units, 400 units, 500 units respectively)
10. WHEN an AI_Bot is eliminated, THE Game_Server SHALL spawn a replacement AI_Bot within 5 seconds to maintain population density

### Requirement 10: Leaderboard and Scoring

**User Story:** As a player, I want to see my ranking compared to other players in real-time, so that I feel competitive motivation.

#### Acceptance Criteria

1. THE Game_Client SHALL display a Leaderboard showing the top 10 players ranked by Mass, updated every 500 milliseconds, with ties broken by earliest time the Mass value was reached
2. THE Leaderboard SHALL display each entry with rank number, player name (truncated to 16 characters), evolution stage icon, and current Mass value
3. WHEN the player is not in the top 10, THE Game_Client SHALL display the player's current rank and Mass below the Leaderboard
4. WHEN a player reaches rank 1, THE Game_Client SHALL display a crown particle effect on that player's Snake Head visible to all players
5. WHEN the rank 1 player drops below rank 1, THE Game_Client SHALL remove the crown particle effect within the next Leaderboard update cycle (500 milliseconds)
6. THE Game_Client SHALL display the player's personal stats in the HUD: current Mass, peak Mass this session, Snakes eliminated, and survival time displayed in mm:ss format updated every second
7. WHEN a player is eliminated, THE Game_Client SHALL display a death summary screen showing final Mass, final rank, Snakes eliminated, time survived, and Orbs collected, with options to enter Spectator_Mode or return to the Lobby

### Requirement 11: Customization System

**User Story:** As a player, I want to customize my snake's appearance, so that I can express my personality and stand out in the arena.

#### Acceptance Criteria

1. THE Lobby SHALL provide a Skin selection screen with at least 20 base Skins available
2. THE Game_Client SHALL allow players to select a primary color, secondary color, and pattern style (solid, striped, gradient, dotted, zigzag) for their Snake
3. THE Game_Client SHALL allow players to select a head shape from at least 8 options (round, arrow, diamond, star, skull, crown, flame, crystal)
4. THE Game_Client SHALL allow players to select a trail effect (none, sparkles, flames, bubbles, lightning, rainbow)
5. WHEN a player completes an Achievement, THE Achievement_System SHALL unlock a corresponding exclusive Skin or cosmetic item
6. THE Game_Client SHALL store player customization preferences in local browser storage for persistence across sessions
7. THE Game_Client SHALL render all customization options on other players' Snakes visible to all connected clients

### Requirement 12: Mini-Map and Navigation

**User Story:** As a player, I want a mini-map to understand my position in the arena, so that I can navigate strategically toward zones and away from the boundary.

#### Acceptance Criteria

1. THE Game_Client SHALL render a Mini_Map in the bottom-right corner of the screen, sized at 150x150 pixels
2. THE Mini_Map SHALL display the player's position as a white dot, the Arena_Boundary as a circle, all active Zones as colored regions matching their Zone type color, and all Snakes within 1500 units of the player as dots colored by their team or evolution stage
3. THE Mini_Map SHALL update at 10 frames per second
4. WHILE the player is within 15% of the Arena_Boundary distance, THE Game_Client SHALL flash the Mini_Map border in red at a rate of 2 flashes per second
5. THE Mini_Map SHALL display the positions of active Power_Orbs as distinct icons matching their Power_Orb type
6. WHEN the player presses the M key or taps the Mini_Map, THE Game_Client SHALL toggle the Mini_Map visibility between shown and hidden

### Requirement 13: Spectator Mode

**User Story:** As a player, I want to spectate the match after I die, so that I can continue watching the action and learn from other players.

#### Acceptance Criteria

1. WHEN a player is eliminated, THE Game_Client SHALL display a prompt within 2 seconds offering the option to enter Spectator_Mode or return to the Lobby
2. WHILE in Spectator_Mode, THE Game_Client SHALL allow the player to cycle through surviving Snakes using left/right arrow keys or swipe gestures, wrapping from the last player back to the first
3. WHILE in Spectator_Mode, THE Game_Client SHALL allow free camera movement with WASD keys or pan gestures, constrained to remain within the Arena_Boundary
4. WHILE in Spectator_Mode, THE Game_Client SHALL display the spectated Snake's stats (Mass, evolution stage, active power-ups)
5. THE Game_Client SHALL display a spectator count to all alive players showing how many spectators are watching them, updated every 2 seconds
6. WHILE in Spectator_Mode, THE Game_Client SHALL provide a toggle key (Tab on desktop, double-tap on mobile) to switch between follow-camera mode (tracking a selected Snake) and free-camera mode
7. WHILE in Spectator_Mode, THE Game_Client SHALL display a button or key binding (Escape on desktop, back gesture on mobile) to return to the Lobby at any time
8. IF the match ends while a player is in Spectator_Mode, THEN THE Game_Client SHALL display the match results summary and return the player to the Lobby within 5 seconds

### Requirement 14: Visual Effects and Polish

**User Story:** As a player, I want visually stunning effects and polished presentation, so that the game feels premium and engaging.

#### Acceptance Criteria

1. THE Particle_System SHALL render a glowing aura around each Snake Head with intensity scaling per evolution stage: Stage 1 at 20% opacity, Stage 2 at 40%, Stage 3 at 60%, Stage 4 at 80%, and Stage 5 at 100% opacity with an additional pulsing animation
2. THE Particle_System SHALL render between 50 and 200 ambient floating particles within the visible viewport area in the Arena background to convey depth and movement
3. WHEN a Snake is eliminated, THE Particle_System SHALL render an explosion of 5 to 10 orb-sized particles per Body_Segment, radiating outward over 1.5 seconds
4. WHEN a Snake collects an Orb, THE Game_Client SHALL render an absorption animation lasting 300 milliseconds with color matching the collected Orb
5. THE Game_Client SHALL render the Arena background with a grid pattern that parallax-scrolls at 0.5x the camera movement rate to convey depth
6. THE Game_Client SHALL implement dynamic camera zoom starting at 1.0x for Mass below 100, scaling linearly down to a minimum of 0.5x at Mass 3000 or above
7. WHEN boost is active, THE Particle_System SHALL render motion blur lines and a trail effect with 2x the normal particle density and glow radius compared to the non-boosting state
8. THE Game_Client SHALL maintain a minimum of 60 frames per second on mid-range hardware (equivalent to integrated graphics from 2020)

### Requirement 15: Audio System

**User Story:** As a player, I want immersive sound effects and background music, so that the game experience is engaging across all senses.

#### Acceptance Criteria

1. THE Game_Client SHALL play ambient background music using at least two layered audio tracks: a base exploration layer that plays continuously, and an intensity layer that crossfades in over 1 second when any other Snake is within 200 units, and crossfades out over 2 seconds when no Snake is within 200 units
2. WHEN an Orb is collected, THE Game_Client SHALL play a chime sound with pitch mapped linearly across the Orb value range (lowest pitch for value 1, highest pitch for value 5)
3. WHEN boost is activated, THE Game_Client SHALL play a whoosh sound effect that loops continuously while boosting and stops within 100 milliseconds of boost deactivation
4. WHEN a Snake is eliminated within 500 units of the player's Snake, THE Game_Client SHALL play an explosion sound effect with volume attenuated linearly based on distance (full volume at 0 units, silent at 500 units)
5. WHEN an evolution occurs, THE Game_Client SHALL play a triumphant fanfare sound lasting 2 seconds
6. WHEN a Power_Orb is collected, THE Game_Client SHALL play a unique activation sound for each of the six power-up types (Shield, Magnet, Ghost, Speed_Surge, Mass_Drain, Freeze_Aura)
7. THE Game_Client SHALL provide volume controls with a slider range of 0% to 100% for Music and Sound Effects independently, and a master Mute toggle, with all settings persisted in local storage and defaulting to Music 50%, Sound Effects 70%, and Mute off on first visit
8. WHEN the player first interacts with the game (click, tap, or keypress), THE Game_Client SHALL initialize the audio system and begin background music playback, displaying a visible unmute prompt if audio context is suspended due to browser autoplay policy
9. IF the browser tab loses focus, THEN THE Game_Client SHALL reduce all audio volume to 0% and restore it to the player's configured levels when the tab regains focus

### Requirement 16: Responsive Controls and Mobile Support

**User Story:** As a player, I want to play the game comfortably on both desktop and mobile devices, so that I can enjoy the game regardless of my device.

#### Acceptance Criteria

1. THE Input_Handler SHALL support mouse movement for direction control on desktop devices
2. THE Input_Handler SHALL support touch-and-drag for direction control on mobile devices, where the Snake Head turns toward the touch position, with a minimum drag distance of 10 pixels before a direction change registers
3. THE Input_Handler SHALL support a dedicated on-screen boost button for mobile devices, sized at minimum 60x60 CSS pixels and positioned in the lower-right quadrant of the screen with its center no more than 100 pixels from the screen edge
4. WHEN the Game_Client loads, THE Game_Client SHALL detect device type and adjust UI element sizes: buttons minimum 44x44 CSS pixels on mobile, HUD text minimum 14px equivalent, and all interactive elements maintaining a minimum spacing of 8 pixels between touch targets
5. IF the frame rate drops below 50fps for more than 1 second, THEN THE Game_Client SHALL reduce particle density by 50% and reduce draw distance to 800 units until the frame rate recovers above 55fps for 2 consecutive seconds
6. WHEN screen orientation changes on mobile, THE Game_Client SHALL re-layout the UI within 500 milliseconds without pausing game state or dropping player input events
7. THE Game_Client SHALL support both landscape and portrait orientations on mobile, with landscape as the recommended default

### Requirement 17: Networking and Real-Time Multiplayer

**User Story:** As a player, I want smooth real-time multiplayer with minimal lag, so that the competitive experience feels fair and responsive.

#### Acceptance Criteria

1. THE Game_Server SHALL communicate with Game_Clients using WebSocket connections with binary message encoding for reduced bandwidth
2. THE Game_Server SHALL run the authoritative game simulation at a Tick_Rate of 20 Hz (50ms per tick)
3. THE Game_Client SHALL implement client-side prediction for the local Snake's movement to mask network latency up to 150ms, and SHALL smoothly correct the local Snake's position over 200ms when the Game_Server's authoritative state diverges from the predicted state
4. THE Game_Client SHALL implement entity interpolation for remote Snakes, rendering them with a 100ms interpolation buffer
5. IF a player's latency exceeds 300ms for more than 5 consecutive seconds, THEN THE Game_Server SHALL disconnect that player and THE Game_Client SHALL display a timeout notification informing the player of the disconnection reason
6. IF a player attempts to join a game session that has reached 50 concurrent players, THEN THE Matchmaking_Service SHALL reject the join request and assign the player to the next available session with open slots
7. WHEN a player initiates matchmaking, THE Matchmaking_Service SHALL assign the player to the available game session with the lowest ping that has open slots
8. THE Game_Server SHALL send delta state updates (only changed entities) to each connected Game_Client once per tick (every 50ms)
9. IF a Game_Client's WebSocket connection is lost, THEN THE Game_Client SHALL display a reconnection indicator and attempt to reconnect up to 3 times over 5 seconds; IF reconnection fails, THEN THE Game_Client SHALL return the player to the Lobby with a connection-lost message
10. IF no game session with open slots is available when a player initiates matchmaking, THEN THE Matchmaking_Service SHALL create a new game session and connect the player within 5 seconds

### Requirement 18: Achievement System and Progression

**User Story:** As a player, I want persistent achievements and progression, so that I have long-term goals beyond individual matches.

#### Acceptance Criteria

1. THE Achievement_System SHALL track at least 30 distinct achievements across categories: Growth (reach Mass thresholds), Combat (elimination counts), Survival (time alive), Collection (Orbs collected), and Mastery (use all power-ups, evolve to max stage)
2. WHEN a player completes an achievement, THE Game_Client SHALL display a notification banner with the achievement name, icon, and reward description for 5 seconds before automatically dismissing
3. THE Achievement_System SHALL persist achievement progress (including incremental counters for multi-step achievements) in local browser storage, updating after each match ends or when an achievement is completed
4. IF local browser storage is unavailable or full, THEN THE Game_Client SHALL display a warning message indicating that achievement progress cannot be saved and SHALL continue tracking progress for the current session in memory
5. THE Game_Client SHALL provide an Achievements screen in the Lobby displaying all achievements grouped by category, showing completion status, unlock requirements, and numeric progress toward incomplete achievements (e.g., "3/10 eliminations")
6. WHEN all achievements in a category are completed, THE Achievement_System SHALL unlock a special category-completion Skin and THE Game_Client SHALL display a category-complete notification banner for 5 seconds
7. WHILE a match is in progress, THE Game_Client SHALL update achievement progress in the HUD when incremental progress is made toward any tracked achievement

### Requirement 19: Lobby and Matchmaking

**User Story:** As a player, I want a polished lobby experience to set up matches quickly, so that I spend minimal time waiting and maximum time playing.

#### Acceptance Criteria

1. THE Lobby SHALL display the Game_Mode selection, Snake customization preview, player name input, and a Play button
2. WHEN the Play button is pressed, THE Matchmaking_Service SHALL connect the player to an available game session within 5 seconds
3. IF no game session is available within 5 seconds, THEN THE Matchmaking_Service SHALL create a new game session and begin filling it with AI_Bots until human players join
4. THE Lobby SHALL display current online player count and active game session count, updated every 5 seconds
5. WHEN a player enters a name, THE Game_Client SHALL persist the name in local storage for future sessions
6. THE Lobby SHALL display a daily challenge card showing the current challenge objective and reward

### Requirement 20: Daily Challenge System

**User Story:** As a player, I want daily challenges that give me unique objectives, so that each day offers a fresh reason to play.

#### Acceptance Criteria

1. THE Game_Server SHALL generate a new daily challenge at 00:00 UTC every 24 hours, selecting one objective from a pool of at least 10 distinct objectives that include: reach Mass 1000 in under 3 minutes, eliminate 5 Snakes in one session, collect 3 Power_Orbs in one life, or survive for 10 minutes without boosting
2. WHEN a player completes the daily challenge, THE Achievement_System SHALL award one cosmetic item (trail effect, color variant, or head shape) that is unique to that calendar day and not obtainable through other means
3. IF a player has already completed the current daily challenge, THEN THE Game_Client SHALL display the challenge as completed and THE Achievement_System SHALL not award a duplicate reward
4. THE Game_Client SHALL display daily challenge progress in the HUD during gameplay as a numeric tracker showing current value versus target value (e.g., "3/5 Snakes eliminated")
5. THE Game_Client SHALL display a countdown timer in the Lobby in HH:MM:SS format showing time remaining until the next daily challenge refreshes
6. IF the daily challenge resets while a player is in an active game session, THEN THE Game_Server SHALL allow the current session's progress toward the old challenge to complete, and present the new challenge upon the player's next session start

### Requirement 21: Performance and Scalability

**User Story:** As a player, I want the game to run smoothly regardless of how many players are in the arena, so that gameplay quality is consistent.

#### Acceptance Criteria

1. THE Game_Server SHALL process a full game tick (collision detection, physics, state updates) within 30 milliseconds for up to 50 Snakes and 5000 Orbs
2. THE Game_Client SHALL implement viewport culling, rendering only entities within the visible screen area plus a 200-unit buffer
3. THE Game_Client SHALL use object pooling for Orbs and particles such that no single garbage collection pause exceeds 16 milliseconds during active gameplay
4. THE Game_Server SHALL implement interest management, sending entity updates only for entities within 1500 units of each player's viewport
5. IF frame rate drops below 30fps for more than 2 consecutive seconds, THEN THE Game_Client SHALL reduce visual quality (disable particles, reduce Orb animations) until frame rate recovers above 45fps
6. IF frame rate remains below 30fps for more than 5 consecutive seconds after visual quality reduction has been applied, THEN THE Game_Client SHALL further reduce rendering by halving draw distance and disabling all non-essential HUD animations
7. THE Game_Client SHALL load all game assets (textures, audio, fonts) during an initial loading screen within 10 seconds on a 10 Mbps connection, displaying a progress bar that reflects the percentage of total asset bytes loaded
