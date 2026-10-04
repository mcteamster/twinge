import { test as base, type Browser, type BrowserContext } from '@playwright/test';

const BLOCK_PATTERN = '**/api.ohnomer.com/**';
const STUB_RESPONSE = { status: 200, body: '{}' };
const TEST_REGION_SCRIPT = () => localStorage.setItem('region', 'TEST');

// Intercept api.ohnomer.com so E2E test room creations don't pollute tracking data.
// Force region to TEST so rooms are created on the test stack not prod.
// Applies to pages created via the `page` / `context` fixtures.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(BLOCK_PATTERN, route => route.fulfill(STUB_RESPONSE));
    await context.addInitScript(TEST_REGION_SCRIPT);
    await use(context);
  },
});

// Helper for tests that create their own browser contexts via `browser.newContext()`
export async function newContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  await ctx.route(BLOCK_PATTERN, route => route.fulfill(STUB_RESPONSE));
  await ctx.addInitScript(TEST_REGION_SCRIPT);
  return ctx;
}

export { expect } from '@playwright/test';
export type { Browser, BrowserContext, Page } from '@playwright/test';
