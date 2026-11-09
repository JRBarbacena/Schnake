// Core types for "Who's the Snake King" game

/** 2D vector / point */
export interface Vec2 {
  x: number;
  y: number;
}

/** Types of collectible power-ups */
export enum PowerUpType {
  Shield = 'shield',
  Magnet = 'magnet',
  Ghost = 'ghost',
  SpeedSurge = 'speed_surge',
  MassDrain = 'mass_drain',
  FreezeAura = 'freeze_aura',
}

/** Types of arena zones */
export enum ZoneType {
  Speed = 'speed',
  Danger = 'danger',
  Bonus = 'bonus',
  Stealth = 'stealth',
}

/** Available game modes */
export enum GameMode {
  Classic = 'classic',
  BattleRoyale = 'battle_royale',
  Team = 'team',
  InfiniteGrowth = 'infinite_growth',
}
