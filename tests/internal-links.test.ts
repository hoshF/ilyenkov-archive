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
  it('uses URLs without trailing slashes and resolves every local anchor destination', () => {
    const root = path.join(process.cwd(), 'dist');
    const pages = htmlFiles(root);
    expect(pages.length).toBeGreaterThan(0);
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        const { pathname } = new URL(href.replaceAll('&amp;', '&'), 'https://local.invalid');
        expect(pathname === '/' || !pathname.endsWith('/'), `${path.relative(root, file)} → ${href}`).toBe(true);
        const destination = path.join(root, decodeURIComponent(pathname));
        expect(existsSync(path.join(destination, 'index.html')) || (existsSync(destination) && path.extname(destination) !== ''),
          `${path.relative(root, file)} → ${href}`).toBe(true);
      }
    }
  });
});
