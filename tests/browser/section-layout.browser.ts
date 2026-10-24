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

for (const entry of [
  { route: '/group/', label: '关于小组', names: '.group-heading__names' },
  { route: '/research/researchers/andrey-maidansky/', label: '学术入口', names: '.record__original' },
]) {
  test(`keeps ${entry.label} beside the identity in the page introduction`, async ({ page }) => {
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(entry.route);
      const intro = page.locator('.section-layout__intro');
      const resources = intro.locator('.intro-links');
      expect(await resources.getAttribute(entry.label === '关于小组' ? 'aria-label' : 'aria-labelledby'))
        .toBe(entry.label === '关于小组' ? entry.label : 'researcher-resources-heading');
      expect(await page.locator('.section-layout__sidebar').count()).toBe(0);
      const names = await box(intro.locator(entry.names));
      const links = await box(resources);
      const firstSection = await box(page.locator('.section-layout__content h2').first());
      expect(links.y).toBeGreaterThanOrEqual(names.y + names.height);
      expect(links.y + links.height).toBeLessThanOrEqual(firstSection.y);
      const anchors = resources.getByRole('link');
      expect(await anchors.count()).toBeGreaterThan(0);
      await anchors.first().focus();
      expect(await anchors.first().evaluate(element => element === document.activeElement)).toBe(true);
      await expectNoHorizontalOverflow(page);
    }
  });
}

test('aligns a wrapping directory with a multiline title and follows metadata resizing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(readingRoute);
  const title = page.getByRole('heading', { level: 1 });
  const toc = page.locator('.section-layout__toc');
  const original = await box(page.locator('.section-layout__content'));
  await page.evaluate(() => {
    document.querySelector('h1')!.textContent = '虚构的较长文章题名，用于验证换行后的目录与正文关系。'.repeat(3);
    for (const link of document.querySelectorAll('.section-layout__toc a')) {
      link.textContent = '虚构的较长章节名称，用于验证目录文字换行后的布局';
    }
    document.querySelector('.document-header .record__meta')!.textContent = '虚构作者与文献元数据。'.repeat(20);
  });
  for (const width of [1440, 1024, 861]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => Math.abs((await box(toc)).y - (await box(title)).y)).toBeLessThanOrEqual(1);
    const content = await box(page.locator('.section-layout__content'));
    const directory = await box(toc);
    expect(directory.x + directory.width).toBeLessThan(content.x);
    expect(await toc.locator('a').first().evaluate(element => element.getBoundingClientRect().height
      > parseFloat(getComputedStyle(element).lineHeight))).toBe(true);
    expect(await title.evaluate(element => element.getBoundingClientRect().height
      > parseFloat(getComputedStyle(element).lineHeight))).toBe(true);
    await expectNoHorizontalOverflow(page);
    if (width === 1440) {
      expect(content.x).toBe(original.x);
      expect(content.width).toBe(original.width);
    }
  }
  await page.evaluate(() => scrollTo(0, 900));
  await expect.poll(async () => Math.abs((await box(toc)).y
    - await toc.evaluate(element => parseFloat(getComputedStyle(element).top)))).toBeLessThanOrEqual(1);
});

test('keeps inline academic links clear of an optional portrait and a long name', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/research/researchers/andrey-maidansky/');
    // Exercise the existing optional-portrait CSS with fictional content, without changing publication inputs.
    await page.evaluate(() => {
      document.querySelector('.research-profile')!.classList.add('research-profile--portrait');
      document.querySelector('h1')!.textContent = '虚构研究者的较长中文姓名，用于检查标题换行';
      const portrait = document.createElement('img');
      portrait.className = 'researcher-portrait';
      portrait.width = 160; portrait.height = 213; portrait.alt = '虚构测试人物照片';
      portrait.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="213"/>');
      document.querySelector('.researcher-heading')!.prepend(portrait);
    });
    const portrait = await box(page.getByRole('img', { name: '虚构测试人物照片' }));
    const links = await box(page.locator('.intro-links'));
    const overlap = Math.min(portrait.x + portrait.width, links.x + links.width) - Math.max(portrait.x, links.x) > 1
      && Math.min(portrait.y + portrait.height, links.y + links.height) - Math.max(portrait.y, links.y) > 1;
    expect(overlap).toBe(false);
    await expectNoHorizontalOverflow(page);
  }
});
