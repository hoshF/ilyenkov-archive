import { chromium, type Browser, type Page } from 'playwright';
import { test as base, expect } from 'vitest';
import { startStaticSite } from './static-site';

export const test = base.extend<{
  site: Awaited<ReturnType<typeof startStaticSite>>;
  page: Page;
  expectedPageErrors: string[];
}>({
  expectedPageErrors: async ({}, use) => { await use([]); },
  site: async ({}, use) => {
    const site = await startStaticSite();
    try { await use(site); }
    finally { await site.close(); }
  },
  page: async ({ site, expectedPageErrors }, use) => {
    const started = performance.now();
    let browser: Browser | undefined;
    try {
      try {
        browser = await chromium.launch();
      } catch (error) {
        throw new Error('Chromium could not start. Install the matching browser with npx playwright install chromium, then rerun npm run test:browser.', { cause: error });
      }
      const context = await browser.newContext({ baseURL: site.url });
      const externalRequests: string[] = [];
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === site.url) return route.continue();
        externalRequests.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(10_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      console.info(`Chromium ${browser.version()}; setup ${Math.round(performance.now() - started)} ms`);
      await use(page);
      expect(externalRequests, 'Browser smoke tests must stay on the local static site').toEqual([]);
      expect(errors, 'Uncaught page errors (empty unless a test explicitly records a known dependency fault)').toEqual(expectedPageErrors);
    } finally {
      await browser?.close();
    }
  },
});

export { expect } from 'vitest';
