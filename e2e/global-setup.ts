import fs from 'fs';
import path from 'path';

/**
 * Playwright globalSetup: writes a storageState JSON file that seeds
 * localStorage with `region=TEST` for every browser context before the
 * test suite starts.  This routes all WebSocket connections to the isolated
 * test endpoint (wss://test.twinge.mcteamster.com) instead of a prod region,
 * keeping E2E games out of production DynamoDB tables.
 *
 * The file is written to e2e/.auth/test-storage.json and referenced by
 * `use.storageState` in playwright.config.ts.  The .auth/ directory is
 * gitignored so the generated file is never committed.
 */
async function globalSetup(): Promise<void> {
  const authDir = path.join(import.meta.dirname, '.auth');
  const storageFile = path.join(authDir, 'test-storage.json');

  fs.mkdirSync(authDir, { recursive: true });

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'https://twinge.mcteamster.com',
        localStorage: [
          {
            name: 'region',
            value: 'TEST',
          },
        ],
      },
    ],
  };

  fs.writeFileSync(storageFile, JSON.stringify(storageState, null, 2));
}

export default globalSetup;
