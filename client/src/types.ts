// Domain types for the Twinge client

export type GamePhase = 'open' | 'closed' | 'playing' | 'won' | 'lost';

export type Region =
  | 'AU'
  | 'JP'
  | 'SG'
  | 'IN'
  | 'EU'
  | 'UK'
  | 'BR'
  | 'EAST'
  | 'WEST'
  | 'DEFAULT';

export interface GameConfig {
  deckSize: number;
  maxLives: number;
}

export interface PileEvent {
  card: number;
  round: number;
  missed: boolean;
  playerName?: string;
  playerIndex?: number;
}

export interface PublicGameState {
  pile: PileEvent[];
  remaining: number;
  lives: number;
}

export interface GamePlayer {
  playerId: string;
  name: string;
  hand: number[];
  handSize: number;
  strikes: number;
  connected: boolean;
}

export interface GameMeta {
  phase: GamePhase;
  round: number;
}

export interface GameState {
  gameId: string;
  players: GamePlayer[];
  public: PublicGameState;
  meta: GameMeta;
  config: GameConfig;
}

export interface ServerMessage {
  gameId?: string;
  playerId?: string;
  roomCode?: string;
  stateHash?: string;
  gamestate?: GameState;
  code?: number;
  message?: string;
}

export interface AudioSettings {
  mute: boolean;
}

export interface OverlayState {
  message: string;
}

export interface ModalState {
  type: string;
}

export interface AudioRefs {
  ring: HTMLAudioElement;
  buzz: HTMLAudioElement;
}

// The composite state object passed as `state` prop throughout the app
export interface AppState extends Omit<ServerMessage, 'gameId' | 'playerId'> {
  region: Region | null;
  gameId: string | null;
  playerId: string | null;
  createTime: string | null;
  audio: AudioSettings;
  loading: boolean;
  isConnected: boolean;
  overlay: OverlayState;
  modal: ModalState;
  gamestate?: GameState;
  roomCode?: string;
  stateHash?: string;
}

// WebSocket service types
export interface WebSocketCallbacks {
  onConnectionStatus?: (connected: boolean) => void;
  onGameState?: (data: ServerMessage, isBackgroundSync?: boolean) => void;
  onError?: (data: ServerMessage) => void;
  onMaxReconnectReached?: () => void;
  onSessionCleared?: () => void;
}

export interface StoredSession {
  gameId: string;
  playerId: string;
  timestamp: number;
}
