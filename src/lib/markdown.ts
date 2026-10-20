import { readFileSync } from 'node:fs';
import { imageMetadata } from 'astro/assets/utils';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly/parseOnly';
import remarkRehype from 'remark-rehype';
import { defaultHandlers, toHast, type State } from 'mdast-util-to-hast';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Element, ElementContent, Root as HastRoot, RootContent as HastContent } from 'hast';
import type { FootnoteDefinition, FootnoteReference, Heading, Image, Nodes, Parents, Root } from 'mdast';

interface MarkdownOptions {
  imageBaseUrl?: string;
  /** imageBaseUrl 下的文件名到本地文件路径；给出时插图带上固有宽高。 */
  imageFile?: (asset: string) => string;
  title?: string;
  titleNotes?: string[];
  /** 单篇译文：注释显示原刊注码（数字技术 ID 或 note-label），并呈现正文未引用的注文。 */
  sourceFootnoteLabels?: boolean;
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
 * 本地插图写入文件的固有宽高：浏览器在图片下载前就按比例留出位置，
 * 慢速网络下按锚点直接打开文章时，后到的图片不再把目标标题推离视口。
 */
function reserveLocalImageSpace(
  imageBaseUrl: string | undefined,
  imageFile: MarkdownOptions['imageFile'],
) {
  return async (tree: HastRoot): Promise<void> => {
    if (!imageBaseUrl || !imageFile) return;

    const images: Element[] = [];
    const visit = (node: HastRoot | HastContent): void => {
      if (node.type === 'element' && node.tagName === 'img') images.push(node);
      if ('children' in node) node.children.forEach(visit);
    };
    visit(tree);

    await Promise.all(images.map(async (image) => {
      const src = String(image.properties.src ?? '');
      if (!src.startsWith(imageBaseUrl)) return;
      const asset = decodeURIComponent(src.slice(imageBaseUrl.length));
      const { width, height } = await imageMetadata(readFileSync(imageFile(asset)), src);
      image.properties.width = width;
      image.properties.height = height;
    }));
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

/** 单篇译文注释的显示注码与定义顺序；enabled 为 false 时沿用默认脚注渲染。 */
interface SourceFootnotes {
  enabled: boolean;
  labels: Map<string, string>;
  definitions: FootnoteDefinition[];
}

const NOTES_LABEL = '注释';
const FOOTNOTE_PREFIX = 'user-content-';
const noteLabelMarker = /^<!--\s*note-label:\s*(.*?)\s*-->$/su;
/** 显示注码：正整数，或原刊星号注的 *、**、***。 */
const noteLabelValue = /^(?:[1-9]\d*|\*{1,3})$/u;
const integerLabel = /^[1-9]\d*$/u;
const numericId = /^[1-9]\d*$/u;
/** GFM 只把有定义的 `[^id]` 解析为注释引用，其余留作正文文字。 */
const unresolvedReference = /\[\^[^\]\s]+\]/u;

/** mdast-util-to-hast 以大写标识符登记注释。 */
function footnoteKey(identifier: string): string {
  return identifier.toUpperCase();
}

function displayLabel(footnotes: SourceFootnotes, identifier: string): string {
  return footnotes.labels.get(footnoteKey(identifier)) ?? identifier;
}

/**
 * 读取并移除紧接在注释定义前的 note-label 标记，校验注释定义与引用。
 * 全部注释使用不带前导零的纯数字技术 ID 时按原刊注码显示；否则沿用默认渲染，且不得使用标记。
 */
function readSourceFootnotes(footnotes: SourceFootnotes, enabled: boolean) {
  return (tree: Root): void => {
    if (!enabled) return;
    const definitions: FootnoteDefinition[] = [];
    const labels = new Map<string, string>();

    const visit = (parent: Parents): void => {
      for (let index = 0; index < parent.children.length; index += 1) {
        const node = parent.children[index];
        if (node.type === 'html' && node.value.includes('note-label')) {
          const marker = node.value.trim();
          const match = marker.match(noteLabelMarker);
          if (!match) throw new Error(`Malformed note-label marker: ${marker}`);
          const label = match[1];
          if (!noteLabelValue.test(label)) throw new Error(`note-label must be a positive integer or *, **, ***: ${marker}`);
          const next = parent.children[index + 1];
          if (next?.type !== 'footnoteDefinition' || next.position?.start.line !== (node.position?.end.line ?? 0) + 1) {
            throw new Error(`note-label is not immediately followed by a footnote definition: ${marker}`);
          }
          if (label === next.identifier) throw new Error(`note-label repeats footnote id ${next.identifier}`);
          labels.set(footnoteKey(next.identifier), label);
          parent.children.splice(index, 1);
          index -= 1;
          continue;
        }
        if (node.type === 'footnoteDefinition') {
          if (definitions.some((definition) => footnoteKey(definition.identifier) === footnoteKey(node.identifier))) {
            throw new Error(`Duplicate footnote definition: ${node.identifier}`);
          }
          definitions.push(node);
        }
        if (node.type === 'text' && unresolvedReference.test(node.value)) {
          throw new Error(`Footnote reference without a definition: ${node.value.match(unresolvedReference)![0]}`);
        }
        if ('children' in node) visit(node);
      }
    };
    visit(tree);

    const numeric = definitions.every((definition) => numericId.test(definition.identifier));
    if (labels.size > 0 && !numeric) throw new Error('note-label requires numeric footnote ids throughout the document');
    footnotes.enabled = definitions.length > 0 && numeric;
    footnotes.labels = labels;
    footnotes.definitions = definitions;
  };
}

/** 注释号沿用默认的链接、锚点与多次引用后缀，只把可见文字换成显示注码。 */
function sourceFootnoteReference(footnotes: SourceFootnotes) {
  return (state: State, node: FootnoteReference): Element => {
    const sup = defaultHandlers.footnoteReference(state, node);
    const link = sup.children[0];
    if (footnotes.enabled && link?.type === 'element') {
      link.children = [{ type: 'text', value: displayLabel(footnotes, node.identifier) }];
    }
    return sup;
  };
}

function containsFootnoteReference(node: Nodes): boolean {
  return node.type === 'footnoteReference' || ('children' in node && (node.children as Nodes[]).some(containsFootnoteReference));
}

/**
 * 整数显示注码写入列表号；星号注不占列表号，标号作为条目开头的文字写出，
 * 免得与浏览器生成的列表号重复显示。
 */
function labelItem(item: Element, label: string): void {
  if (integerLabel.test(label)) {
    item.properties.value = label;
    return;
  }
  item.properties.dataNoteLabel = label;
  const mark: Element = { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: label }] };
  const first = item.children.find((child): child is Element => child.type === 'element');
  if (first?.tagName === 'p') first.children.unshift(mark);
  else item.children.unshift(mark);
}

function lines(children: ElementContent[]): ElementContent[] {
  return [{ type: 'text', value: '\n' }, ...children.flatMap((child): ElementContent[] => [child, { type: 'text', value: '\n' }])];
}

/**
 * 注释区按定义顺序列出全部注释，列表号为显示注码。
 * 正文未引用的注文补成条目，不加返回链接；全文没有引用时另建注释区。
 */
function completeSourceFootnotes(footnotes: SourceFootnotes) {
  return (tree: HastRoot): void => {
    if (!footnotes.enabled) return;

    let section = tree.children.find((node): node is Element => (
      node.type === 'element' && node.tagName === 'section' && node.properties.dataFootnotes !== undefined
    ));
    if (!section) {
      section = {
        type: 'element',
        tagName: 'section',
        properties: { dataFootnotes: true, className: ['footnotes'] },
        children: [
          { type: 'element', tagName: 'h2', properties: { id: 'footnote-label' }, children: [{ type: 'text', value: NOTES_LABEL }] },
          { type: 'text', value: '\n' },
          { type: 'element', tagName: 'ol', properties: {}, children: [] },
          { type: 'text', value: '\n' },
        ],
      };
      tree.children.push({ type: 'text', value: '\n' }, section);
    }

    const list = section.children.find((node): node is Element => node.type === 'element' && node.tagName === 'ol');
    if (!list) throw new Error('Footnote section has no list');
    const rendered = new Map(list.children
      .filter((node): node is Element => node.type === 'element' && node.tagName === 'li')
      .map((item) => [String(item.properties.id), item]));

    list.children = lines(footnotes.definitions.map((definition) => {
      const id = `${FOOTNOTE_PREFIX}fn-${definition.identifier}`;
      let item = rendered.get(id);
      if (!item) {
        // 未引用的注文单独转换，其中的注释号无从与正文共用编号与锚点，只能拒绝。
        if (definition.children.some(containsFootnoteReference)) {
          throw new Error(`Unreferenced footnote ${definition.identifier} contains a footnote reference`);
        }
        item = {
          type: 'element',
          tagName: 'li',
          properties: { id },
          children: lines((toHast({ type: 'root', children: definition.children }) as HastRoot).children as ElementContent[]),
        };
      }
      labelItem(item, displayLabel(footnotes, definition.identifier));
      return item;
    }));
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
  { imageBaseUrl, imageFile, title, titleNotes = [], sourceFootnoteLabels = false }: MarkdownOptions = {},
): Promise<RenderedMarkdown> {
  const headings: ArticleHeading[] = [];
  const footnotes: SourceFootnotes = { enabled: false, labels: new Map(), definitions: [] };
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCjkFriendly)
    .use(resolveRelativeImages, imageBaseUrl)
    // 标记必须先于“注释”稿件标题的判断移除，否则标题后不再紧接注释定义。
    .use(readSourceFootnotes, footnotes, sourceFootnoteLabels)
    .use(removeRedundantNotesHeading)
    .use(collectHeadings, headings)
    .use(prependDocumentTitle, title, titleNotes)
    .use(remarkRehype, {
      allowDangerousHtml: false,
      footnoteLabel: NOTES_LABEL,
      footnoteLabelProperties: {},
      footnoteBackLabel: '返回正文',
      handlers: { footnoteReference: sourceFootnoteReference(footnotes) },
    })
    .use(completeSourceFootnotes, footnotes)
    // remark-rehype has already added the defensive `user-content-` prefix.
    // Avoid adding the same prefix a second time while sanitizing the tree.
    .use(rehypeSanitize, {
      ...defaultSchema,
      clobberPrefix: '',
      // 星号注的注释条目以 data-note-label 取消列表号。
      attributes: { ...defaultSchema.attributes, li: [...(defaultSchema.attributes?.li ?? []), 'dataNoteLabel'] },
    })
    .use(reserveLocalImageSpace, imageBaseUrl, imageFile)
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
