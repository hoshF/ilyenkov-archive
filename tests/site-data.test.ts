import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPublicMarkdown } from '../src/lib/markdown';
import {
  generatedArticleIds,
  resolveGeneratedArticlePath,
} from '../src/lib/article-source';
import { getSiteData } from '../src/lib/site-data';

const researchRoot = path.resolve(
  process.env.ILYENKOV_ROOT?.trim() || path.join(process.cwd(), '..', 'Ilyenkov'),
);

interface WebsiteWork {
  work_id: string;
  work_json_path: string;
}

function websiteWorks(): WebsiteWork[] {
  const publication = JSON.parse(readFileSync(
    path.join(researchRoot, 'translation/publication.json'),
    'utf8',
  ));
  return publication.works.filter((work: Record<string, unknown>) => (
    work.publication_scope === 'website_public'
  ));
}

describe('translation sync boundary', () => {
  it('checks generated articles against the private website_public selection', () => {
    const output = execFileSync('node', ['scripts/sync-translations.mjs', '--check'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const selected = websiteWorks();
    expect(selected.length).toBeGreaterThan(0);
    expect(output).toContain(`stale=0 articles=${selected.length}`);
    expect(generatedArticleIds()).toEqual(selected.map((work) => work.work_id).sort());
  });

  it('combines each work.json with its Markdown as a frontmatter article', () => {
    for (const selected of websiteWorks()) {
      const work = JSON.parse(readFileSync(path.join(researchRoot, selected.work_json_path), 'utf8'));
      const article = matter(readFileSync(resolveGeneratedArticlePath(selected.work_id), 'utf8'));
      const textRelative = path.posix.join(
        path.posix.dirname(selected.work_json_path),
        `${selected.work_id}.md`,
      );
      expect(article.data).toMatchObject({
        title: work.title,
        title_zh: work.title_zh,
        source_edition: work.source_edition,
        source_url: work.source_url,
        type: 'translation',
        generated_from: `Ilyenkov:${textRelative}`,
      });
      if (work.doi) expect(article.data.doi).toBe(work.doi);
      expect(article.content).not.toMatch(/^---\r?\n/);
      expect(article.content.length).toBeGreaterThan(1000);
    }
  });

  it('keeps generated website text outside the public Git content tree', () => {
    const source = readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(source).toContain('.website-input/');
    expect(resolveGeneratedArticlePath(generatedArticleIds()[0])).toContain('/.website-input/articles/');
  });
});

describe('website-approved data adapter', () => {
  it('loads every approved translation without assuming a current artifact count', async () => {
    const data = await getSiteData();
    expect(data.articles).toHaveLength(websiteWorks().length);
    expect(data.articles.every((article) => article.html.length > 1000)).toBe(true);
  });

  it('uses source information generated directly from work.json', async () => {
    const { articles } = await getSiteData();
    expect(articles.every((article) => article.originalTitle.length > 0)).toBe(true);
    expect(articles.every((article) => article.sourceUrl?.startsWith('https://'))).toBe(true);
    expect(articles.some((article) => article.doiUrl?.startsWith('https://doi.org/'))).toBe(true);
    expect(articles.every((article) => article.sourceEdition.length > 0)).toBe(true);
  });

  it('keeps canonical routes unique', async () => {
    const { documents } = await getSiteData();
    const routes = documents.map((document) => document.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('does not expose local filesystem paths as public data', async () => {
    const data = await getSiteData();
    const publicRoutes = new Set(data.documents.map((document) => document.route));
    const strings: string[] = [];
    const collectStrings = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(collectStrings);
      else if (value && typeof value === 'object') Object.values(value).forEach(collectStrings);
    };
    collectStrings(data);

    const absolutePaths = strings.filter((value) => (
      path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
    ));
    expect(absolutePaths.every((value) => publicRoutes.has(value))).toBe(true);
    expect(strings.some((value) => value.startsWith('file:'))).toBe(false);
  });

  it('provides the long-term public information architecture without private records', () => {
    for (const route of [
      'ilyenkov.astro',
      'translations.astro',
      'works.astro',
      'research.astro',
      'group.astro',
      'publications.astro',
      'about.astro',
    ]) {
      expect(existsSync(path.join(process.cwd(), 'src/pages', route))).toBe(true);
    }
  });

  it('publishes only documents selected by the upstream website channel', async () => {
    const { documents } = await getSiteData();
    expect(documents.some((document) => document.kind === 'readable' && document.html.length > 0)).toBe(true);
    expect(documents.some((document) => document.kind === 'work')).toBe(false);
  });
});

describe('Markdown safety and semantics', () => {
  it('renders headings, quotations, lists, emphasis, links, and footnotes while dropping raw HTML', async () => {
    const html = await renderPublicMarkdown(`
## 小标题

正文与*强调*、[链接](https://example.com)和脚注[^1]。

> 引文

- 列表

<script>alert('no')</script>

[^1]: 脚注内容。
`);
    expect(html).toContain('<h2>小标题</h2>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<ul>');
    expect(html).toContain('data-footnote-ref');
    expect(html).toContain('脚注内容');
    expect(html).toContain('href="#user-content-fn-1"');
    expect(html).toContain('id="user-content-fn-1"');
    expect(html).not.toContain('user-content-user-content');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain("alert('no')");
  });

  it('replaces a manuscript notes heading with one generated notes section', async () => {
    const html = await renderPublicMarkdown(`
正文。[^1]

## 注释

[^1]: 注释内容。

## 参考文献

- A Book
`);
    expect(html.match(/<h2[^>]*>\s*注释\s*<\/h2>/g)).toHaveLength(1);
    expect(html.indexOf('参考文献')).toBeLessThan(html.indexOf('id="footnote-label"'));
    expect(html).toContain('<section data-footnotes class="footnotes">');
  });

  it('keeps an ordinary notes heading when it is not followed by footnote definitions', async () => {
    const html = await renderPublicMarkdown(`
## 注释

这是普通段落。
`);
    expect(html).toContain('<h2>注释</h2>');
    expect(html).not.toContain('data-footnotes');
  });

  it('renders compact Chinese dialogue and metadata labels as strong text', async () => {
    const html = await renderPublicMarkdown(`
**安德烈·迈丹斯基：**的确，伊里因科夫越来越受欢迎。

**关键词：**直观，主体性，逻辑范畴。
`);
    expect(html).toContain('<strong>安德烈·迈丹斯基：</strong>的确');
    expect(html).toContain('<strong>关键词：</strong>直观');
    expect(html).not.toContain('**');
  });

  it('preserves hard line breaks and GFM table alignment', async () => {
    const html = await renderPublicMarkdown(`
> 革命就这样，\\
> 翻搅着各个阶级，\\
> 却使国家权力愈发膨胀。

| 年份 | 页数 | 备注 |
|---|---:|:-:|
| 1953 | 128 | *草稿* |
`);
    expect(html).toContain('革命就这样，<br>\n翻搅着各个阶级，<br>');
    expect(html).toContain('<th align="right">页数</th>');
    expect(html).toContain('<th align="center">备注</th>');
    expect(html).toContain('<td align="center"><em>草稿</em></td>');
  });

  it('gives repeated footnote references unique anchors and backlinks', async () => {
    const html = await renderPublicMarkdown(`
第一次。[^1]

第二次。[^1]

[^1]: 被引用两次的注释。
`);
    expect(html).toContain('id="user-content-fnref-1"');
    expect(html).toContain('id="user-content-fnref-1-2"');
    expect(html).toContain('href="#user-content-fnref-1"');
    expect(html).toContain('href="#user-content-fnref-1-2"');
  });
});
