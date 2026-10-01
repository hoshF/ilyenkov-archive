import { describe, expect, it } from 'vitest';
import { renderPublicMarkdown } from '../src/lib/markdown';

describe('Markdown safety and semantics', () => {
  it('renders headings, quotations, lists, emphasis, links, and footnotes while dropping raw HTML', async () => {
    const { html } = await renderPublicMarkdown(`
## 小标题

正文与*强调*、[链接](https://example.com)和脚注[^1]。

> 引文

- 列表

<script>alert('no')</script>

[^1]: 脚注内容。
`);
    expect(html).toContain('<h2 id="小标题">小标题</h2>');
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
    const { html } = await renderPublicMarkdown(`
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
    const { html } = await renderPublicMarkdown(`
## 注释

这是普通段落。
`);
    expect(html).toContain('<h2 id="注释">注释</h2>');
    expect(html).not.toContain('data-footnotes');
  });

  it('renders compact Chinese dialogue and metadata labels as strong text', async () => {
    const { html } = await renderPublicMarkdown(`
**安德烈·迈丹斯基：**的确，伊里因科夫越来越受欢迎。

**关键词：**直观，主体性，逻辑范畴。
`);
    expect(html).toContain('<strong>安德烈·迈丹斯基：</strong>的确');
    expect(html).toContain('<strong>关键词：</strong>直观');
    expect(html).not.toContain('**');
  });

  it('recognizes Chinese emphasis next to quotation marks, punctuation, and adjoining text', async () => {
    const { html, headings } = await renderPublicMarkdown(`
## *“新标题”*

自己的*“自我”*，与**“创造性马克思主义”**相联系。

*资助：*本研究。*事实。*接着叙述。***“重要。”***继续正文。
`);
    expect(html).toContain('自己的<em>“自我”</em>，与<strong>“创造性马克思主义”</strong>相联系。');
    expect(html).toContain('<em>资助：</em>本研究。<em>事实。</em>接着叙述。');
    expect(html).toContain('<em><strong>“重要。”</strong></em>继续正文。');
    expect(headings).toEqual([{ id: '“新标题”', text: '“新标题”' }]);
    expect(html).not.toContain('*');
  });

  it('closes each Chinese emphasis span without pairing delimiters across surrounding prose', async () => {
    const { html } = await renderPublicMarkdown(`
第一个*“辩证唯物主义”*学派，德波林的追随者*把辩证法从方法变成学说*，变成教条体系。

从一个系统中*“切割出一部分”*时，不应当忽视系统的其他部分。没有*运动自由*，心理就不能正常工作。
`);
    expect(html).toContain('第一个<em>“辩证唯物主义”</em>学派，德波林的追随者<em>把辩证法从方法变成学说</em>，');
    expect(html).toContain('系统中<em>“切割出一部分”</em>时，不应当忽视系统的其他部分。没有<em>运动自由</em>，');
    expect(html.match(/<em>/g)).toHaveLength(4);
    expect(html).not.toContain('*');
  });

  it('recognizes Chinese emphasis inside quotations, nested lists, and footnote definitions', async () => {
    const { html } = await renderPublicMarkdown(`
> 公羊*“共同具有”*的关系。

- **关键词：**活动。
  - *资助：*本研究。

正文。[^1]

[^1]: 不包含*“对人的身体本身的充分认识”*（定理27）。
`);
    expect(html).toContain('<blockquote>\n<p>公羊<em>“共同具有”</em>的关系。</p>');
    expect(html).toContain('<strong>关键词：</strong>活动。');
    expect(html).toContain('<li><em>资助：</em>本研究。</li>');
    expect(html).toContain('不包含<em>“对人的身体本身的充分认识”</em>（定理27）。');
    expect(html).toContain('href="#user-content-fnref-1"');
    expect(html).not.toContain('*');
  });

  it('preserves escaped stars and emphasis syntax inside inline and fenced code', async () => {
    const { html } = await renderPublicMarkdown([
      '转义：\\*“字面星号”\\*。',
      '',
      '行内代码：`*“行内代码”*`。',
      '',
      '```markdown',
      '**关键词：**正文',
      '*“代码”*。',
      '```',
    ].join('\n'));
    expect(html).toContain('<p>转义：*“字面星号”*。</p>');
    expect(html).toContain('<code>*“行内代码”*</code>');
    expect(html).toContain('<code class="language-markdown">**关键词：**正文\n*“代码”*。\n</code>');
    expect(html).not.toContain('<em>');
    expect(html).not.toContain('<strong>');
  });

  it('preserves hard line breaks and GFM table alignment', async () => {
    const { html } = await renderPublicMarkdown(`
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
    const { html } = await renderPublicMarkdown(`
![档案照片](portrait.jpg "摄于莫斯科")

![外部照片](https://example.com/photo.webp)
`, { imageBaseUrl: '/archive/an-article/media/' });
    expect(html).toContain(
      '<img src="/archive/an-article/media/portrait.jpg" alt="档案照片" title="摄于莫斯科">',
    );
    expect(html).toContain('<img src="https://example.com/photo.webp" alt="外部照片">');
  });

  it('gives repeated footnote references unique anchors and backlinks', async () => {
    const { html } = await renderPublicMarkdown(`
第一次。[^1]

第二次。[^1]

[^1]: 被引用两次的注释。
`);
    expect(html).toContain('id="user-content-fnref-1"');
    expect(html).toContain('id="user-content-fnref-1-2"');
    expect(html).toContain('href="#user-content-fnref-1"');
    expect(html).toContain('href="#user-content-fnref-1-2"');
  });

  it('numbers title and body footnotes together and links back to each reference', async () => {
    const { html, titleHtml, headings } = await renderPublicMarkdown(`
## 引言

正文注释。[^2] 再次引用标题注释。[^1]

[^2]: 正文注释内容。
[^1]: 标题注释内容。
`, {
      title: '伊里因科夫三角：马克思主义探寻哲学根源',
      titleNotes: ['1'],
    });

    expect(titleHtml).toContain('伊里因科夫三角：马克思主义探寻哲学根源');
    expect(titleHtml).toContain('href="#user-content-fn-1"');
    expect(titleHtml).toContain('id="user-content-fnref-1"');
    expect(titleHtml).toMatch(/data-footnote-ref[^>]*>1<\/a>/);
    expect(html).toMatch(/id="user-content-fnref-2"[^>]*>2<\/a>/);
    expect(html).toContain('id="user-content-fnref-1-2"');
    expect(html).toContain('href="#user-content-fnref-1"');
    expect(html).toContain('href="#user-content-fnref-1-2"');
    expect(html).toContain('href="#user-content-fnref-2"');
    expect(html.indexOf('id="user-content-fn-1"')).toBeLessThan(html.indexOf('id="user-content-fn-2"'));
    expect(html).toContain('标题注释内容。');
    expect(html).toContain('正文注释内容。');
    expect(html).not.toContain('<h1');
    expect(headings).toEqual([{ id: '引言', text: '引言' }]);
  });

  it('keeps document titles as safe plain text even when they contain Markdown or HTML', async () => {
    const { titleHtml, html } = await renderPublicMarkdown('正文。', {
      title: '**标题** <script>标题文字</script>',
    });
    expect(titleHtml).toContain('**标题** &#x3C;script>标题文字&#x3C;/script>');
    expect(titleHtml).not.toContain('<script>');
    expect(titleHtml).not.toContain('<strong>');
    expect(html).toContain('<p>正文。</p>');
    expect(html).not.toContain('标题文字');
  });

  it('anchors each section of the article on its own heading', async () => {
    const { html, headings } = await renderPublicMarkdown(`
## 摘要

正文一。[^1]

## 引言 与背景

正文二。

## 摘要

同名的一节。

[^1]: 注。
`);
    expect(headings).toEqual([
      { id: '摘要', text: '摘要' },
      { id: '引言-与背景', text: '引言 与背景' },
      { id: '摘要-2', text: '摘要' },
    ]);
    expect(html).toContain('<h2 id="摘要">摘要</h2>');
    expect(html).toContain('<h2 id="引言-与背景">引言 与背景</h2>');
    expect(html).toContain('<h2 id="摘要-2">摘要</h2>');

    // 注释一节由 remark-rehype 生成，不属于正文结构，不进索引。
    expect(headings.some((heading) => heading.text === '注释')).toBe(false);
  });
});
