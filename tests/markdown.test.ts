import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fromHtml } from 'hast-util-from-html';
import type { Element, Nodes } from 'hast';
import { describe, expect, it } from 'vitest';
import { renderPublicMarkdown } from '../src/lib/markdown';
import { prepareTranslationMarkdown } from '../scripts/lib/translation-markdown.mjs';

/** 只含 IHDR 头的 PNG：足以读出固有宽高。 */
function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header.writeUInt8(8, 24);
  return header;
}

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

  it('joins a marked caption to its image as a figure with the caption text unchanged', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'markdown-figures-'));
    writeFileSync(path.join(directory, 'scan.png'), pngHeader(939, 1617));
    writeFileSync(path.join(directory, 'group.png'), pngHeader(1298, 838));
    writeFileSync(path.join(directory, 'plain.png'), pngHeader(1298, 838));
    const { html } = await renderPublicMarkdown(`
![档案扫描](scan.png)

<!-- figure-caption -->
**档案卷宗（1958）（档案全宗2501）**

![合照](group.png)

<!-- figure-caption -->
*图：仍是朋友。左起：埃·伊里因科夫*

![无图注](plain.png)

**这是正文里的加粗段落，不是图注。**
`, {
      imageBaseUrl: '/archive/an-article/media/',
      imageFile: (asset) => path.join(directory, asset),
    });
    // 整段加粗或斜体只是原文写法，去掉外包装后由网站统一样式；竖图的 figure 另标规格。
    expect(html).toContain('<figure class="prose-figure--portrait"><img src="/archive/an-article/media/scan.png" alt="档案扫描" width="939" height="1617" class="prose-image--portrait"><figcaption>档案卷宗（1958）（档案全宗2501）</figcaption></figure>');
    expect(html).toContain('<figure><img src="/archive/an-article/media/group.png" alt="合照" width="1298" height="838" class="prose-image--landscape"><figcaption>图：仍是朋友。左起：埃·伊里因科夫</figcaption></figure>');
    // 没有标记的段落不猜测为图注。
    expect(html).toContain('<p><img src="/archive/an-article/media/plain.png"');
    expect(html).toContain('<p><strong>这是正文里的加粗段落，不是图注。</strong></p>');
    expect(html).not.toContain('figure-caption');
  });

  it('keeps inline markup inside a caption that is not wholly emphasized', async () => {
    const { html } = await renderPublicMarkdown(`
![照片](https://example.com/photo.webp)

<!-- figure-caption -->
*《重访》*封面，摄于莫斯科
`);
    expect(html).toContain('<figcaption><em>《重访》</em>封面，摄于莫斯科</figcaption>');
  });

  it.each([
    ['after a text paragraph', '正文。\n\n<!-- figure-caption -->\n图注'],
    ['without a caption paragraph', '![照片](https://example.com/photo.webp)\n\n<!-- figure-caption -->\n\n## 标题'],
    ['at the end of the document', '![照片](https://example.com/photo.webp)\n\n<!-- figure-caption -->'],
  ])('fails on a figure-caption marker %s', async (_case, markdown) => {
    await expect(renderPublicMarkdown(markdown)).rejects.toThrow(/figure-caption must sit between/);
  });

  it('reserves intrinsic dimensions for article-local images only', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'markdown-images-'));
    writeFileSync(path.join(directory, 'scan.png'), pngHeader(939, 1617));
    writeFileSync(path.join(directory, 'group.png'), pngHeader(1298, 838));
    writeFileSync(path.join(directory, 'square.png'), pngHeader(800, 800));
    const { html } = await renderPublicMarkdown(`
![档案扫描](scan.png)

![合照](group.png)

![方图](square.png)

![外部照片](https://example.com/photo.webp)
`, {
      imageBaseUrl: '/archive/an-article/media/',
      imageFile: (asset) => path.join(directory, asset),
    });
    // 宽大于高为横图，其余（含方图）为竖图；外部图片尺寸未知，不分规格。
    expect(html).toContain(
      '<img src="/archive/an-article/media/scan.png" alt="档案扫描" width="939" height="1617" class="prose-image--portrait">',
    );
    expect(html).toContain(
      '<img src="/archive/an-article/media/group.png" alt="合照" width="1298" height="838" class="prose-image--landscape">',
    );
    expect(html).toContain(
      '<img src="/archive/an-article/media/square.png" alt="方图" width="800" height="800" class="prose-image--portrait">',
    );
    expect(html).toContain('<img src="https://example.com/photo.webp" alt="外部照片">');
  });

  it('fails instead of rendering an article-local image without its file', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'markdown-images-'));
    await expect(renderPublicMarkdown('![缺失](missing.png)', {
      imageBaseUrl: '/archive/an-article/media/',
      imageFile: (asset) => path.join(directory, asset),
    })).rejects.toThrow();
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

  it('indexes standalone bold abstract labels without changing their presentation', async () => {
    const { html, headings } = await renderPublicMarkdown(`
**摘要**

摘要内容。

正文中提到摘要，不是目录项。

**摘要**与其他文字。

## 引言

正文。

## 摘要
`);
    expect(headings).toEqual([
      { id: '摘要', text: '摘要' },
      { id: '引言', text: '引言' },
      { id: '摘要-2', text: '摘要' },
    ]);
    expect(html).toContain('<p id="摘要"><strong>摘要</strong></p>');
    expect(html).toContain('<h2 id="摘要-2">摘要</h2>');
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

function elementsOf(node: Nodes): Element[] {
  const found: Element[] = [];
  const visit = (current: Nodes): void => {
    if (current.type === 'element') found.push(current);
    if ('children' in current) current.children.forEach(visit);
  };
  visit(node);
  return found;
}

function textOf(node: Nodes): string {
  if (node.type === 'text') return node.value;
  return 'children' in node ? node.children.map(textOf).join('') : '';
}

/** 解析生成的 HTML，读出注释号、注释条目、返回链接与全部元素 ID。 */
function footnotesOf(html: string, titleHtml = '') {
  const elements = elementsOf(fromHtml(`<h1>${titleHtml}</h1>${html}`, { fragment: true }));
  const section = elements.find((element) => element.tagName === 'section' && element.properties.dataFootnotes !== undefined);
  const items = section ? elementsOf(section).filter((element) => element.tagName === 'li') : [];
  return {
    ids: elements.map((element) => element.properties.id).filter((id) => id !== undefined).map(String),
    references: elements
      .filter((element) => element.tagName === 'a' && element.properties.dataFootnoteRef !== undefined)
      .map((link) => ({ label: textOf(link), href: String(link.properties.href), id: String(link.properties.id) })),
    items: items.map((item) => ({
      id: String(item.properties.id),
      value: String(item.properties.value),
      noteLabel: item.properties.dataNoteLabel === undefined ? undefined : String(item.properties.dataNoteLabel),
      backrefs: elementsOf(item)
        .filter((element) => element.tagName === 'a' && element.properties.dataFootnoteBackref !== undefined)
        .map((link) => String(link.properties.href)),
      text: textOf(item).replace(/↩\d*/gu, '').replace(/\s+/gu, ' ').trim(),
    })),
    notesHeadings: elements.filter((element) => element.tagName === 'h2' && textOf(element) === '注释').length,
  };
}

/** 每个注释号、返回链接都指向存在的元素，元素 ID 不重复。 */
function expectConsistentLinks(footnotes: ReturnType<typeof footnotesOf>): void {
  expect(new Set(footnotes.ids).size).toBe(footnotes.ids.length);
  for (const reference of footnotes.references) expect(footnotes.ids).toContain(reference.href.slice(1));
  for (const item of footnotes.items) {
    for (const backref of item.backrefs) expect(footnotes.ids).toContain(backref.slice(1));
  }
}

function renderSource(markdown: string, options: Parameters<typeof renderPublicMarkdown>[1] = {}) {
  return renderPublicMarkdown(markdown, { sourceFootnoteLabels: true, ...options });
}

describe('source footnote labels in translated articles', () => {
  it('keeps consecutive numbering and otherwise matches the default footnote markup', async () => {
    const markdown = '甲。[^1] 乙。[^2] 丙。[^3]\n\n[^1]: 一。\n[^2]: 二。\n[^3]: 三。\n';
    const { html } = await renderSource(markdown);
    const footnotes = footnotesOf(html);
    expect(footnotes.references.map((reference) => reference.label)).toEqual(['1', '2', '3']);
    expect(footnotes.items.map((item) => item.value)).toEqual(['1', '2', '3']);
    expectConsistentLinks(footnotes);
    const { html: defaultHtml } = await renderPublicMarkdown(markdown);
    expect(html.replace(/ value="\d+"/gu, '')).toBe(defaultHtml);
  });

  it('shows source note numbers that start above one or skip numbers', async () => {
    const late = footnotesOf((await renderSource('甲。[^4] 乙。[^5] 丙。[^12]\n\n[^4]: 四。\n[^5]: 五。\n[^12]: 十二。\n')).html);
    expect(late.references.map((reference) => reference.label)).toEqual(['4', '5', '12']);
    expect(late.items.map((item) => [item.id, item.value])).toEqual([
      ['user-content-fn-4', '4'], ['user-content-fn-5', '5'], ['user-content-fn-12', '12'],
    ]);
    expectConsistentLinks(late);

    const gap = footnotesOf((await renderSource('甲。[^1] 乙。[^3] 丙。[^4]\n\n[^1]: 一。\n[^3]: 三。\n[^4]: 四。\n')).html);
    expect(gap.references.map((reference) => reference.label)).toEqual(['1', '3', '4']);
    expect(gap.items.map((item) => item.value)).toEqual(['1', '3', '4']);
  });

  it('shows repeated source numbers from note-label markers while anchors keep the technical ids', async () => {
    const { html } = await renderSource(`甲。[^2] 乙。[^3] 丙。[^4] 丁。[^5] 末节。[^6]

<!-- note-label: 1 -->
[^2]: 第一条。
<!-- note-label: 2 -->
[^3]: 第二条。
<!-- note-label: 3 -->
[^4]: 第三条。
<!-- note-label: 4 -->
[^5]: 第四条。
<!-- note-label: 1 -->
[^6]: 末节重新起编的第一条。
`);
    const footnotes = footnotesOf(html);
    expect(footnotes.references.map((reference) => [reference.label, reference.href])).toEqual([
      ['1', '#user-content-fn-2'], ['2', '#user-content-fn-3'], ['3', '#user-content-fn-4'],
      ['4', '#user-content-fn-5'], ['1', '#user-content-fn-6'],
    ]);
    expect(footnotes.items.map((item) => [item.id, item.value])).toEqual([
      ['user-content-fn-2', '1'], ['user-content-fn-3', '2'], ['user-content-fn-4', '3'],
      ['user-content-fn-5', '4'], ['user-content-fn-6', '1'],
    ]);
    expect(html).not.toContain('<!--');
    expectConsistentLinks(footnotes);
  });

  it('lists an unreferenced note in definition order without a return link', async () => {
    const { html } = await renderSource(`甲。[^10] 乙。[^12]

[^10]: 第十条。
[^11]: 正文没有注码的注文。〔原刊保留注文，正文未见对应注码——本站编者〕
[^12]: 第十二条。
`);
    const footnotes = footnotesOf(html);
    expect(footnotes.references.map((reference) => reference.label)).toEqual(['10', '12']);
    expect(footnotes.items.map((item) => [item.value, item.backrefs.length])).toEqual([['10', 1], ['11', 0], ['12', 1]]);
    expect(footnotes.items[1].text).toBe('正文没有注码的注文。〔原刊保留注文，正文未见对应注码——本站编者〕');
    expect(footnotes.ids).not.toContain('user-content-fnref-11');
    expectConsistentLinks(footnotes);
  });

  it('orders notes by their definitions rather than by numeric id', async () => {
    const { html } = await renderSource('甲。[^2] 乙。[^1]\n\n[^2]: 先定义。\n[^1]: 后定义。\n');
    expect(footnotesOf(html).items.map((item) => item.id)).toEqual(['user-content-fn-2', 'user-content-fn-1']);
  });

  it('builds a notes section for an article whose only notes are unreferenced', async () => {
    const { html } = await renderSource('正文没有注码。\n\n## 注释\n\n[^11]: 只有注文。\n');
    const footnotes = footnotesOf(html);
    expect(footnotes.notesHeadings).toBe(1);
    expect(html).toContain('id="footnote-label"');
    expect(footnotes.references).toEqual([]);
    expect(footnotes.items).toEqual([{ id: 'user-content-fn-11', value: '11', noteLabel: undefined, backrefs: [], text: '只有注文。' }]);
  });

  it('keeps unique anchors and return links for repeated references, including relabelled notes', async () => {
    const { html } = await renderSource(`甲。[^3] 乙。[^3] 丙。[^6] 丁。[^6]

[^3]: 第三条。
<!-- note-label: 1 -->
[^6]: 显示为一的注释。
`);
    const footnotes = footnotesOf(html);
    expect(footnotes.references.map((reference) => [reference.label, reference.id])).toEqual([
      ['3', 'user-content-fnref-3'], ['3', 'user-content-fnref-3-2'],
      ['1', 'user-content-fnref-6'], ['1', 'user-content-fnref-6-2'],
    ]);
    expect(footnotes.items.map((item) => item.backrefs)).toEqual([
      ['#user-content-fnref-3', '#user-content-fnref-3-2'],
      ['#user-content-fnref-6', '#user-content-fnref-6-2'],
    ]);
    expectConsistentLinks(footnotes);
  });

  it('labels title notes like body notes', async () => {
    const { html, titleHtml } = await renderSource('正文。[^3]\n\n[^2]: 标题注。\n[^3]: 正文注。\n', {
      title: '题名',
      titleNotes: ['2'],
    });
    const footnotes = footnotesOf(html, titleHtml);
    expect(footnotes.references.map((reference) => [reference.label, reference.href])).toEqual([
      ['2', '#user-content-fn-2'], ['3', '#user-content-fn-3'],
    ]);
    expect(footnotes.items.map((item) => item.value)).toEqual(['2', '3']);
    expectConsistentLinks(footnotes);
  });

  it('accepts a note-label between a block-id and its definition', async () => {
    const { body } = prepareTranslationMarkdown(`正文。[^6]

<!-- block-id: b000123 -->
<!-- note-label: 1 -->
[^6]: 注文。
`);
    expect(body).not.toContain('block-id');
    const footnotes = footnotesOf((await renderSource(body)).html);
    expect(footnotes.references.map((reference) => reference.label)).toEqual(['1']);
    expect(footnotes.items.map((item) => item.value)).toEqual(['1']);
  });

  it('rejects a note-label written before the block-id of its definition', async () => {
    const markdown = `正文。[^6]

<!-- note-label: 1 -->
<!-- block-id: b000123 -->
[^6]: 注文。
`;
    expect(() => prepareTranslationMarkdown(markdown)).toThrow(/not immediately followed by a footnote definition/u);
    await expect(renderSource(markdown)).rejects.toThrow(/not immediately followed by a footnote definition/u);
  });

  it('removes the manuscript notes heading when the first definition carries a note-label', async () => {
    const { html } = await renderSource(`正文。[^6]

## 注释

<!-- note-label: 1 -->
[^6]: 注文。
`);
    expect(footnotesOf(html).notesHeadings).toBe(1);
  });

  it.each([
    ['a marker followed by a blank line', '正文。[^6]\n\n<!-- note-label: 1 -->\n\n[^6]: 注文。\n', /not immediately followed/u],
    ['an orphan marker at the end', '正文。[^6]\n\n[^6]: 注文。\n\n<!-- note-label: 1 -->\n', /not immediately followed/u],
    ['two markers for one definition', '正文。[^6]\n\n<!-- note-label: 1 -->\n<!-- note-label: 2 -->\n[^6]: 注文。\n', /not immediately followed/u],
    ['a marker inside a paragraph', '正文 <!-- note-label: 1 --> 文字。[^6]\n\n[^6]: 注文。\n', /not immediately followed/u],
    ['a non-integer label', '正文。[^6]\n\n<!-- note-label: x -->\n[^6]: 注文。\n', /positive integer/u],
    ['a zero label', '正文。[^6]\n\n<!-- note-label: 0 -->\n[^6]: 注文。\n', /positive integer/u],
    ['a malformed marker', '正文。[^6]\n\n<!-- note-label 1 -->\n[^6]: 注文。\n', /Malformed note-label/u],
    ['a label equal to the id', '正文。[^6]\n\n<!-- note-label: 6 -->\n[^6]: 注文。\n', /repeats footnote id 6/u],
    ['a marker in a document with non-numeric ids', '正文。[^a] [^6]\n\n[^a]: 甲。\n<!-- note-label: 1 -->\n[^6]: 注文。\n', /numeric footnote ids/u],
    ['a duplicate definition', '正文。[^6]\n\n[^6]: 甲。\n[^6]: 乙。\n', /Duplicate footnote definition: 6/u],
    ['a reference without a definition', '正文。[^6] 又见[^9]。\n\n[^6]: 注文。\n', /without a definition: \[\^9\]/u],
  ])('rejects %s', async (_, markdown, message) => {
    await expect(renderSource(markdown)).rejects.toThrow(message);
  });

  it('shows source asterisk notes beside numbered notes without shifting the numbers', async () => {
    const { html } = await renderSource(`甲。[^11] 乙。[^12] 丙。[^13] 丁。[^14] 戊。[^15] 己。[^16]

[^11]: 第十一条。
<!-- note-label: * -->
[^12]: 第一条星号注。
<!-- note-label: ** -->
[^13]: 双星号注。
<!-- note-label: 12 -->
[^14]: 原刊第十二条。
<!-- note-label: * -->
[^15]: 另一页的星号注。
<!-- note-label: 13 -->
[^16]: 原刊第十三条。
`);
    const footnotes = footnotesOf(html);
    expect(footnotes.references.map((reference) => [reference.label, reference.href])).toEqual([
      ['11', '#user-content-fn-11'], ['*', '#user-content-fn-12'], ['**', '#user-content-fn-13'],
      ['12', '#user-content-fn-14'], ['*', '#user-content-fn-15'], ['13', '#user-content-fn-16'],
    ]);
    expect(footnotes.items.map((item) => [item.id, item.value, item.noteLabel])).toEqual([
      ['user-content-fn-11', '11', undefined],
      ['user-content-fn-12', 'undefined', '*'],
      ['user-content-fn-13', 'undefined', '**'],
      ['user-content-fn-14', '12', undefined],
      ['user-content-fn-15', 'undefined', '*'],
      ['user-content-fn-16', '13', undefined],
    ]);
    // 星号注的标号是条目开头的文字，读屏与复制都能得到。
    expect(footnotes.items.map((item) => item.text)).toEqual([
      '第十一条。', '* 第一条星号注。', '** 双星号注。', '原刊第十二条。', '* 另一页的星号注。', '原刊第十三条。',
    ]);
    expect(html).toContain('<li id="user-content-fn-12" data-note-label="*">');
    expect(html).toContain('<li id="user-content-fn-12" data-note-label="*"><span>*</span>\n<p>第一条星号注。');
    expect(html.match(/data-note-label=/gu)).toHaveLength(3);
    expectConsistentLinks(footnotes);
  });

  it('keeps block content of asterisk notes intact after the mark', async () => {
    const { html } = await renderSource(`正文。[^2] [^3] [^4]

<!-- note-label: * -->
[^2]:
    > 引文开头的星号注。

<!-- note-label: ** -->
[^3]:
    - 列表开头的星号注

<!-- note-label: *** -->
[^4]:
    \`\`\`
    代码开头的星号注
    \`\`\`
`);
    const items = elementsOf(fromHtml(html, { fragment: true })).filter((element) => element.tagName === 'li' && element.properties.id);
    expect(items.map((item) => {
      const children = item.children.filter((child): child is Element => child.type === 'element');
      return [String(item.properties.dataNoteLabel), children[0].tagName, textOf(children[0]), children[1].tagName];
    })).toEqual([
      ['*', 'span', '*', 'blockquote'],
      ['**', 'span', '**', 'ul'],
      ['***', 'span', '***', 'pre'],
    ]);
  });

  it('labels a title note through a note-label marker', async () => {
    const { html, titleHtml } = await renderSource('正文。[^3]\n\n<!-- note-label: * -->\n[^2]: 标题注。\n<!-- note-label: 1 -->\n[^3]: 正文注。\n', {
      title: '题名',
      titleNotes: ['2'],
    });
    const footnotes = footnotesOf(html, titleHtml);
    expect(footnotes.references.map((reference) => [reference.label, reference.href])).toEqual([
      ['*', '#user-content-fn-2'], ['1', '#user-content-fn-3'],
    ]);
    expect(footnotes.items.map((item) => [item.value, item.noteLabel, item.backrefs])).toEqual([
      ['undefined', '*', ['#user-content-fnref-2']],
      ['1', undefined, ['#user-content-fnref-3']],
    ]);
    expectConsistentLinks(footnotes);
  });

  it('rejects an unreferenced note that itself cites a note', async () => {
    await expect(renderSource('正文。[^3]\n\n[^2]: 未引用，见注[^3]。\n[^3]: 第三条。\n'))
      .rejects.toThrow(/Unreferenced footnote 2 contains a footnote reference/u);
  });

  it.each(['****', '†', '*1', '1*', '<b>', '第一'])('rejects the note-label value %s', async (value) => {
    await expect(renderSource(`正文。[^6]\n\n<!-- note-label: ${value} -->\n[^6]: 注文。\n`))
      .rejects.toThrow(/positive integer or \*, \*\*, \*\*\*/u);
  });

  it('keeps default numbering when footnote ids carry leading zeros', async () => {
    const markdown = '甲。[^01] 乙。[^02]\n\n[^01]: 甲注。\n[^02]: 乙注。\n';
    const { html } = await renderSource(markdown);
    expect(html).toBe((await renderPublicMarkdown(markdown)).html);
    await expect(renderSource('甲。[^01]\n\n<!-- note-label: 1 -->\n[^01]: 甲注。\n')).rejects.toThrow(/numeric footnote ids/u);
  });

  it('keeps default numbering for documents with non-numeric footnote ids', async () => {
    const markdown = '甲。[^note] 乙。[^zh-1]\n\n[^note]: 甲注。\n[^zh-1]: 乙注。\n[^unused]: 未引用。\n';
    const { html } = await renderSource(markdown);
    expect(html).toBe((await renderPublicMarkdown(markdown)).html);
    expect(footnotesOf(html).references.map((reference) => reference.label)).toEqual(['1', '2']);
  });

  it('leaves ordinary Markdown unchanged when the option is off', async () => {
    const { html } = await renderPublicMarkdown('甲。[^4] 乙。[^6]\n\n[^4]: 四。\n<!-- note-label: 1 -->\n[^6]: 六。\n[^7]: 未引用。\n');
    const footnotes = footnotesOf(html);
    expect(footnotes.references.map((reference) => reference.label)).toEqual(['1', '2']);
    expect(footnotes.items.map((item) => item.id)).toEqual(['user-content-fn-4', 'user-content-fn-6']);
    expect(html).not.toContain('value=');
    expect(html).not.toContain('未引用');
  });
});
