// play.test.js
// Uses vi.spyOn on the handler's exported _testDeps object to intercept
// dependency calls without module-system mocking. Matches the _testClient
// pattern used in connections.test.js and games.test.js.
//
// Gamestate and Player constructors are replaced on _testDeps per-test so
// that action functions (which read _deps.Gamestate at call time) get the spy.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import playHandlerModule from '../src/handlers/play.js';

const { handler, _testDeps } = playHandlerModule;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGamestateSpy(overrides = {}) {
  return {
    addPlayer: vi.fn().mockResolvedValue('new-player-id'),
    findPlayer: vi.fn().mockResolvedValue({ playerId: 'p1', handSize: 1, hand: [5] }),
    kickPlayer: vi.fn().mockResolvedValue(undefined),
    setupGame: vi.fn(),
    setupRound: vi.fn(),
    playCard: vi.fn(),
    checkConnections: vi.fn(),
    restartGame: vi.fn(),
    meta: { phase: 'open', round: 0 },
    public: { pile: [], lives: 5, remaining: 100 },
    players: [{ playerId: 'p1', handSize: 1, hand: [5] }],
    config: { deckSize: 100, maxLives: 5 },
    private: { deck: [] },
    ...overrides,
  };
}

function makeEvent(actionType, body = {}) {
  return {
    requestContext: { connectionId: 'conn-test' },
    body: JSON.stringify({
      actionType,
      gameId: body.gameId !== undefined ? body.gameId : 'game-1',
      playerId: body.playerId !== undefined ? body.playerId : 'p1',
      roomCode: body.roomCode ?? undefined,
      stateHash: body.stateHash ?? 'hash-abc',
      name: body.name ?? undefined,
      config: body.config ?? undefined,
      target: body.target ?? undefined,
    }),
  };
}

// Saved original constructors for restore after each test
const OriginalGamestate = _testDeps.Gamestate;
const OriginalPlayer = _testDeps.Player;

describe('play handler', () => {
  beforeEach(() => {
    // Restore all spies on helper objects and reset constructor stubs
    vi.restoreAllMocks();
    _testDeps.Gamestate = OriginalGamestate;
    _testDeps.Player = OriginalPlayer;

    // Default stubs for helpers (tests override per-scenario as needed)
    vi.spyOn(_testDeps.messages, 'send').mockResolvedValue(undefined);
    vi.spyOn(_testDeps.messages, 'broadcastGame').mockResolvedValue(undefined);
    vi.spyOn(_testDeps.connections, 'updateConnection').mockResolvedValue({ Attributes: {} });
    vi.spyOn(_testDeps.connections, 'findConnections').mockResolvedValue([{ connectionId: 'conn-test', playerId: 'p1' }]);
  });

  afterEach(() => {
    // Ensure constructors are always restored even if a test throws
    _testDeps.Gamestate = OriginalGamestate;
    _testDeps.Player = OriginalPlayer;
  });

  // ─── 5.10: Entry point always returns ACK ────────────────────────────────

  describe('entry point ACK (5.10)', () => {
    it('returns { statusCode: 200, body: ack } for a valid action', async () => {
      const spy = makeGamestateSpy();
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      vi.spyOn(_testDeps.games, 'createGame').mockResolvedValue({ gameId: 'game-1', gamestate: spy });

      const result = await handler(makeEvent('new', { gameId: undefined }));
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ code: 0, message: 'ack' }),
      });
    });
  });

  // ─── 5.3: new action ─────────────────────────────────────────────────────

  describe('"new" action (5.3)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy();
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      vi.spyOn(_testDeps.games, 'createGame').mockResolvedValue({ gameId: 'game-1', gamestate: spy });
    });

    it('calls games.createGame', async () => {
      await handler(makeEvent('new', { gameId: undefined }));
      expect(_testDeps.games.createGame).toHaveBeenCalledTimes(1);
    });

    it('calls connections.updateConnection twice (gameId, playerId)', async () => {
      await handler(makeEvent('new', { gameId: undefined }));
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledTimes(2);
    });

    it('calls messages.send to creator', async () => {
      await handler(makeEvent('new', { gameId: undefined }));
      expect(_testDeps.messages.send).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 5.4: join action — valid roomCode ───────────────────────────────────

  describe('"join" action — valid roomCode (5.4)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1', handSize: 0, hand: [] });
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'findGames').mockResolvedValue([game]);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
    });

    it('calls messages.broadcastGame after joining', async () => {
      await handler(makeEvent('join', { gameId: undefined, roomCode: 'ABCD' }));
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 5.5: join — unknown roomCode ────────────────────────────────────────

  describe('"join" action — unknown roomCode (5.5)', () => {
    beforeEach(() => {
      vi.spyOn(_testDeps.games, 'findGames').mockResolvedValue([]);
    });

    it('sends error code 2 when game not found', async () => {
      await handler(makeEvent('join', { gameId: undefined, roomCode: 'XXXX' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });
  });

  // ─── 5.6: start action ───────────────────────────────────────────────────

  describe('"start" action (5.6)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'open' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
    });

    it('calls gamestate.setupGame', async () => {
      await handler(makeEvent('start'));
      expect(spy.setupGame).toHaveBeenCalledTimes(1);
    });

    it('calls gamestate.setupRound', async () => {
      await handler(makeEvent('start'));
      expect(spy.setupRound).toHaveBeenCalledTimes(1);
    });

    it('calls messages.broadcastGame', async () => {
      await handler(makeEvent('start'));
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });
  });

  describe('"start" action — missing gameId (5.9)', () => {
    it('sends error code 1 when no gameId provided', async () => {
      await handler(makeEvent('start', { gameId: null }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
    });
  });

  // ─── 5.7: twinge action ──────────────────────────────────────────────────

  describe('"twinge" action (5.7)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1', handSize: 1, hand: [5] });
      _testDeps.Gamestate = function() { return spy; };
    });

    describe('valid play (matching stateHash)', () => {
      beforeEach(() => {
        const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'playing' } } };
        vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
        vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      });

      it('calls gamestate.playCard', async () => {
        await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
        expect(spy.playCard).toHaveBeenCalledTimes(1);
      });

      it('calls messages.broadcastGame', async () => {
        await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
        expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      });
    });

    describe('stale stateHash (5.7)', () => {
      beforeEach(() => {
        const game = { gameId: 'game-1', stateHash: 'different-hash', gamestate: { meta: { phase: 'playing' } } };
        vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      });

      it('sends error code 5 when stateHash does not match', async () => {
        await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
        expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      });
    });

    describe('empty hand (5.7)', () => {
      beforeEach(() => {
        spy.findPlayer.mockResolvedValue({ playerId: 'p1', handSize: 0, hand: [] });
        const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'playing' } } };
        vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      });

      it('sends error code 4 when hand is empty', async () => {
        await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
        expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 4 }));
      });
    });

    describe('missing gameId (5.9)', () => {
      it('sends error code 1 when no gameId provided', async () => {
        await handler(makeEvent('twinge', { gameId: null }));
        expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
      });
    });
  });

  // ─── 5.8: next action ────────────────────────────────────────────────────

  describe('"next" action (5.8)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      _testDeps.Gamestate = function() { return spy; };
    });

    describe('all hands empty', () => {
      beforeEach(() => {
        spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
        spy.players = [{ playerId: 'p1', hand: [], handSize: 0 }];
        const game = { gameId: 'game-1', gamestate: { meta: { phase: 'playing' }, players: [{ hand: [] }] } };
        vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
        vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      });

      it('calls gamestate.setupRound when all hands are empty', async () => {
        await handler(makeEvent('next'));
        expect(spy.setupRound).toHaveBeenCalledTimes(1);
      });

      it('calls messages.broadcastGame', async () => {
        await handler(makeEvent('next'));
        expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      });
    });

    describe('round in progress (5.8)', () => {
      beforeEach(() => {
        spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
        spy.players = [{ playerId: 'p1', hand: [5, 10], handSize: 2 }];
        const game = { gameId: 'game-1', gamestate: { meta: { phase: 'playing' }, players: [{ hand: [5, 10] }] } };
        vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      });

      it('sends error code 6 when round is still in progress', async () => {
        await handler(makeEvent('next'));
        expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 6 }));
      });
    });

    describe('missing gameId (5.9)', () => {
      it('sends error code 1 when no gameId provided', async () => {
        await handler(makeEvent('next', { gameId: null }));
        expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
      });
    });
  });

  // ─── 5.9: leave — missing gameId ─────────────────────────────────────────

  describe('"leave" action — missing gameId (5.9)', () => {
    it('sends error code 1 when no gameId provided', async () => {
      await handler(makeEvent('leave', { gameId: null }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
    });
  });
});
