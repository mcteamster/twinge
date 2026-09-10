// Shared type definitions for the Twinge service.
// Centralises the game data shapes and Lambda I/O contracts so handlers,
// helpers, and models import from one place rather than duplicating them.

/** User-customisable game configuration. */
export interface GameConfig {
  deckSize: number;
  maxLives: number;
}

/** Abstract game progression state. */
export interface GameMeta {
  phase: string; // 'open' | 'playing' | 'won' | 'lost' | 'closed'
  round: number;
}

/** A single entry in the public pile (a played or missed card). */
export interface PileEvent {
  time: string;
  card: number | string;
  round: number;
  playerIndex: number;
  playerName?: string;
  missed?: boolean;
}

/** Publicly visible table state. */
export interface PublicState {
  pile: PileEvent[];
  lives: number;
  remaining: number;
}

/** Secret per-game state (deck). */
export interface PrivateState {
  deck: number[];
}

/** Plain-object representation of a player (as stored / rehydrated). */
export interface PlayerData {
  playerId: string;
  connected: boolean;
  strikes: number;
  name: string;
  hand: number[];
  handSize: number;
}

/** Plain-object representation of a full gamestate (as stored / rehydrated). */
export interface GamestateData {
  config: GameConfig;
  meta: GameMeta;
  public: PublicState;
  players: PlayerData[];
  private: PrivateState;
}

/** A row in the connection DynamoDB table. */
export interface ConnectionRecord {
  connectionId: string;
  createTime?: string;
  gameId?: string;
  playerId?: string;
}

/** A row in the game DynamoDB table. */
export interface GameRecord {
  gameId: string;
  createTime?: string;
  expiryTimeEpoch?: number;
  roomCode?: string | null;
  gamestate: GamestateData;
  stateHash?: string;
}

/** Minimal shape of the API Gateway WebSocket Lambda event we consume. */
export interface LambdaEvent {
  requestContext: {
    connectionId: string;
    eventType?: string;
  };
  body?: string;
}

/** Lambda proxy result returned to API Gateway. */
export interface LambdaResult {
  statusCode: number;
  body?: string;
}
