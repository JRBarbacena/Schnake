/**
 * @snake-king/client - Game client entry point
 * Main bootstrap for "Who's the Snake King"
 *
 * Wires all client components together:
 * - Asset loading with progress bar
 * - Lobby UI → Play → Game Loop → Death → Spectator
 * - 60fps render loop with requestAnimationFrame
 * - Server connection, prediction, interpolation
 */

import { Camera } from './Camera';
import { Renderer, type RenderableSnake, type RenderableOrb, type RenderableZone } from './Renderer';
import { ParticleSystem } from './ParticleSystem';
import { InputHandler } from './InputHandler';
import { NetworkClient, type NetworkEventType } from './NetworkClient';
import { ClientPrediction, type PendingInput } from './Prediction';
import { InterpolationBuffer, type SnakeSnapshot } from './Interpolation';
import { HUD, type HUDState } from './HUD';
import { MiniMap, type MiniMapData } from './MiniMap';
import { AudioEngine } from './AudioEngine';
import { PerformanceManager } from './PerformanceManager';
import { ResponsiveLayout } from './ResponsiveLayout';
import { SpectatorMode } from './SpectatorMode';
import { DeathSummary, type DeathStats } from './DeathSummary';
import { AchievementSystem } from './Achievements';
import { DailyChallengeTracker } from './DailyChallenge';
import { Lobby } from './Lobby';
import { Customization, type SkinConfig } from './Customization';
import { AssetLoader } from './AssetLoader';
import { TICK_RATE, BASE_SPEED, BOOST_SPEED, ARENA_RADIUS } from '@snake-king/shared';

// ─── Game State ──────────────────────────────────────────────────────────────

type GameState = 'loading' | 'lobby' | 'playing' | 'dead' | 'spectating';

// ─── GameManager ─────────────────────────────────────────────────────────────

class GameManager {
  // Canvas and rendering
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // Core systems
  private camera!: Camera;
  private renderer!: Renderer;
  private particleSystem!: ParticleSystem;
  private inputHandler!: InputHandler;
  private network!: NetworkClient;
  private prediction!: ClientPrediction;
  private interpolation!: InterpolationBuffer;
  private hud!: HUD;
  private miniMap!: MiniMap;
  private audio!: AudioEngine;
  private performance!: PerformanceManager;
  private layout!: ResponsiveLayout;
  private spectator!: SpectatorMode;
  private deathSummary!: DeathSummary;
  private achievements!: AchievementSystem;
  private dailyChallenge!: DailyChallengeTracker;
  private lobby!: Lobby;
  private customization!: Customization;
  private assetLoader!: AssetLoader;

  // Game state
  private state: GameState = 'loading';
  private mySnakeId: number = -1;
  private playerName: string = '';
  private skinConfig!: SkinConfig;
  private lastFrameTime: number = 0;
  private animFrameId: number = 0;

  // Session stats
  private sessionStartTime: number = 0;
  private eliminations: number = 0;
  private orbsCollected: number = 0;
  private peakMass: number = 0;

  // World state received from server
  private worldSnakes: Map<number, SnakeSnapshot> = new Map();
  private worldOrbs: Map<number, RenderableOrb> = new Map();
  private worldZones: RenderableZone[] = [];

  // Server config
  private serverUrl: string = `ws://${window.location.hostname || 'localhost'}:8080`;

  async init(): Promise<void> {
    // Get canvas element
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element #game-canvas not found');
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;

    // Set initial canvas size
    this.canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    this.canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;

    // Load assets with progress bar
    this.assetLoader = new AssetLoader((progress) => {
      AssetLoader.renderProgressBar(this.ctx, progress, this.canvas.width, this.canvas.height);
    });

    await this.assetLoader.load();

    // Initialize all systems
    this.initSystems();

    // Show lobby
    this.state = 'lobby';
    this.lobby.show();

    // Start the render loop
    this.lastFrameTime = performance.now();
    this.gameLoop(this.lastFrameTime);
  }

  private initSystems(): void {
    const uiRoot = document.getElementById('ui-root')!;

    // Camera and rendering
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.renderer = new Renderer(this.canvas, this.camera);
    this.particleSystem = new ParticleSystem();
    this.performance = new PerformanceManager();
    this.layout = new ResponsiveLayout(this.canvas);

    // Audio
    this.audio = new AudioEngine();

    // Networking
    this.network = new NetworkClient(this.serverUrl);
    this.prediction = new ClientPrediction();
    this.interpolation = new InterpolationBuffer();

    // HUD
    this.hud = new HUD(this.ctx);
    this.miniMap = new MiniMap(this.ctx);

    // Input
    this.inputHandler = new InputHandler(this.canvas, (type, value) => {
      this.handleInput(type, value);
    });

    // Spectator and death
    this.spectator = new SpectatorMode(() => this.returnToLobby());
    this.deathSummary = new DeathSummary(
      () => this.enterSpectatorMode(),
      () => this.returnToLobby(),
    );

    // Achievement & challenges
    this.achievements = new AchievementSystem();
    this.dailyChallenge = new DailyChallengeTracker();

    // Lobby and customization
    this.lobby = new Lobby(uiRoot, (name, mode) => {
      this.startGame(name, mode);
    });

    this.customization = new Customization(uiRoot, (config) => {
      this.skinConfig = config;
    });
    this.skinConfig = this.customization.getConfig();

    // Network event handling
    this.network.on((event: NetworkEventType, data?: unknown) => {
      this.handleNetworkEvent(event, data);
    });

    // Death summary click handling
    this.canvas.addEventListener('click', (e) => {
      if (this.state === 'dead') {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
        const y = (e.clientY - rect.top) * (window.devicePixelRatio || 1);
        this.deathSummary.handleClick(x, y);
      }
    });
  }

  // ─── Game Loop (60fps via requestAnimationFrame) ───────────────────────────

  private gameLoop = (timestamp: number): void => {
    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1); // cap at 100ms
    this.lastFrameTime = timestamp;

    // Update performance monitoring
    this.performance.update(dt);

    switch (this.state) {
      case 'loading':
        // Already handled by asset loader
        break;

      case 'lobby':
        this.renderLobbyBackground(dt);
        break;

      case 'playing':
        this.updatePlaying(dt);
        this.renderPlaying(dt);
        break;

      case 'dead':
        this.renderPlaying(dt); // Keep rendering the world behind
        this.deathSummary.render(this.ctx);
        break;

      case 'spectating':
        this.updateSpectating(dt);
        this.renderPlaying(dt);
        this.spectator.render(this.ctx);
        break;
    }

    // Achievement notifications (always render on top)
    this.achievements.update(dt * 1000);
    this.achievements.renderNotifications(this.ctx);

    this.animFrameId = requestAnimationFrame(this.gameLoop);
  };

  // ─── State: Playing ────────────────────────────────────────────────────────

  private updatePlaying(dt: number): void {
    // Update local prediction
    const mySnake = this.worldSnakes.get(this.mySnakeId);
    if (mySnake) {
      const predicted = this.prediction.predict(
        {
          position: mySnake.position,
          direction: mySnake.direction,
          speed: mySnake.speed,
          isBoosting: mySnake.isBoosting,
        },
        dt,
      );

      // Smooth any correction
      const smoothed = this.prediction.getSmoothedPosition(predicted.position, dt);

      // Update camera to follow predicted position
      this.camera.follow(smoothed, mySnake.mass);

      // Update audio intensity based on nearest snake
      const nearestDist = this.getNearestSnakeDistance();
      this.audio.updateIntensity(nearestDist);

      // Track peak mass
      if (mySnake.mass > this.peakMass) {
        this.peakMass = mySnake.mass;
      }

      // Update input center
      this.inputHandler.updateCenter({
        x: this.canvas.clientWidth / 2,
        y: this.canvas.clientHeight / 2,
      });
    }

    // Clean up interpolation buffer
    this.interpolation.cleanup(performance.now());

    // Update particles
    const quality = this.performance.getSettings();
    this.particleSystem.setDensityMultiplier(quality.particleDensity);
    this.particleSystem.update(dt);

    if (quality.enableParticles) {
      this.particleSystem.updateAmbient(this.camera.getVisibleBounds());
    }

    // Update achievements
    const survivalTime = (performance.now() - this.sessionStartTime) / 1000;
    this.achievements.checkAchievements({
      mass: this.peakMass,
      eliminations: this.eliminations,
      survivalTime,
      orbsCollected: this.orbsCollected,
    });
  }

  private renderPlaying(dt: number): void {
    // Build renderable arrays
    const snakes: RenderableSnake[] = [];
    const orbs: RenderableOrb[] = Array.from(this.worldOrbs.values());
    const renderTime = performance.now();

    for (const [id, snapshot] of this.worldSnakes) {
      if (id === this.mySnakeId) {
        // Use predicted position for local snake
        snakes.push({
          id,
          position: snapshot.position,
          direction: snapshot.direction,
          segments: snapshot.segments,
          mass: snapshot.mass,
          evolutionStage: snapshot.evolutionStage,
          isBoosting: snapshot.isBoosting,
          name: this.playerName,
          primaryColor: this.skinConfig.primaryColor,
          secondaryColor: this.skinConfig.secondaryColor,
        });
      } else {
        // Interpolate remote snakes
        const interpolated = this.interpolation.getInterpolatedState(id, renderTime);
        if (interpolated) {
          snakes.push({
            id,
            position: interpolated.position,
            direction: interpolated.direction,
            segments: interpolated.segments,
            mass: interpolated.mass,
            evolutionStage: interpolated.evolutionStage,
            isBoosting: interpolated.isBoosting,
            name: `Snake_${id}`,
            primaryColor: '#ff6644',
            secondaryColor: '#cc4422',
          });
        }
      }
    }

    // Render the world
    this.renderer.render(dt, snakes, orbs, this.worldZones);

    // Render particles
    this.particleSystem.render(this.ctx, (pos) => this.camera.worldToScreen(pos));

    // Render mobile controls
    this.inputHandler.renderMobileControls(this.ctx);

    // Render HUD (only during playing/spectating)
    if (this.state === 'playing') {
      const mySnake = this.worldSnakes.get(this.mySnakeId);
      if (mySnake) {
        const hudState: HUDState = {
          mass: mySnake.mass,
          peakMass: this.peakMass,
          eliminations: this.eliminations,
          survivalTime: (performance.now() - this.sessionStartTime) / 1000,
          evolutionStage: mySnake.evolutionStage,
          evolutionProgress: this.getEvolutionProgress(mySnake.mass, mySnake.evolutionStage),
          playerRank: 1, // TODO: get from leaderboard
        };
        this.hud.render(hudState);
      }

      // Render mini-map
      const myPos = this.worldSnakes.get(this.mySnakeId)?.position ?? { x: 0, y: 0 };
      const distToEdge = 1 - (Math.sqrt(myPos.x * myPos.x + myPos.y * myPos.y) / ARENA_RADIUS);
      const miniMapData: MiniMapData = {
        playerPosition: myPos,
        nearbySnakes: snakes
          .filter((s) => s.id !== this.mySnakeId)
          .map((s) => ({ position: s.position })),
        zones: this.worldZones.map((z) => ({
          position: z.position,
          radius: z.radius,
          type: z.type,
        })),
        powerOrbs: [],
        distanceToEdge: distToEdge,
      };
      this.miniMap.render(miniMapData);

      // Daily challenge
      this.dailyChallenge.render(this.ctx, 16, this.canvas.height - 110);
    }

    // Crown effect for #1 rank
    const rank1Snake = snakes.length > 0
      ? snakes.reduce((a, b) => (a.mass > b.mass ? a : b))
      : null;
    if (rank1Snake) {
      const headScreen = this.camera.worldToScreen(rank1Snake.position);
      this.layout.renderCrownEffect(this.ctx, headScreen);
    }
  }

  // ─── State: Spectating ─────────────────────────────────────────────────────

  private updateSpectating(dt: number): void {
    const result = this.spectator.update(dt);
    if (result.cameraTarget) {
      this.camera.follow(result.cameraTarget, 100);
    } else {
      // Follow spectated snake
      const targetId = this.spectator.getFollowTarget();
      if (targetId !== null) {
        const snake = this.worldSnakes.get(targetId);
        if (snake) {
          this.camera.follow(snake.position, snake.mass);
        }
      }
    }

    // Keep updating particles
    this.particleSystem.update(dt);
    this.interpolation.cleanup(performance.now());
  }

  // ─── Lobby Background ──────────────────────────────────────────────────────

  private renderLobbyBackground(_dt: number): void {
    // Render a subtle animated background behind the lobby UI
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Subtle grid
    const time = performance.now() / 1000;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;
    const spacing = 60;
    const offset = (time * 10) % spacing;

    this.ctx.beginPath();
    for (let x = -offset; x < this.canvas.width; x += spacing) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    for (let y = -offset; y < this.canvas.height; y += spacing) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    this.ctx.stroke();
  }

  // ─── Game Start/Stop ───────────────────────────────────────────────────────

  private startGame(name: string, _mode: string): void {
    this.playerName = name;
    this.lobby.hide();

    // Initialize audio on first user interaction
    this.audio.init();

    // Connect to server
    this.network.connect();

    // Reset session stats
    this.sessionStartTime = performance.now();
    this.eliminations = 0;
    this.orbsCollected = 0;
    this.peakMass = 0;
    this.worldSnakes.clear();
    this.worldOrbs.clear();

    // Start input handling
    this.inputHandler.start();

    this.state = 'playing';
  }

  private handleDeath(): void {
    this.state = 'dead';
    this.inputHandler.stop();

    const stats: DeathStats = {
      finalMass: this.worldSnakes.get(this.mySnakeId)?.mass ?? 0,
      finalRank: 1, // TODO: get from server
      snakesEliminated: this.eliminations,
      timeSurvived: (performance.now() - this.sessionStartTime) / 1000,
      orbsCollected: this.orbsCollected,
    };

    this.deathSummary.show(stats);
    this.audio.playExplosion(0);
  }

  private enterSpectatorMode(): void {
    this.state = 'spectating';
    const survivingIds = Array.from(this.worldSnakes.keys()).filter(
      (id) => id !== this.mySnakeId,
    );
    this.spectator.start(survivingIds);
  }

  private returnToLobby(): void {
    this.state = 'lobby';
    this.spectator.stop();
    this.network.disconnect();
    this.inputHandler.stop();
    this.worldSnakes.clear();
    this.worldOrbs.clear();
    this.lobby.show();
  }

  // ─── Input Handling ────────────────────────────────────────────────────────

  private handleInput(type: 'direction' | 'boost_start' | 'boost_end', value?: number): void {
    if (this.state !== 'playing') return;

    if (type === 'direction' && value !== undefined) {
      this.network.sendDirection(value);
      this.prediction.addPendingInput({
        sequenceNumber: this.network.getSequenceNumber(),
        type,
        targetDirection: value,
        timestamp: Date.now(),
      });
    } else if (type === 'boost_start') {
      this.network.sendBoostStart();
      this.audio.startBoostSound();
      this.prediction.addPendingInput({
        sequenceNumber: this.network.getSequenceNumber(),
        type,
        timestamp: Date.now(),
      });
    } else if (type === 'boost_end') {
      this.network.sendBoostEnd();
      this.audio.stopBoostSound();
      this.prediction.addPendingInput({
        sequenceNumber: this.network.getSequenceNumber(),
        type,
        timestamp: Date.now(),
      });
    }
  }

  // ─── Network Events ────────────────────────────────────────────────────────

  private handleNetworkEvent(event: NetworkEventType, data?: unknown): void {
    switch (event) {
      case 'connected':
        // Server will assign our snake ID via first state delta
        break;

      case 'disconnected':
        if (this.state === 'playing' || this.state === 'spectating') {
          this.returnToLobby();
        }
        break;

      case 'reconnecting':
        // Show reconnecting indicator (handled passively by HUD)
        break;

      case 'state_delta':
        this.processStateDelta(data);
        break;
    }
  }

  private processStateDelta(data: unknown): void {
    if (!data || typeof data !== 'object') return;

    const delta = data as {
      tick?: number;
      snakes?: Array<{
        id: number;
        position: { x: number; y: number };
        direction: number;
        segments: Array<{ x: number; y: number }>;
        mass: number;
        speed: number;
        isBoosting: boolean;
        evolutionStage: number;
        name: string;
      }>;
      orbs?: Array<{
        id: number;
        position: { x: number; y: number };
        size: number;
        value: number;
        colorIndex: number;
      }>;
      removedSnakeIds?: number[];
      removedOrbIds?: number[];
      powerOrbs?: Array<{
        id: number;
        position: { x: number; y: number };
        type: string;
      }>;
      removedPowerOrbIds?: number[];
    };

    // Process removed snakes
    if (delta.removedSnakeIds) {
      for (const id of delta.removedSnakeIds) {
        this.worldSnakes.delete(id);
        this.interpolation.removeSnake(id);
        if (id === this.mySnakeId) {
          this.handleDeath();
        }
      }
    }

    // Process snake updates
    if (delta.snakes) {
      for (const s of delta.snakes) {
        // Assign our snake ID from the first update (our snake is always included)
        if (this.mySnakeId === -1) {
          this.mySnakeId = s.id;
        }

        const snapshot: SnakeSnapshot = {
          id: s.id,
          position: s.position,
          direction: s.direction,
          segments: s.segments,
          mass: s.mass,
          speed: s.speed,
          isBoosting: s.isBoosting,
          evolutionStage: s.evolutionStage,
          timestamp: performance.now(),
        };

        this.worldSnakes.set(s.id, snapshot);

        if (s.id !== this.mySnakeId) {
          this.interpolation.pushSnapshot(snapshot);
        }
      }
    }

    // Process orbs (full set each tick from interest management)
    if (delta.orbs) {
      const receivedOrbIds = new Set<number>();
      for (const orb of delta.orbs) {
        receivedOrbIds.add(orb.id);
        if (!this.worldOrbs.has(orb.id)) {
          this.worldOrbs.set(orb.id, {
            id: orb.id,
            position: orb.position,
            size: orb.size * 4 + 8,
            colorIndex: orb.colorIndex,
          });
        }
      }
    }

    // Process removed orbs
    if (delta.removedOrbIds) {
      for (const orbId of delta.removedOrbIds) {
        const orb = this.worldOrbs.get(orbId);
        if (orb) {
          this.audio.playOrbCollect(Math.ceil(orb.size / 6));
          this.particleSystem.spawnCollectionEffect(orb.position, '#ffcc44');
          this.orbsCollected++;
          this.worldOrbs.delete(orbId);
        }
      }
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  private getNearestSnakeDistance(): number {
    const mySnake = this.worldSnakes.get(this.mySnakeId);
    if (!mySnake) return Infinity;

    let nearest = Infinity;
    for (const [id, snake] of this.worldSnakes) {
      if (id === this.mySnakeId) continue;
      const dx = snake.position.x - mySnake.position.x;
      const dy = snake.position.y - mySnake.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearest) nearest = dist;
    }
    return nearest;
  }

  private getEvolutionProgress(mass: number, stage: number): number {
    const thresholds = [0, 100, 500, 1500, 5000];
    if (stage >= thresholds.length) return 1;
    const current = thresholds[stage - 1] ?? 0;
    const next = thresholds[stage] ?? thresholds[thresholds.length - 1];
    if (next <= current) return 1;
    return Math.min(1, (mass - current) / (next - current));
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const game = new GameManager();
game.init().catch((err) => {
  console.error('[SnakeKing] Failed to initialize:', err);
});
