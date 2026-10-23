import { describe, expect, it } from 'vitest';
import { prepareTranslationMarkdown } from '../scripts/lib/translation-markdown.mjs';

describe('translation source preparation', () => {
  it('separates the source H1 and its footnotes from the published body', () => {
    const { body, titleNotes } = prepareTranslationMarkdown(`---
title: "完整的出版题名"
---

<!-- block-id: source-title -->
# 简短的原稿题名[^Note]

正文。[^2]

<!-- block-id: source-paragraph -->
## 引言

[^Note]: 标题注释。
[^2]: 正文注释。
`);
    expect(titleNotes).toEqual(['note']);
    expect(body).toBe('正文。[^2]\n\n## 引言\n\n[^Note]: 标题注释。\n[^2]: 正文注释。');
  });

  it('keeps a figure-caption marker placed after the caption block-id and drops the block-ids', () => {
    const { body } = prepareTranslationMarkdown(`<!-- block-id: b000016 -->
![漫画](img-2.png)

<!-- block-id: b000017 -->
<!-- figure-caption -->
**照录的原文图注**
`);
    expect(body).toBe('![漫画](img-2.png)\n\n<!-- figure-caption -->\n**照录的原文图注**');
  });

  it.each([
    ['before the caption block-id', '![漫画](img-2.png)\n\n<!-- figure-caption -->\n<!-- block-id: b000017 -->\n**图注**'],
    ['after a text paragraph', '正文。\n\n<!-- figure-caption -->\n**图注**'],
    ['without a caption paragraph', '![漫画](img-2.png)\n\n<!-- figure-caption -->\n\n## 标题'],
  ])('rejects a figure-caption marker %s', (_case, text) => {
    expect(() => prepareTranslationMarkdown(text)).toThrow(/figure-caption must sit between/);
  });

  it('preserves code examples, inline comments, and an article without a leading H1', () => {
    const text = `## 正文开头

行内 <!-- block-id: example --> 注释。

\`\`\`markdown
<!-- block-id: fenced-example -->
# 示例标题
\`\`\`

~~~markdown
<!-- block-id: tilde-example -->
~~~

    <!-- block-id: indented-example -->`;
    expect(prepareTranslationMarkdown(text)).toEqual({ body: text, titleNotes: [] });
  });
});
