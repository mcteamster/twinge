import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameWebSocket } from './gameWebSocket';
import { ENDPOINTS } from '../constants/constants';
import type { MockWebSocket as MockWebSocketType } from '../../vitest.setup';
import type { WebSocketCallbacks, ServerMessage } from '../types';

// The global WebSocket is replaced by MockWebSocket in vitest.setup.ts.
const MockWebSocket = globalThis.WebSocket as unknown as typeof MockWebSocketType;

function makeCallbacks(): Required<WebSocketCallbacks> {
  return {
    onConnectionStatus: vi.fn(),
    onGameState: vi.fn(),
    onError: vi.fn(),
    onMaxReconnectReached: vi.fn(),
    onSessionCleared: vi.fn(),
  };
}

describe('GameWebSocket', () => {
  let callbacks: Required<WebSocketCallbacks>;
  let service: GameWebSocket;

  beforeEach(() => {
    callbacks = makeCallbacks();
    service = new GameWebSocket(callbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 2.2 — public API surface (the real service exposes connect/disconnect/send;
  // there is no createGameWebSocket factory or reconnect() method in the source,
  // so this asserts the actual methods the class provides).
  it('exposes send, disconnect, and connect methods', () => {
    expect(typeof service.send).toBe('function');
    expect(typeof service.disconnect).toBe('function');
    expect(typeof service.connect).toBe('function');
  });

  // 2.3 — connecting creates a WebSocket with the endpoint URL derived from the
  // stored region (construction is triggered by connect(), not the constructor).
  it('creates a WebSocket at the correct endpoint URL on connect', () => {
    localStorage.setItem('region', 'AU');
    void service.connect();
    const sock = MockWebSocket.last()!;
    expect(sock).toBeDefined();
    expect(sock.url).toBe(ENDPOINTS.AU);
  });

  it('falls back to the DEFAULT endpoint when no region is stored', () => {
    void service.connect();
    expect(MockWebSocket.last()!.url).toBe(ENDPOINTS.DEFAULT);
  });

  // 2.4 — onopen fires onConnectionStatus(true)
  it('calls onConnectionStatus(true) when the socket opens', () => {
    void service.connect();
    MockWebSocket.last()!.triggerOpen();
    expect(callbacks.onConnectionStatus).toHaveBeenCalledWith(true);
  });

  // 2.5 — onclose fires onConnectionStatus(false) and schedules a reconnect
  it('calls onConnectionStatus(false) and schedules a reconnect on abnormal close', () => {
    vi.useFakeTimers();
    void service.connect();
    const sock = MockWebSocket.last()!;
    sock.triggerOpen();
    callbacks.onConnectionStatus.mockClear();

    sock.triggerClose(1006, 'network'); // non-1000 => reconnect
    expect(callbacks.onConnectionStatus).toHaveBeenCalledWith(false);
    expect(service.reconnectAttempts).toBe(1);

    // A reconnect timer was scheduled and opens a fresh socket when it fires.
    const before = MockWebSocket.instances.length;
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(before + 1);
  });

  it('does not reconnect on a normal (code 1000) close', () => {
    void service.connect();
    const sock = MockWebSocket.last()!;
    sock.triggerOpen();
    sock.triggerClose(1000, 'client disconnect');
    expect(service.reconnectAttempts).toBe(0);
  });

  // 2.6 — onmessage with a game state routes to onGameState
  it('routes a valid game-state message to onGameState', () => {
    void service.connect();
    const state: ServerMessage = {
      gameId: 'G1',
      roomCode: 'TWNG',
      gamestate: {
        gameId: 'G1',
        players: [],
        public: { pile: [], remaining: 0, lives: 5 },
        meta: { phase: 'open', round: 0 },
        config: { deckSize: 67, maxLives: 5 },
      },
    };
    MockWebSocket.last()!.triggerMessage(state);
    expect(callbacks.onGameState).toHaveBeenCalledTimes(1);
    expect(callbacks.onGameState.mock.calls[0][0]).toMatchObject({ gameId: 'G1' });
  });

  it('ignores ack messages (code 0, message "ack")', () => {
    void service.connect();
    MockWebSocket.last()!.triggerMessage({ code: 0, message: 'ack' });
    expect(callbacks.onGameState).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  // 2.7 — onmessage with a non-zero error code routes to onError
  it('routes an error-code message to onError', () => {
    void service.connect();
    const err: ServerMessage = { code: 404, message: 'game not found' };
    MockWebSocket.last()!.triggerMessage(err);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError.mock.calls[0][0]).toMatchObject({ code: 404 });
    expect(callbacks.onGameState).not.toHaveBeenCalled();
  });

  it('swallows unparseable messages without throwing', () => {
    void service.connect();
    expect(() => MockWebSocket.last()!.triggerMessage('not-json{')).not.toThrow();
    expect(callbacks.onGameState).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  // 2.8 — reconnect backoff: after max attempts, onMaxReconnectReached fires and it stops
  it('calls onMaxReconnectReached and stops after max reconnect attempts', () => {
    // Force the service past its max attempts, then trigger one more reconnect.
    // maxReconnectAttempts is 5 (private); drive attemptReconnect directly.
    (service as unknown as { reconnectAttempts: number }).reconnectAttempts = 5;
    service.attemptReconnect();
    expect(callbacks.onMaxReconnectReached).toHaveBeenCalledTimes(1);
    // No new socket should be opened once the cap is hit.
    expect(MockWebSocket.instances.length).toBe(0);
  });

  // 2.9 — session persisted on setGameSession; cleared on clearSession, firing onSessionCleared
  it('persists the session to storage and clears it, firing onSessionCleared', () => {
    service.setGameSession('G7', 'P3');
    const stored = JSON.parse(localStorage.getItem('twinge-session')!);
    expect(stored).toMatchObject({ gameId: 'G7', playerId: 'P3' });
    expect(typeof stored.timestamp).toBe('number');
    expect(service.gameId).toBe('G7');

    service.clearSession();
    expect(localStorage.getItem('twinge-session')).toBeNull();
    expect(service.gameId).toBeNull();
    expect(callbacks.onSessionCleared).toHaveBeenCalledTimes(1);
  });

  it('loadSession returns a fresh session and drops an expired one', () => {
    service.setGameSession('G7', 'P3');
    expect(service.loadSession()).toMatchObject({ gameId: 'G7', playerId: 'P3' });

    // Older than the 12h TTL => cleared and null.
    localStorage.setItem(
      'twinge-session',
      JSON.stringify({ gameId: 'G8', playerId: 'P9', timestamp: Date.now() - 43200001 }),
    );
    expect(service.loadSession()).toBeNull();
    expect(localStorage.getItem('twinge-session')).toBeNull();
  });

  // 2.10 — disconnect() closes the socket with code 1000 and prevents reconnect
  it('disconnect() closes the socket and prevents reconnect', () => {
    vi.useFakeTimers();
    void service.connect();
    const sock = MockWebSocket.last()!;
    sock.triggerOpen();

    service.disconnect();
    expect(sock.close).toHaveBeenCalledWith(1000, 'Client disconnecting');
    expect(service.reconnectAttempts).toBe(0);

    // No pending reconnect timer opens a new socket after disconnect.
    const before = MockWebSocket.instances.length;
    vi.advanceTimersByTime(5000);
    expect(MockWebSocket.instances.length).toBe(before);
  });
});
