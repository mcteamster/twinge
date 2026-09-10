// connections.test.js
// Uses vi.spyOn on the exported _testClient to intercept DynamoDB calls
// without needing to mock node_modules (which Vitest CJS cannot do reliably).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import connections from '../src/helpers/connections';

const client: any = connections._testClient;

describe('connections helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── createConnection ────────────────────────────────────────────────────────

  describe('createConnection', () => {
    it('calls put with correct connectionId', async () => {
      const spy = vi.spyOn(client, 'put').mockResolvedValueOnce({});
      await connections.createConnection('conn-1');
      expect(spy).toHaveBeenCalledTimes(1);
      const params: any = spy.mock.calls[0][0];
      expect(params.Item.connectionId).toBe('conn-1');
    });

    it('returns 200 on success', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({});
      const result = await connections.createConnection('conn-1');
      expect(result).toBe(200);
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const result = await connections.createConnection('conn-1');
      expect(result).toBe(500);
    });
  });

  // ── deleteConnection ────────────────────────────────────────────────────────

  describe('deleteConnection', () => {
    it('calls delete with correct connectionId', async () => {
      const spy = vi.spyOn(client, 'delete').mockResolvedValueOnce({});
      await connections.deleteConnection('conn-2');
      const params: any = spy.mock.calls[0][0];
      expect(params.Key.connectionId).toBe('conn-2');
    });

    it('returns 200 on success', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce({});
      const result = await connections.deleteConnection('conn-2');
      expect(result).toBe(200);
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const result = await connections.deleteConnection('conn-2');
      expect(result).toBe(500);
    });
  });

  // ── updateConnection ────────────────────────────────────────────────────────

  describe('updateConnection', () => {
    it('calls update with correct UpdateExpression', async () => {
      const spy = vi.spyOn(client, 'update').mockResolvedValueOnce({ Attributes: {} });
      await connections.updateConnection('conn-3', 'gameId', 'game-123');
      const params: any = spy.mock.calls[0][0];
      expect(params.UpdateExpression).toMatch(/set #updateKey = :updateValue/);
    });

    it('passes the updateKey via ExpressionAttributeNames', async () => {
      const spy = vi.spyOn(client, 'update').mockResolvedValueOnce({ Attributes: {} });
      await connections.updateConnection('conn-3', 'gameId', 'game-123');
      const params: any = spy.mock.calls[0][0];
      expect(params.ExpressionAttributeNames['#updateKey']).toBe('gameId');
    });

    it('passes the updateValue via ExpressionAttributeValues', async () => {
      const spy = vi.spyOn(client, 'update').mockResolvedValueOnce({ Attributes: {} });
      await connections.updateConnection('conn-3', 'gameId', 'game-123');
      const params: any = spy.mock.calls[0][0];
      expect(params.ExpressionAttributeValues[':updateValue']).toBe('game-123');
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'update').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const result = await connections.updateConnection('conn-3', 'gameId', 'x');
      expect(result).toBe(500);
    });
  });

  // ── findConnections ─────────────────────────────────────────────────────────

  describe('findConnections', () => {
    it('calls query with correct IndexName', async () => {
      const spy = vi.spyOn(client, 'query').mockResolvedValueOnce({ Items: [] });
      await connections.findConnections('gameId', 'game-abc');
      const params: any = spy.mock.calls[0][0];
      expect(params.IndexName).toBe('gameId');
    });

    it('calls query with correct key condition value', async () => {
      const spy = vi.spyOn(client, 'query').mockResolvedValueOnce({ Items: [] });
      await connections.findConnections('gameId', 'game-abc');
      const params: any = spy.mock.calls[0][0];
      expect(params.ExpressionAttributeValues[':queryValue']).toBe('game-abc');
    });

    it('returns the Items array', async () => {
      const items = [{ connectionId: 'c1', playerId: 'p1' }];
      vi.spyOn(client, 'query').mockResolvedValueOnce({ Items: items });
      const result = await connections.findConnections('gameId', 'game-abc');
      expect(result).toEqual(items);
    });

    it('returns 500 on error', async () => {
      vi.spyOn(client, 'query').mockRejectedValueOnce(new Error('DynamoDB failure'));
      const result = await connections.findConnections('gameId', 'game-abc');
      expect(result).toBe(500);
    });
  });
});
