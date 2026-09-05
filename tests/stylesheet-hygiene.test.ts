import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rules, stylesheetSource } from './helpers/styles';

/** 样式表只有一份，且没有构建期工具检查它：规则写重、类名无人使用、变量声明未用都不会报错。 */

/** 这些类名由渲染管线生成，源码里搜不到。 */
const renderedClasses = new Set(['footnotes']);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return ['.astro', '.ts'].includes(path.extname(entry.name)) ? [target] : [];
  });
}

const markup = sourceFiles(path.join(process.cwd(), 'src'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

describe('stylesheet hygiene', () => {
  it('never sets the same property twice for one selector', () => {
    // 同一选择器分几条规则写没问题（共用一组 + 单独补一条）；同一属性写两遍则无从判断哪条生效。
    const seen = new Map<string, string[]>();
    for (const rule of rules) {
      for (const property of Object.keys(rule.declarations)) {
        const key = `${rule.media}|${rule.selector}|${property}`;
        seen.set(key, [...(seen.get(key) ?? []), rule.selector]);
      }
    }
    const overridden = [...seen].filter(([, occurrences]) => occurrences.length > 1).map(([key]) => key);
    expect(overridden).toEqual([]);
  });

  it('keeps no class the markup does not use', () => {
    const classes = new Set(
      [...stylesheetSource.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)]
        .map((match) => match[1]),
    );
    const orphans = [...classes].filter((name) => !renderedClasses.has(name) && !markup.includes(name));
    expect(orphans).toEqual([]);
  });

  it('uses every custom property it declares', () => {
    const body = stylesheetSource.replace(/\/\*[\s\S]*?\*\//g, '');
    const declared = new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
    const used = new Set([...body.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]));
    const unused = [...declared].filter((name) => !used.has(name) && !markup.includes(name));
    expect(unused).toEqual([]);
  });
});
