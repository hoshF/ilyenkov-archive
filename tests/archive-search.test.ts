import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getSiteData } from '../src/lib/site-data';

interface Fragment { url: string; content: string; meta: { title: string }; filters: Record<string, string[]>; }
const fragments = (root: string): Fragment[] => readdirSync(join(root, 'pagefind/fragment')).map((file) => {
  const text = gunzipSync(readFileSync(join(root, 'pagefind/fragment', file))).toString();
  return JSON.parse(text.slice(text.indexOf('{'))) as Fragment;
});
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('public article search index', () => {
  it('contains exactly the approved article routes, canonical titles and existing facets', async () => {
    const { articles } = await getSiteData();
    const indexed = fragments('dist');
    expect(indexed.map((item) => item.url.replace(/\/$/, '')).toSorted())
      .toEqual(articles.map((article) => article.route.replace(/\/$/, '')).toSorted());
    for (const article of articles) {
      const entry = indexed.find((item) => item.url.replace(/\/$/, '') === article.route.replace(/\/$/, ''))!;
      expect(entry.meta.title).toBe(article.title);
      expect((entry.filters.topic ?? []).toSorted()).toEqual(article.topics.map((term) => term.id).toSorted());
      expect((entry.filters.person ?? []).toSorted()).toEqual(article.persons.map((term) => term.id).toSorted());
      expect(entry.content).not.toMatch(/generated_from|generated_rev|publication_scope|返回文本档案/);
    }
  });

  it('rebuilds from public HTML and removes withdrawn fragments and stale files', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'ilyenkov-search-'));
    const write = (route: string, body: string) => {
      const directory = join(temporary, 'dist', route);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'index.html'), `<html lang="zh-CN"><body>${body}</body></html>`);
    };
    const build = () => execFileSync('npm', ['run', 'search:index'], {
      cwd: temporary,
      env: { ...process.env, PATH: `${join(process.cwd(), 'node_modules/.bin')}:${process.env.PATH}` },
      stdio: 'pipe',
    });
    try {
      writeFileSync(join(temporary, 'package.json'), JSON.stringify({ scripts: { 'search:index': packageJson.scripts['search:index'] } }));
      write('archive/retained', '<main data-pagefind-body><h1>测试题名</h1><p>认识活动中的具体概念</p></main><nav>NAVIGATION_SENTINEL</nav>');
      write('archive/withdrawn', '<main data-pagefind-body><h1>撤回测试</h1><p>WITHDRAWAL_SENTINEL</p></main>');
      write('books/restricted', '<main>INTERNAL_PUBLIC_SENTINEL</main>');
      write('research/unselected', '<main>UNSELECTED_SENTINEL</main>');
      build();
      expect(fragments(join(temporary, 'dist'))).toHaveLength(2);
      writeFileSync(join(temporary, 'dist/pagefind/stale-sentinel'), 'stale');
      rmSync(join(temporary, 'dist/archive/withdrawn'), { recursive: true });
      build();
      const output = fragments(join(temporary, 'dist'));
      expect(output).toHaveLength(1);
      expect(output[0].content.replace(/\u200b/g, '')).toContain('认识活动中的具体概念');
      expect(JSON.stringify(output)).not.toMatch(/WITHDRAWAL_SENTINEL|INTERNAL_PUBLIC_SENTINEL|UNSELECTED_SENTINEL|NAVIGATION_SENTINEL/);
      expect(readdirSync(join(temporary, 'dist/pagefind'))).not.toContain('stale-sentinel');
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }, 30000);
});
