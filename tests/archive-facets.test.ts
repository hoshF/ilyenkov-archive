import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getArchiveVocabulary, assertEveryTermHasArticles } from '../src/lib/archive-taxonomy';
import { getSiteData } from '../src/lib/site-data';
import { declaration, rules } from './helpers/styles';

/**
 * Archive facet 浏览的契约：路由从受控词表生成、结果与筛选一致、顺序仍是 canonical order、
 * 每页只有一个 current、左栏的数字就是真实命中数。
 */

const facetPage = (segments: string[]) => path.join(process.cwd(), 'dist', 'archive', ...segments, 'index.html');

describe('archive facets', () => {
  it('uses the centered archive layout for the root and every facet view', async () => {
    const { facets } = await getSiteData();
    const pages = [
      facetPage([]),
      ...facets.topics.map((term) => facetPage(['topic', term.id])),
      ...facets.persons.map((term) => facetPage(['person', term.id])),
    ];

    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      const layout = [...html.matchAll(/<div class="([^"]*)"/g)]
        .map(([, value]) => value.split(/\s+/))
        .find((classes) => classes.includes('section-layout'));
      expect(layout, file).toBeDefined();
      for (const modifier of ['archive-index-page', 'section-layout--rail', 'section-layout--pinned']) {
        expect(layout, `${file} ${modifier}`).toContain(modifier);
      }
      // 只借文章页的水平几何，不启用阅读页的字体、背景或手机隐藏规则。
      expect(layout, file).not.toContain('section-layout--reading');
      expect(html, file).not.toContain('reading-page');
      expect(html, file).toContain('class="archive-search"');
    }
  });

  it('centers the desktop content on the article axis with facets in its left index rail', () => {
    const desktop = '@media (min-width: 801px)';
    // 分类是辅助入口，采用页面局部的窄索引；正文仍沿用相同的居中几何。
    expect(declaration('.archive-index-page', '--index', desktop)).toBe('160px');
    expect(declaration('.archive-index-page', '--index-gap', desktop)).toBe('32px');
    for (const property of ['width', 'grid-template-columns']) {
      expect(declaration('.archive-index-page', property, desktop), property)
        .toBe(declaration('.section-layout--reading', property));
    }
    expect(declaration('.archive-index-page', 'column-gap', desktop)).toBe('var(--index-gap)');
    expect(declaration('.archive-index-page .section-layout__content', 'grid-column', desktop)).toBe('2');
    for (const selector of ['.archive-index-page .section-layout__aside', '.archive-index-page .archive-facets']) {
      expect(declaration(selector, 'margin-top', desktop), selector).toBe('0');
    }
    for (const selector of [
      '.archive-index-page .archive-facets__label',
      '.archive-index-page .archive-facets__all a',
      '.archive-index-page .archive-facets__term',
    ]) {
      expect(declaration(selector, 'font-size', desktop), selector).toBe('var(--text-meta)');
    }

    // 分类目录自己吸顶；页眉仍在正常文档流内，不给目录增加补偿高度。
    const sidebar = '.section-layout--pinned .section-layout__sidebar';
    expect(declaration(sidebar, 'position')).toBe('sticky');
    expect(declaration(sidebar, 'top')).toBe('var(--section-top)');
  });

  it('keeps narrow archive views in the existing single-column flow', () => {
    const layoutProperties = ['display', 'width', 'grid-template-columns', 'grid-column', 'column-gap'];
    const archiveRules = rules.filter(({ selector, declarations }) => (
      selector.includes('.archive-index-page')
      && layoutProperties.some((property) => property in declarations)
    ));
    expect(archiveRules.length).toBeGreaterThan(0);
    for (const rule of archiveRules) {
      expect(rule.media, rule.selector).toBe('@media (min-width: 801px)');
    }
    expect(declaration(
      '.section-layout:not(.section-layout--indexed)', 'grid-template-columns', '@media (max-width: 800px)',
    )).toBe('1fr');
    expect(declaration(
      '.section-layout--pinned .section-layout__sidebar', 'position', '@media (max-width: 800px)',
    )).toBe('static');
  });

  it('generates one static page per controlled term, keyed by canonical id', async () => {
    const { facets } = await getSiteData();
    expect(facets.topics.length).toBeGreaterThan(0);
    expect(facets.persons.length).toBeGreaterThan(0);

    for (const term of facets.topics) {
      expect(term.href).toBe(`/archive/topic/${term.id}`);
      expect(existsSync(facetPage(['topic', term.id])), term.href).toBe(true);
    }
    for (const term of facets.persons) {
      expect(term.href).toBe(`/archive/person/${term.id}`);
      expect(existsSync(facetPage(['person', term.id])), term.href).toBe(true);
    }
    // 路由用 canonical id，不用中文 label。
    expect(existsSync(facetPage(['topic', '观念的东西']))).toBe(false);
    expect(existsSync(facetPage(['person', '维果茨基']))).toBe(false);
  });

  it('splits the article set exactly, without dropping or inventing matches', async () => {
    const { articles, facets } = await getSiteData();

    for (const term of facets.topics) {
      const expected = articles
        .filter((article) => article.topics.some((topic) => topic.id === term.id))
        .map((article) => article.id);
      expect(expected.length, term.id).toBe(term.count);
      expect(expected.length, `${term.id} should not be empty`).toBeGreaterThan(0);
    }
    for (const term of facets.persons) {
      const expected = articles
        .filter((article) => article.persons.some((person) => person.id === term.id))
        .map((article) => article.id);
      expect(expected.length, term.id).toBe(term.count);
      expect(expected.length, `${term.id} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('keeps filtered results a subsequence of the canonical article order', async () => {
    const { articles, facets } = await getSiteData();
    const canonical = articles.map((article) => article.id);

    for (const [kind, terms] of [['topics', facets.topics], ['persons', facets.persons]] as const) {
      for (const term of terms) {
        const filtered = articles
          .filter((article) => (
            (kind === 'topics' ? article.topics : article.persons).some((item) => item.id === term.id)
          ))
          .map((article) => article.id);
        // 筛选不重新排序：结果就是 canonical 顺序的子序列。
        let cursor = -1;
        for (const id of filtered) {
          const at = canonical.indexOf(id);
          expect(at, `${term.id} keeps canonical order`).toBeGreaterThan(cursor);
          cursor = at;
        }
      }
    }
  });

  it('keeps classification labels compact without a redundant sidebar heading', () => {
    const html = readFileSync(facetPage([]), 'utf8');
    const rail = html.match(/<aside class="archive-facets"[\s\S]*?<\/aside>/)![0];
    expect(rail).toContain('aria-label="档案分类"');
    expect(rail).toContain('aria-label="相关人物"');
    expect(rail).not.toContain('按分类浏览');
    expect(declaration('.archive-facets__term', 'display')).toBe('block');
    expect(declaration('.archive-facets__term[aria-current=page]', 'color')).toBe('var(--ink-soft)');
  });

  it('shows classification names without counts in the auxiliary rail', async () => {
    const { facets } = await getSiteData();
    const html = readFileSync(facetPage([]), 'utf8');
    const rail = html.match(/<aside class="archive-facets"[\s\S]*?<\/aside>/)![0];
    expect(rail).not.toContain('archive-facets__count');
    for (const term of [...facets.topics, ...facets.persons]) {
      expect(rail).toContain(`href="${term.href}"`);
      expect(rail).toContain(`<span class="archive-facets__name">${term.label}</span>`);
    }
  });

  it('marks exactly one current facet on every archive index page', async () => {
    const { facets } = await getSiteData();
    const pages: Array<[string, string | null]> = [
      [facetPage([]), null],
      ...facets.topics.map((t) => [facetPage(['topic', t.id]), `topic/${t.id}`] as [string, string]),
      ...facets.persons.map((p) => [facetPage(['person', p.id]), `person/${p.id}`] as [string, string]),
    ];

    for (const [file, expected] of pages) {
      const html = readFileSync(file, 'utf8');
      const rail = html.match(/<aside class="archive-facets"[\s\S]*?<\/aside>/)![0];

      // 左栏分类目录里只有一个 current。
      expect([...rail.matchAll(/aria-current="page"/g)].length, `${file} rail current`).toBe(1);
      // 全页共两处：顶栏的"档案"与左栏的当前分类。
      expect([...html.matchAll(/aria-current="page"/g)].length, `${file} total current`).toBe(2);

      if (expected === null) {
        expect(rail).toMatch(/href="\/archive" aria-current="page"/);
      } else {
        expect(rail).toContain(`href="/archive/${expected}" aria-current="page"`);
      }
    }
  });

  it('fails closed when a controlled term has no published articles', () => {
    // 受控词条 0 篇 = taxonomy stale 或预建空分类，两种都不该生成空页面。
    expect(() => assertEveryTermHasArticles([])).toThrow(
      /terms have no published articles: topic "/,
    );
  });

  it('gives every facet its own document metadata while keeping the archive h1', async () => {
    const { facets } = await getSiteData();
    const head = (file: string) => {
      const html = readFileSync(file, 'utf8');
      const text = (pattern: RegExp) => (html.match(pattern) || [])[1] ?? '';
      return {
        html,
        title: text(/<title>([\s\S]*?)<\/title>/).replace(/&amp;/g, '&').trim(),
        description: text(/<meta name="description" content="([^"]*)"/).replace(/&amp;/g, '&').trim(),
        h1: text(/<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').trim(),
      };
    };

    const root = head(facetPage([]));
    // 总目录使用“全部文章”作为可见标题。
    expect(root.title).toBe('文本档案｜中文伊里因科夫');
    expect(root.h1).toBe('全部文章');
    expect(root.html).not.toContain('<h2>文章</h2>');
    expect(root.description).toBe('伊里因科夫著作、中文译文及相关研究译文的公开档案。');

    // 分类视图以当前目录名作为 h1；文档元信息仍保留档案栏目身份。
    const titles = new Set([root.title]);
    const descriptions = new Set([root.description]);

    for (const term of facets.topics) {
      const page = head(facetPage(['topic', term.id]));
      expect(page.title, term.id).toBe(`${term.label}｜文本档案｜中文伊里因科夫`);
      expect(page.h1, `${term.id} shows its directory name`).toBe(term.label);
      expect(page.description, term.id).toContain(term.label);
      expect(page.description, term.id).toContain('主题');
      expect(page.description, term.id).not.toBe(root.description);
      // canonical id 只用于 URL，不进入标题。
      expect(page.title, term.id).not.toContain(term.id);
      titles.add(page.title);
      descriptions.add(page.description);
    }

    for (const term of facets.persons) {
      const page = head(facetPage(['person', term.id]));
      expect(page.title, term.id).toBe(`${term.label}｜文本档案｜中文伊里因科夫`);
      expect(page.h1, `${term.id} shows its directory name`).toBe(term.label);
      expect(page.description, term.id).toContain(term.label);
      expect(page.description, term.id).toContain('中心人物');
      expect(page.description, term.id).not.toBe(root.description);
      expect(page.title, term.id).not.toContain(term.id);
      titles.add(page.title);
      descriptions.add(page.description);
    }

    // 8 个 URL 的标题与描述两两不同：不再有彼此无法区分的公开页面。
    const pageCount = 1 + facets.topics.length + facets.persons.length;
    expect(titles.size).toBe(pageCount);
    expect(descriptions.size).toBe(pageCount);

    // 可见结构与导航不因元信息改动：搜索渐进增强，左栏分类目录原样存在。
    expect(root.html).toContain('class="archive-search"');
    expect(root.html).toContain('class="archive-facets"');
  });

  it('keeps the visible vocabulary in the archive index and out of generated article facts', async () => {
    const { topics, persons } = getArchiveVocabulary();
    expect(topics.length).toBeGreaterThan(0);
    expect(persons.length).toBeGreaterThan(0);

    // 详情页不展示分类目录，生成输入不带分类。用当前真正公开的一篇文章，而不是写死某个 id：
    // 上游可以调整哪些作品进入网站公开范围（见 publication_scope）。
    const { articles } = await getSiteData();
    const sample = articles[0];
    expect(sample).toBeDefined();

    const detail = readFileSync(
      path.join(process.cwd(), 'dist', 'archive', sample.id, 'index.html'),
      'utf8',
    );
    expect(detail).not.toContain('archive-facets');
    expect(detail).not.toContain('aria-label="主题"');

    const generated = readFileSync(
      path.join(process.cwd(), '.website-input', 'articles', `${sample.id}.md`),
      'utf8',
    );
    for (const leak of ['topics', 'persons', 'ideal', 'vygotsky', 'archive-taxonomy']) {
      expect(generated, `generated frontmatter should not carry ${leak}`).not.toContain(`${leak}:`);
    }
  });
});
