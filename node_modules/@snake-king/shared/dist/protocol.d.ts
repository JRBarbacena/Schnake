export declare enum MessageType {
    Join = "join",
    Input = "input",
    Ping = "ping",
    Welcome = "welcome",
    StateDelta = "state_delta",
    FullState = "full_state",
    Pong = "pong",
    Eliminated = "eliminated",
    LeaderboardUpdate = "leaderboard_update"
}
export type InputType = 'direction' | 'boost_start' | 'boost_end';
export interface InputMessage {
    type: InputType;
    targetDirection?: number;
    sequenceNumber: number;
    timestamp: number;
}
//# sourceMappingURL=protocol.d.ts.map