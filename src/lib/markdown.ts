import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly/parseOnly';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Heading, Image, Root } from 'mdast';

interface MarkdownOptions {
  imageBaseUrl?: string;
  title?: string;
  titleNotes?: string[];
}

/** 正文里的一节：左栏索引按它跳转。 */
export interface ArticleHeading {
  id: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  titleHtml: string;
  headings: ArticleHeading[];
}

/** 标题与正文共用一次脚注编号；题名作为文字节点，不解释 Markdown 或 HTML。 */
function prependDocumentTitle(title: string | undefined, titleNotes: string[]) {
  return (tree: Root): void => {
    if (title === undefined) return;
    tree.children.unshift({
      type: 'heading',
      depth: 1,
      children: [
        { type: 'text', value: title },
        ...titleNotes.map((identifier) => ({
          type: 'footnoteReference' as const,
          identifier,
          label: identifier,
        })),
      ],
    });
  };
}

function isRelativeImageUrl(value: string): boolean {
  return !value.startsWith('/')
    && !value.startsWith('//')
    && !/^[a-z][a-z\d+.-]*:/iu.test(value);
}

function resolveRelativeImages(imageBaseUrl: string | undefined) {
  return (tree: Root): void => {
    if (!imageBaseUrl) return;

    const visit = (node: Root | Root['children'][number]): void => {
      if (node.type === 'image' && isRelativeImageUrl(node.url)) {
        const image = node as Image;
        image.url = new URL(image.url, `https://markdown.local${imageBaseUrl}`).pathname;
      }
      if ('children' in node) node.children.forEach(visit);
    };
    visit(tree);
  };
}

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

function headingText(node: Heading): string {
  const parts: string[] = [];
  const visit = (node: Heading['children'][number]): void => {
    if ('value' in node) parts.push(node.value);
    if ('children' in node) node.children.forEach(visit);
  };
  node.children.forEach(visit);
  return parts.join('').trim();
}

/**
 * 标题原文就是锚点：译文标题是中文，转写成拉丁字母的 slug 既不稳定也读不出来。
 * 只去掉会截断片段标识符的字符，重名的加序号。
 */
function headingId(text: string, taken: Set<string>): string {
  const base = text.replace(/\s+/gu, '-').replace(/["'#%/?<>\\^`{|}]/gu, '') || 'section';
  let id = base;
  for (let ordinal = 2; taken.has(id); ordinal += 1) id = `${base}-${ordinal}`;
  taken.add(id);
  return id;
}

/** 收集正文二级标题及独立加粗的摘要标签；生成的注释不进索引。 */
function collectHeadings(headings: ArticleHeading[]) {
  return (tree: Root): void => {
    const taken = new Set<string>();
    for (const node of tree.children) {
      const isAbstractLabel = node.type === 'paragraph'
        && node.children.length === 1
        && node.children[0].type === 'strong'
        && node.children[0].children.length === 1
        && node.children[0].children[0].type === 'text'
        && node.children[0].children[0].value.trim() === '摘要';
      if (!(node.type === 'heading' && node.depth === 2) && !isAbstractLabel) continue;
      const text = node.type === 'heading' ? headingText(node) : '摘要';
      if (!text) continue;
      const id = headingId(text, taken);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      headings.push({ id, text });
    }
  };
}

export async function renderPublicMarkdown(
  markdown: string,
  { imageBaseUrl, title, titleNotes = [] }: MarkdownOptions = {},
): Promise<RenderedMarkdown> {
  const headings: ArticleHeading[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCjkFriendly)
    .use(resolveRelativeImages, imageBaseUrl)
    .use(removeRedundantNotesHeading)
    .use(collectHeadings, headings)
    .use(prependDocumentTitle, title, titleNotes)
    .use(remarkRehype, {
      allowDangerousHtml: false,
      footnoteLabel: '注释',
      footnoteLabelProperties: {},
      footnoteBackLabel: '返回正文',
    })
    // remark-rehype has already added the defensive `user-content-` prefix.
    // Avoid adding the same prefix a second time while sanitizing the tree.
    .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: '' })
    .use(rehypeStringify);

  const tree = await processor.run(processor.parse(markdown));
  let titleHtml = '';
  const titleNode = tree.children[0];
  if (title !== undefined && titleNode?.type === 'element' && titleNode.tagName === 'h1') {
    tree.children.shift();
    titleHtml = processor.stringify({ type: 'root', children: titleNode.children });
  }

  return { html: processor.stringify(tree), titleHtml, headings };
}
