// games.test.js
// Uses vi.spyOn on the exported _testClient to intercept DynamoDB calls
// without needing to mock node_modules (which Vitest CJS cannot do reliably).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import games from '../src/helpers/games.js';

const client = games._testClient;

describe('games helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── createGame ──────────────────────────────────────────────────────────────

  describe('createGame', () => {
    beforeEach(() => {
      // findGames (used inside createGame for dedup) returns empty — no collision
      vi.spyOn(client, 'query').mockResolvedValue({ Items: [] });
      vi.spyOn(client, 'put').mockResolvedValue({});
    });

    it('calls put with a gameId', async () => {
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      await games.createGame('game-1', gs);
      const putSpy = vi.mocked(client.put);
      const params = putSpy.mock.calls[0][0];
      expect(params.Item.gameId).toBe('game-1');
    });

    it('calls put with a roomCode string', async () => {
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      await games.createGame('game-1', gs);
      const putSpy = vi.mocked(client.put);
      const params = putSpy.mock.calls[0][0];
      expect(typeof params.Item.roomCode).toBe('string');
      expect(params.Item.roomCode.length).toBeGreaterThan(0);
    });

    it('calls put with a stateHash string', async () => {
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      await games.createGame('game-1', gs);
      const putSpy = vi.mocked(client.put);
      const params = putSpy.mock.calls[0][0];
      expect(typeof params.Item.stateHash).toBe('string');
    });

    it('calls put with an expiryTimeEpoch number', async () => {
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      await games.createGame('game-1', gs);
      const putSpy = vi.mocked(client.put);
      const params = putSpy.mock.calls[0][0];
      expect(typeof params.Item.expiryTimeEpoch).toBe('number');
    });

    it('returns the created item on success', async () => {
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      const result = await games.createGame('game-1', gs);
      expect(result).toMatchObject({ gameId: 'game-1' });
    });

    it('returns 500 on put error', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      const result = await games.createGame('game-1', gs);
      expect(result).toBe(500);
    });
  });

  // ── readGame ────────────────────────────────────────────────────────────────

  describe('readGame', () => {
    it('calls get with the correct gameId key', async () => {
      const spy = vi.spyOn(client, 'get').mockResolvedValueOnce({ Item: { gameId: 'game-1' } });
      await games.readGame('game-1');
      const params = spy.mock.calls[0][0];
      expect(params.Key.gameId).toBe('game-1');
    });

    it('returns the Item from DynamoDB', async () => {
      const item = { gameId: 'game-1', roomCode: 'ABC' };
      vi.spyOn(client, 'get').mockResolvedValueOnce({ Item: item });
      const result = await games.readGame('game-1');
      expect(result).toEqual(item);
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const result = await games.readGame('game-1');
      expect(result).toBe(500);
    });
  });

  // ── updateGame ──────────────────────────────────────────────────────────────

  describe('updateGame', () => {
    it('calls update with correct gameId key', async () => {
      const spy = vi.spyOn(client, 'update').mockResolvedValueOnce({ Attributes: { gameId: 'game-1' } });
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      await games.updateGame('game-1', gs);
      const params = spy.mock.calls[0][0];
      expect(params.Key.gameId).toBe('game-1');
    });

    it('calls update with gamestate and stateHash in expression', async () => {
      const spy = vi.spyOn(client, 'update').mockResolvedValueOnce({ Attributes: {} });
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      await games.updateGame('game-1', gs);
      const params = spy.mock.calls[0][0];
      expect(params.UpdateExpression).toMatch(/gamestate/);
      expect(params.UpdateExpression).toMatch(/stateHash/);
    });

    it('returns the Attributes from DynamoDB', async () => {
      const attrs = { gameId: 'game-1', roomCode: 'XYZ' };
      vi.spyOn(client, 'update').mockResolvedValueOnce({ Attributes: attrs });
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      const result = await games.updateGame('game-1', gs);
      expect(result).toEqual(attrs);
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'update').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const gs = { config: { deckSize: 100, maxLives: 5 }, players: [] };
      const result = await games.updateGame('game-1', gs);
      expect(result).toBe(500);
    });
  });

  // ── deleteGame ──────────────────────────────────────────────────────────────

  describe('deleteGame', () => {
    it('calls delete with correct gameId key', async () => {
      const spy = vi.spyOn(client, 'delete').mockResolvedValueOnce({});
      await games.deleteGame('game-1');
      const params = spy.mock.calls[0][0];
      expect(params.Key.gameId).toBe('game-1');
    });

    it('returns 200 on success', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce({});
      const result = await games.deleteGame('game-1');
      expect(result).toBe(200);
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const result = await games.deleteGame('game-1');
      expect(result).toBe(500);
    });
  });
});
