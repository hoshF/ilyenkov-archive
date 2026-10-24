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
globalThis.__realPagefindCalls = [];
export async function destroy() {
  globalThis.__realPagefindCalls.push('destroy');
  if (globalThis.__holdRealDestroy) {
    globalThis.__realDestroyPending = true;
    await new Promise(resolve => { globalThis.__releaseRealDestroy = resolve; });
  }
  try {
    await actual.destroy();
    // The observation alias lives in /actual/; restore the real bundle path cleared by destroy().
    await actual.options({ basePath: '/pagefind/' });
  }
  finally { globalThis.__realPagefindCalls.push('destroy:done'); }
}
export async function search(query, options) {
  globalThis.__realPagefindCalls.push('search:' + query);
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
  const settled = async (query: string, index: number) => {
    await page.waitForFunction(id => (globalThis as typeof globalThis & { __realPagefindSettled: string[] })
      .__realPagefindSettled.includes(id), `${query}:${index}`);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  };
  return Object.assign(settled, {
    calls: () => page.evaluate(() => (globalThis as typeof globalThis & { __realPagefindCalls: string[] }).__realPagefindCalls),
    async holdDestroy() {
      await page.evaluate(() => { (globalThis as typeof globalThis & { __holdRealDestroy: boolean }).__holdRealDestroy = true; });
      return {
        requested: page.waitForFunction(() => (globalThis as typeof globalThis & { __realDestroyPending: boolean }).__realDestroyPending),
        release: () => page.evaluate(() => {
          const control = globalThis as typeof globalThis & { __holdRealDestroy: boolean; __releaseRealDestroy?: () => void };
          control.__holdRealDestroy = false;
          control.__releaseRealDestroy?.();
        }),
      };
    },
  });
}

/** Only the external Pagefind interface is replaced; the component owns all UI state. */
const moduleSource = `
const events = globalThis.__pagefindTestEvents = [];
let generation = 0;
async function request(kind, key, runtime) {
  const id = kind + ':' + key;
  events.push(id + ':start');
  try {
    const response = await fetch('/__pagefind-test/' + kind + '?key=' + encodeURIComponent(key) + '&generation=' + runtime);
    if (!response.ok) throw new Error('Synthetic Pagefind network failure: ' + response.status);
    return await response.json();
  } finally { events.push(id + ':settled', id + ':' + runtime + ':settled'); }
}
export async function init() {}
export async function destroy() {
  await request('destroy', 'runtime', generation);
  generation++;
}
export async function search(query, options) {
  const runtime = generation;
  const ids = await request('search', query, runtime);
  return { results: ids.map(id => ({ id, score: 1, data: () => request('data', id, runtime) })) };
}
`;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

export async function installPagefindControl(page: Page) {
  type Kind = 'search' | 'data' | 'destroy';
  type Plan = { body: unknown; status: number; wait?: ReturnType<typeof deferred>; arrived: ReturnType<typeof deferred> };
  const plans = new Map<string, Plan>();
  const unexpected: string[] = [];
  const calls: { kind: string; key: string; generation: number }[] = [];
  const plan = (kind: Kind, key: string, generation?: number) => {
    const id = `${kind}:${key}${generation === undefined ? '' : ':' + generation}`;
    if (!plans.has(id)) plans.set(id, { body: null, status: 200, arrived: deferred() });
    return plans.get(id)!;
  };
  plan('destroy', 'runtime').body = {};
  await page.route('**/pagefind/pagefind.js', route => route.fulfill({ contentType: 'text/javascript', body: moduleSource }));
  await page.route('**/__pagefind-test/**', async route => {
    const url = new URL(route.request().url());
    const id = `${url.pathname.split('/').at(-1)}:${url.searchParams.get('key')}`;
    const generation = Number(url.searchParams.get('generation'));
    calls.push({ kind: url.pathname.split('/').at(-1)!, key: url.searchParams.get('key')!, generation });
    const response = plans.get(`${id}:${generation}`) ?? plans.get(id);
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
    calls,
    results(query: string, count: number, generation?: number) {
      const ids = Array.from({ length: count }, (_, i) => `${query}-${i + 1}`);
      plan('search', query, generation).body = ids;
      for (const id of ids) plan('data', id, generation).body = {
        url: `/archive/${id}/`, meta: { title: `Fictional ${id}` }, excerpt: `<mark>${query}</mark> synthetic content.`,
      };
      return ids;
    },
    fail(kind: Kind, key: string, generation?: number) { plan(kind, key, generation).status = 503; },
    recover(kind: Kind, key: string, generation?: number) { plan(kind, key, generation).status = 200; },
    hold(kind: Kind, key: string, generation?: number) {
      const response = plan(kind, key, generation);
      response.wait = deferred();
      return { requested: response.arrived.promise, release: () => response.wait!.resolve() };
    },
    async settled(kind: Kind, key: string, generation?: number) {
      // Observe completion, then the next paint, so the production promise continuations have run.
      await page.waitForFunction(id => (globalThis as typeof globalThis & { __pagefindTestEvents: string[] })
        .__pagefindTestEvents.includes(id + ':settled'), `${kind}:${key}${generation === undefined ? '' : ':' + generation}`);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    },
    releaseAll() { for (const response of plans.values()) response.wait?.resolve(); },
  };
}
