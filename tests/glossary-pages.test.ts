import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossary } from '../src/lib/glossary';
import { getGlossaryFacets, NAME_TYPE_LABELS, type GlossaryEntry } from '../src/lib/glossary-query';
import { builtRoutePath } from './helpers/pages';

const glossary = getGlossary();
const builtPage = (route: string): string => readFileSync(builtRoutePath(route), 'utf8');
const normalized = (value: string): string => value.replace(/\s+/gu, ' ').trim();
const decode = (value: string): string => value.replace(
  /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,
  (entity) => {
    const named: Record<string, string> = {
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    };
    if (Object.hasOwn(named, entity.toLowerCase())) return named[entity.toLowerCase()]!;
    const number = entity.startsWith('&#x') || entity.startsWith('&#X')
      ? Number.parseInt(entity.slice(3, -1), 16)
      : Number.parseInt(entity.slice(2, -1), 10);
    return String.fromCodePoint(number);
  },
);
const textContent = (html: string): string => normalized(decode(html.replace(/<[^>]+>/g, ' ')));
const mainContent = (html: string): string => html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)![1];
const links = (html: string): { href: string; label: string }[] => (
  [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(([, href, content]) => ({ href: decode(href), label: textContent(content) }))
);
const indexMain = (): string => mainContent(builtPage('/glossary/'));
const detailMain = (entry: GlossaryEntry): string => mainContent(builtPage(entry.route));

function sectionWithHeading(html: string, heading: string): string | undefined {
  return [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)]
    .map(([, content]) => content)
    .find((content) => textContent(content.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '') === heading);
}

function definitionWithLabel(html: string, label: string): string | undefined {
  return [...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/g)]
    .find(([, content]) => textContent(content) === label)?.[2];
}

function staticRoutes(directory: string, relative = ''): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return staticRoutes(path.join(directory, entry.name), next);
    return entry.name === 'index.html'
      ? [`/glossary/${relative ? `${relative}/` : ''}`]
      : [];
  });
}

function labelledControl(form: string, tag: 'input' | 'select', name: string): string {
  const control = [...form.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))]
    .map(([markup]) => markup)
    .find((markup) => markup.includes(`name="${name}"`));
  expect(control, `the ${name} control`).toBeDefined();
  const id = control!.match(/\bid="([^"]+)"/)?.[1];
  expect(id, `an id for the ${name} control`).toBeDefined();
  const label = [...form.matchAll(/<label\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/label>/g)]
    .find(([, labelFor]) => labelFor === id);
  expect(label, `a visible label for the ${name} control`).toBeDefined();
  expect(textContent(label![2])).not.toBe('');
  return control!;
}

function selectOptions(form: string, name: string): { id: string; label: string }[] {
  const select = [...form.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)]
    .find(([, attributes]) => attributes.includes(`name="${name}"`));
  expect(select, `the ${name} select`).toBeDefined();
  return [...select![2].matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)]
    .map(([, id, content]) => ({ id: decode(id), label: textContent(content) }));
}

describe('static glossary index and entry pages', () => {
  it('builds exactly the current public entry routes, including separate tables with the same id', () => {
    const expected = ['/glossary/', ...glossary.map((entry) => entry.route)].sort();
    expect(staticRoutes(path.join(process.cwd(), 'dist', 'glossary')).sort()).toEqual(expected);
    expect(new Set(glossary.map((entry) => entry.route)).size).toBe(glossary.length);
  });

  it('makes every public entry accessible through the initial index without JavaScript', () => {
    const main = indexMain();
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe('术语库');
    const articles = [...main.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
      .map(([, content]) => content);
    expect(articles).toHaveLength(glossary.length);
    expect(articles.flatMap(links).map((link) => link.href)).toEqual(glossary.map((entry) => entry.route));

    for (const [index, entry] of glossary.entries()) {
      const article = articles[index];
      const heading = article.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1];
      expect(links(heading), entry.route).toEqual([{ href: entry.route, label: normalized(entry.zh_preferred) }]);
      const text = textContent(article);
      expect(text, entry.route).toContain(normalized(entry.canonical));
      expect(text, entry.route).toContain(entry.categoryLabel);
      if (entry.category === 'concepts') expect(text, entry.route).toContain(entry.collectionLabel);
      if (entry.category === 'names') expect(text, entry.route).toContain(NAME_TYPE_LABELS[entry.type!]);
      const visibleFields = [entry.zh_preferred, entry.canonical, entry.categoryLabel];
      if (entry.category === 'concepts') visibleFields.push(entry.collectionLabel);
      if (entry.category === 'names') visibleFields.push(NAME_TYPE_LABELS[entry.type!]);
      expect(text, entry.route).toBe(normalized(visibleFields.join(' ')));
      expect(article, entry.route).not.toMatch(/\shidden(?:[\s=>]|$)/);
    }

    const payload = [...main.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
      .find(([, attributes]) => attributes.includes('type="application/json"'));
    expect(payload).toBeDefined();
    const searchEntries = JSON.parse(payload![2]) as GlossaryEntry[];
    expect(searchEntries.map((entry) => entry.route)).toEqual(glossary.map((entry) => entry.route));
    expect(searchEntries.every((entry) => entry.notes === '')).toBe(true);
  });

  it('offers labelled search and filter controls with a reset and live result count', () => {
    const main = indexMain();
    const form = [...main.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)]
      .find(([, attributes]) => attributes.includes('role="search"'));
    expect(form).toBeDefined();
    const content = form![2];
    expect(labelledControl(content, 'input', 'q')).toContain('type="search"');
    for (const name of ['category', 'collection', 'type']) labelledControl(content, 'select', name);
    const buttons = [...content.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .map(([, attributes, body]) => ({ attributes, label: textContent(body) }));
    expect(buttons.some(({ attributes, label }) => attributes.includes('type="submit"') && label === '搜索')).toBe(true);
    expect(buttons.some(({ attributes, label }) => attributes.includes('type="reset"') && label === '重置')).toBe(true);
    const status = main.match(/<([a-z]+)\b[^>]*role="status"[^>]*>([\s\S]*?)<\/\1>/);
    expect(status).toBeDefined();
    expect(status![0]).toContain('aria-live="polite"');
    expect(textContent(status![2])).toContain(String(glossary.length));
    const noscript = main.match(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/);
    expect(noscript).toBeDefined();
    expect(textContent(noscript![1])).toMatch(/JavaScript|脚本/);
  });

  it('derives every selectable category, author and name type from the public entry set', () => {
    const main = indexMain();
    const form = main.match(/<form\b[^>]*>([\s\S]*?)<\/form>/)![1];
    const facets = getGlossaryFacets(glossary);
    for (const [name, expected] of [
      ['category', facets.categories], ['collection', facets.authors], ['type', facets.types],
    ] as const) {
      const options = selectOptions(form, name);
      expect(options[0].id, `${name} has an all option`).toBe('');
      expect(options.slice(1).map((option) => option.id)).toEqual(expected.map((facet) => facet.id));
      for (const facet of expected) {
        expect(options.find((option) => option.id === facet.id)!.label).toContain(facet.label);
      }
    }
  });

  it('renders each entry identity and its category, author or name type with a link back to the index', () => {
    for (const entry of glossary) {
      const main = detailMain(entry);
      const headings = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
      expect(headings, entry.route).toHaveLength(1);
      expect(textContent(headings[0][1]), entry.route).toBe(normalized(entry.zh_preferred));
      const text = textContent(main);
      expect(text, entry.route).toContain(normalized(entry.canonical));
      expect(text, entry.route).toContain(entry.categoryLabel);
      if (entry.category === 'concepts') expect(text, entry.route).toContain(entry.collectionLabel);
      if (entry.category === 'names') expect(text, entry.route).toContain(NAME_TYPE_LABELS[entry.type!]);
      expect(links(main).some((link) => link.href === '/glossary/' && link.label.includes('术语库')), entry.route).toBe(true);
    }
  });

  it('preserves all alternative Chinese forms and foreign forms while omitting empty fields', () => {
    for (const entry of glossary) {
      const main = detailMain(entry);
      for (const [label, values] of [
        ['其他中文形式', entry.zh_alternatives], ['外文词形', entry.forms],
      ] as const) {
        const definition = definitionWithLabel(main, label);
        if (!values.length) {
          expect(definition, `${entry.route}: ${label}`).toBeUndefined();
          expect([...main.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/g)]
            .map(([, content]) => textContent(content)), entry.route).not.toContain(label);
          continue;
        }
        expect(definition, `${entry.route}: ${label}`).toBeDefined();
        const items = [...definition!.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
          .map(([, content]) => textContent(content));
        expect(items, `${entry.route}: ${label}`).toEqual(values.map(normalized));
      }
    }
  });

  it('renders nonempty usage notes as literal text and omits blank notes', () => {
    for (const entry of glossary) {
      const section = sectionWithHeading(detailMain(entry), '用法与译名说明');
      if (!entry.notes.trim()) {
        expect(section, entry.route).toBeUndefined();
        continue;
      }
      expect(section, entry.route).toBeDefined();
      const body = section!.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/, '');
      expect(textContent(body), entry.route).toBe(normalized(entry.notes));
      expect(body, entry.route).not.toMatch(/<(?:a|strong|em|code|script|iframe)\b/);
    }
  });
});
