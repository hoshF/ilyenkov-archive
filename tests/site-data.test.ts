import { execFileSync } from 'node:child_process';
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
    expect(output).toContain('Publication input validated: website-approved=6');
    expect(websitePublicationArtifacts()).toHaveLength(6);
  });
});

describe('website-approved data adapter', () => {
  it('loads six readable translations without assuming repository publication', async () => {
    const data = await getSiteData();
    expect(data.articles).toHaveLength(6);
    expect(data.works).toHaveLength(0);
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

  it('does not expose research-repository paths', async () => {
    const data = await getSiteData();
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('/Users/hoshf/Project/Ilyenkov/');
    expect(serialized).not.toContain('dist/public');
    expect(serialized).not.toContain('maidansky_markdown/');
    expect(serialized).not.toContain('translation_workspace/');
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
