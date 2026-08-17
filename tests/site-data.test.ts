import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPublicMarkdown } from '../src/lib/markdown';
import { websitePublicationArtifacts } from '../src/lib/publication-source';
import {
  getSiteData,
  validateEditorialReferences,
} from '../src/lib/site-data';

describe('publication input boundary', () => {
  it('validates only the upstream-generated bundle and its bound revisions', () => {
    const output = execFileSync('node', ['scripts/publication-input.mjs', 'validate'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const artifacts = websitePublicationArtifacts();
    expect(artifacts.length).toBeGreaterThan(0);
    expect(output).toContain(`Publication input validated: website-approved=${artifacts.length}`);
    for (const artifact of artifacts) {
      expect(path.posix.isAbsolute(artifact.source_path)).toBe(false);
      expect(path.win32.isAbsolute(artifact.source_path)).toBe(false);
      expect(path.posix.isAbsolute(artifact.bundle_path)).toBe(false);
      expect(path.win32.isAbsolute(artifact.bundle_path)).toBe(false);
    }
  });
});

describe('website-approved data adapter', () => {
  it('loads every approved translation without assuming a current artifact count', async () => {
    const data = await getSiteData();
    const approvedTranslations = websitePublicationArtifacts()
      .filter((artifact) => artifact.content_category === 'translation');
    expect(data.articles).toHaveLength(approvedTranslations.length);
    expect(data.articles.every((article) => article.html.length > 1000)).toBe(true);
  });

  it('keeps canonical routes unique', async () => {
    const { documents } = await getSiteData();
    const routes = documents.map((document) => document.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('fails editorial references that do not exist upstream', async () => {
    const { documents } = await getSiteData();
    expect(() => validateEditorialReferences(['missing-public-id'], documents, 'Test'))
      .toThrow('unknown public document ID');
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

  it('resolves every editorial selection to a readable public document', async () => {
    const { featured, guide } = await getSiteData();
    expect(featured.every((document) => document.kind === 'readable')).toBe(true);
    expect(guide.items.every(({ document }) => document.kind === 'readable')).toBe(true);
  });

  it('does not expose a works route when no work records are published', async () => {
    const { works } = await getSiteData();
    if (works.length > 0) return;

    expect(existsSync(path.join(process.cwd(), 'src/pages/works.astro'))).toBe(false);
    for (const relativePath of ['src/layouts/BaseLayout.astro', 'src/pages/index.astro']) {
      const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      expect(source).not.toContain('href="/works"');
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
});
