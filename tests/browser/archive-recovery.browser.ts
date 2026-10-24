import { test, expect, query, status, list, catalogue, search, expectInitial, expectFailure } from './helpers/archive-browser';

for (const stage of ['metadata'] as const) {
  test(`recovers on the same page after a real Pagefind ${stage} network failure`, async ({ page }) => {
    let available = false;
    let failures = 0;
    await page.route('**/pagefind/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const target = stage === 'metadata' ? path.endsWith('/pagefind-entry.json') : path.includes('/fragment/');
      if (target && !available) { failures++; await route.abort('failed'); }
      else await route.continue();
    });
    await page.goto('/archive/');
    await search(page, 'alpha'); await expectFailure(page);
    expect(failures).toBeGreaterThan(0);
    await query(page).fill(''); await expectInitial(page);
    available = true;
    await search(page, 'alpha');
    await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
    expect(await list(page).getByRole('listitem').count()).toBe(10);
    expect(await catalogue(page).isVisible()).toBe(false);
  });
}

test('reports a real index-chunk network failure and recovers on the same page', async ({ page }) => {
  let available = false;
  let failed!: () => void;
  const failure = new Promise<void>(resolve => { failed = resolve; });
  await page.route('**/pagefind/index/**', async route => {
    if (!available) { await route.abort('failed'); failed(); }
    else await route.continue();
  });
  await page.goto('/archive/');
  await search(page, 'alpha'); await failure;
  await expect.poll(() => status(page).textContent()).not.toBe('正在搜索…');
  // Keep both observations even if Pagefind converts the transport failure into an empty result.
  expect.soft(await status(page).textContent()).toBe('搜索暂时不可用，请使用下方文章列表或分类浏览。');
  expect.soft(await catalogue(page).isVisible()).toBe(true);
  await query(page).fill(''); await expectInitial(page);
  available = true;
  await search(page, 'alpha');
  await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
});
