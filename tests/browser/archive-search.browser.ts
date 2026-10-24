import { test, expect } from './helpers/browser';

test('loads real Pagefind, paginates results and restores the archive when cleared', async ({ page }) => {
  const moduleResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/pagefind/pagefind.js');
  await page.goto('/archive/');
  const search = page.getByRole('region', { name: '文章搜索', exact: true });
  const query = search.getByRole('searchbox', { name: '搜索文章', exact: true });
  const status = search.getByRole('status', { includeHidden: true });
  const results = search.getByRole('list', { includeHidden: true });
  const rows = results.getByRole('listitem', { includeHidden: true });
  const more = search.getByRole('button', { name: '更多结果', exact: true, includeHidden: true });
  const catalogue = page.locator('[data-archive-list]');
  expect(await catalogue.isVisible()).toBe(true);
  await query.fill('思维');
  await query.press('Enter');
  expect((await moduleResponse).status()).toBe(200);
  await expect.poll(() => status.textContent(), { timeout: 10_000 }).toMatch(/^找到 \d+ 篇文章$/);
  const total = Number((await status.textContent())!.match(/\d+/)![0]);
  // A pagination smoke test requires more than one batch, not a fixed corpus count.
  expect(total, 'The 思维 query needs more than 10 results to exercise pagination in this build').toBeGreaterThan(10);
  await expect.poll(() => rows.count()).toBe(10);
  expect(await catalogue.isVisible()).toBe(false);
  for (let shown = 10; shown < total; shown += 10) {
    expect(await more.isVisible()).toBe(true);
    await more.click();
    await expect.poll(() => rows.count(), { timeout: 10_000 }).toBe(Math.min(shown + 10, total));
  }
  expect(await more.isVisible()).toBe(false);
  const urls = await results.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(new Set(urls).size).toBe(total);
  expect(await status.textContent()).toBe(`找到 ${total} 篇文章`);
  await query.fill('');
  await expect.poll(() => catalogue.isVisible()).toBe(true);
  expect(await results.isVisible()).toBe(false);
  expect(await rows.count()).toBe(0);
  expect(await more.isVisible()).toBe(false);
  expect(await status.textContent()).toBe('');
});
