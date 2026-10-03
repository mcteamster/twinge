import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  createGame,
  joinGame,
  waitForPhase,
  waitForRound,
  waitForLives,
  playAllCards,
  longPress,
} from './helpers';

/**
 * In-game progression tests: next round, win, loss, restart, and end game.
 *
 * All tests configure minimal decks via the Create sliders so they complete
 * quickly and deterministically.
 *
 * Deck size is constrained to 10–1000 by the server; these tests use 10
 * (the minimum) to keep the card counts small.
 */

/**
 * Set the deck size slider to a value.  The slider is only visible on the
 * home screen before a game is created.
 */
async function setSlider(page: Page, sliderId: string, value: number): Promise<void> {
  const slider = page.locator(`#${sliderId}`);
  await expect(slider).toBeVisible({ timeout: 10000 });
  // Set the DOM value directly — the Create button reads getElementById().value at
  // click time, so no React event is needed; the DOM value is the source of truth.
  await slider.evaluate((el: HTMLInputElement, v: number) => {
    el.value = String(v);
  }, value);
}

/**
 * Create a game with custom deckSize and/or maxLives.
 * The sliders must be set before clicking Create.
 */
async function createGameWithConfig(
  page: Page,
  config: { deckSize?: number; maxLives?: number },
): Promise<string> {
  await page.goto('/');
  if (config.deckSize !== undefined) await setSlider(page, 'deckSize', config.deckSize);
  if (config.maxLives !== undefined) await setSlider(page, 'maxLives', config.maxLives);
  await page.locator('.Create').click();
  const roomCode = page.locator('#roomCode');
  await expect(roomCode).toHaveText(/^[A-Z]{4}$/, { timeout: 20000 });
  await expect(page.locator('.Start')).toBeVisible({ timeout: 20000 });
  return (await roomCode.textContent())?.trim() ?? '';
}

/**
 * Press and hold the Hand area to trigger next-round / replay / end actions.
 * These use the same buffered long-press mechanism as card play.
 */
async function pressHandArea(page: Page): Promise<void> {
  await longPress(page, page.locator('.Hand').first(), 1000);
}

// -------------------------------------------------------------------------
// 3.1  Next round
// -------------------------------------------------------------------------
test('Next round: playing all cards then pressing Next Level increments round', async ({ browser }: { browser: Browser }) => {
  let p1Context: BrowserContext | undefined;
  let p2Context: BrowserContext | undefined;
  try {
    p1Context = await browser.newContext();
    p2Context = await browser.newContext();
    const p1: Page = await p1Context.newPage();
    const p2: Page = await p2Context.newPage();

    // deckSize=10 — minimal deck so round 2 is reachable with 2 players
    // (round 1: 2 cards total, remaining=8; round 2 needs 4 ≤ 8, OK).
    const roomCode = await createGameWithConfig(p1, { deckSize: 10 });
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // Both players play their single round-1 card.
    await playAllCards(p1);
    await playAllCards(p2);

    // Wait for all cards to be exhausted (Next Level button visible).
    await expect.poll(
      async () => (await p1.locator('.Hand').first().innerText().catch(() => '')).includes('Next Level'),
      { timeout: 20000 },
    ).toBeTruthy();

    // Trigger next round (P1 presses Next Level) — retry until round increments.
    await expect.poll(
      async () => {
        await pressHandArea(p1);
        const text = await p1.locator('.Status').innerText().catch(() => '');
        const match = text.match(/Level\s+(\d+)\s+of/i) ?? text.match(/^(\d+)\s+of/m);
        return match ? Number(match[1]) : 1;
      },
      { timeout: 30000, intervals: [1500] },
    ).toBeGreaterThan(1);

    // Round counter should now show 2.
    await waitForRound(p1, 2);
    // Both players should have new hands (round 2 = 2 cards each).
    await expect(p1.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
    await expect(p2.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
  } finally {
    await p1Context?.close();
    await p2Context?.close();
  }
});

// -------------------------------------------------------------------------
// 3.2  Win — single context, deckSize=10, play all rounds solo
// -------------------------------------------------------------------------
test('Win: exhausting the deck shows the win state', async ({ page }) => {
  test.setTimeout(90000); // 4 rounds × up to 4 cards, each needing a server round-trip
  // deckSize=10, 1 player: round 1=1, round 2=2, round 3=3, round 4=4 = 10 cards total.
  await createGameWithConfig(page, { deckSize: 10 });
  await waitForPhase(page, 'open');
  await page.locator('.Start').click();
  await waitForPhase(page, 'playing');

  // Play through all rounds until the win state is shown.
  for (let round = 1; round <= 4; round++) {
    await waitForRound(page, round);
    await playAllCards(page);
    // After all cards played, either Next Level button or the win phase.
    await expect.poll(
      async () => {
        const handText = await page.locator('.Hand').first().innerText().catch(() => '');
        const phase = await page.evaluate(() => {
          // Peek at a data attribute set by the Overlay for won state
          return document.querySelector('.Hand .replay') !== null ? 'won' : 'other';
        });
        return handText.includes('Next Level') || handText.includes('Replay') || phase === 'won';
      },
      { timeout: 20000 },
    ).toBeTruthy();

    const hasNextLevel = (await page.locator('.Hand').first().innerText().catch(() => '')).includes('Next Level');
    if (hasNextLevel) {
      // Retry the press until the round increments — the buffer can reset if
      // mouseleave fires mid-hold in headless CI.
      await expect.poll(
        async () => {
          await pressHandArea(page);
          const text = await page.locator('.Status').innerText().catch(() => '');
          const match = text.match(/Level\s+(\d+)\s+of/i) ?? text.match(/^(\d+)\s+of/m);
          return match ? Number(match[1]) : round;
        },
        { timeout: 30000, intervals: [1500] },
      ).toBeGreaterThan(round);
    } else {
      // Win or loss state reached.
      break;
    }
  }

  // Win state: the Hand shows the "Replay" button (win/loss overlay).
  await expect(page.locator('.Hand .replay')).toBeVisible({ timeout: 60000 });
});

// -------------------------------------------------------------------------
// 3.3  Loss — two contexts, P1 plays highest card first (skips P2's lower card)
// -------------------------------------------------------------------------
test('Loss: playing out-of-order loses a life and triggers loss at 0 lives', async ({ browser }: { browser: Browser }) => {
  let p1Context: BrowserContext | undefined;
  let p2Context: BrowserContext | undefined;
  try {
    p1Context = await browser.newContext();
    p2Context = await browser.newContext();
    const p1: Page = await p1Context.newPage();
    const p2: Page = await p2Context.newPage();

    // maxLives=1 so any missed card ends the game immediately.
    // deckSize=10 (minimum).
    const roomCode = await createGameWithConfig(p1, { deckSize: 10, maxLives: 1 });
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // P1 plays their card immediately. With maxLives=1 and two players, if
    // P1's card is higher than P2's, P2's card is missed → lives=0 → lost.
    // We play P1's card and observe the outcome; if no miss occurred (rare
    // card distribution), P2 plays — the autocomplete rule means the last
    // remaining player auto-plays, guaranteeing the round ends cleanly if P1
    // played the lower card. In that case we rely on the retry (retries: 1
    // in playwright.config.ts) for a fresh distribution.
    //
    // To maximise determinism: both players play simultaneously so at least
    // one ordering causes a miss.

    // Trigger a loss: read each player's card value, then have the player
    // with the HIGHER card play first. This guarantees a miss — the higher
    // card skips the lower card still in the other player's hand → lives=0.
    const p1CardText = await p1.locator('.Hand .Card').first().innerText();
    const p2CardText = await p2.locator('.Hand .Card').first().innerText();
    const p1Val = parseInt(p1CardText.trim(), 10);
    const p2Val = parseInt(p2CardText.trim(), 10);

    const higherPlayer = p1Val > p2Val ? p1 : p2;
    await longPress(higherPlayer, higherPlayer.locator('.Hand').first(), 1000);
    await expect.poll(
      async () => {
        const p1HandText = await p1.locator('.Hand').first().innerText().catch(() => '');
        return p1HandText.includes('Replay') || p1HandText.includes('Finish');
      },
      { timeout: 30000 },
    ).toBeTruthy();

    // Both contexts should show loss state (Replay / Finish buttons).
    await expect(p1.locator('.Hand .replay')).toBeVisible({ timeout: 20000 });
    await expect(p2.locator('.Hand .replay')).toBeVisible({ timeout: 20000 });

    // Lives display should show 0 filled hearts.
    await waitForLives(p1, 0);
  } finally {
    await p1Context?.close();
    await p2Context?.close();
  }
});

// -------------------------------------------------------------------------
// 3.4  Restart — from loss state, click Restart → round = 1, new hands dealt
// -------------------------------------------------------------------------
test('Restart: from loss state resets to round 1 with new hands', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(90000);
  let p1Context: BrowserContext | undefined;
  let p2Context: BrowserContext | undefined;
  try {
    p1Context = await browser.newContext();
    p2Context = await browser.newContext();
    const p1: Page = await p1Context.newPage();
    const p2: Page = await p2Context.newPage();

    // Reproduce a loss state using the same approach as 3.3.
    const roomCode = await createGameWithConfig(p1, { deckSize: 10, maxLives: 1 });
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // Trigger a loss: read each player's card value, then have the player
    // with the HIGHER card play first. Their card will skip the lower card
    // still in the other player's hand → guaranteed miss → lives=0 → loss.
    const p1CardText = await p1.locator('.Hand .Card').first().innerText();
    const p2CardText = await p2.locator('.Hand .Card').first().innerText();
    const p1Val = parseInt(p1CardText.trim(), 10);
    const p2Val = parseInt(p2CardText.trim(), 10);

    // The player with the higher card plays first → guaranteed miss.
    const higherPlayer = p1Val > p2Val ? p1 : p2;
    await longPress(higherPlayer, higherPlayer.locator('.Hand').first(), 1000);

    // Wait for loss state (Replay button) on both contexts.
    await expect(p1.locator('.Hand .replay')).toBeVisible({ timeout: 30000 });

    // Press Replay (restart) — goes directly back to playing phase (round 1)
    // with new hands dealt. restartGame() calls setupGame() + setupRound().
    await longPress(p1, p1.locator('.Hand .replay'), 1500);

    // After restart: round 1, playing phase, new hands dealt.
    await waitForRound(p1, 1);
    await expect(p1.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
    await expect(p2.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
  } finally {
    await p1Context?.close();
    await p2Context?.close();
  }
});

// -------------------------------------------------------------------------
// 3.5  End game — from loss state, click Finish → home screen for both
// -------------------------------------------------------------------------
test('End game: Finish from loss state returns all contexts to home screen', async ({ browser }: { browser: Browser }) => {
  let p1Context: BrowserContext | undefined;
  let p2Context: BrowserContext | undefined;
  try {
    p1Context = await browser.newContext();
    p2Context = await browser.newContext();
    const p1: Page = await p1Context.newPage();
    const p2: Page = await p2Context.newPage();

    // Reproduce a loss state.
    const roomCode = await createGameWithConfig(p1, { deckSize: 10, maxLives: 1 });
    await joinGame(p2, roomCode);
    await expect(p1.locator('.playerLobby .Player')).toHaveCount(2, { timeout: 20000 });

    await p1.locator('.Start').click();
    await waitForPhase(p1, 'playing');
    await waitForPhase(p2, 'playing');

    // Trigger loss deterministically: player with the higher card plays first.
    const p1eVal = parseInt((await p1.locator('.Hand .Card').first().innerText()).trim(), 10);
    const p2eVal = parseInt((await p2.locator('.Hand .Card').first().innerText()).trim(), 10);
    const higherE = p1eVal > p2eVal ? p1 : p2;
    await longPress(higherE, higherE.locator('.Hand').first(), 1000);
    await expect(p1.locator('.Hand .replay')).toBeVisible({ timeout: 30000 });
    await expect(p2.locator('.Hand .replay')).toBeVisible({ timeout: 30000 });

    // Press Finish (end game) — it uses the endBuffer, not the replayBuffer.
    // The Finish button (.endgame) is the second button in the Hand.
    await longPress(p1, p1.locator('.Hand .endgame').first(), 1000);

    // Both contexts should return to the home screen (Create button visible).
    await expect(p1.locator('.Create')).toBeVisible({ timeout: 20000 });
    await expect(p2.locator('.Create')).toBeVisible({ timeout: 20000 });
  } finally {
    await p1Context?.close();
    await p2Context?.close();
  }
});
