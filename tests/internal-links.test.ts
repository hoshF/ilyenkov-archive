import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}

describe('built internal navigation', () => {
  it('uses trailing-slash routes, file URLs without one, and resolves every local anchor destination', () => {
    const root = path.join(process.cwd(), 'dist');
    const pages = htmlFiles(root);
    expect(pages.length).toBeGreaterThan(0);
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        const { pathname } = new URL(href.replaceAll('&amp;', '&'), 'https://local.invalid');
        // Cloudflare Pages 对目录路由强制尾斜杠，站点生成的内链必须与之一致，避免 308。
        // 静态文件（/rss.xml、/robots.txt 等）不带尾斜杠。
        const isFile = path.extname(pathname) !== '';
        expect(pathname === '/' || pathname.endsWith('/') || isFile,
          `${path.relative(root, file)} → ${href}`).toBe(true);
        const destination = path.join(root, decodeURIComponent(pathname));
        expect(existsSync(path.join(destination, 'index.html')) || (existsSync(destination) && path.extname(destination) !== ''),
          `${path.relative(root, file)} → ${href}`).toBe(true);
      }
    }
  });
});
