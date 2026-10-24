import type { Page } from 'playwright';
import { searchGlossary, type GlossarySearchEntry } from '../../src/lib/glossary-query';
import { test, expect } from './helpers/browser';

const visibleRoutes = (page: Page) => page.locator('[data-glossary-entry]:not([hidden])')
  .evaluateAll(items => items.map(item => item.getAttribute('data-glossary-entry')));

async function readEntries(page: Page) {
  const entries = JSON.parse((await page.locator('[data-glossary-data]').textContent())!) as GlossarySearchEntry[];
  expect(entries.length, 'The existing build needs at least one glossary entry for a search smoke test').toBeGreaterThan(0);
  return entries;
}

test('loads glossary controls, filters into the URL and restores the list when cleared', async ({ page }) => {
  await page.goto('/glossary/');
  const query = page.getByRole('searchbox', { name: '搜索术语', exact: true });
  await query.waitFor({ state: 'visible' });
  for (const name of ['类别', '作者', '名称类型']) {
    expect(await page.getByRole('combobox', { name, exact: true }).isVisible()).toBe(true);
  }
  const entries = await readEntries(page);
  const keyword = entries[0].zh_preferred;
  const expected = searchGlossary(entries, { query: keyword }).map(entry => entry.route);
  await query.fill(keyword);
  await expect.poll(() => visibleRoutes(page)).toEqual(expected);
  expect(new URL(page.url()).searchParams.get('q')).toBe(keyword.trim());
  expect(await query.inputValue()).toBe(keyword);
  await query.fill('');
  await expect.poll(() => visibleRoutes(page)).toEqual(searchGlossary(entries).map(entry => entry.route));
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
});

test('restores the glossary query, category and results after refresh', async ({ page }) => {
  await page.goto('/glossary/');
  const query = page.getByRole('searchbox', { name: '搜索术语', exact: true });
  await query.waitFor({ state: 'visible' });
  const entries = await readEntries(page);
  const { zh_preferred: keyword, category } = entries[0];
  await page.getByRole('combobox', { name: '类别', exact: true }).selectOption(category);
  await query.fill(keyword);
  const expected = searchGlossary(entries, { query: keyword, category }).map(entry => entry.route);
  await expect.poll(() => visibleRoutes(page)).toEqual(expected);
  expect(new URL(page.url()).searchParams.get('category')).toBe(category);
  const url = page.url();
  await page.reload();
  await query.waitFor({ state: 'visible' });
  expect(page.url()).toBe(url);
  expect(await query.inputValue()).toBe(keyword);
  expect(await page.getByRole('combobox', { name: '类别', exact: true }).inputValue()).toBe(category);
  await expect.poll(() => visibleRoutes(page)).toEqual(expected);
});
