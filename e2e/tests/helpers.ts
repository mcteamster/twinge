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
  // Use pressSequentially (not fill) so React's onChange fires on each
  // keystroke — fill() sets the value directly without dispatching input events.
  await rename.pressSequentially(name, { delay: 50 });
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
