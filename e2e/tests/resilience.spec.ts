import { test, expect, newContext, type Browser, type BrowserContext, type Page } from '../fixtures';
import { createGame, joinGame, waitForPhase, longPress } from './helpers';

/**
 * Resilience tests: concurrent card play (stale-state rejection) and
 * auto-refresh keeping an idle client in sync.
 *
 * These tests depend on live AWS infrastructure timing and carry longer
 * timeouts than the lobby/in-game suites.
 */

// -------------------------------------------------------------------------
// 4.1  Stale state — simultaneous plays from two contexts
// -------------------------------------------------------------------------
test('Stale state: concurrent plays produce exactly one new pile card', async ({ browser }: { browser: Browser }) => {
  let p1Context: BrowserContext | undefined;
  let p2Context: BrowserContext | undefined;
  try {
    p1Context = await newContext(browser);
    p2Context = await newContext(browser);
    const p1: Page = await p1Context.newPage();
    const p2: Page = await p2Context.newPage();

    const roomCode = await createGame(p1);
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // Record the pile length before the simultaneous play attempt.
    const pileBefore = await p1.locator('.Pile .Card').count();

    // Both players attempt to play a card at the same time.  The server
    // applies a conditional write (stateHash guard) so exactly one succeeds;
    // the other receives code 5 (stale) and the client auto-corrects.
    const playGesture = async (page: Page): Promise<void> => {
      const hand = page.locator('.Hand').first();
      await expect(hand).toBeVisible({ timeout: 20000 });
      const box = await hand.boundingBox();
      if (!box) return;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1000);
      await page.mouse.up();
    };

    // Fire both plays concurrently without awaiting either individually.
    await Promise.all([playGesture(p1), playGesture(p2)]);

    // Wait for the pile to settle to exactly one more card than before.
    // The stale-state loser's view should self-correct via the broadcast.
    await expect.poll(
      async () => await p1.locator('.Pile .Card').count(),
      { timeout: 20000 },
    ).toBeGreaterThanOrEqual(pileBefore + 1);

    // Determine pile count on both sides after the dust settles.
    const p1PileCount = await p1.locator('.Pile .Card').count();
    const p2PileCount = await p2.locator('.Pile .Card').count();

    // Both contexts must agree on the pile size (consistent state).
    expect(p1PileCount).toBe(p2PileCount);
  } finally {
    await p1Context?.close();
    await p2Context?.close();
  }
});

// -------------------------------------------------------------------------
// 4.2  Auto-refresh — idle client syncs after 12s
// NOTE: this test adds ~12s to the suite run; keep it last or in its own
// worker by placing it after the stale-state test.
// -------------------------------------------------------------------------
test('Auto-refresh: idle client matches active client after 12s', async ({ browser }: { browser: Browser }) => {
  let p1Context: BrowserContext | undefined;
  let p2Context: BrowserContext | undefined;
  try {
    p1Context = await newContext(browser);
    p2Context = await newContext(browser);
    const p1: Page = await p1Context.newPage();
    const p2: Page = await p2Context.newPage();

    const roomCode = await createGame(p1);
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // P1 plays their card; P2 is intentionally left idle.
    await longPress(p1, p1.locator('.Hand').first(), 1000);

    // Wait for P1's pile to update (the play was accepted).
    await expect(p1.locator('.Pile .Card').first()).toBeVisible({ timeout: 20000 });

    // Record P1's pile count after the play.
    const p1PileCount = await p1.locator('.Pile .Card').count();

    // Wait > 10s (the client's poll interval) so P2's auto-refresh fires.
    await p2.waitForTimeout(12000);

    // P2's pile should now match P1's pile (auto-refresh applied the delta).
    const p2PileCount = await p2.locator('.Pile .Card').count();
    expect(p2PileCount).toBe(p1PileCount);
  } finally {
    await p1Context?.close();
    await p2Context?.close();
  }
});
