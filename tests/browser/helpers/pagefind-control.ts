import type { Page } from 'playwright';
import path from 'node:path';

/** Observe data() settlement around the real engine; no UI or query logic is replaced. */
export async function observeRealPagefind(page: Page, directory: string) {
  await page.route('**/pagefind/actual/pagefind.js', route => route.fulfill({
    path: path.join(directory, 'pagefind/pagefind.js'), contentType: 'text/javascript',
  }));
  await page.route('**/pagefind/pagefind.js', route => route.fulfill({
    contentType: 'text/javascript', body: `
import * as actual from './actual/pagefind.js';
export * from './actual/pagefind.js';
await actual.options({ basePath: '/pagefind/' });
globalThis.__realPagefindSettled = [];
export async function search(query, options) {
  const response = await actual.search(query, options);
  response.results.forEach((result, index) => {
    const read = result.data;
    result.data = async () => {
      try { return await read(); }
      finally { globalThis.__realPagefindSettled.push(query + ':' + index); }
    };
  });
  return response;
}
`,
  }));
  return async (query: string, index: number) => {
    await page.waitForFunction(id => (globalThis as typeof globalThis & { __realPagefindSettled: string[] })
      .__realPagefindSettled.includes(id), `${query}:${index}`);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  };
}

/** Only the external Pagefind interface is replaced; the component owns all UI state. */
const moduleSource = `
const events = globalThis.__pagefindTestEvents = [];
async function request(kind, key) {
  const id = kind + ':' + key;
  events.push(id + ':start');
  try {
    const response = await fetch('/__pagefind-test/' + kind + '?key=' + encodeURIComponent(key));
    if (!response.ok) throw new Error('Synthetic Pagefind network failure: ' + response.status);
    return await response.json();
  } finally { events.push(id + ':settled'); }
}
export async function init() {}
export async function search(query, options) {
  const ids = await request('search', query);
  return { results: ids.map(id => ({ id, score: 1, data: () => request('data', id) })) };
}
`;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

export async function installPagefindControl(page: Page) {
  type Plan = { body: unknown; status: number; wait?: ReturnType<typeof deferred>; arrived: ReturnType<typeof deferred> };
  const plans = new Map<string, Plan>();
  const unexpected: string[] = [];
  const plan = (kind: 'search' | 'data', key: string) => {
    const id = `${kind}:${key}`;
    if (!plans.has(id)) plans.set(id, { body: null, status: 200, arrived: deferred() });
    return plans.get(id)!;
  };
  await page.route('**/pagefind/pagefind.js', route => route.fulfill({ contentType: 'text/javascript', body: moduleSource }));
  await page.route('**/__pagefind-test/**', async route => {
    const url = new URL(route.request().url());
    const id = `${url.pathname.split('/').at(-1)}:${url.searchParams.get('key')}`;
    const response = plans.get(id);
    if (!response) {
      unexpected.push(id);
      await route.fulfill({ status: 500, body: 'Unexpected synthetic request' });
      return;
    }
    response.arrived.resolve();
    await response.wait?.promise;
    await route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) });
  });
  return {
    unexpected,
    results(query: string, count: number) {
      const ids = Array.from({ length: count }, (_, i) => `${query}-${i + 1}`);
      plan('search', query).body = ids;
      for (const id of ids) plan('data', id).body = {
        url: `/archive/${id}/`, meta: { title: `Fictional ${id}` }, excerpt: `<mark>${query}</mark> synthetic content.`,
      };
      return ids;
    },
    fail(kind: 'search' | 'data', key: string) { plan(kind, key).status = 503; },
    recover(kind: 'search' | 'data', key: string) { plan(kind, key).status = 200; },
    hold(kind: 'search' | 'data', key: string) {
      const response = plan(kind, key);
      response.wait = deferred();
      return { requested: response.arrived.promise, release: () => response.wait!.resolve() };
    },
    async settled(kind: 'search' | 'data', key: string) {
      // Observe completion, then the next paint, so the production promise continuations have run.
      await page.waitForFunction(id => (globalThis as typeof globalThis & { __pagefindTestEvents: string[] })
        .__pagefindTestEvents.includes(id + ':settled'), `${kind}:${key}`);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    },
    releaseAll() { for (const response of plans.values()) response.wait?.resolve(); },
  };
}
