// analytics.test.ts
// Uses vi.spyOn on the exported _testClient to intercept the S3 putObject
// call without needing to mock node_modules — matches the _testClient pattern
// used in games.test.ts and connections.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import analytics from '../src/helpers/analytics';
import type { GamestateData } from '../src/types';

const client: any = analytics._testClient;

function makeGamestate(overrides: Partial<GamestateData> = {}): GamestateData {
  return {
    config: { deckSize: 100, maxLives: 5 },
    meta: { phase: 'won', round: 7 },
    public: { pile: [], lives: 3, remaining: 0 },
    players: [
      { playerId: 'p1', connected: true, strikes: 0, name: 'A', hand: [], handSize: 0 },
      { playerId: 'p2', connected: true, strikes: 0, name: 'B', hand: [], handSize: 0 },
    ],
    private: { deck: [] },
    ...overrides,
  } as GamestateData;
}

describe('analytics helper', () => {
  const OLD_ENV = process.env.ANALYTICS_BUCKET;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ANALYTICS_BUCKET = 'twinge-analytics-test';
  });

  afterEach(() => {
    if (OLD_ENV === undefined) {
      delete process.env.ANALYTICS_BUCKET;
    } else {
      process.env.ANALYTICS_BUCKET = OLD_ENV;
    }
  });

  it('writes to S3 with a YYYY/MM/DD/<gameId>.json key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T10:30:00.000Z'));
    const spy = vi.spyOn(client, 'putObject').mockResolvedValue({});

    await analytics.writeAnalytics('abc-123', makeGamestate());

    const params: any = spy.mock.calls[0][0];
    expect(params.Key).toBe('2025/03/15/abc-123.json');
    expect(params.Bucket).toBe('twinge-analytics-test');
    vi.useRealTimers();
  });

  it('writes a record with the full schema shape', async () => {
    const spy = vi.spyOn(client, 'putObject').mockResolvedValue({});

    await analytics.writeAnalytics('game-9', makeGamestate({ meta: { phase: 'lost', round: 4 }, public: { pile: [], lives: 0, remaining: 12 } }));

    const params: any = spy.mock.calls[0][0];
    const record = JSON.parse(params.Body);
    expect(record).toMatchObject({
      gameId: 'game-9',
      outcome: 'lost',
      round: 4,
      playerCount: 2,
      deckSize: 100,
      maxLives: 5,
      livesRemaining: 0,
    });
    expect(typeof record.timestamp).toBe('string');
    expect(() => new Date(record.timestamp).toISOString()).not.toThrow();
  });

  it('records outcome "won" when phase is won', async () => {
    const spy = vi.spyOn(client, 'putObject').mockResolvedValue({});
    await analytics.writeAnalytics('g', makeGamestate({ meta: { phase: 'won', round: 1 } }));
    const record = JSON.parse((spy.mock.calls[0][0] as any).Body);
    expect(record.outcome).toBe('won');
  });

  it('catches an S3 error without re-throwing', async () => {
    vi.spyOn(client, 'putObject').mockRejectedValueOnce(new Error('S3 failure'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(analytics.writeAnalytics('g', makeGamestate())).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
  });

  it('skips the write and does not call S3 when ANALYTICS_BUCKET is unset', async () => {
    delete process.env.ANALYTICS_BUCKET;
    const spy = vi.spyOn(client, 'putObject').mockResolvedValue({});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await analytics.writeAnalytics('g', makeGamestate());
    expect(spy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
