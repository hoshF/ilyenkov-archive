import type { ArticleHeading } from './markdown';

export interface ReadingTocItem {
  href: string;
  label: string;
}

/** remark-rehype 生成的注释区标题；只有正文里真的有注释时才存在。 */
const NOTES_ANCHOR = 'footnote-label';

/**
 * 连续阅读页的页内目录：桌面侧栏与手机、平板的折叠目录共用这一份。
 * 顺序跟文档的实际阅读顺序一致——正文二级标题（含参考文献）、注释区、原文信息。
 */
export function readingToc(
  headings: ArticleHeading[],
  html: string,
  { sourceInfo }: { sourceInfo?: { href: string; label: string } } = {},
): ReadingTocItem[] {
  const items = headings.map((heading) => ({ href: `#${heading.id}`, label: heading.text }));
  if (html.includes(`id="${NOTES_ANCHOR}"`)) items.push({ href: `#${NOTES_ANCHOR}`, label: '注释' });
  if (sourceInfo) items.push(sourceInfo);
  return items;
}

/** 折叠目录只在至少两个去处时出现；只剩一项的目录不帮读者找任何东西。 */
export const READING_OUTLINE_MINIMUM = 2;
