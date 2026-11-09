// Core types for "Who's the Snake King" game
/** Types of collectible power-ups */
export var PowerUpType;
(function (PowerUpType) {
    PowerUpType["Shield"] = "shield";
    PowerUpType["Magnet"] = "magnet";
    PowerUpType["Ghost"] = "ghost";
    PowerUpType["SpeedSurge"] = "speed_surge";
    PowerUpType["MassDrain"] = "mass_drain";
    PowerUpType["FreezeAura"] = "freeze_aura";
})(PowerUpType || (PowerUpType = {}));
/** Types of arena zones */
export var ZoneType;
(function (ZoneType) {
    ZoneType["Speed"] = "speed";
    ZoneType["Danger"] = "danger";
    ZoneType["Bonus"] = "bonus";
    ZoneType["Stealth"] = "stealth";
})(ZoneType || (ZoneType = {}));
/** Available game modes */
export var GameMode;
(function (GameMode) {
    GameMode["Classic"] = "classic";
    GameMode["BattleRoyale"] = "battle_royale";
    GameMode["Team"] = "team";
    GameMode["InfiniteGrowth"] = "infinite_growth";
})(GameMode || (GameMode = {}));
//# sourceMappingURL=types.js.map