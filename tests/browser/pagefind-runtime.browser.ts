import type { Page } from 'playwright';
import { test, expect } from './helpers/archive-browser';

type SearchResponse = { results: { data: () => Promise<{ url: string; meta: Record<string, string>; excerpt: string }> }[]; search_environment?: string };
type BrowserRuntime = {
  init: () => Promise<void>; destroy: () => Promise<void>;
  options: (options: { noWorker: boolean }) => Promise<void>;
  filters: () => Promise<Record<string, Record<string, number>>>;
  preload: (query: string) => Promise<void>;
  search: (query: string, options?: { verbose?: boolean }, delay?: number) => Promise<SearchResponse>;
  debouncedSearch: (query: string, options?: { verbose?: boolean }, delay?: number) => Promise<SearchResponse>;
};
type Mode = 'worker' | 'main';
type Method = 'search' | 'preload' | 'debouncedSearch' | 'filters';

async function initialize(page: Page, mode: Mode) {
  // Article fixtures have no UI prewarming; options are applied before any initialization.
  await page.goto('/archive/alpha-1/');
  // Keep the browser import outside Vitest's server-side module transform.
  await page.addScriptTag({ type: 'module', content: 'globalThis.__pagefindReady = import("/pagefind/pagefind.js");' });
  await page.evaluate(async mode => {
    const runtime = await (globalThis as typeof globalThis & { __pagefindReady: Promise<BrowserRuntime> }).__pagefindReady;
    if (mode === 'main') await runtime.options({ noWorker: true });
    await runtime.init();
    await runtime.init();
  }, mode);
}

async function call(page: Page, method: Method) {
  return page.evaluate(async method => {
    const runtime = await (globalThis as typeof globalThis & { __pagefindReady: Promise<BrowserRuntime> }).__pagefindReady;
    let phase = 'api';
    try {
      if (method === 'filters') return { ok: true, filters: await runtime.filters() };
      if (method === 'preload') { await runtime.preload('alpha'); return { ok: true }; }
      const response = await runtime[method]('alpha', { verbose: true }, 0);
      phase = 'details';
      const entries = await Promise.all((response.results as { data: () => Promise<{ url: string; meta: Record<string, string>; excerpt: string }> }[])
        .map(async result => {
          const data = await result.data();
          return { url: data.url, title: data.meta.title, excerpt: data.excerpt };
        }));
      return { ok: true, count: response.results.length as number, environment: response.search_environment as string, entries };
    } catch (error) {
      return { ok: false, phase, message: error instanceof Error ? error.message : String(error) };
    }
  }, method);
}

async function reset(page: Page, mode: Mode) {
  await page.evaluate(async mode => {
    const runtime = await (globalThis as typeof globalThis & { __pagefindReady: Promise<BrowserRuntime> }).__pagefindReady;
    await runtime.destroy();
    if (mode === 'main') await runtime.options({ noWorker: true });
  }, mode);
}

async function expectZero(page: Page) {
  expect(await page.evaluate(async () => {
    const runtime = await (globalThis as typeof globalThis & { __pagefindReady: Promise<BrowserRuntime> }).__pagefindReady;
    return (await runtime.search('zzznomatch')).results.length;
  })).toBe(0);
}

for (const mode of ['worker', 'main'] as const) {
  test(`${mode}: healthy results, caching and legitimate zero results remain unchanged`, async ({ page }) => {
    const requests: string[] = [];
    await page.route('**/pagefind/**', async route => { requests.push(new URL(route.request().url()).pathname); await route.continue(); });
    await initialize(page, mode);
    const first = await call(page, 'search');
    expect(first).toMatchObject({ ok: true, count: 12, environment: mode === 'worker' ? 'webworker' : 'mainthread' });
    expect(new Set(first.entries!.map(entry => entry.url)).size).toBe(12);
    const count = requests.length;
    expect(await call(page, 'search')).toEqual(first);
    expect(requests).toHaveLength(count);
    expect(requests.filter(path => path.endsWith('/pagefind-entry.json'))).toHaveLength(1);
    await expectZero(page);
  });

  for (const [fault, method] of [
    ['metadata', 'search'], ['metadata', 'debouncedSearch'],
    ['index', 'search'], ['index', 'preload'], ['index', 'debouncedSearch'], ['filter', 'filters'],
  ] as const) {
    test(`${mode}: ${fault} failure rejects public ${method} without an unhandled rejection and recovers after destroy`, async ({ page }) => {
      let available = false;
      const requests: string[] = [];
      await page.route('**/pagefind/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const target = fault === 'metadata' ? path.endsWith('/pagefind-entry.json') : path.includes(fault === 'index' ? '/index/' : '/filter/');
        if (target) requests.push(path);
        if (target && !available) await route.abort('failed');
        else await route.continue();
      });
      await initialize(page, mode);
      const first = await call(page, method);
      expect(first).toMatchObject({ ok: false, phase: 'api', message: expect.any(String) });
      expect(requests.length).toBeGreaterThan(0);
      const count = requests.length;
      available = true;
      expect(await call(page, method)).toEqual(first);
      expect(requests).toHaveLength(count); // Cache a rejection, never a successful empty response.
      await reset(page, mode);
      expect(await call(page, method)).toMatchObject({ ok: true });
      expect(await call(page, 'search')).toMatchObject({ ok: true, count: 12, environment: mode === 'worker' ? 'webworker' : 'mainthread' });
      await expectZero(page);
    });
  }

  test(`${mode}: concurrent search and preloads share the failed request and all report rejection`, async ({ page }) => {
    let available = false;
    const requests: string[] = [];
    await page.route('**/pagefind/index/**', async route => {
      requests.push(new URL(route.request().url()).pathname);
      if (!available) await route.abort('failed');
      else await route.continue();
    });
    await initialize(page, mode);
    const states = await page.evaluate(async () => {
      const runtime = await (globalThis as typeof globalThis & { __pagefindReady: Promise<BrowserRuntime> }).__pagefindReady;
      await runtime.filters();
      return (await Promise.allSettled([
        runtime.search('alpha'), runtime.search('alpha'), runtime.preload('alpha'), runtime.debouncedSearch('alpha', {}, 0),
      ])).map(result => result.status);
    });
    expect(states).toEqual(['rejected', 'rejected', 'rejected', 'rejected']);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.length).toBe(new Set(requests).size);
    available = true;
    await reset(page, mode);
    expect(await call(page, 'search')).toMatchObject({ ok: true, count: 12 });
    await expectZero(page);
  });
}
