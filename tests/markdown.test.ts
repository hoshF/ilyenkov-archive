import { describe, expect, it } from 'vitest';
import { renderPublicMarkdown } from '../src/lib/markdown';

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

  it('renders photographs and resolves article-local image paths', async () => {
    const html = await renderPublicMarkdown(`
![档案照片](portrait.jpg "摄于莫斯科")

![外部照片](https://example.com/photo.webp)
`, { imageBaseUrl: '/archive/an-article/media/' });
    expect(html).toContain(
      '<img src="/archive/an-article/media/portrait.jpg" alt="档案照片" title="摄于莫斯科">',
    );
    expect(html).toContain('<img src="https://example.com/photo.webp" alt="外部照片">');
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
