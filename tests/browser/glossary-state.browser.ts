import type { Page } from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import { test as browserTest, expect } from './helpers/browser';
import { buildGlossaryFixture } from './helpers/glossary-fixture';
import { startStaticSite } from './helpers/static-site';

let fixture: Awaited<ReturnType<typeof buildGlossaryFixture>>;
beforeAll(async () => { fixture = await buildGlossaryFixture(); }, 40_000);
afterAll(async () => { await fixture?.cleanup(); });

const test = browserTest.extend({
  site: async ({}, use) => {
    const site = await startStaticSite(fixture.directory, ['glossary/index.html']);
    try { await use(site); }
    finally { await site.close(); }
  },
});

const query = (page: Page) => page.getByRole('searchbox', { name: '搜索术语', exact: true });
const select = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
const route = (collection: string, id: string) => `/glossary/${collection}/${id}/`;
const shared = ['fixture-alpha', 'fixture-beta', 'terms'].map(collection => route(collection, 'shared'));

async function open(page: Page, search = '') {
  await page.goto(`/glossary/${search}`);
  await query(page).waitFor({ state: 'visible' });
}

async function expectState(page: Page, filters: Record<string, string>, routes: string[], active = true) {
  await expect.poll(() => page.locator('[data-glossary-entry]:not([hidden])')
    .evaluateAll(items => items.map(item => item.getAttribute('data-glossary-entry')).sort()))
    .toEqual([...routes].sort());
  for (const name of ['q', 'category', 'collection', 'type']) {
    expect(await page.locator(`[name="${name}"]`).inputValue()).toBe(filters[name] ?? '');
    expect(new URL(page.url()).searchParams.get(name)).toBe(filters[name] || null);
  }
  expect(await page.getByRole('status').textContent()).toBe(`${active ? '找到' : '共'} ${routes.length} 个词条`);
  expect(await page.locator('[data-glossary-empty]').isVisible()).toBe(routes.length === 0);
}

test('intersects keyword, category and collection, and clears incompatible filters when switching to name types', async ({ page }) => {
  await open(page);
  await query(page).fill('思维');
  await expectState(page, { q: '思维' }, shared);
  await select(page, '类别').selectOption('concepts');
  await expectState(page, { q: '思维', category: 'concepts' }, shared.slice(0, 2));
  expect(await select(page, '名称类型').isDisabled()).toBe(true);
  await select(page, '作者').selectOption('fixture-alpha');
  await expectState(page, { q: '思维', category: 'concepts', collection: 'fixture-alpha' }, [shared[0]]);
  await select(page, '类别').selectOption('terms');
  await expectState(page, { q: '思维', category: 'terms' }, [shared[2]]);
  expect(await select(page, '作者').isDisabled()).toBe(true);
  await query(page).fill('测试');
  await select(page, '类别').selectOption('names');
  await select(page, '名称类型').selectOption('person');
  await expectState(page, { q: '测试', category: 'names', type: 'person' }, [route('glossary', 'person')]);
  await select(page, '名称类型').selectOption('work');
  await expectState(page, { q: '测试', category: 'names', type: 'work' }, [route('glossary', 'work')]);
});

test('restores multiple filters from the URL and after refresh', async ({ page }) => {
  await open(page, '?q=思维&category=concepts&collection=fixture-alpha');
  const filters = { q: '思维', category: 'concepts', collection: 'fixture-alpha' };
  await expectState(page, filters, [shared[0]]);
  await page.reload();
  await query(page).waitFor({ state: 'visible' });
  await expectState(page, filters, [shared[0]]);
  expect(await select(page, '作者').isEnabled()).toBe(true);
  expect(await select(page, '名称类型').isDisabled()).toBe(true);
});

test('restores controls and results on real back and forward navigation between explicitly established history entries', async ({ page }) => {
  await open(page, '?q=思维&category=concepts&collection=fixture-alpha');
  const first = { q: '思维', category: 'concepts', collection: 'fixture-alpha' };
  await expectState(page, first, [shared[0]]);
  // Filtering uses replaceState. Establish the second entry explicitly, then use the UI.
  await page.evaluate(() => {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
      document.documentElement.dataset.observedPopstates = String(Number(document.documentElement.dataset.observedPopstates ?? 0) + 1);
    });
  });
  await select(page, '类别').selectOption('names');
  await select(page, '名称类型').selectOption('person');
  await query(page).fill('测试');
  const second = { q: '测试', category: 'names', type: 'person' };
  await expectState(page, second, [route('glossary', 'person')]);
  await page.goBack();
  await expectState(page, first, [shared[0]]);
  expect(await page.locator('html').getAttribute('data-observed-popstates')).toBe('1');
  expect(await select(page, '名称类型').isDisabled()).toBe(true);
  await page.goForward();
  await expectState(page, second, [route('glossary', 'person')]);
  expect(await page.locator('html').getAttribute('data-observed-popstates')).toBe('2');
  expect(await select(page, '作者').isDisabled()).toBe(true);
});

async function composingInput(page: Page, value: string, start = false) {
  await query(page).evaluate((element, { value, start }) => {
    const input = element as HTMLInputElement;
    input.focus();
    if (start) input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertCompositionText', isComposing: true }));
  }, { value, start });
}

async function endComposition(page: Page, value: string) {
  await query(page).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }));
  }, value);
}

test('ignores composing input events and applies the final value at compositionend', async ({ page }) => {
  await open(page);
  const visible = () => page.locator('[data-glossary-entry]:not([hidden])')
    .evaluateAll(items => items.map(item => item.getAttribute('data-glossary-entry')));
  const initial = await visible();
  for (const [index, value] of ['思', '思维'].entries()) {
    await composingInput(page, value, index === 0);
    expect(await query(page).inputValue()).toBe(value);
    expect(new URL(page.url()).search).toBe('');
    expect(await page.getByRole('status').textContent()).toBe('共 6 个词条');
    expect(await visible()).toEqual(initial);
  }
  await endComposition(page, '思维');
  await expectState(page, { q: '思维' }, shared);
  // A following non-composing input event must leave the committed result unchanged.
  await query(page).dispatchEvent('input', { bubbles: true, isComposing: false });
  await expectState(page, { q: '思维' }, shared);
});

test('distinguishes explicit form submission during synthetic composition from ignored composing input events', async ({ page }) => {
  await open(page);
  await composingInput(page, '思', true);
  expect(await page.getByRole('status').textContent()).toBe('共 6 个词条');
  // requestSubmit deliberately submits; synthetic composition does not reproduce an OS IME's Enter handling.
  const canceled = await page.getByRole('search').evaluate(element => {
    let canceled = false;
    element.addEventListener('submit', event => { canceled = event.defaultPrevented; }, { once: true });
    (element as HTMLFormElement).requestSubmit();
    return canceled;
  });
  expect(canceled, 'The form handles submission without navigating').toBe(true);
  await expectState(page, { q: '思' }, shared);
  await composingInput(page, '测试人物');
  expect(new URL(page.url()).searchParams.get('q')).toBe('思');
  expect(await page.getByRole('status').textContent()).toBe('找到 3 个词条');
  await endComposition(page, '测试人物');
  await expectState(page, { q: '测试人物' }, [route('glossary', 'person')]);
});

test('shows no-results feedback, clears only the keyword and fully resets filters and counts', async ({ page }) => {
  await open(page, '?q=S06无匹配&category=concepts&collection=fixture-alpha');
  await expectState(page, { q: 'S06无匹配', category: 'concepts', collection: 'fixture-alpha' }, []);
  expect(await page.locator('[data-glossary-empty]').textContent()).toContain('没有找到匹配的术语');
  await query(page).fill('');
  await expectState(page, { category: 'concepts', collection: 'fixture-alpha' }, [shared[0], route('fixture-alpha', 'action')]);
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expectState(page, {}, [...shared, route('fixture-alpha', 'action'), route('glossary', 'person'), route('glossary', 'work')], false);
  expect(await select(page, '作者').isEnabled()).toBe(true);
  expect(await select(page, '名称类型').isEnabled()).toBe(true);
  expect(await page.locator('[data-glossary-filter-summary]').textContent()).toBe('筛选类别、作者与名称类型');
});
