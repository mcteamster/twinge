import { S3 } from '@aws-sdk/client-s3';
import type { GamestateData } from '../types';

// S3 client for writing analytics records. Constructed once per Lambda
// container; targets eu-central-1 where the single analytics bucket lives.
const s3Client = new S3({ region: 'eu-central-1' });

/** A single game-outcome analytics record written to S3 on terminal phase. */
interface AnalyticsRecord {
  gameId: string;
  outcome: 'won' | 'lost';
  round: number;
  playerCount: number;
  deckSize: number;
  maxLives: number;
  livesRemaining: number;
  timestamp: string;
}

/**
 * Writes a game-outcome record to the analytics S3 bucket.
 *
 * Fire-and-forget from the caller's perspective: this awaits the S3 write so
 * the Lambda stays alive until it settles, but any failure is logged and
 * swallowed so the player-facing path is never affected. If ANALYTICS_BUCKET
 * is unset, it logs a warning and returns without writing.
 */
async function writeAnalytics(gameId: string, gamestate: GamestateData): Promise<void> {
  const bucket = process.env.ANALYTICS_BUCKET;
  if (!bucket) {
    console.warn('ANALYTICS_BUCKET is not set; skipping analytics write');
    return;
  }

  const timestamp = new Date().toISOString();
  const record: AnalyticsRecord = {
    gameId,
    outcome: gamestate.meta.phase === 'won' ? 'won' : 'lost',
    round: gamestate.meta.round,
    playerCount: gamestate.players.length,
    deckSize: gamestate.config.deckSize,
    maxLives: gamestate.config.maxLives,
    livesRemaining: gamestate.public.lives,
    timestamp,
  };

  // Derive a Hive-partitioned key: games/year=YYYY/month=MM/day=DD/<gameId>-<ts>.json (UTC).
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const key = `games/year=${year}/month=${month}/day=${day}/${gameId}-${Date.now()}.json`;

  try {
    await s3Client.putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(record),
      ContentType: 'application/json',
    });
  } catch (error) {
    console.error('Failed to write analytics record to S3:', error);
    return;
  }
}

export = {
  writeAnalytics,
  // Exposed for unit testing only — allows tests to spy on the S3 client
  // without patching node_modules. Not used in production Lambda execution.
  _testClient: s3Client,
};
