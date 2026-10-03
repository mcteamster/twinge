import { type Page, expect } from '@playwright/test';

/**
 * Shared helpers for the Twinge E2E suite.
 *
 * Selectors mirror the live client DOM:
 *  - Create button:  `.Create`
 *  - Join field:     `input#inputBox` (the Join variant, placeholder "or Join Game")
 *  - Rename field:   `input#inputBox` (the Rename variant, placeholder "Set Name")
 *  - Room code:      `#roomCode` in the Header (4 uppercase letters once in a lobby)
 *  - Start button:   `.Start` (only rendered to the host, phase `open`)
 *  - Hand / cards:   `.Hand .Card` (phase `playing`)
 *  - Pile:           `.Pile .Card`
 */

/** A room code is exactly four uppercase letters, e.g. "TWNG". */
const ROOM_CODE_RE = /^[A-Z]{4}$/;

/**
 * Click Create and wait for the lobby to appear (room code visible).
 * Returns the generated room code.
 */
export async function createGame(page: Page): Promise<string> {
  await page.goto('/');
  await page.locator('.Create').click();
  // The lobby is reached once the Header shows a 4-letter room code.
  const roomCode = page.locator('#roomCode');
  await expect(roomCode).toHaveText(ROOM_CODE_RE, { timeout: 20000 });
  // The Start button confirms we are the host in an open lobby.
  await expect(page.locator('.Start')).toBeVisible({ timeout: 20000 });
  const code = (await roomCode.textContent())?.trim() ?? '';
  if (!ROOM_CODE_RE.test(code)) {
    throw new Error(`createGame: expected a 4-letter room code, got "${code}"`);
  }
  return code;
}

/**
 * Type a room code into the Join field and wait for the lobby to load.
 * Typing the 4th character auto-submits (see Join component onKeyUp).
 */
export async function joinGame(page: Page, roomCode: string): Promise<void> {
  await page.goto('/');
  const joinField = page.locator('input#inputBox.Join');
  await expect(joinField).toBeVisible({ timeout: 20000 });
  // Fill char-by-char so the component's onKeyUp handler fires and auto-joins
  // when the 4th character lands.
  await joinField.click();
  await joinField.type(roomCode, { delay: 50 });
  // Lobby reached: the Header shows the room code we joined.
  await expect(page.locator('#roomCode')).toHaveText(ROOM_CODE_RE, { timeout: 20000 });
}

/**
 * Wait for a DOM indicator of the given game phase.
 *  - `open`    => the Start button is visible (lobby, host).
 *  - `playing` => a card button is visible in the Hand.
 */
export async function waitForPhase(page: Page, phase: 'open' | 'playing'): Promise<void> {
  if (phase === 'open') {
    await expect(page.locator('.Start')).toBeVisible({ timeout: 20000 });
  } else {
    await expect(page.locator('.Hand .Card').first()).toBeVisible({ timeout: 20000 });
  }
}

/**
 * Set the current player's name via the Rename field (lobby only) and wait for
 * the lobby player display to reflect it. The host's lobby name is prefixed
 * with a star ("⭐️ <name>"), so we assert the name appears, not an exact match.
 */
export async function renamePlayer(page: Page, name: string): Promise<void> {
  const rename = page.locator('input#inputBox.Rename');
  await expect(rename).toBeVisible({ timeout: 20000 });
  // Set value via React's internal setter so a single onChange fires with the
  // full name. pressSequentially/type fire onChange per keystroke causing
  // multiple renames with the same stateHash — all but the first are rejected
  // as stale (code 5). fill() alone sets the DOM value but doesn't fire React's
  // synthetic event.
  await rename.evaluate((input: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, name);
  await expect(page.locator('.playerLobby .playerValue').first()).toContainText(name, {
    timeout: 20000,
  });
}

/**
 * Play the current player's lowest card via the press-and-hold gesture.
 *
 * The Hand uses a buffered press: a card is sent only when the mouse is held
 * past a threshold (buffer value > 25) and then released (< 150). The buffer
 * ticks every 20ms, so a ~1s hold lands safely in the send window.
 */
export async function playCard(page: Page): Promise<void> {
  const hand = page.locator('.Hand').first();
  await expect(hand).toBeVisible({ timeout: 20000 });
  const box = await hand.boundingBox();
  if (!box) throw new Error('playCard: Hand element has no bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Hold long enough for the card buffer to cross the send threshold.
  await page.waitForTimeout(1000);
  await page.mouse.up();
}

/**
 * Click the ✕ (exit/leave) button in the Header and wait for the home screen.
 * The home screen is identified by the Create button becoming visible again.
 */
export async function leaveGame(page: Page): Promise<void> {
  await page.locator('#exit').click();
  // Home screen: Create button is rendered and the room code is gone.
  await expect(page.locator('.Create')).toBeVisible({ timeout: 20000 });
}

/**
 * Wait until the lives display shows exactly `count` filled hearts (❤️).
 *
 * The Status component renders lives as repeated ❤️ / 🤍 characters inside
 * the `.Status` element. We count the ❤️ characters in the element's text.
 */
export async function waitForLives(page: Page, count: number): Promise<void> {
  await expect.poll(
    async () => {
      const text = await page.locator('.Status').innerText();
      return (text.match(/❤️/g) ?? []).length;
    },
    { timeout: 20000 },
  ).toBe(count);
}

/**
 * Wait until the Status component's Level display shows `round` as the
 * current level number (the "Level X of Y" line).
 */
export async function waitForRound(page: Page, round: number): Promise<void> {
  await expect.poll(
    async () => {
      const text = await page.locator('.Status').innerText();
      const match = text.match(/Level\s+(\d+)\s+of/i) ?? text.match(/^(\d+)\s+of/m);
      return match ? Number(match[1]) : -1;
    },
    { timeout: 20000 },
  ).toBe(round);
}

/**
 * Play every card in the current player's hand one at a time.
 *
 * Between each play we wait for the pile count to increase (or the hand
 * container to change) so the stateHash has time to update before the next
 * play attempt. Stops when `.Hand .Card` is no longer present (hand empty)
 * or when the hand area shows the "Next Level" / end-game buttons.
 */
export async function playAllCards(page: Page): Promise<void> {
  // Keep playing until there are no more Card elements in the Hand.
  while (true) {
    const cardCount = await page.locator('.Hand .Card').count();
    if (cardCount === 0) break;

    const pileBefore = await page.locator('.Pile .Card').count();

    await playCard(page);

    // Wait for the pile to grow (card was accepted) or the hand to empty.
    // If the play was rejected (stale state, code 5), the client receives a
    // corrected gamestate — wait briefly then retry rather than timing out.
    const accepted = await expect.poll(
      async () => {
        const pileNow = await page.locator('.Pile .Card').count();
        const handNow = await page.locator('.Hand .Card').count();
        return pileNow > pileBefore || handNow < cardCount;
      },
      { timeout: 8000, intervals: [200, 500, 1000] },
    ).toBeTruthy().then(() => true).catch(() => false);

    if (!accepted) {
      // Likely a stale-state rejection. Wait for the correction then retry.
      await page.waitForTimeout(1500);
      continue;
    }

    // Small delay to let the stateHash propagate before the next play.
    await page.waitForTimeout(300);
  }
}

/**
 * Perform a long-press gesture on a Playwright locator for `ms` milliseconds.
 *
 * Uses raw mouse events (mousedown → waitForTimeout → mouseup) so the buffer
 * timing matches the real browser interaction.  The locator must already be
 * visible before calling this helper.
 */
export async function longPress(page: Page, locator: ReturnType<Page['locator']>, ms: number): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error('longPress: element has no bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
