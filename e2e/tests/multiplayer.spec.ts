import { test, expect, newContext, type Browser, type BrowserContext, type Page } from '../fixtures';
import { createGame, joinGame, waitForPhase, playCard } from './helpers';

/**
 * Multiplayer tests drive two fully isolated browser contexts (separate
 * cookies, localStorage, and WebSocket connections) within one test process,
 * simulating two real players against the live AU server.
 */
test.describe('Multiplayer', () => {
  let p1Context: BrowserContext;
  let p2Context: BrowserContext;
  let p1: Page;
  let p2: Page;

  test.beforeEach(async ({ browser }: { browser: Browser }) => {
    p1Context = await newContext(browser);
    p2Context = await newContext(browser);
    p1 = await p1Context.newPage();
    p2 = await p2Context.newPage();
  });

  test.afterEach(async () => {
    await p1Context.close();
    await p2Context.close();
  });

  test('Join by room code: both contexts show two players', async () => {
    const roomCode = await createGame(p1);
    await joinGame(p2, roomCode);

    // Both lobbies should list two players.
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });
    await expect(p2.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });
  });

  test('Start propagates: both contexts enter playing phase', async () => {
    const roomCode = await createGame(p1);
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();

    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');
  });

  test('Card play propagates: P2 pile updates when P1 plays', async () => {
    const roomCode = await createGame(p1);
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // P1 plays their (lowest) card.
    await playCard(p1);

    // P2's pile should reflect the newly played card.
    await expect(p2.locator('.Pile .Card').first()).toBeVisible({ timeout: 20000 });
  });
});
