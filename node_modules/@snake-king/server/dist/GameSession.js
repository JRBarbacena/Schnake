// GameSession - orchestrates the 20Hz game loop pipeline
import { vecDistance, TICK_RATE, ARENA_RADIUS, MIN_ORBS, ORB_SPAWN_RATE, ORB_SIZE_PROBABILITIES, SPAWN_INNER_RADIUS_PERCENT, SPAWN_FALLBACK_RADIUS_PERCENT, SPAWN_MIN_DISTANCE, INITIAL_SEGMENTS, INITIAL_MASS, MASS_PER_SEGMENT, SEGMENT_SPACING, INTEREST_RADIUS, BOOST_UNLOCK_MASS, PowerUpType, } from '@snake-king/shared';
import { PhysicsEngine } from './Physics';
import { CollisionEngine } from './CollisionEngine';
import { EvolutionSystem } from './EvolutionSystem';
import { PowerUpManager } from './PowerUpManager';
import { ZoneManager } from './ZoneManager';
import { AIManager } from './AIManager';
import { LeaderboardManager } from './LeaderboardManager';
// ─── GameSession ─────────────────────────────────────────────────────────────
export class GameSession {
    constructor() {
        this.snakes = new Map();
        this.orbs = new Map();
        this.players = new Map();
        this.currentTick = 0;
        this.nextSnakeId = 1;
        this.nextOrbId = 1;
        this.inputQueue = new Map();
        // Track removed entities per tick for delta generation
        this.removedSnakeIds = [];
        this.removedOrbIds = [];
        this.removedPowerOrbIds = [];
        this.physics = new PhysicsEngine();
        this.collisionEngine = new CollisionEngine();
        this.evolutionSystem = new EvolutionSystem();
        this.powerUpManager = new PowerUpManager();
        this.zoneManager = new ZoneManager();
        this.aiManager = new AIManager();
        this.leaderboard = new LeaderboardManager();
    }
    // ─── Game Loop ───────────────────────────────────────────────────────────
    /** Run one game tick (called at 20Hz) */
    gameTick(dt) {
        this.currentTick++;
        this.removedSnakeIds = [];
        this.removedOrbIds = [];
        this.removedPowerOrbIds = [];
        // 1. Process queued inputs
        this.applyInputs();
        // 2. Update AI
        this.updateAI(dt);
        // 3. Apply physics
        this.applyPhysics(dt);
        // 4. Check zones
        this.applyZones(dt);
        // 5. Run collisions
        this.runCollisions();
        // 6. Process power-ups
        this.processPowerUps(dt);
        // 7. Check evolution
        this.checkEvolution();
        // 8. Update leaderboard
        this.updateLeaderboard(dt);
        // 9. Spawn orbs
        this.spawnOrbs();
    }
    // ─── Pipeline Steps ──────────────────────────────────────────────────────
    applyInputs() {
        for (const [snakeId, inputs] of this.inputQueue) {
            const snake = this.snakes.get(snakeId);
            if (!snake)
                continue;
            for (const input of inputs) {
                switch (input.type) {
                    case 'direction':
                        if (input.targetDirection !== undefined) {
                            snake.targetDirection = input.targetDirection;
                        }
                        break;
                    case 'boost_start':
                        if (!snake.boostLocked && snake.mass >= BOOST_UNLOCK_MASS) {
                            snake.isBoosting = true;
                        }
                        break;
                    case 'boost_end':
                        snake.isBoosting = false;
                        break;
                }
            }
        }
        this.inputQueue.clear();
    }
    updateAI(dt) {
        // Handle bot respawns
        const respawnCount = this.aiManager.getPendingRespawns();
        for (let i = 0; i < respawnCount; i++) {
            const botId = this.addPlayer(`Bot_${this.nextSnakeId}`, true);
            this.aiManager.addBot(botId);
        }
        // Get nearby orbs for AI decision-making
        const allSnakes = this.getSnakes();
        const decisions = this.aiManager.tick(dt, (id) => this.snakes.get(id), allSnakes, (pos) => this.getNearbyOrbPositions(pos, 300));
        // Apply AI decisions to bot snakes
        for (const [snakeId, decision] of decisions) {
            const snake = this.snakes.get(snakeId);
            if (!snake)
                continue;
            snake.targetDirection = decision.targetDirection;
            if (decision.shouldBoost && !snake.boostLocked && snake.mass >= BOOST_UNLOCK_MASS) {
                snake.isBoosting = true;
            }
            else if (!decision.shouldBoost) {
                snake.isBoosting = false;
            }
        }
    }
    applyPhysics(dt) {
        for (const snake of this.snakes.values()) {
            // Apply turn rate
            this.physics.applyTurnRate(snake, dt);
            // Calculate effective speed with stage bonus
            const modifiers = this.evolutionSystem.applyStageModifiers(snake.evolutionStage);
            snake.speed = this.physics.calculateEffectiveSpeed(snake, modifiers.speedBonus, 1.0, // zone multiplier applied separately
            snake.isBoosting);
            // Move snake
            this.physics.moveSnake(snake, dt);
            // Update segments
            this.physics.updateSegments(snake);
            // Apply boost (drain mass, spawn trail orbs)
            const trailOrbs = this.physics.applyBoost(snake, dt, modifiers.boostEfficiency);
            for (const trail of trailOrbs) {
                this.addOrb(trail.position, Math.min(trail.value, 5));
            }
            // Re-lock boost check
            if (snake.mass >= BOOST_UNLOCK_MASS) {
                snake.boostLocked = false;
            }
            // Update segment count based on mass
            const targetSegments = Math.max(INITIAL_SEGMENTS, Math.floor(snake.mass / MASS_PER_SEGMENT));
            this.adjustSegments(snake, targetSegments);
        }
    }
    applyZones(dt) {
        // Tick zone rotation
        this.zoneManager.tick(dt);
        // Apply zone effects to all snakes
        for (const snake of this.snakes.values()) {
            const effect = this.zoneManager.getEffectsForSnake(snake.id, snake.position);
            if (!effect)
                continue;
            // Speed zone: multiply speed
            if (effect.speedMultiplier !== undefined) {
                snake.speed *= effect.speedMultiplier;
            }
            // Danger zone: drain mass
            if (effect.massDrain !== undefined) {
                snake.mass -= effect.massDrain * dt;
                if (snake.mass < 1)
                    snake.mass = 1;
            }
        }
    }
    runCollisions() {
        const allSnakes = this.getSnakes();
        const allOrbs = Array.from(this.orbs.values()).map((o) => ({
            id: o.id,
            position: o.position,
        }));
        // Rebuild spatial grids
        this.collisionEngine.rebuildGrid(allSnakes, allOrbs);
        // Detect collisions
        const headToBody = this.collisionEngine.detectHeadToBody(allSnakes);
        const headToHead = this.collisionEngine.detectHeadToHead(allSnakes);
        const boundaryEliminations = this.collisionEngine.detectHeadToBoundary(allSnakes, ARENA_RADIUS);
        const orbCollections = this.collisionEngine.detectOrbCollection(allSnakes, allOrbs);
        const powerOrbCollections = this.collisionEngine.detectPowerOrbCollection(allSnakes, this.powerUpManager.getPowerOrbs());
        // Process eliminations
        const eliminated = new Set();
        // Head-to-body: check shield/ghost first
        for (const { killerId, victimId } of headToBody) {
            if (eliminated.has(victimId))
                continue;
            if (this.powerUpManager.isGhostActive(victimId))
                continue;
            if (this.powerUpManager.tryAbsorbCollision(victimId))
                continue;
            eliminated.add(victimId);
        }
        // Head-to-head: both die (unless shielded/ghost)
        for (const { snake1Id, snake2Id } of headToHead) {
            const s1Ghost = this.powerUpManager.isGhostActive(snake1Id);
            const s2Ghost = this.powerUpManager.isGhostActive(snake2Id);
            if (s1Ghost && s2Ghost)
                continue;
            if (s1Ghost) {
                if (!this.powerUpManager.tryAbsorbCollision(snake2Id)) {
                    eliminated.add(snake2Id);
                }
                continue;
            }
            if (s2Ghost) {
                if (!this.powerUpManager.tryAbsorbCollision(snake1Id)) {
                    eliminated.add(snake1Id);
                }
                continue;
            }
            // Neither has ghost - check shields
            const s1Shield = this.powerUpManager.tryAbsorbCollision(snake1Id);
            const s2Shield = this.powerUpManager.tryAbsorbCollision(snake2Id);
            if (!s1Shield)
                eliminated.add(snake1Id);
            if (!s2Shield)
                eliminated.add(snake2Id);
        }
        // Boundary eliminations
        for (const snakeId of boundaryEliminations) {
            eliminated.add(snakeId);
        }
        // Handle eliminated snakes: spawn death orbs and remove
        for (const snakeId of eliminated) {
            const snake = this.snakes.get(snakeId);
            if (!snake)
                continue;
            const deathOrbs = this.physics.spawnDeathOrbs(snake);
            for (const deathOrb of deathOrbs) {
                this.addOrb(deathOrb.position, Math.min(deathOrb.value, 5));
            }
            this.eliminateSnake(snakeId);
        }
        // Process orb collections
        for (const { snakeId, orbId } of orbCollections) {
            if (eliminated.has(snakeId))
                continue;
            const orb = this.orbs.get(orbId);
            if (!orb)
                continue;
            const snake = this.snakes.get(snakeId);
            if (!snake)
                continue;
            // Check bonus zone for 2x value
            const zoneEffect = this.zoneManager.getEffectsForSnake(snakeId, snake.position);
            let value = orb.value;
            if (zoneEffect?.orbValueMultiplier) {
                value *= zoneEffect.orbValueMultiplier;
            }
            snake.mass += value;
            this.orbs.delete(orbId);
            this.removedOrbIds.push(orbId);
        }
        // Process power orb collections
        for (const { snakeId, orbId } of powerOrbCollections) {
            if (eliminated.has(snakeId))
                continue;
            const powerOrb = this.powerUpManager.getPowerOrbs().find((o) => o.id === orbId);
            if (!powerOrb)
                continue;
            this.powerUpManager.activatePowerUp(snakeId, powerOrb.type);
            this.powerUpManager.removePowerOrb(orbId);
            this.removedPowerOrbIds.push(orbId);
        }
    }
    processPowerUps(dt) {
        // Tick power orb spawning
        this.powerUpManager.tickSpawning(dt);
        // Tick active power-up durations
        this.powerUpManager.tickActivePowerUps(dt);
        // Apply freeze aura effects
        for (const snake of this.snakes.values()) {
            const powerUp = this.powerUpManager.getActivePowerUp(snake.id);
            if (powerUp?.type === PowerUpType.FreezeAura) {
                const allPositions = Array.from(this.snakes.values()).map((s) => ({
                    id: s.id,
                    position: s.position,
                }));
                const affected = this.powerUpManager.getFreezeAuraEffects(snake.position, allPositions);
                for (const { snakeId, speedMultiplier } of affected) {
                    if (snakeId === snake.id)
                        continue;
                    const target = this.snakes.get(snakeId);
                    if (target) {
                        target.speed *= speedMultiplier;
                    }
                }
            }
        }
    }
    checkEvolution() {
        for (const snake of this.snakes.values()) {
            const newStage = this.evolutionSystem.checkEvolution(snake.mass, snake.evolutionStage);
            if (newStage > snake.evolutionStage) {
                snake.evolutionStage = newStage;
            }
            else {
                const devolved = this.evolutionSystem.checkDevolution(snake.mass, snake.evolutionStage);
                if (devolved < snake.evolutionStage) {
                    snake.evolutionStage = devolved;
                }
            }
        }
    }
    updateLeaderboard(dt) {
        const snakeData = Array.from(this.snakes.values()).map((snake) => {
            const player = this.players.get(snake.id);
            return {
                id: snake.id,
                name: player?.name ?? 'Unknown',
                mass: snake.mass,
                evolutionStage: snake.evolutionStage,
            };
        });
        this.leaderboard.update(snakeData);
        // Tick broadcast timer (dt in seconds → ms)
        this.leaderboard.tickBroadcast(dt * 1000);
    }
    spawnOrbs() {
        const currentCount = this.orbs.size;
        if (currentCount >= MIN_ORBS)
            return;
        const orbsPerTick = Math.ceil(ORB_SPAWN_RATE / TICK_RATE);
        const deficit = MIN_ORBS - currentCount;
        const toSpawn = Math.min(orbsPerTick, deficit);
        for (let i = 0; i < toSpawn; i++) {
            const position = this.randomOrbPosition();
            const size = this.randomOrbSize();
            this.addOrb(position, size);
        }
    }
    // ─── Player Management ───────────────────────────────────────────────────
    /** Add a player and spawn their snake. Returns snakeId. */
    addPlayer(name, isBot = false) {
        const snakeId = this.nextSnakeId++;
        const position = this.findSpawnPosition();
        const direction = Math.random() * 2 * Math.PI;
        // Create initial segments behind the head
        const segments = [];
        for (let i = 0; i < INITIAL_SEGMENTS; i++) {
            segments.push({
                x: position.x - Math.cos(direction) * SEGMENT_SPACING * (i + 1),
                y: position.y - Math.sin(direction) * SEGMENT_SPACING * (i + 1),
            });
        }
        const snake = {
            id: snakeId,
            position,
            direction,
            targetDirection: direction,
            segments,
            mass: INITIAL_MASS,
            speed: 0,
            isBoosting: false,
            evolutionStage: 1,
            pathHistory: [{ ...position }],
            boostLocked: false,
            massAccumulator: 0,
            boostTrailTimer: 0,
        };
        this.snakes.set(snakeId, snake);
        this.players.set(snakeId, { snakeId, name, isBot });
        this.inputQueue.set(snakeId, []);
        return snakeId;
    }
    /** Remove a player and their snake */
    removePlayer(snakeId) {
        const player = this.players.get(snakeId);
        if (!player)
            return;
        if (player.isBot) {
            this.aiManager.removeBot(snakeId);
        }
        this.snakes.delete(snakeId);
        this.players.delete(snakeId);
        this.inputQueue.delete(snakeId);
        this.powerUpManager.removeActivePowerUp(snakeId);
        this.removedSnakeIds.push(snakeId);
    }
    /** Queue an input for processing next tick */
    processInput(snakeId, input) {
        const queue = this.inputQueue.get(snakeId);
        if (queue) {
            queue.push(input);
        }
    }
    // ─── State Delta ─────────────────────────────────────────────────────────
    /** Get interest-managed state delta for a specific player */
    getStateDelta(snakeId) {
        const snake = this.snakes.get(snakeId);
        const delta = {
            tick: this.currentTick,
            snakes: [],
            orbs: [],
            removedSnakeIds: [...this.removedSnakeIds],
            removedOrbIds: [...this.removedOrbIds],
            powerOrbs: [],
            removedPowerOrbIds: [...this.removedPowerOrbIds],
        };
        if (!snake)
            return delta;
        const playerPos = snake.position;
        // Snakes within interest radius
        for (const s of this.snakes.values()) {
            if (vecDistance(playerPos, s.position) <= INTEREST_RADIUS) {
                const player = this.players.get(s.id);
                delta.snakes.push({
                    id: s.id,
                    position: s.position,
                    direction: s.direction,
                    segments: s.segments,
                    mass: s.mass,
                    speed: s.speed,
                    isBoosting: s.isBoosting,
                    evolutionStage: s.evolutionStage,
                    name: player?.name ?? 'Unknown',
                });
            }
        }
        // Orbs within interest radius
        for (const orb of this.orbs.values()) {
            if (vecDistance(playerPos, orb.position) <= INTEREST_RADIUS) {
                delta.orbs.push({
                    id: orb.id,
                    position: orb.position,
                    size: orb.size,
                    value: orb.value,
                    colorIndex: orb.colorIndex,
                });
            }
        }
        // Power orbs within interest radius
        for (const powerOrb of this.powerUpManager.getPowerOrbs()) {
            if (vecDistance(playerPos, powerOrb.position) <= INTEREST_RADIUS) {
                delta.powerOrbs.push({
                    id: powerOrb.id,
                    position: powerOrb.position,
                    type: powerOrb.type,
                });
            }
        }
        return delta;
    }
    // ─── Accessors ───────────────────────────────────────────────────────────
    /** Get all active snakes as an array */
    getSnakes() {
        return Array.from(this.snakes.values());
    }
    /** Get all orbs */
    getOrbs() {
        return this.orbs;
    }
    /** Get current tick number */
    getTick() {
        return this.currentTick;
    }
    /** Get leaderboard manager */
    getLeaderboard() {
        return this.leaderboard;
    }
    /** Get a snake by ID */
    getSnake(snakeId) {
        return this.snakes.get(snakeId);
    }
    /** Get player info */
    getPlayer(snakeId) {
        return this.players.get(snakeId);
    }
    // ─── Private Helpers ─────────────────────────────────────────────────────
    eliminateSnake(snakeId) {
        const player = this.players.get(snakeId);
        if (player?.isBot) {
            this.aiManager.removeBot(snakeId);
        }
        this.snakes.delete(snakeId);
        this.players.delete(snakeId);
        this.inputQueue.delete(snakeId);
        this.powerUpManager.removeActivePowerUp(snakeId);
        this.removedSnakeIds.push(snakeId);
    }
    findSpawnPosition() {
        const innerRadius = ARENA_RADIUS * SPAWN_INNER_RADIUS_PERCENT;
        const fallbackRadius = ARENA_RADIUS * SPAWN_FALLBACK_RADIUS_PERCENT;
        // Try 20 random positions within inner 70%
        for (let attempt = 0; attempt < 20; attempt++) {
            const pos = this.randomPositionInRadius(innerRadius);
            if (this.isSafeSpawnPosition(pos)) {
                return pos;
            }
        }
        // Fallback: try 20 positions within 85%
        for (let attempt = 0; attempt < 20; attempt++) {
            const pos = this.randomPositionInRadius(fallbackRadius);
            if (this.isSafeSpawnPosition(pos)) {
                return pos;
            }
        }
        // Edge case: just pick any position within 85%
        return this.randomPositionInRadius(fallbackRadius);
    }
    isSafeSpawnPosition(pos) {
        for (const snake of this.snakes.values()) {
            if (vecDistance(pos, snake.position) < SPAWN_MIN_DISTANCE) {
                return false;
            }
        }
        return true;
    }
    randomPositionInRadius(radius) {
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.sqrt(Math.random()) * radius;
        return {
            x: r * Math.cos(angle),
            y: r * Math.sin(angle),
        };
    }
    randomOrbPosition() {
        // 2x density near center: positions within 30% of center have 2x spawn probability
        // Use rejection sampling with weighted distribution
        const centerThreshold = ARENA_RADIUS * 0.3;
        const maxRadius = ARENA_RADIUS * 0.95; // Keep orbs away from the very edge
        // Weight: 2x chance for center region
        // P(center) = 2 * area_center / (2 * area_center + area_outer)
        // Simplification: randomly decide inner vs outer with 2:1 weight per unit area
        const centerAreaWeight = 2 * (centerThreshold * centerThreshold);
        const outerAreaWeight = maxRadius * maxRadius - centerThreshold * centerThreshold;
        const totalWeight = centerAreaWeight + outerAreaWeight;
        const centerProbability = centerAreaWeight / totalWeight;
        if (Math.random() < centerProbability) {
            // Spawn in center region (within 30% of arena)
            return this.randomPositionInRadius(centerThreshold);
        }
        else {
            // Spawn in outer region (30% to 95% of arena)
            const angle = Math.random() * 2 * Math.PI;
            const minR = centerThreshold;
            const maxR = maxRadius;
            // Uniform distribution in an annulus: r = sqrt(random * (maxR^2 - minR^2) + minR^2)
            const r = Math.sqrt(Math.random() * (maxR * maxR - minR * minR) + minR * minR);
            return {
                x: r * Math.cos(angle),
                y: r * Math.sin(angle),
            };
        }
    }
    randomOrbSize() {
        const roll = Math.random();
        let cumulative = 0;
        for (let i = 0; i < ORB_SIZE_PROBABILITIES.length; i++) {
            cumulative += ORB_SIZE_PROBABILITIES[i];
            if (roll < cumulative) {
                return i + 1;
            }
        }
        return 1; // fallback
    }
    addOrb(position, size) {
        const clampedSize = Math.max(1, Math.min(5, Math.round(size)));
        const orb = {
            id: this.nextOrbId++,
            position,
            size: clampedSize,
            value: clampedSize,
            colorIndex: Math.floor(Math.random() * 8),
        };
        this.orbs.set(orb.id, orb);
    }
    adjustSegments(snake, targetCount) {
        while (snake.segments.length < targetCount) {
            // Add segment at the tail
            const lastSeg = snake.segments[snake.segments.length - 1] ?? snake.position;
            snake.segments.push({ x: lastSeg.x, y: lastSeg.y });
        }
        while (snake.segments.length > targetCount) {
            snake.segments.pop();
        }
    }
    getNearbyOrbPositions(position, radius) {
        const nearby = [];
        for (const orb of this.orbs.values()) {
            if (vecDistance(position, orb.position) <= radius) {
                nearby.push(orb.position);
            }
        }
        return nearby;
    }
}
//# sourceMappingURL=GameSession.js.map