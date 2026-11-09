// @snake-king/shared - Network protocol definitions
// ─── Message Types ───────────────────────────────────────────────────────────
export var MessageType;
(function (MessageType) {
    // Client → Server
    MessageType["Join"] = "join";
    MessageType["Input"] = "input";
    MessageType["Ping"] = "ping";
    // Server → Client
    MessageType["Welcome"] = "welcome";
    MessageType["StateDelta"] = "state_delta";
    MessageType["FullState"] = "full_state";
    MessageType["Pong"] = "pong";
    MessageType["Eliminated"] = "eliminated";
    MessageType["LeaderboardUpdate"] = "leaderboard_update";
})(MessageType || (MessageType = {}));
//# sourceMappingURL=protocol.js.map