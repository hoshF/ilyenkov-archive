import { test, expect, query, status, list, more, catalogue, search, expectResults, expectInitial, expectFailure, observeReal } from './helpers/archive-browser';

test('searches and paginates a fictional corpus using the real Pagefind module and index', async ({ page }) => {
  await page.goto('/archive/');
  await search(page, 'alpha');
  await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
  await expect.poll(() => list(page).getByRole('listitem').count()).toBe(10);
  await more(page).click();
  await expect.poll(() => list(page).getByRole('listitem').count()).toBe(12);
  expect(await more(page).isVisible()).toBe(false);
  const links = await list(page).getByRole('link').evaluateAll(items => items.map(item => item.getAttribute('href')));
  expect(new Set(links)).toEqual(new Set(Array.from({ length: 12 }, (_, i) => `/archive/alpha-${i + 1}/`)));
  await query(page).fill('');
  await expectInitial(page);
});

test('keeps query B after the older query A completes last', async ({ page, control }) => {
  control.results('alpha', 2); control.results('beta', 1);
  const old = control.hold('search', 'alpha');
  await page.goto('/archive/');
  await search(page, 'alpha'); await old.requested;
  await search(page, 'beta'); await expectResults(page, 'beta', 1);
  old.release(); await control.settled('search', 'alpha');
  await expectResults(page, 'beta', 1);
});

test('keeps query B after the older result data completes last', async ({ page, control }) => {
  control.results('alpha', 1); control.results('beta', 1);
  const old = control.hold('data', 'alpha-1');
  await page.goto('/archive/');
  await search(page, 'alpha'); await old.requested;
  await search(page, 'beta'); await expectResults(page, 'beta', 1);
  old.release(); await control.settled('data', 'alpha-1');
  await expectResults(page, 'beta', 1);
});

for (const outcome of ['success', 'failure'] as const) {
  test(`isolates an old pagination ${outcome} from the newer query`, async ({ page, control }) => {
    control.results('alpha', 12); control.results('beta', 1);
    const old = control.hold('data', 'alpha-11');
    if (outcome === 'failure') control.fail('data', 'alpha-11');
    await page.goto('/archive/');
    await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
    await more(page).click(); await old.requested;
    await search(page, 'beta'); await expectResults(page, 'beta', 1);
    old.release(); await control.settled('data', 'alpha-11');
    await expect.poll(() => more(page).isDisabled()).toBe(false);
    await expectResults(page, 'beta', 1);
  });
}

test('keeps the new query pagination usable while old pagination details remain pending', async ({ page, control }) => {
  control.results('alpha', 12); control.results('beta', 12);
  const old = control.hold('data', 'alpha-11');
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
  await more(page).click(); await old.requested;
  await search(page, 'beta'); await expectResults(page, 'beta', 12, 10);
  try {
    expect(await more(page).isEnabled(), 'An old query must not lock the new query pagination').toBe(true);
    await more(page).click();
    await expect.poll(() => list(page).getByRole('listitem').count()).toBe(12);
    await expectResults(page, 'beta', 12);
  } finally {
    old.release(); await control.settled('data', 'alpha-11');
    await expect.poll(() => more(page).isDisabled()).toBe(false);
  }
});

for (const outcome of ['success', 'failure'] as const) {
  test(`isolates an old pagination ${outcome} with real Pagefind fragment requests`, async ({ page }) => {
    const settled = await observeReal(page);
    let hold = false;
    let started = false;
    let requested!: () => void;
    let release!: () => void;
    const arrived = new Promise<void>(resolve => { requested = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/pagefind/fragment/**', async route => {
      if (!hold) { await route.continue(); return; }
      requested();
      await gate;
      if (outcome === 'failure') await route.abort('failed');
      else await route.continue();
    });
    try {
      await page.goto('/archive/');
      await search(page, 'alpha');
      await expect.poll(() => status(page).textContent()).toBe('找到 12 篇文章');
      expect(await list(page).getByRole('listitem').count()).toBe(10);
      hold = true;
      await more(page).click(); await arrived; started = true;
      hold = false;
      await search(page, 'beta');
      await expect.poll(() => status(page).textContent()).toBe('找到 2 篇文章');
      const expected = ['/archive/beta-1/', '/archive/beta-2/'];
      const urls = () => list(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')).sort());
      expect(await urls()).toEqual(expected);
      release();
      await settled('alpha', 10); await settled('alpha', 11);
      expect(await more(page).isDisabled()).toBe(false);
      expect(await urls()).toEqual(expected);
      expect(await catalogue(page).isVisible()).toBe(false);
      expect(await more(page).isVisible()).toBe(false);
      expect(await status(page).textContent()).toBe('找到 2 篇文章');
    } finally {
      release();
      if (started) { await settled('alpha', 10); await settled('alpha', 11); }
    }
  });
}

test('keeps a new query error when the old pagination fails later', async ({ page, control }) => {
  control.results('alpha', 12); control.results('beta', 1);
  const old = control.hold('data', 'alpha-11');
  control.fail('data', 'alpha-11'); control.fail('search', 'beta');
  await page.goto('/archive/');
  await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
  await more(page).click(); await old.requested;
  await search(page, 'beta'); await expectFailure(page);
  old.release(); await control.settled('data', 'alpha-11');
  await expectFailure(page);
  expect(await more(page).isDisabled()).toBe(false);
});

for (const outcome of ['success', 'failure'] as const) {
  test(`keeps the cleared catalogue after an old pagination ${outcome}`, async ({ page, control }) => {
    control.results('alpha', 12);
    const old = control.hold('data', 'alpha-11');
    if (outcome === 'failure') control.fail('data', 'alpha-11');
    await page.goto('/archive/');
    await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
    await more(page).click(); await old.requested;
    await query(page).fill(''); await expectInitial(page);
    old.release(); await control.settled('data', 'alpha-11');
    await expectInitial(page);
    expect(await more(page).isDisabled()).toBe(false);
  });
}

for (const outcome of ['success', 'failure'] as const) {
  test(`keeps new pagination disabled when the old pagination ${outcome} finishes`, async ({ page, control }) => {
    control.results('alpha', 12); control.results('beta', 12);
    const old = control.hold('data', 'alpha-11');
    const current = control.hold('data', 'beta-11');
    if (outcome === 'failure') control.fail('data', 'alpha-11');
    try {
      await page.goto('/archive/');
      await search(page, 'alpha'); await expectResults(page, 'alpha', 12, 10);
      await more(page).click(); await old.requested;
      await search(page, 'beta'); await expectResults(page, 'beta', 12, 10);
      expect(await more(page).isEnabled()).toBe(true);
      await more(page).click(); await current.requested;
      old.release(); await control.settled('data', 'alpha-11');
      expect(await more(page).isDisabled()).toBe(true);
      await expectResults(page, 'beta', 12, 10);
      current.release(); await control.settled('data', 'beta-11');
      await expectResults(page, 'beta', 12);
      expect(await more(page).isDisabled()).toBe(false);
    } finally {
      old.release(); current.release();
      await control.settled('data', 'alpha-11');
    }
  });
}

for (const outcome of ['success', 'failure'] as const) {
  test(`clearing an in-flight query restores the catalogue after its late ${outcome}`, async ({ page, control }) => {
    control.results('alpha', 1);
    const pending = control.hold('search', 'alpha');
    if (outcome === 'failure') control.fail('search', 'alpha');
    await page.goto('/archive/');
    await search(page, 'alpha'); await pending.requested;
    expect(await status(page).textContent()).toBe('正在搜索…');
    await query(page).fill(''); await expectInitial(page);
    pending.release(); await control.settled('search', 'alpha');
    await expectInitial(page);
  });
}
