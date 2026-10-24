import type { Locator, Page } from 'playwright';
import { test, expect } from './helpers/browser';

const readingRoute = '/archive/reality-of-the-ideal/';

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds, 'The layout region must have a visible box').not.toBeNull();
  return bounds!;
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport + 1);
}

for (const route of [readingRoute, '/archive/']) {
  test(`keeps the desktop rail beside the content on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const content = await box(page.locator('.section-layout__content'));
    // The indexed wrapper has no box; its directory is the actual grid item.
    const rail = await box(page.locator(route === readingRoute
      ? '.section-layout__toc' : '.section-layout__sidebar'));
    expect(rail.x + rail.width).toBeLessThanOrEqual(content.x);
    expect(Math.min(rail.y + rail.height, content.y + content.height))
      .toBeGreaterThan(Math.max(rail.y, content.y));
    await expectNoHorizontalOverflow(page);
  });

  test(`has no horizontal overflow on narrow screens on ${route}`, async ({ page }) => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalOverflow(page);
      const content = await box(page.locator('.section-layout__content'));
      expect(content.x).toBeGreaterThanOrEqual(0);
      expect(content.x + content.width).toBeLessThanOrEqual(width + 1);
    }
  });
}

test('switches reading directories at the breakpoint and supports the folded directory by keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(readingRoute);
  const sidebar = page.locator('.section-layout__toc');
  const folded = page.locator('.reading-outline');
  for (const width of [861, 860, 601, 600, 390, 861]) {
    await page.setViewportSize({ width, height: 900 });
    const desktop = width > 860;
    await expect.poll(() => sidebar.isVisible()).toBe(desktop);
    await expect.poll(() => folded.isVisible()).toBe(!desktop);
    expect(await page.getByRole('navigation', { name: '页内目录', exact: true }).count())
      .toBe(desktop ? 1 : 0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const summary = folded.locator('summary');
  await summary.focus();
  expect(await summary.evaluate(element => element === document.activeElement)).toBe(true);
  await summary.press('Enter');
  await expect.poll(() => folded.locator('details').getAttribute('open')).not.toBeNull();
  const firstLink = folded.getByRole('link').first();
  await page.keyboard.press('Tab');
  expect(await firstLink.evaluate(element => element === document.activeElement)).toBe(true);
  const target = (await firstLink.getAttribute('href'))!;
  await firstLink.press('Enter');
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toBe(decodeURIComponent(target));
  const targetVisible = await page.evaluate(hash => {
    const heading = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!heading) return false;
    const bounds = heading.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < innerHeight;
  }, target);
  expect(targetVisible).toBe(true);
});

test('keeps a reading page without a directory in a centered single column', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/group/0/');
    expect(await page.locator('.section-layout__sidebar').count()).toBe(0);
    expect(await page.locator('.reading-outline').count()).toBe(0);
    const content = await box(page.locator('.section-layout__content'));
    const article = await box(page.getByRole('article'));
    const title = await box(page.getByRole('heading', { level: 1 }));
    expect(Math.abs(content.x + content.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(article.x - content.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(article.width - content.width)).toBeLessThanOrEqual(1);
    expect(title.y + title.height).toBeLessThanOrEqual(article.y);
    await expectNoHorizontalOverflow(page);
  }
});
