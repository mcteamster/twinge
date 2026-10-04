import { test, expect, newContext, type Browser, type BrowserContext, type Page } from '../fixtures';
import {
  createGame,
  joinGame,
  waitForPhase,
  leaveGame,
  longPress,
  playCard,
} from './helpers';

/**
 * Extended lobby tests covering leave, rejoin, warn, kick, spectator mode,
 * and mid-game join scenarios.
 */
test.describe('Lobby Extended', () => {
  // -------------------------------------------------------------------------
  // 2.1  Leave — single context
  // -------------------------------------------------------------------------
  test('Leave: clicking ✕ returns to home screen', async ({ page }) => {
    await createGame(page);
    await leaveGame(page);
    // Home screen: Create button visible, room code gone.
    await expect(page.locator('.Create')).toBeVisible();
    await expect(page.locator('#roomCode')).toHaveText('');
  });

  // -------------------------------------------------------------------------
  // 2.2  Rejoin — single context, simulate disconnect by navigating away
  // -------------------------------------------------------------------------
  test('Rejoin: navigating back restores player in game with hand', async ({ page }) => {
    const roomCode = await createGame(page);
    await waitForPhase(page, 'open');
    // Start the game so a hand is dealt.
    await page.locator('.Start').click();
    await waitForPhase(page, 'playing');
    // Simulate tab close / disconnect by navigating to a blank page.
    await page.goto('about:blank');
    // Navigate back — the client reads localStorage and sends a rejoin.
    await page.goto('/');
    // Player should land back in the playing phase with their hand.
    await waitForPhase(page, 'playing');
    await expect(page.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
    // Silence unused variable warning: roomCode confirmed above via createGame assertion.
    void roomCode;
  });

  // -------------------------------------------------------------------------
  // 2.3  Warn — two contexts, P2 long-presses P1's nametag, assert P1 gets 1 strike
  // -------------------------------------------------------------------------
  test('Warn: long-pressing a player adds one strike', async ({ browser }: { browser: Browser }) => {
    let p1Context: BrowserContext | undefined;
    let p2Context: BrowserContext | undefined;
    try {
      p1Context = await newContext(browser);
      p2Context = await newContext(browser);
      const p1: Page = await p1Context.newPage();
      const p2: Page = await p2Context.newPage();

      const roomCode = await createGame(p1);
      await joinGame(p2, roomCode);

      // Wait for both lobbies to list two players.
      await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });
      await expect(p2.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

      // P2 long-presses P1's nametag (index 0 in P2's lobby — P1 is host / first player).
      // We use 2200ms to safely exceed the 2000ms kickBuffer threshold.
      const p1NametageOnP2 = p2.locator('.playerLobby .Player').first();
      await longPress(p2, p1NametageOnP2, 2200);

      // P1's own lobby should now show the strikes CSS class on their player card.
      await expect(p1.locator('.playerLobby .Player').first()).toHaveClass(/strikes/, { timeout: 20000 });
    } finally {
      await p1Context?.close();
      await p2Context?.close();
    }
  });

  // -------------------------------------------------------------------------
  // 2.4  Kick — two contexts, P2 warns P1 twice, assert P1 removed
  // -------------------------------------------------------------------------
  test('Kick: second warn removes player from lobby', async ({ browser }: { browser: Browser }) => {
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
      await expect(p2.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

      const p1NametageOnP2 = p2.locator('.playerLobby .Player').first();

      // First warn.
      await longPress(p2, p1NametageOnP2, 2200);
      await expect(p1.locator('.playerLobby .Player').first()).toHaveClass(/strikes/, { timeout: 20000 });

      // Second warn (kick) — target already has one strike.
      await longPress(p2, p1NametageOnP2, 2200);

      // P1 should be removed; P2's lobby should only have one player.
      await expect(p2.locator('.playerLobby .Player')).toHaveCount(1, { timeout: 20000 });
    } finally {
      await p1Context?.close();
      await p2Context?.close();
    }
  });

  // -------------------------------------------------------------------------
  // 2.5  Spectator — long-press own nametag, assert strikes = -1 (👀 visible)
  // -------------------------------------------------------------------------
  test('Spectator: long-pressing own nametag enables spectator mode', async ({ page }) => {
    await createGame(page);

    // The host is always the first player in the lobby.
    const ownNametag = page.locator('.playerLobby .Player').first();
    await longPress(page, ownNametag, 2200);

    // Spectator indicator: playerValue shows the 👀 emoji (strikes === -1).
    await expect(page.locator('.playerLobby .playerValue').first()).toContainText('👀', { timeout: 20000 });
  });

  // -------------------------------------------------------------------------
  // 2.6  Mid-game join — P2 joins after game starts, assert no hand; next round deals cards
  // -------------------------------------------------------------------------
  test('Mid-game join: late joiner has no hand until next round', async ({ browser }: { browser: Browser }) => {
    let p1Context: BrowserContext | undefined;
    let p2Context: BrowserContext | undefined;
    try {
      p1Context = await newContext(browser);
      p2Context = await newContext(browser);
      const p1: Page = await p1Context.newPage();
      const p2: Page = await p2Context.newPage();

      // P1 creates and starts as a solo player.
      const roomCode = await createGame(p1);
      await waitForPhase(p1, 'open');
      await p1.locator('.Start').click();
      await waitForPhase(p1, 'playing');

      // P2 joins mid-game.
      await joinGame(p2, roomCode);

      // P2 is in the game but has no hand (no Card elements in their Hand).
      await expect(p2.locator('.Hand')).toBeVisible({ timeout: 20000 });
      await expect(p2.locator('.Hand .Card')).toHaveCount(0, { timeout: 20000 });

      // P1 plays all cards to trigger next round — hold until Next Level appears.
      // P1 plays their single round-1 card so the hand empties and the
      // "Next Level" prompt is rendered.
      await p1.locator('.Hand').first().waitFor({ state: 'visible' });
      await playCard(p1);
      // Trigger next round via the Hand area (Next Level button appears when all cards played).
      // Wait for the "Next Level" / "No Active Players" state on P1.
      await expect.poll(
        async () => {
          const handText = await p1.locator('.Hand').first().innerText().catch(() => '');
          return handText.includes('Next Level') || handText.includes('No Active Players');
        },
        { timeout: 30000 },
      ).toBeTruthy();

      // Trigger next level (long-press the Next Level button area).
      const handArea = p1.locator('.Hand').first();
      await longPress(p1, handArea, 1000);

      // After next round starts, P2 should now be dealt cards.
      await expect(p2.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
    } finally {
      await p1Context?.close();
      await p2Context?.close();
    }
  });
});
