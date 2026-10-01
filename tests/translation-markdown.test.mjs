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
