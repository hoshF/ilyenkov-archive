import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 样式表的最小解析器：把 global.css 读成「媒体查询 + 选择器 → 声明」的结构，
 * 让测试断言实际生效的声明，而不是断言源码里的某一行长什么样。
 */

export interface StyleRule {
  /** 媒体查询条件，顶层规则为空串。 */
  media: string;
  selector: string;
  declarations: Record<string, string>;
}

const stylesheet = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');

function splitDeclarations(body: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  let depth = 0;
  let buffer = '';
  const flush = (): void => {
    const text = buffer.trim();
    buffer = '';
    if (!text) return;
    const separator = text.indexOf(':');
    if (separator < 0) return;
    declarations[text.slice(0, separator).trim()] = text.slice(separator + 1).replace(/\s+/g, ' ').trim();
  };

  for (const character of body) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ';' && depth === 0) flush();
    else buffer += character;
  }
  flush();
  return declarations;
}

function parse(css: string, media = ''): StyleRule[] {
  const rules: StyleRule[] = [];
  let index = 0;

  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open < 0) break;

    const prelude = css.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    const body = css.slice(open + 1, cursor - 1);
    if (prelude.startsWith('@')) rules.push(...parse(body, prelude.replace(/\s+/g, ' ')));
    else {
      for (const selector of prelude.split(',')) {
        rules.push({ media, selector: selector.replace(/\s+/g, ' ').trim(), declarations: splitDeclarations(body) });
      }
    }
    index = cursor;
  }

  return rules;
}

export const rules: StyleRule[] = parse(stylesheet.replace(/\/\*[\s\S]*?\*\//g, ''));

/** 同一选择器在同一媒体查询下可能写了多条规则，按源码顺序合并，后面的覆盖前面的。 */
export function declarationsFor(selector: string, media = ''): Record<string, string> {
  return rules
    .filter((rule) => rule.selector === selector && rule.media === media)
    .reduce<Record<string, string>>((merged, rule) => ({ ...merged, ...rule.declarations }), {});
}

export function declaration(selector: string, property: string, media = ''): string | undefined {
  return declarationsFor(selector, media)[property];
}

/** 选择器是否在样式表里出现过——用于「这条规则还活着」这类断言。 */
export function hasRule(selector: string, media = ''): boolean {
  return rules.some((rule) => rule.selector === selector && rule.media === media);
}

export const stylesheetSource = stylesheet;
