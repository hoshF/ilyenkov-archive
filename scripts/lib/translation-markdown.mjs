import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

const parser = unified().use(remarkParse).use(remarkGfm);
const blockMarker = /^\s*<!--\s*block-id:.*?-->\s*$/u;

/**
 * 去掉整行 block-id 前先确认 note-label 紧接注释定义：
 * 标记写在 block-id 之前时，去掉 block-id 后二者才相邻，渲染阶段已无从分辨。
 */
function stripBlockMarkers(body) {
  const lines = body.split(/\r?\n/);
  const removed = new Set();
  const visit = (node, next) => {
    if (node.type === 'html' && node.value.includes('note-label') && next?.type !== 'footnoteDefinition') {
      throw new Error(`note-label is not immediately followed by a footnote definition: ${node.value.trim()}`);
    }
    if (node.type === 'html' && node.position) {
      for (let index = node.position.start.line - 1; index < node.position.end.line; index += 1) {
        if (blockMarker.test(lines[index])) removed.add(index);
      }
    }
    node.children?.forEach((child, index) => visit(child, node.children[index + 1]));
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
