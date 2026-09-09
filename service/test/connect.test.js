// connect.test.js
// Uses vi.spyOn on the handler's exported _testDeps object to intercept
// dependency calls without module-system mocking. Matches the _testClient
// pattern used in connections.test.js and games.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import connectHandlerModule from '../src/handlers/connect.js';

const { handler, _testDeps } = connectHandlerModule;
const { connections } = _testDeps;

function makeEvent(eventType, connectionId = 'conn-abc') {
  return {
    requestContext: {
      connectionId,
      eventType,
    },
  };
}

describe('connect handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CONNECT event', () => {
    it('calls createConnection with the connectionId', async () => {
      const spy = vi.spyOn(connections, 'createConnection').mockResolvedValueOnce(200);
      await handler(makeEvent('CONNECT', 'conn-123'));
      expect(spy).toHaveBeenCalledWith('conn-123');
    });

    it('returns statusCode from createConnection (200)', async () => {
      vi.spyOn(connections, 'createConnection').mockResolvedValueOnce(200);
      const result = await handler(makeEvent('CONNECT'));
      expect(result).toEqual({ statusCode: 200 });
    });

    it('passes through non-200 status codes from createConnection (500)', async () => {
      vi.spyOn(connections, 'createConnection').mockResolvedValueOnce(500);
      const result = await handler(makeEvent('CONNECT'));
      expect(result).toEqual({ statusCode: 500 });
    });
  });

  describe('DISCONNECT event', () => {
    it('calls deleteConnection with the connectionId', async () => {
      const spy = vi.spyOn(connections, 'deleteConnection').mockResolvedValueOnce(200);
      await handler(makeEvent('DISCONNECT', 'conn-456'));
      expect(spy).toHaveBeenCalledWith('conn-456');
    });

    it('returns statusCode from deleteConnection (200)', async () => {
      vi.spyOn(connections, 'deleteConnection').mockResolvedValueOnce(200);
      const result = await handler(makeEvent('DISCONNECT'));
      expect(result).toEqual({ statusCode: 200 });
    });

    it('passes through non-200 status codes from deleteConnection (500)', async () => {
      vi.spyOn(connections, 'deleteConnection').mockResolvedValueOnce(500);
      const result = await handler(makeEvent('DISCONNECT'));
      expect(result).toEqual({ statusCode: 500 });
    });
  });

  describe('unknown event type', () => {
    it('returns statusCode 200 (default) for unrecognised event type', async () => {
      const result = await handler(makeEvent('MESSAGE'));
      expect(result).toEqual({ statusCode: 200 });
    });
  });
});
