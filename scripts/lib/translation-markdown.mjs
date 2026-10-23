import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

const parser = unified().use(remarkParse).use(remarkGfm);
const blockMarker = /^\s*<!--\s*block-id:.*?-->\s*$/u;
const isBlockMarker = (node) => node?.type === 'html' && blockMarker.test(node.value);
const isImageParagraph = (node) => node?.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'image';

/**
 * 去掉整行 block-id 前先确认 note-label 紧接注释定义、figure-caption 介于图片段落与图注段落之间：
 * 标记写在 block-id 之前时，去掉 block-id 后二者才相邻，渲染阶段已无从分辨。
 */
function stripBlockMarkers(body) {
  const lines = body.split(/\r?\n/);
  const removed = new Set();
  const visit = (node, next, siblings = [], index = 0) => {
    if (node.type === 'html' && node.value.includes('note-label') && next?.type !== 'footnoteDefinition') {
      throw new Error(`note-label is not immediately followed by a footnote definition: ${node.value.trim()}`);
    }
    if (node.type === 'html' && node.value.includes('figure-caption')) {
      let previous = index - 1;
      while (isBlockMarker(siblings[previous])) previous -= 1;
      if (!isImageParagraph(siblings[previous]) || next?.type !== 'paragraph') {
        throw new Error(`figure-caption must sit between an image and its caption paragraph: ${node.value.trim()}`);
      }
    }
    if (node.type === 'html' && node.position) {
      for (let line = node.position.start.line - 1; line < node.position.end.line; line += 1) {
        if (blockMarker.test(lines[line])) removed.add(line);
      }
    }
    node.children?.forEach((child, childIndex) => visit(child, node.children[childIndex + 1], node.children, childIndex));
  };
  visit(parser.parse(body));
  return lines.filter((_, index) => !removed.has(index)).join('\n').trim();
}

/** 页面单独显示题名；标题脚注留在同一篇正文的注释系统中。 */
export function prepareTranslationMarkdown(text) {
  const withoutFrontmatter = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  const body = stripBlockMarkers(withoutFrontmatter);
  const title = parser.parse(body).children[0];
  if (title?.type !== 'heading' || title.depth !== 1) return { body, titleNotes: [] };

  const titleNotes = [];
  const visit = (node) => {
    if (node.type === 'footnoteReference') titleNotes.push(node.identifier);
    node.children?.forEach(visit);
  };
  visit(title);
  return { body: body.slice(title.position.end.offset).trimStart(), titleNotes };
}
