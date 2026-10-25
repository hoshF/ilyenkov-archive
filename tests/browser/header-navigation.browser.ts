import { test, expect } from './helpers/browser';

test('underlines the discussion text, spacing and external arrow as one continuous line', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const link = page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: '讨论', exact: true });
    await link.hover();
    const text = await link.evaluate(element => {
      const outer = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const content = range.getBoundingClientRect();
      return {
        start: Math.ceil(content.left - outer.left) + 1,
        end: Math.floor(content.right - outer.left) - 1,
        bottom: Math.floor(content.bottom - outer.top),
      };
    });
    const png = (await link.screenshot()).toString('base64');
    // Inspect the painted underline, including the space between text and arrow.
    // Bounds come from the rendered text, not a fixed font or screenshot snapshot.
    const continuous = await page.evaluate(async ({ png, text }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = text.bottom; y < canvas.height; y++) {
        let painted = true;
        for (let x = text.start; x <= text.end; x++) {
          const i = (y * canvas.width + x) * 4;
          if (Math.min(data[i], data[i + 1], data[i + 2]) >= 245) { painted = false; break; }
        }
        if (painted) return true;
      }
      return false;
    }, { png, text });
    expect(continuous, `Continuous discussion underline at ${width}px`).toBe(true);
  }
});

test('keeps wrapped navigation rows compact, separate and left-aligned without shrinking the type', async ({ page }) => {
  let desktopFont: string | undefined;
  for (const width of [1280, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.locator('.site-header__nav').evaluate(nav => {
      const bounds = nav.getBoundingClientRect();
      return {
        left: bounds.left,
        overflow: document.documentElement.scrollWidth - innerWidth,
        items: [...nav.querySelectorAll('a')].map(link => {
          const r = link.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, height: r.height, font: getComputedStyle(link).fontSize };
        }),
      };
    });
    if (width === 1280) { desktopFont = layout.items[0].font; continue; }
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.items.every(item => item.font === desktopFont)).toBe(true);
    expect(layout.items.every(item => item.height >= 32 && item.height < 44)).toBe(true);
    const tops = [...new Set(layout.items.map(item => item.y))].sort((a, b) => a - b);
    expect(tops.length).toBeGreaterThan(1);
    for (let i = 1; i < tops.length; i++) {
      const rowHeight = Math.max(...layout.items.filter(item => item.y === tops[i - 1]).map(item => item.height));
      const pitch = tops[i] - tops[i - 1];
      expect(pitch).toBeGreaterThanOrEqual(rowHeight - 1);
      expect(pitch).toBeLessThanOrEqual(rowHeight + 1);
    }
    for (const top of tops) {
      const row = layout.items.filter(item => item.y === top);
      expect(Math.abs(Math.min(...row.map(item => item.x)) - layout.left)).toBeLessThanOrEqual(1);
    }
  }
});
