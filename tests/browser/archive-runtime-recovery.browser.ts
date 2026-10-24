import { test, expect, query, status, list, more, catalogue, search, expectResults, expectInitial, expectFailure, observeReal } from './helpers/archive-browser';

for (const stage of ['search', 'data'] as const) {
  test(`recovers on the same page after a ${stage} failure`, async ({ page, control }) => {
    control.results('alpha', 1);
    const key = stage === 'search' ? 'alpha' : 'alpha-1';
    control.fail(stage, key);
    await page.goto('/archive/');
    await search(page, 'alpha'); await expectFailure(page);
    control.recover(stage, key);
    await search(page, 'alpha'); await expectResults(page, 'alpha', 1);
  });
}

test('retries a real module network failure on the same page once the resource is available', async ({ page }) => {
  let available = false;
  let requests = 0;
  await page.route('**/pagefind/pagefind.js', async route => {
    requests++;
    if (!available) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectFailure(page);
  expect(requests).toBeGreaterThan(0);
  const failedRequests = requests;
  await query(page).fill(''); await expectInitial(page);
  available = true;
  await search(page, 'alpha');
  // Retry the module request in the same document.
  await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
  expect(requests).toBeGreaterThan(failedRequests);
});

test('clears a failed query and can search again on the same page', async ({ page, control }) => {
  control.results('alpha', 1); control.fail('search', 'alpha');
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectFailure(page);
  await query(page).fill(''); await expectInitial(page);
  control.recover('search', 'alpha');
  await search(page, 'alpha'); await expectResults(page, 'alpha', 1);
});

for (const stage of ['metadata', 'fragment'] as const) {
  test(`recovers the UI and paginates after a real ${stage} failure with one destroy`, async ({ page }) => {
    const engine = await observeReal(page);
    let available = false;
    await page.route('**/pagefind/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const target = stage === 'metadata' ? path.endsWith('/pagefind-entry.json') : path.includes('/fragment/');
      if (target && !available) await route.abort('failed');
      else await route.fallback();
    });
    await page.goto('/archive/');
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await search(page, 'alpha'); await expectFailure(page);
    available = true;
    await search(page, 'alpha');
    await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
    expect(await list(page).getByRole('listitem').count()).toBe(10);
    expect(await catalogue(page).isVisible()).toBe(false);
    await more(page).click();
    await expect.poll(() => list(page).getByRole('listitem').count()).toBe(12);
    expect(await more(page).isVisible()).toBe(false);
    const links = await list(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(new Set(links).size).toBe(12);
    expect((await engine.calls()).filter(call => call === 'destroy')).toHaveLength(1);
    expect(navigations, 'Recovery must not reload the page').toBe(0);
  });
}

test('recovers with the unwrapped real Pagefind module after a fragment failure', async ({ page }) => {
  let available = false;
  await page.route('**/pagefind/fragment/**', async route => {
    if (!available) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectFailure(page);
  available = true;
  await search(page, 'alpha');
  await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
  expect(await list(page).getByRole('listitem').count()).toBe(10);
  await more(page).click();
  await expect.poll(() => list(page).getByRole('listitem').count()).toBe(12);
});

test('does not destroy a healthy runtime during searches, pagination or clearing', async ({ page, control }) => {
  control.results('alpha', 12); control.results('beta', 2);
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
  await more(page).click();
  await expect.poll(() => list(page).getByRole('listitem').count()).toBe(12);
  await expectResults(page, 'alpha', 12);
  await search(page, 'beta'); await expectResults(page, 'beta', 2);
  await query(page).fill(''); await expectInitial(page);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(0);
});

test('shares one pending destroy across consecutive retry submissions', async ({ page, control }) => {
  control.results('alpha', 12); control.fail('search', 'alpha');
  const reset = control.hold('destroy', 'runtime');
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectFailure(page);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(0);
  control.recover('search', 'alpha');
  try {
    await search(page, 'alpha'); await reset.requested;
    await search(page, 'alpha'); await search(page, 'alpha');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(1);
    expect(control.calls.filter(call => call.kind === 'search')).toHaveLength(1);
    reset.release(); await control.settled('destroy', 'runtime', 0);
    await expectResults(page, 'alpha', 12, 10);
    expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(1);
    expect(control.calls.filter(call => call.kind === 'search' && call.generation === 1)).toHaveLength(1);
  } finally { reset.release(); }
});

for (const action of ['change', 'clear'] as const) {
  test(`handles ${action} during a real public destroy without restoring a stale query`, async ({ page }) => {
    const engine = await observeReal(page);
    let available = false;
    await page.route('**/pagefind/fragment/**', async route => {
      if (!available) await route.abort('failed');
      else await route.continue();
    });
    await page.goto('/archive/');
    await search(page, 'alpha'); await expectFailure(page);
    available = true;
    const reset = await engine.holdDestroy();
    try {
      await search(page, 'alpha'); await reset.requested;
      if (action === 'change') await search(page, 'beta');
      else { await query(page).fill(''); await expectInitial(page); }
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      expect(await engine.calls()).toEqual(['search:alpha', 'destroy']);
      await reset.release();
      await page.waitForFunction(() => (globalThis as typeof globalThis & { __realPagefindCalls: string[] }).__realPagefindCalls.includes('destroy:done'));
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      if (action === 'clear') {
        await expectInitial(page);
        expect(await engine.calls()).toEqual(['search:alpha', 'destroy', 'destroy:done']);
      } else {
        await expect.poll(() => status(page).textContent()).toBe('找到 2 篇文章');
        expect(await query(page).inputValue()).toBe('beta');
        const links = await list(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')).sort());
        expect(links).toEqual(['/archive/beta-1/', '/archive/beta-2/']);
        expect(await engine.calls()).toEqual(['search:alpha', 'destroy', 'destroy:done', 'search:beta']);
      }
    } finally { await reset.release(); }
  });
}

test('shows a second failure without automatically resetting again, then recovers on an explicit retry', async ({ page, control }) => {
  control.results('alpha', 12, 0); control.fail('search', 'alpha', 0);
  control.results('alpha', 12, 1); control.fail('search', 'alpha', 1);
  control.results('alpha', 12, 2);
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectFailure(page);
  await search(page, 'alpha'); await expectFailure(page);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(1);
  expect(control.calls.filter(call => call.kind === 'search')).toHaveLength(2);
  await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(2);
});

test('keeps the catalogue available when destroy rejects and retries it only on another submission', async ({ page, control }) => {
  control.results('alpha', 12); control.fail('search', 'alpha');
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectFailure(page);
  control.recover('search', 'alpha'); control.fail('destroy', 'runtime');
  await search(page, 'alpha'); await expectFailure(page);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(1);
  expect(control.calls.filter(call => call.kind === 'search')).toHaveLength(1);
  control.recover('destroy', 'runtime');
  await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(2);
});

for (const stage of ['search', 'data', 'pagination'] as const) {
  test(`ignores a late ${stage} rejection from the disposed runtime generation`, async ({ page, control }) => {
    const kind = stage === 'search' ? 'search' : 'data';
    const key = stage === 'search' ? 'old' : stage === 'pagination' ? 'old-11' : 'old-1';
    control.results('old', stage === 'pagination' ? 12 : 1, 0);
    control.fail(kind, key, 0);
    const old = control.hold(kind, key, 0);
    control.results('broken', 1, 0); control.fail('search', 'broken', 0);
    control.results('beta', 1, 1); control.results('gamma', 1, 1);
    try {
      await page.goto('/archive/');
      await search(page, 'old');
      if (stage === 'pagination') { await expectResults(page, 'old', 12, 10); await more(page).click(); }
      await old.requested;
      await search(page, 'broken'); await expectFailure(page);
      await search(page, 'beta'); await expectResults(page, 'beta', 1);
      old.release(); await control.settled(kind, key, 0);
      await expectResults(page, 'beta', 1);
      await search(page, 'gamma'); await expectResults(page, 'gamma', 1);
      expect(control.calls.filter(call => call.kind === 'destroy')).toEqual([{ kind: 'destroy', key: 'runtime', generation: 0 }]);
      expect(await more(page).isDisabled()).toBe(false);
    } finally { old.release(); }
  });
}

test('retries a failed page from the first batch after destroying the runtime', async ({ page, control }) => {
  control.results('alpha', 22);
  control.fail('data', 'alpha-11');
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectResults(page, 'alpha', 22, 10);
  await more(page).click();
  await expect.poll(() => status(page).textContent()).toBe('结果加载失败，请重试。');
  control.recover('data', 'alpha-11');
  await more(page).click();
  await expectResults(page, 'alpha', 22, 10);
  expect(control.calls.filter(call => call.kind === 'destroy')).toHaveLength(1);
  await more(page).click();
  await expect.poll(() => list(page).getByRole('listitem').count()).toBe(20);
  await expectResults(page, 'alpha', 22, 20);
});
