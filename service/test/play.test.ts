// play.test.js
// Uses vi.spyOn on the handler's exported _testDeps object to intercept
// dependency calls without module-system mocking. Matches the _testClient
// pattern used in connections.test.js and games.test.js.
//
// Gamestate and Player constructors are replaced on _testDeps per-test so
// that action functions (which read _deps.Gamestate at call time) get the spy.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import playHandlerModule from '../src/handlers/play';

const { handler, _testDeps } = playHandlerModule as { handler: typeof playHandlerModule.handler; _testDeps: any };

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGamestateSpy(overrides: any = {}) {
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

function makeEvent(actionType: string, body: any = {}) {
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
    vi.spyOn(_testDeps.analytics, 'writeAnalytics').mockResolvedValue(undefined);
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

  // ─── join — IDOR fix (server-assigned identity) ──────────────────────────

  describe('"join" action — IDOR fix', () => {
    it('joining with a playerId matching an existing player still creates a new player', async () => {
      const spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 }, activePlayerCount: 1 });
      // Simulate a game that already contains the claimed player id.
      spy.findPlayer.mockResolvedValue({ playerId: 'existing-player', handSize: 0, hand: [] });
      spy.addPlayer.mockResolvedValue('server-assigned-id');
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('join', { gameId: 'game-1', playerId: 'existing-player' }));

      // A fresh player is always created regardless of the supplied playerId.
      expect(spy.addPlayer).toHaveBeenCalledTimes(1);
      // The connection is linked to the server-assigned id, not the claimed one.
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-test', 'playerId', 'server-assigned-id');
      expect(_testDeps.connections.updateConnection).not.toHaveBeenCalledWith('conn-test', 'playerId', 'existing-player');
    });

    it('joining without a playerId still creates a new player successfully', async () => {
      const spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 }, activePlayerCount: 0 });
      spy.findPlayer.mockResolvedValue({ playerId: 'server-assigned-id', handSize: 0, hand: [] });
      spy.addPlayer.mockResolvedValue('server-assigned-id');
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('join', { gameId: 'game-1', playerId: null }));

      expect(spy.addPlayer).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('client-supplied playerId is discarded even when game is not in open/playing phase', async () => {
      // A game in 'won' or 'lost' phase: addPlayer is NOT called (no new join),
      // but the client-supplied playerId must NOT be used for findPlayer — it
      // must have been nulled before the findPlayer call so the result is
      // 'Player not found' (code 3) rather than silently linking the connection
      // to the claimed identity.
      const spy = makeGamestateSpy({ meta: { phase: 'won', round: 3 }, activePlayerCount: 2 });
      // findPlayer: when called with null/undefined should return undefined (no match)
      spy.findPlayer.mockImplementation(async (id: string | null) => {
        if (id === 'existing-player') return { playerId: 'existing-player' };
        return undefined;
      });
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('join', { gameId: 'game-1', playerId: 'existing-player' }));

      // addPlayer must NOT be called (game is not open/playing)
      expect(spy.addPlayer).not.toHaveBeenCalled();
      // The connection must NOT be linked to the claimed playerId
      expect(_testDeps.connections.updateConnection).not.toHaveBeenCalledWith('conn-test', 'playerId', 'existing-player');
      // Should have sent error code 3 (player not found) because playerId was nulled
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── join — player cap enforcement ───────────────────────────────────────

  describe('"join" action — player cap', () => {
    it('sends error code 8 and does not add a player when the game is full', async () => {
      const spy = makeGamestateSpy({
        meta: { phase: 'open', round: 0 },
        config: { deckSize: 100, maxLives: 5, maxPlayers: 12 },
        activePlayerCount: 12,
      });
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('join', { gameId: 'game-1', playerId: null }));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 8 }));
      expect(spy.addPlayer).not.toHaveBeenCalled();
    });

    it('adds a player when the game has capacity', async () => {
      const spy = makeGamestateSpy({
        meta: { phase: 'open', round: 0 },
        config: { deckSize: 100, maxLives: 5, maxPlayers: 12 },
        activePlayerCount: 11,
      });
      spy.findPlayer.mockResolvedValue({ playerId: 'new-player-id', handSize: 0, hand: [] });
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('join', { gameId: 'game-1', playerId: null }));

      expect(spy.addPlayer).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.send).not.toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 8 }));
    });

    it('does not count spectators (strikes === -1) toward the cap', async () => {
      // Real Gamestate to exercise the activePlayerCount getter: 12 spectators
      // plus 1 active player — activePlayerCount is 1, so a join succeeds.
      const players = Array.from({ length: 12 }, (_, i) => ({
        playerId: `spec-${i}`, connected: true, strikes: -1, name: `S${i}`, hand: [], handSize: 0,
      }));
      players.push({ playerId: 'active-1', connected: true, strikes: 0, name: 'A1', hand: [], handSize: 0 });
      const gs = new OriginalGamestate({
        config: { deckSize: 100, maxLives: 5, maxPlayers: 12 },
        meta: { phase: 'open', round: 0 },
        public: { pile: [], lives: 5, remaining: 100 },
        players,
        private: { deck: [] },
      });
      _testDeps.Gamestate = function() { return gs; };
      _testDeps.Player = OriginalPlayer;
      const game = { gameId: 'game-1', gamestate: gs };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      const beforeCount = gs.players.length;
      await handler(makeEvent('join', { gameId: 'game-1', playerId: null }));

      // A new active player was added, not rejected as full.
      expect(gs.players.length).toBe(beforeCount + 1);
      expect(_testDeps.messages.send).not.toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 8 }));
    });
  });

  // ─── 5.6: start action ───────────────────────────────────────────────────

  describe('"start" action (5.6)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'open' } } };
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

    describe('valid play (matching stateHash — atomic write succeeds)', () => {
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

      it('passes stateHash as expectedHash to updateGame', async () => {
        await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
        expect(_testDeps.games.updateGame).toHaveBeenCalledWith(
          'game-1',
          expect.anything(),
          'hash-abc',
        );
      });

      it('does NOT call readGame a second time after the initial read', async () => {
        await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
        // Only one readGame call: the initial game fetch. The second redundant
        // readGame that used to be present has been removed.
        expect(_testDeps.games.readGame).toHaveBeenCalledTimes(1);
      });
    });

    describe('stale stateHash — atomic write rejected (409 from updateGame) (5.7)', () => {
      beforeEach(() => {
        const game = { gameId: 'game-1', stateHash: 'current-hash', gamestate: { meta: { phase: 'playing' } } };
        vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
        // updateGame returns 409 to signal ConditionalCheckFailedException
        vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(409);
      });

      it('sends error code 5 when updateGame returns 409', async () => {
        await handler(makeEvent('twinge', { stateHash: 'stale-hash' }));
        expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      });

      it('does NOT call broadcastGame when write is rejected', async () => {
        await handler(makeEvent('twinge', { stateHash: 'stale-hash' }));
        expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
      });

      it('does NOT call readGame a second time', async () => {
        await handler(makeEvent('twinge', { stateHash: 'stale-hash' }));
        expect(_testDeps.games.readGame).toHaveBeenCalledTimes(1);
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
        const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'playing' }, players: [{ hand: [] }] } };
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

  // ─── twg-14: handler-level error handling ────────────────────────────────

  describe('unknown / missing action type (code 9)', () => {
    it('returns { statusCode: 200 } and sends code 9 for an unknown actionType', async () => {
      const result = await handler(makeEvent('bogus'));
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ code: 9, message: 'Unknown action type' }),
      });
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 9 }));
    });

    it('returns { statusCode: 200 } and sends code 9 when actionType is undefined', async () => {
      // Build an event whose parsed body has no actionType field.
      const event = {
        requestContext: { connectionId: 'conn-test' },
        body: JSON.stringify({ gameId: 'game-1', playerId: 'p1' }),
      };
      const result = await handler(event as any);
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ code: 9, message: 'Unknown action type' }),
      });
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 9 }));
    });

    it('returns { statusCode: 200 } and sends code 9 for a prototype-inherited key (e.g. constructor)', async () => {
      // 'constructor' is inherited from Object.prototype and passes an `in` check on any plain
      // object literal. The guard uses Object.hasOwn to exclude such keys; this test confirms
      // the prototype-chain bypass is closed and the correct error code is returned.
      const result = await handler(makeEvent('constructor'));
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ code: 9, message: 'Unknown action type' }),
      });
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 9 }));
    });
  });

  describe('internal error (code 8)', () => {
    it('returns { statusCode: 200 } and sends code 8 when a known action handler throws', async () => {
      // A valid "start" action that reaches broadcastGame, which is made to reject.
      const spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'open' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      // Silence the intentional console.error from the catch block.
      vi.spyOn(console, 'error').mockImplementation(() => {});
      // broadcastGame rejects unexpectedly for an otherwise-valid action.
      (_testDeps.messages.broadcastGame as any).mockRejectedValue(new Error('boom'));

      const result = await handler(makeEvent('start'));
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ code: 8, message: 'Internal server error' }),
      });
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 8 }));
    });
  });

  // ─── 3.4: broadcastGame — null playerId must not match any player ─────────

  describe('broadcastGame null playerId isolation (3.4)', () => {
    it('a connection with playerId null does not receive any player hand or playerId', async () => {
      // Restore beforeEach stubs so we can set up fresh spies for this test
      vi.restoreAllMocks();

      // messages.broadcastGame internally calls connections.findConnections.
      // Because _testDeps.connections is the same imported module object,
      // spying on it here mutates the property in place and is visible to messages.ts.
      vi.spyOn(_testDeps.connections, 'findConnections').mockResolvedValue([
        { connectionId: 'conn-null', playerId: null },
      ]);

      // Spy on the API Gateway client to capture what payload was posted
      const sentPayloads: Array<{ connId: string; data: unknown }> = [];
      vi.spyOn(_testDeps.messages._testClient, 'postToConnection').mockImplementation(({ ConnectionId, Data }: any) => {
        sentPayloads.push({ connId: ConnectionId, data: JSON.parse(Data) });
        return Promise.resolve({});
      });

      const fakeGame = {
        gameId: 'game-1',
        gamestate: {
          private: { deck: [] },
          players: [
            { playerId: 'real-player', hand: [42, 99], handSize: 2, connected: true, strikes: 0, name: 'CAT' },
          ],
          meta: { phase: 'playing', round: 1 },
          public: { pile: [], lives: 5, remaining: 80 },
          config: { deckSize: 100, maxLives: 5 },
        },
      };

      await _testDeps.messages.broadcastGame(fakeGame);

      // One postToConnection call (one connection)
      expect(sentPayloads.length).toBe(1);
      expect(sentPayloads[0].connId).toBe('conn-null');
      const sent = sentPayloads[0].data as any;
      // null !== 'real-player' (strict), so the player's hand and playerId are stripped
      const player = sent.gamestate.players[0];
      expect(player.hand).toBeUndefined();
      expect(player.playerId).toBeUndefined();
    });
  });

  // ─── 1: rejoin action ────────────────────────────────────────────────────

  describe('"rejoin" action', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1', handSize: 1, hand: [5] });
      _testDeps.Gamestate = function() { return spy; };
      _testDeps.Player = function() { return {}; };
      // Default connection record: no stored playerId (falls back to body value)
      vi.spyOn(_testDeps.connections, 'readConnection').mockResolvedValue({ connectionId: 'conn-test', playerId: '-1' });
    });

    it('happy path — game and player exist, broadcastGame is called (1.2)', async () => {
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('rejoin', { gameId: 'game-1', playerId: 'p1' }));

      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('IDOR mitigation — uses server-stored playerId over body value (1.3)', async () => {
      // Connection record holds a stored playerId that differs from the body value.
      (_testDeps.connections.readConnection as any).mockResolvedValue({ connectionId: 'conn-test', playerId: 'stored-player' });
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('rejoin', { gameId: 'game-1', playerId: 'attacker-supplied' }));

      // findPlayer must be called with the server-stored id, never the body value.
      expect(spy.findPlayer).toHaveBeenCalledWith('stored-player');
      expect(spy.findPlayer).not.toHaveBeenCalledWith('attacker-supplied');
      // The connection is linked to the server-stored id.
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-test', 'playerId', 'stored-player');
    });

    it('falls back to body-supplied playerId when connection has no stored playerId (1.4)', async () => {
      // Default readConnection returns playerId '-1' — handler keeps the body value.
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('rejoin', { gameId: 'game-1', playerId: 'body-player' }));

      expect(spy.findPlayer).toHaveBeenCalledWith('body-player');
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-test', 'playerId', 'body-player');
    });

    it('sends code 1 when both gameId and playerId are absent (1.5)', async () => {
      await handler(makeEvent('rejoin', { gameId: null, playerId: null }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
    });

    it('sends code 2 when readGame does not return a valid GameRecord (1.6)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(500);
      await handler(makeEvent('rejoin', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 3 when findPlayer returns falsy (1.7)', async () => {
      spy.findPlayer.mockResolvedValue(undefined);
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('rejoin', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── 2: rename action ────────────────────────────────────────────────────

  describe('"rename" action', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1', rename: vi.fn().mockResolvedValue(undefined) });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('happy path — open phase, player.rename and broadcastGame called (2.2)', async () => {
      const player = { playerId: 'p1', rename: vi.fn().mockResolvedValue(undefined) };
      spy.findPlayer.mockResolvedValue(player);
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('rename', { gameId: 'game-1', playerId: 'p1', name: 'newname' }));

      expect(player.rename).toHaveBeenCalledWith('NEWNAME');
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('sends code 2 when readGame does not return a valid GameRecord (2.3)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(500);
      await handler(makeEvent('rename', { gameId: 'game-1', playerId: 'p1', name: 'x' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 3 when game is not in open phase (2.4)', async () => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('rename', { gameId: 'game-1', playerId: 'p1', name: 'x' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });

    it('sends code 3 when playerId is absent (2.4)', async () => {
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('rename', { gameId: 'game-1', playerId: null, name: 'x' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── 3: kick action ──────────────────────────────────────────────────────

  describe('"kick" action', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('first-strike path — strikes 0, hash matches; updateGame + broadcastGame, strikes becomes 1 (3.2)', async () => {
      const target = { playerId: 'target-p', strikes: 0 };
      spy.players = [target];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));

      expect(target.strikes).toBe(1);
      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('first-strike stale-hash — strikes 0, hash mismatch; sends code 5 (3.3)', async () => {
      const target = { playerId: 'target-p', strikes: 0 };
      spy.players = [target];
      const game = { gameId: 'game-1', stateHash: 'different', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
    });

    it('second-strike path — strikes 1; leaveGame invoked for target (3.4)', async () => {
      // Target already has one strike → this kick removes them via leaveGame.
      // leaveGame re-reads the game, finds the target, kicks, resets their connection,
      // and (players still remain) updates + broadcasts.
      const target = { playerId: 'target-p', strikes: 1 };
      spy.players = [target, { playerId: 'p1', strikes: 0 }];
      spy.findPlayer.mockResolvedValue({ playerId: 'target-p' });
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      // findConnections resolves the target's connectionId for the kick.
      (_testDeps.connections.findConnections as any).mockResolvedValue([
        { connectionId: 'conn-target', playerId: 'target-p' },
      ]);

      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));

      // leaveGame removed the target from the gamestate.
      expect(spy.kickPlayer).toHaveBeenCalledWith('target-p');
      // leaveGame reset the target connection's gameId/playerId to '-1'.
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-target', 'gameId', '-1');
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-target', 'playerId', '-1');
      // Players remain, so updateGame is called (game not deleted).
      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
    });

    it('self-kick to spectator — self, strikes 0; strikes becomes -1, broadcastGame (3.5)', async () => {
      const target = { playerId: 'p1', strikes: 0 };
      spy.players = [target];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));

      expect(target.strikes).toBe(-1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('self-kick resume — self, strikes -1; strikes becomes 0, broadcastGame (3.6)', async () => {
      const target = { playerId: 'p1', strikes: -1 };
      spy.players = [target];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));

      expect(target.strikes).toBe(0);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('self-kick stale-hash — self, hash mismatch; sends code 5 (3.7)', async () => {
      const target = { playerId: 'p1', strikes: 0 };
      spy.players = [target];
      const game = { gameId: 'game-1', stateHash: 'different', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
    });

    it('sends code 7 when target playerId is falsy — empty slot (3.8)', async () => {
      spy.players = [{ playerId: '', strikes: 0 }];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 7 }));
    });

    it('sends code 3 when payload.playerId is absent (3.9)', async () => {
      spy.players = [{ playerId: 'target-p', strikes: 0 }];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('kick', { gameId: 'game-1', playerId: null, target: 0, stateHash: 'hash-abc' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });

    it('sends code 2 when readGame does not return a valid GameRecord (3.10)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(404);
      await handler(makeEvent('kick', { gameId: 'game-1', playerId: 'p1', target: 0, stateHash: 'hash-abc' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });
  });

  // ─── 4: leave action — success paths ─────────────────────────────────────

  describe('"leave" action — success paths', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('happy path — player found, others remain; updateGame + broadcastGame, connection reset, caller gets closed-state (4.2)', async () => {
      spy.players = [{ playerId: 'other' }];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));

      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-test', 'gameId', '-1');
      expect(_testDeps.connections.updateConnection).toHaveBeenCalledWith('conn-test', 'playerId', '-1');
      // Caller receives the closed-state message.
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({
        gameId: null,
        gamestate: expect.objectContaining({ meta: { phase: 'closed' }, players: [] }),
      }));
    });

    it('last-player path — no players remain; deleteGame, no broadcast, caller still gets closed-state (4.3)', async () => {
      spy.players = [];
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'deleteGame').mockResolvedValue({ Attributes: {} });
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));

      expect(_testDeps.games.deleteGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({
        gameId: null,
        gamestate: expect.objectContaining({ meta: { phase: 'closed' }, players: [] }),
      }));
    });

    it('stale-hash — hash mismatch; sends code 5, does NOT call updateGame (4.4)', async () => {
      spy.players = [{ playerId: 'other' }];
      const game = { gameId: 'game-1', stateHash: 'different', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
      // Stale-hash must not broadcast the pre-kick state to remaining players (same
      // guard applied by commit 4171ffe in kickPlayer / twinge but missed here).
      expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
    });

    it('sends code 2 when readGame does not return a valid GameRecord (4.5)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(404);
      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 3 when findPlayer returns falsy (4.6)', async () => {
      spy.findPlayer.mockResolvedValue(undefined);
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── 5: refresh action ───────────────────────────────────────────────────

  describe('"refresh" action', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('happy path — game and player found; updateGame + broadcastGame (5.2)', async () => {
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('refresh', { gameId: 'game-1', playerId: 'p1' }));

      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('sends code 1 when no gameId provided (5.3)', async () => {
      await handler(makeEvent('refresh', { gameId: null }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
    });

    it('sends code 2 when readGame does not return a valid GameRecord (5.4)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(404);
      await handler(makeEvent('refresh', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 3 when findPlayer returns falsy (5.5)', async () => {
      spy.findPlayer.mockResolvedValue(undefined);
      const game = { gameId: 'game-1', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('refresh', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── 6: restart action ───────────────────────────────────────────────────

  describe('"restart" action', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'won', round: 3 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('happy path — not open phase, player found; restartGame + broadcastGame (6.2)', async () => {
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('restart', { gameId: 'game-1', playerId: 'p1' }));

      expect(spy.restartGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
    });

    it('sends code 1 when no gameId provided (6.3)', async () => {
      await handler(makeEvent('restart', { gameId: null }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
    });

    it('sends code 2 when game is in open phase (6.4)', async () => {
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'open' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('restart', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 2 when readGame returns a non-record (6.4)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(404);
      await handler(makeEvent('restart', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 3 when findPlayer returns falsy (6.5)', async () => {
      spy.findPlayer.mockResolvedValue(undefined);
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('restart', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── 7: end action ───────────────────────────────────────────────────────

  describe('"end" action', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'won', round: 3 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('happy path — not open phase, player found; deleteGame + broadcastGame with closed record (7.2)', async () => {
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'deleteGame').mockResolvedValue({ Attributes: {} });

      await handler(makeEvent('end', { gameId: 'game-1', playerId: 'p1' }));

      expect(_testDeps.games.deleteGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      // Broadcast a fully-closed record: phase 'closed', empty players.
      const broadcastArg = (_testDeps.messages.broadcastGame as any).mock.calls[0][0];
      expect(broadcastArg.gamestate.meta.phase).toBe('closed');
      expect(broadcastArg.gamestate.players).toEqual([]);
    });

    it('sends code 1 when no gameId provided (7.3)', async () => {
      await handler(makeEvent('end', { gameId: null }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 1 }));
    });

    it('sends code 2 when game is in open phase (7.4)', async () => {
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'open' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('end', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 2 when readGame returns a non-record (7.4)', async () => {
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(404);
      await handler(makeEvent('end', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 2 }));
    });

    it('sends code 3 when findPlayer returns falsy (7.5)', async () => {
      spy.findPlayer.mockResolvedValue(undefined);
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      await handler(makeEvent('end', { gameId: 'game-1', playerId: 'p1' }));
      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 3 }));
    });
  });

  // ─── twg-20: stateHash guards on mutating handlers ────────────────────────

  describe('"rename" stateHash guard (twg-20)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('stale hash — sends code 5, does NOT call updateGame', async () => {
      const player = { playerId: 'p1', rename: vi.fn().mockResolvedValue(undefined) };
      spy.findPlayer.mockResolvedValue(player);
      const game = { gameId: 'game-1', stateHash: 'server-hash', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      // payload stateHash from makeEvent defaults to 'hash-abc', differs from 'server-hash'

      await handler(makeEvent('rename', { name: 'newname' }));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
      expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
    });

    it('matching hash — calls updateGame and broadcastGame', async () => {
      const player = { playerId: 'p1', rename: vi.fn().mockResolvedValue(undefined) };
      spy.findPlayer.mockResolvedValue(player);
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('rename', { name: 'newname' }));

      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.send).not.toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
    });
  });

  describe('"start" stateHash guard (twg-20)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'open', round: 0 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('stale hash — sends code 5, does NOT call updateGame', async () => {
      const game = { gameId: 'game-1', stateHash: 'server-hash', gamestate: { meta: { phase: 'open' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      // payload stateHash defaults to 'hash-abc', differs from 'server-hash'

      await handler(makeEvent('start'));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
      expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
    });

    it('matching hash — calls updateGame and broadcastGame', async () => {
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'open' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('start'));

      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.send).not.toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
    });
  });

  describe('"next" stateHash guard (twg-20)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'playing', round: 1 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      spy.players = [{ playerId: 'p1', hand: [], handSize: 0 }];
      _testDeps.Gamestate = function() { return spy; };
    });

    it('stale hash — sends code 5, does NOT call updateGame', async () => {
      const game = { gameId: 'game-1', stateHash: 'server-hash', gamestate: { meta: { phase: 'playing' }, players: [{ hand: [] }] } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      // payload stateHash defaults to 'hash-abc', differs from 'server-hash'

      await handler(makeEvent('next'));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
      expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
    });

    it('matching hash — calls updateGame and broadcastGame', async () => {
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'playing' }, players: [{ hand: [] }] } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('next'));

      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.send).not.toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
    });
  });

  describe('"restart" stateHash guard (twg-20)', () => {
    let spy;
    beforeEach(() => {
      spy = makeGamestateSpy({ meta: { phase: 'won', round: 3 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
    });

    it('stale hash — sends code 5, does NOT call updateGame', async () => {
      const game = { gameId: 'game-1', stateHash: 'server-hash', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      // payload stateHash defaults to 'hash-abc', differs from 'server-hash'

      await handler(makeEvent('restart'));

      expect(_testDeps.messages.send).toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
      expect(_testDeps.games.updateGame).not.toHaveBeenCalled();
      expect(_testDeps.messages.broadcastGame).not.toHaveBeenCalled();
    });

    it('matching hash — calls updateGame and broadcastGame', async () => {
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('restart'));

      expect(_testDeps.games.updateGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.broadcastGame).toHaveBeenCalledTimes(1);
      expect(_testDeps.messages.send).not.toHaveBeenCalledWith('conn-test', expect.objectContaining({ code: 5 }));
    });
  });

  // ─── Analytics emit on terminal phase (twinge path) ──────────────────────

  describe('"twinge" action — analytics emit', () => {
    function setupTwinge(phaseAfterPlay: string) {
      const spy = makeGamestateSpy({ meta: { phase: phaseAfterPlay, round: 3 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1', handSize: 1, hand: [5] });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'playing' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      return spy;
    }

    it('calls writeAnalytics when phase is "won" after playing', async () => {
      setupTwinge('won');
      await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledTimes(1);
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledWith('game-1', expect.anything());
    });

    it('calls writeAnalytics when phase is "lost" after playing', async () => {
      setupTwinge('lost');
      await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledTimes(1);
    });

    it('does NOT call writeAnalytics when phase is still "playing"', async () => {
      setupTwinge('playing');
      await handler(makeEvent('twinge', { stateHash: 'hash-abc' }));
      expect(_testDeps.analytics.writeAnalytics).not.toHaveBeenCalled();
    });
  });

  // ─── Analytics emit on terminal phase (next path) ────────────────────────

  describe('"next" action — analytics emit', () => {
    function setupNext(phaseAfterRound: string) {
      const spy = makeGamestateSpy({ meta: { phase: phaseAfterRound, round: 4 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      spy.players = [{ playerId: 'p1', hand: [], handSize: 0 }];
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: { meta: { phase: 'playing' }, players: [{ hand: [] }] } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);
      return spy;
    }

    it('calls writeAnalytics when the round advance wins the game', async () => {
      setupNext('won');
      await handler(makeEvent('next'));
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledTimes(1);
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledWith('game-1', expect.anything());
    });

    it('calls writeAnalytics when the round advance loses the game', async () => {
      setupNext('lost');
      await handler(makeEvent('next'));
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledTimes(1);
    });

    it('does NOT call writeAnalytics when the game is still "playing"', async () => {
      setupNext('playing');
      await handler(makeEvent('next'));
      expect(_testDeps.analytics.writeAnalytics).not.toHaveBeenCalled();
    });
  });

  // ─── Analytics emit on leaveGame — abandoned (5.7) ───────────────────────

  describe('"leave" action — analytics emit', () => {
    it('calls writeAnalytics with outcome "abandoned" when last player leaves (5.7)', async () => {
      const spy = makeGamestateSpy({ meta: { phase: 'playing', round: 2 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      spy.players = [];  // no players remain after kick
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'deleteGame').mockResolvedValue({ Attributes: {} });

      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));

      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledTimes(1);
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledWith('game-1', expect.anything(), 'abandoned');
      expect(_testDeps.games.deleteGame).toHaveBeenCalledTimes(1);
    });

    it('does NOT call writeAnalytics when other players remain (5.7)', async () => {
      const spy = makeGamestateSpy({ meta: { phase: 'playing', round: 2 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      spy.players = [{ playerId: 'other' }];
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', stateHash: 'hash-abc', gamestate: spy };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'updateGame').mockResolvedValue(game);

      await handler(makeEvent('leave', { gameId: 'game-1', playerId: 'p1', stateHash: 'hash-abc' }));

      expect(_testDeps.analytics.writeAnalytics).not.toHaveBeenCalled();
    });
  });

  // ─── Analytics emit on endGame — ended (5.8) ─────────────────────────────

  describe('"end" action — analytics emit', () => {
    it('calls writeAnalytics with outcome "ended" when host ends the game (5.8)', async () => {
      const spy = makeGamestateSpy({ meta: { phase: 'playing', round: 3 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'playing' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'deleteGame').mockResolvedValue({ Attributes: {} });

      await handler(makeEvent('end', { gameId: 'game-1', playerId: 'p1' }));

      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledTimes(1);
      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledWith('game-1', expect.anything(), 'ended');
      expect(_testDeps.games.deleteGame).toHaveBeenCalledTimes(1);
    });

    it('calls writeAnalytics with outcome "ended" when ending a won game (5.8)', async () => {
      const spy = makeGamestateSpy({ meta: { phase: 'won', round: 5 } });
      spy.findPlayer.mockResolvedValue({ playerId: 'p1' });
      _testDeps.Gamestate = function() { return spy; };
      const game = { gameId: 'game-1', gamestate: { meta: { phase: 'won' } } };
      vi.spyOn(_testDeps.games, 'readGame').mockResolvedValue(game);
      vi.spyOn(_testDeps.games, 'deleteGame').mockResolvedValue({ Attributes: {} });

      await handler(makeEvent('end', { gameId: 'game-1', playerId: 'p1' }));

      expect(_testDeps.analytics.writeAnalytics).toHaveBeenCalledWith('game-1', expect.anything(), 'ended');
    });
  });

  // ─── Analytics helper — explicit outcome param (5.9) ─────────────────────
  // (Tested at the analytics.ts unit level — see analytics.test.ts)
  // The integration-level evidence is the spy assertions above where 'abandoned'
  // and 'ended' are passed explicitly, while twinge/next omit the param.
});
