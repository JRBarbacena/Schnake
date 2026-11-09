/**
 * AudioEngine - Procedural audio system using Web Audio API
 *
 * Features:
 * - Background music: base exploration layer + intensity layer (crossfade proximity-based)
 * - Sound effects: orb collect, boost whoosh, explosion, evolution fanfare, power-up activation
 * - Volume controls: Music/SFX sliders 0-100%, master mute, persisted in localStorage
 * - Initializes on first user interaction (autoplay policy compliance)
 * - Tab visibility: mute on blur, restore on focus
 */

const STORAGE_KEY = 'snake-king-audio-settings';
const INTENSITY_FADE_IN = 1; // seconds
const INTENSITY_FADE_OUT = 2; // seconds
const INTENSITY_THRESHOLD = 200; // units
const EXPLOSION_MAX_DISTANCE = 500; // units - silent beyond this

export interface AudioSettings {
  musicVolume: number; // 0-1
  sfxVolume: number; // 0-1
  masterMute: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  masterMute: false,
};

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private settings: AudioSettings;
  private initialized: boolean = false;
  private intensityActive: boolean = false;

  // Music nodes
  private baseMusicGain: GainNode | null = null;
  private intensityGain: GainNode | null = null;
  private musicMasterGain: GainNode | null = null;
  private sfxMasterGain: GainNode | null = null;

  // Background music oscillators
  private baseMusicOsc: OscillatorNode | null = null;
  private baseMusicOsc2: OscillatorNode | null = null;
  private intensityOsc: OscillatorNode | null = null;
  private intensityOsc2: OscillatorNode | null = null;

  // Boost sound state
  private boostNoiseSource: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  // Tab visibility state
  private wasPlayingBeforeBlur: boolean = false;

  constructor() {
    this.settings = this.loadSettings();
    this.setupVisibilityHandler();
  }

  /** Initialize audio on first user interaction */
  init(): void {
    if (this.initialized) return;

    try {
      this.audioCtx = new AudioContext();
      this.initialized = true;

      // Create master gain nodes
      this.musicMasterGain = this.audioCtx.createGain();
      this.musicMasterGain.gain.value = this.settings.masterMute ? 0 : this.settings.musicVolume;
      this.musicMasterGain.connect(this.audioCtx.destination);

      this.sfxMasterGain = this.audioCtx.createGain();
      this.sfxMasterGain.gain.value = this.settings.masterMute ? 0 : this.settings.sfxVolume;
      this.sfxMasterGain.connect(this.audioCtx.destination);

      // Create music sub-gains
      this.baseMusicGain = this.audioCtx.createGain();
      this.baseMusicGain.gain.value = 1.0;
      this.baseMusicGain.connect(this.musicMasterGain);

      this.intensityGain = this.audioCtx.createGain();
      this.intensityGain.gain.value = 0;
      this.intensityGain.connect(this.musicMasterGain);

      // Start background music layers
      this.startBackgroundMusic();

      // Resume context if suspended (autoplay policy)
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      console.warn('AudioEngine: Failed to initialize AudioContext', e);
    }
  }

  /** Play orb collection chime (pitch mapped by value 1-5) */
  playOrbCollect(value: number): void {
    if (!this.ensureReady()) return;
    const ctx = this.audioCtx!;

    // Map value 1-5 to frequency 200Hz-800Hz
    const clampedValue = Math.max(1, Math.min(5, value));
    const frequency = 200 + ((clampedValue - 1) / 4) * 600;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxMasterGain!);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  /** Start boost whoosh loop */
  startBoostSound(): void {
    if (!this.ensureReady()) return;
    if (this.boostNoiseSource) return; // already playing

    const ctx = this.audioCtx!;

    // Create noise buffer
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Bandpass filter for whoosh character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;

    this.boostGain = ctx.createGain();
    this.boostGain.gain.setValueAtTime(0, ctx.currentTime);
    this.boostGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);

    source.connect(filter);
    filter.connect(this.boostGain);
    this.boostGain.connect(this.sfxMasterGain!);

    source.start();
    this.boostNoiseSource = source;
  }

  /** Stop boost whoosh loop */
  stopBoostSound(): void {
    if (!this.boostNoiseSource || !this.boostGain || !this.audioCtx) return;

    const ctx = this.audioCtx;
    this.boostGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

    const source = this.boostNoiseSource;
    setTimeout(() => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }, 200);

    this.boostNoiseSource = null;
    this.boostGain = null;
  }

  /** Play explosion at distance (volume attenuated linearly, silent at 500u) */
  playExplosion(distance: number): void {
    if (!this.ensureReady()) return;
    if (distance >= EXPLOSION_MAX_DISTANCE) return;

    const ctx = this.audioCtx!;

    // Linear attenuation: full volume at 0, silent at 500u
    const volumeScale = Math.max(0, 1 - distance / EXPLOSION_MAX_DISTANCE);

    // Create noise burst
    const bufferSize = ctx.sampleRate; // 1 second
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Lowpass filter for rumble
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5 * volumeScale, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxMasterGain!);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.8);
  }

  /** Play evolution fanfare */
  playEvolutionFanfare(): void {
    if (!this.ensureReady()) return;
    const ctx = this.audioCtx!;

    // Ascending tones: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const noteDuration = 0.15;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + i * noteDuration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.sfxMasterGain!);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  /** Play power-up activation sound */
  playPowerUpActivation(type: string): void {
    if (!this.ensureReady()) return;
    const ctx = this.audioCtx!;

    // Short synth arpeggio - vary base frequency by type
    const typeHash = this.hashString(type);
    const baseFreq = 300 + (typeHash % 400); // 300-700Hz range

    const arpNotes = [1, 1.25, 1.5, 2]; // ratio intervals
    const noteDuration = 0.08;

    arpNotes.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = baseFreq * ratio;

      const startTime = ctx.currentTime + i * noteDuration;
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.sfxMasterGain!);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  /** Update intensity layer based on proximity */
  updateIntensity(nearestSnakeDistance: number): void {
    if (!this.audioCtx || !this.intensityGain) return;

    const ctx = this.audioCtx;
    const shouldBeActive = nearestSnakeDistance <= INTENSITY_THRESHOLD;

    if (shouldBeActive && !this.intensityActive) {
      // Fade in intensity layer over 1 second
      this.intensityActive = true;
      this.intensityGain.gain.cancelScheduledValues(ctx.currentTime);
      this.intensityGain.gain.setValueAtTime(this.intensityGain.gain.value, ctx.currentTime);
      this.intensityGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + INTENSITY_FADE_IN);
    } else if (!shouldBeActive && this.intensityActive) {
      // Fade out intensity layer over 2 seconds
      this.intensityActive = false;
      this.intensityGain.gain.cancelScheduledValues(ctx.currentTime);
      this.intensityGain.gain.setValueAtTime(this.intensityGain.gain.value, ctx.currentTime);
      this.intensityGain.gain.linearRampToValueAtTime(0, ctx.currentTime + INTENSITY_FADE_OUT);
    }
  }

  /** Set music volume (0-1) */
  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicMasterGain && !this.settings.masterMute) {
      this.musicMasterGain.gain.value = this.settings.musicVolume;
    }
    this.saveSettings();
  }

  /** Set SFX volume (0-1) */
  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxMasterGain && !this.settings.masterMute) {
      this.sfxMasterGain.gain.value = this.settings.sfxVolume;
    }
    this.saveSettings();
  }

  /** Toggle master mute */
  toggleMute(): void {
    this.settings.masterMute = !this.settings.masterMute;
    this.applyMuteState();
    this.saveSettings();
  }

  /** Get current settings */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  // --- Private helpers ---

  private ensureReady(): boolean {
    if (!this.initialized || !this.audioCtx) return false;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return true;
  }

  private startBackgroundMusic(): void {
    if (!this.audioCtx || !this.baseMusicGain || !this.intensityGain) return;
    const ctx = this.audioCtx;

    // Base exploration layer: soft ambient pad using detuned oscillators
    this.baseMusicOsc = ctx.createOscillator();
    this.baseMusicOsc.type = 'sine';
    this.baseMusicOsc.frequency.value = 110; // A2
    this.baseMusicOsc.connect(this.baseMusicGain);
    this.baseMusicOsc.start();

    this.baseMusicOsc2 = ctx.createOscillator();
    this.baseMusicOsc2.type = 'sine';
    this.baseMusicOsc2.frequency.value = 165; // E3 (perfect fifth)
    this.baseMusicOsc2.detune.value = 5; // slight detune for width
    const baseGain2 = ctx.createGain();
    baseGain2.gain.value = 0.6;
    this.baseMusicOsc2.connect(baseGain2);
    baseGain2.connect(this.baseMusicGain);
    this.baseMusicOsc2.start();

    // Intensity layer: higher tension tones
    this.intensityOsc = ctx.createOscillator();
    this.intensityOsc.type = 'sawtooth';
    this.intensityOsc.frequency.value = 220; // A3
    const intensityFilter = ctx.createBiquadFilter();
    intensityFilter.type = 'lowpass';
    intensityFilter.frequency.value = 600;
    this.intensityOsc.connect(intensityFilter);
    intensityFilter.connect(this.intensityGain);
    this.intensityOsc.start();

    this.intensityOsc2 = ctx.createOscillator();
    this.intensityOsc2.type = 'sawtooth';
    this.intensityOsc2.frequency.value = 277.18; // C#4 (tritone for tension)
    this.intensityOsc2.detune.value = -10;
    const intensityGain2 = ctx.createGain();
    intensityGain2.gain.value = 0.5;
    this.intensityOsc2.connect(intensityGain2);
    intensityGain2.connect(this.intensityGain);
    this.intensityOsc2.start();

    // Set overall base music volume low for ambient feel
    this.baseMusicGain.gain.value = 0.15;
  }

  private applyMuteState(): void {
    if (this.musicMasterGain) {
      this.musicMasterGain.gain.value = this.settings.masterMute ? 0 : this.settings.musicVolume;
    }
    if (this.sfxMasterGain) {
      this.sfxMasterGain.gain.value = this.settings.masterMute ? 0 : this.settings.sfxVolume;
    }
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Mute on blur
        this.wasPlayingBeforeBlur = !this.settings.masterMute;
        if (this.musicMasterGain) this.musicMasterGain.gain.value = 0;
        if (this.sfxMasterGain) this.sfxMasterGain.gain.value = 0;
      } else {
        // Restore on focus
        if (this.wasPlayingBeforeBlur) {
          this.applyMuteState();
        }
      }
    });
  }

  private loadSettings(): AudioSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AudioSettings>;
        return {
          musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : DEFAULT_SETTINGS.musicVolume,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULT_SETTINGS.sfxVolume,
          masterMute: typeof parsed.masterMute === 'boolean' ? parsed.masterMute : DEFAULT_SETTINGS.masterMute,
        };
      }
    } catch {
      // localStorage unavailable or corrupted
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // localStorage unavailable
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
