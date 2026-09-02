import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Root } from 'mdast';

/**
 * Footnote definitions are collected into a generated section by remark-rehype.
 * Approved manuscripts may already contain a heading immediately before those
 * definitions. Keeping both would leave the manuscript heading behind while
 * rendering a second footnote section at the end of the article.
 */
function removeRedundantNotesHeading() {
  return (tree: Root): void => {
    for (let index = 0; index < tree.children.length - 1; index += 1) {
      const node = tree.children[index];
      const next = tree.children[index + 1];
      const isNotesHeading = node.type === 'heading'
        && node.children.length === 1
        && node.children[0].type === 'text'
        && node.children[0].value.trim() === '注释';

      if (isNotesHeading && next.type === 'footnoteDefinition') {
        tree.children.splice(index, 1);
        index -= 1;
      }
    }
  };
}

/**
 * CommonMark leaves `**说话人：**正文` untouched because the closing
 * delimiter sits between punctuation and a CJK letter. This compact form is
 * used throughout Chinese interviews and by the reference blog renderer.
 */
function restoreCompactStrongLabels() {
  return (tree: Root): void => {
    for (const node of tree.children) {
      if (node.type !== 'paragraph') continue;

      const first = node.children[0];
      if (!first || first.type !== 'text') continue;

      const match = /^\*\*([^*\r\n]+?[：:])\*\*(?=\S)/u.exec(first.value);
      if (!match || match[1].trim() !== match[1]) continue;

      node.children.splice(
        0,
        1,
        { type: 'strong', children: [{ type: 'text', value: match[1] }] },
        { type: 'text', value: first.value.slice(match[0].length) },
      );
    }
  };
}

export async function renderPublicMarkdown(markdown: string): Promise<string> {
  const rendered = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(restoreCompactStrongLabels)
    .use(removeRedundantNotesHeading)
    .use(remarkRehype, {
      allowDangerousHtml: false,
      footnoteLabel: '注释',
      footnoteLabelProperties: {},
      footnoteBackLabel: '返回正文',
    })
    // remark-rehype has already added the defensive `user-content-` prefix.
    // Avoid adding the same prefix a second time while sanitizing the tree.
    .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: '' })
    .use(rehypeStringify)
    .process(markdown);

  return String(rendered);
}
