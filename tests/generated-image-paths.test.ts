import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGeneratedImagePath } from '../src/lib/generated-image-paths.mjs';

const dist = path.join(process.cwd(), 'dist');
const htmlFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(directory, entry.name);
  if (entry.isDirectory()) return entry.name === 'pagefind' ? [] : htmlFiles(full);
  return entry.name.endsWith('.html') ? [full] : [];
});

describe('generated image paths in development', () => {
  it('covers every built image that is not a static file from public/', () => {
    const sources = new Set(htmlFiles(dist).flatMap((file) => (
      [...readFileSync(file, 'utf8').matchAll(/<img\b[^>]*\bsrc="(\/[^"?#]+)"/g)].map(([, src]) => decodeURI(src))
    )));
    const generated = [...sources].filter((src) => !existsSync(path.join(process.cwd(), 'public', src)));
    expect(generated.length).toBeGreaterThan(0);
    for (const src of generated) {
      expect(isGeneratedImagePath(src), src).toBe(true);
      // 构建产物里它们是真实文件，线上不经过开发服务器的改写。
      expect(existsSync(path.join(dist, src)), src).toBe(true);
    }
  });

  it('leaves pages and static images from public/ alone', () => {
    for (const src of ['/ilyenkov/', '/archive/an-article/', '/archive/an-article/media/', '/research/researchers/a-person/',
      '/favicon.svg', '/covers/book.jpg', '/ilyenkov/portrait.webp/', '/archive/an-article/media/../secret.png']) {
      expect(isGeneratedImagePath(src), src).toBe(false);
    }
    for (const src of ['/archive/an-article/media/img-1.jpeg', '/ilyenkov/portrait.webp', '/research/researchers/a-person/portrait.jpg']) {
      expect(isGeneratedImagePath(src), src).toBe(true);
    }
  });
});
