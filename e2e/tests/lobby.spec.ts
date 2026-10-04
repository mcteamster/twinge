import { test, expect } from '../fixtures';
import { createGame, renamePlayer, waitForPhase } from './helpers';

test.describe('Lobby', () => {
  test('Create -> lobby: room code and Start button appear', async ({ page }) => {
    const roomCode = await createGame(page);
    expect(roomCode).toMatch(/^[A-Z]{4}$/);
    await expect(page.locator('#roomCode')).toHaveText(roomCode);
    await expect(page.locator('.Start')).toBeVisible();
  });

  test('Rename: player name display updates', async ({ page }) => {
    await createGame(page);
    await renamePlayer(page, 'ALICE');
    // Host lobby name is star-prefixed ("⭐️ ALICE"), so assert containment.
    await expect(page.locator('.playerLobby .playerValue').first()).toContainText('ALICE');
  });

  test('Start (single player): transitions to playing phase', async ({ page }) => {
    await createGame(page);
    await waitForPhase(page, 'open');
    await page.locator('.Start').click();
    // Playing phase: a card button is visible in the Hand.
    await waitForPhase(page, 'playing');
    await expect(page.locator('.Hand .Card').first()).toBeVisible();
  });
});
