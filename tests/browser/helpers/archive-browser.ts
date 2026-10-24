import type { Page } from 'playwright';
import { afterAll, beforeAll } from 'vitest';
import { test as browserTest, expect } from './browser';
export { expect } from './browser';
import { buildArchiveFixture } from './archive-fixture';
import { installPagefindControl, observeRealPagefind } from './pagefind-control';
import { startStaticSite } from './static-site';

let fixture: Awaited<ReturnType<typeof buildArchiveFixture>>;
beforeAll(async () => { fixture = await buildArchiveFixture(); }, 40_000);
afterAll(async () => { await fixture?.cleanup(); });
export const observeReal = (page: Page) => observeRealPagefind(page, fixture.directory);
export const test = browserTest.extend<{
  site: Awaited<ReturnType<typeof startStaticSite>>;
  control: Awaited<ReturnType<typeof installPagefindControl>>;
}>({
  site: async ({}, use) => {
    const site = await startStaticSite(fixture.directory, ['archive/index.html', 'pagefind/pagefind.js']);
    try { await use(site); }
    finally { await site.close(); }
  },
  control: async ({ page }, use) => {
    const control = await installPagefindControl(page);
    try { await use(control); }
    finally {
      control.releaseAll();
      expect(control.unexpected).toEqual([]);
    }
  },
});

const region = (page: Page) => page.getByRole('region', { name: '文章搜索', exact: true });
export const query = (page: Page) => region(page).getByRole('searchbox');
export const status = (page: Page) => region(page).getByRole('status', { includeHidden: true });
export const list = (page: Page) => region(page).getByRole('list', { includeHidden: true });
export const more = (page: Page) => region(page).getByRole('button', { name: '更多结果', includeHidden: true });
export const catalogue = (page: Page) => page.locator('[data-archive-list]');

export async function search(page: Page, text: string) {
  await query(page).fill(text);
  await query(page).press('Enter');
}
export async function expectResults(page: Page, name: string, total: number, shown = total) {
  await expect.poll(() => status(page).textContent()).toBe(`找到 ${total} 篇文章`);
  expect(await list(page).isVisible()).toBe(true);
  expect(await catalogue(page).isVisible()).toBe(false);
  const expected = Array.from({ length: shown }, (_, i) => `/archive/${name}-${i + 1}/`);
  expect(await list(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(expected);
  expect(await more(page).isVisible()).toBe(shown < total);
}
export async function expectInitial(page: Page) {
  await expect.poll(() => status(page).textContent()).toBe('');
  expect(await catalogue(page).isVisible()).toBe(true);
  expect(await list(page).isVisible()).toBe(false);
  expect(await list(page).getByRole('listitem', { includeHidden: true }).count()).toBe(0);
  expect(await more(page).isVisible()).toBe(false);
}
export async function expectFailure(page: Page) {
  await expect.poll(() => status(page).textContent(), { timeout: 10_000 }).toBe('搜索暂时不可用，请使用下方文章列表或分类浏览。');
  expect(await catalogue(page).isVisible()).toBe(true);
  expect(await list(page).isVisible()).toBe(false);
  expect(await more(page).isVisible()).toBe(false);
}
