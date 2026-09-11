import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBooks } from '../src/lib/books';
import { site } from '../src/lib/editorial';
import { getSiteData } from '../src/lib/site-data';
import { componentSource, pageFileExists, pageSource, routeExists } from './helpers/pages';
import { websiteWorks } from './helpers/publication';
import { declaration, declarationsFor, hasRule, rules } from './helpers/styles';

describe('website-approved data adapter', () => {
  it('loads every approved translation without assuming a current artifact count', async () => {
    const data = await getSiteData();
    expect(data.articles).toHaveLength(websiteWorks().length);
    expect(data.articles.every((article) => article.html.length > 1000)).toBe(true);
  });

  it('uses source information generated directly from work.json', async () => {
    const { articles } = await getSiteData();
    expect(articles.every((article) => article.originalTitle.length > 0)).toBe(true);
    expect(articles.every((article) => article.sourceUrl?.startsWith('https://'))).toBe(true);
    expect(articles.some((article) => article.doiUrl?.startsWith('https://doi.org/'))).toBe(true);
    expect(articles.every((article) => article.sourceEdition.length > 0)).toBe(true);
  });

  it('keeps canonical routes unique', async () => {
    const { articles } = await getSiteData();
    const routes = articles.map((article) => article.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('does not expose local filesystem paths as public data', async () => {
    const data = await getSiteData();
    const publicRoutes = new Set(data.articles.map((article) => article.route));
    const strings: string[] = [];
    const collectStrings = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(collectStrings);
      else if (value && typeof value === 'object') Object.values(value).forEach(collectStrings);
    };
    collectStrings(data);

    const absolutePaths = strings.filter((value) => (
      path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
    ));
    expect(absolutePaths.every((value) => publicRoutes.has(value))).toBe(true);
    expect(strings.some((value) => value.startsWith('file:'))).toBe(false);
  });

  it('provides the long-term public information architecture without private records', () => {
    for (const route of [
      'ilyenkov/index.astro',
      'ilyenkov/life.astro',
      'ilyenkov/timeline.astro',
      'ilyenkov/works.astro',
      'ilyenkov/circle.astro',
      'archive/index.astro',
      'archive/[id].astro',
      'research.astro',
      'group.astro',
      'books/index.astro',
      'books/[id].astro',
      'about.astro',
    ]) {
      expect(pageFileExists(route), `${route} should exist`).toBe(true);
    }
  });

  it('uses the shared section layout for every non-detail public section', () => {
    for (const route of [
      'ilyenkov/index.astro',
      'ilyenkov/life.astro',
      'ilyenkov/timeline.astro',
      'ilyenkov/works.astro',
      'ilyenkov/circle.astro',
      'archive/index.astro',
      'research.astro',
      'group.astro',
      'about.astro',
    ]) {
      const source = pageSource(route);
      expect(source, `${route} should use SectionLayout`).toContain('SectionLayout');
    }
  });

  it('keeps in-page navigation local to real research sections', () => {
    const source = pageSource('research.astro');
    const anchors = [...source.matchAll(/href: '(#[^']+)'/g)].map((match) => match[1]);
    const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors.every((anchor) => ids.has(anchor.slice(1)))).toBe(true);

    const layout = componentSource('SectionLayout');
    expect(layout).toContain('aria-labelledby="section-toc-label"');
    expect(layout).toContain('id="section-toc-label">页内目录</p>');
    expect(layout).not.toContain('<p>本页</p>');
  });

  it('uses location breadcrumbs on nested reading and catalogue pages', () => {
    const breadcrumb = componentSource('Breadcrumbs');
    expect(breadcrumb).toContain('aria-label="当前位置"');
    expect(breadcrumb).toContain('<li><a href="/">首页</a></li>');

    for (const route of [
      'ilyenkov/life.astro',
      'ilyenkov/timeline.astro',
      'ilyenkov/works.astro',
      'ilyenkov/circle.astro',
      'archive/[id].astro',
      'books/[id].astro',
    ]) {
      const source = pageSource(route);
      expect(source, `${route} should use location breadcrumbs`).toContain('Breadcrumbs');
    }

    const layout = componentSource('SectionLayout');
    expect(layout).toContain('<slot name="breadcrumb" />');
  });

  it('uses one restrained type scale across public page families', () => {
    const scale = declarationsFor(':root');
    expect(scale['--text-meta']).toBe('.875rem');
    expect(scale['--text-secondary']).toBe('.9375rem');
    expect(scale['--text-body']).toBe('1rem');
    expect(scale['--text-item']).toBe('1.125rem');
    expect(scale['--text-section']).toBe('1.375rem');
    expect(scale['--text-page']).toBe('1.75rem');
    expect(scale['--text-display']).toBe('2.25rem');

    expect(declaration('.breadcrumbs', 'font-size')).toBe('var(--text-meta)');
    expect(declaration('.page-title', 'font-size')).toBe('var(--text-page)');
    expect(declaration('.document-header h1', 'font-size')).toBe('var(--text-page)');
    expect(declaration('.prose', 'font-size')).toBe('var(--text-body)');

    // 字号只从 token 取；:root 的 16px 是这套 rem 的基准。
    const pixelSized = rules.filter((rule) => (
      rule.selector !== ':root' && /\d+px/.test(rule.declarations['font-size'] ?? '')
    ));
    expect(pixelSized.map((rule) => rule.selector)).toEqual([]);
  });

  it('keeps the header and the indexed navigation in place while jumping', () => {
    expect(declaration('.site-header', 'position')).toBe('sticky');
    expect(declaration('.site-header', 'top')).toBe('0');
    expect(declarationsFor(':root')['--header-h']).toBeDefined();

    // 标题栏高度只在 --header-h 里定义一次，吸顶位置和锚点落点都从它推出来。
    for (const [selector, property, media] of [
      ['.section-layout__toc', 'top', ''],
      ['.section-layout--indexed .section-layout__toc', 'top', '@media (max-width: 600px)'],
      ['.research-series h2', 'scroll-margin-top', ''],
      ['.research-series h2', 'scroll-margin-top', '@media (max-width: 600px)'],
    ] as const) {
      expect(declaration(selector, property, media), `${selector} ${property}`).toContain('var(--header-h)');
    }

    // 左栏只有索引，它吸在打开页面时的位置；标题与导语归入正文那一栏，跟着正文滚。
    expect(declaration('.section-layout__toc', 'position')).toBe('sticky');
    expect(declaration('.section-layout--indexed', 'grid-template-areas')).toContain('"toc intro"');

    // 两栏 → 单栏
    expect(declaration('.section-layout--indexed', 'grid-template-columns')).toContain('var(--index)');
    // 译文版式：正文是行宽本身，两边各让出一个索引栏的宽度，正文因此落在正中。
    expect(declaration('.section-layout--reading', 'width'))
      .toContain('var(--reading) + (var(--index) + var(--index-gap)) * 2');
    expect(declaration('.section-layout--reading', 'grid-template-columns'))
      .toBe('minmax(var(--index), 1fr) minmax(0, var(--reading)) minmax(0, 1fr)');
    expect(declaration('.section-layout--indexed', 'grid-template-areas', '@media (max-width: 860px)')).toContain('"intro"');
    expect(declaration('.section-layout--indexed', 'display', '@media (max-width: 600px)')).toBe('block');
    expect(declaration('.section-layout--indexed .section-layout__toc', 'position', '@media (max-width: 600px)')).toBe('sticky');
  });

  it('presents Ilyenkov section entrances as whole-card links', () => {
    expect(declaration('.entrance-card', 'text-decoration')).toBe('none');
    expect(declaration('.entrance-grid', 'grid-template-columns')).toContain('repeat(2');
    expect(declaration('.entrance-grid', 'grid-template-columns', '@media (max-width: 600px)')).toBe('1fr');
  });

  it('publishes only readable documents selected by the upstream website channel', async () => {
    const { articles } = await getSiteData();
    expect(articles.every((article) => article.kind === 'readable' && article.html.length > 0)).toBe(true);
  });
});

describe('public navigation', () => {
  it('points every navigation link at a page that exists', () => {
    const hrefs = ['/', ...site.navigation.map((link) => link.href)];
    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs) {
      expect(routeExists(href), `navigation link has no page: ${href}`).toBe(true);
    }
  });

  it('links the homepage introduction to the group page', () => {
    expect(pageSource('index.astro')).toContain('href="/group"');
    const groupPage = pageSource('group.astro');
    expect(groupPage).toContain('<SectionLayout');
    expect(groupPage).toContain('href="/about"');
  });

  it('keeps the group page focused on the group rather than repeating site outputs', () => {
    const source = pageSource('group.astro');
    expect(source).toContain('<SectionLayout');
    for (const siteOutput of ['getSiteData', 'getBooks', 'toc={toc}']) {
      expect(source, `group page should not read ${siteOutput}`).not.toContain(siteOutput);
    }
  });
});

describe('book channel', () => {
  it('loads without requiring any published book', async () => {
    const books = await getBooks();
    expect(Array.isArray(books)).toBe(true);
    for (const book of books) {
      expect(book.route).toBe(`/books/${book.id}`);
      expect(book.introductionHtml.length).toBeGreaterThan(0);
      expect(book.editions).toContain(book.latestEdition);
    }
  });

  it('uses an unheaded default shelf while preserving future category headings', () => {
    const page = pageSource('books/index.astro');
    const detail = pageSource('books/[id].astro');

    expect(page).toContain('<SectionLayout');
    expect(page).toContain('<header class="page-header" slot="intro">');
    expect(page).toContain('<div class="books-shelf">');
    expect(page).toContain('group.category !== \'translation\'');
    expect(page).toContain('<h2 id={`category-${group.category}`}>{group.label}</h2>');
    expect(page).toContain("group.category === 'translation' ? '书籍目录' : undefined");
    expect(detail).toContain('<dt>类型</dt>');
    expect(detail).toContain('BOOK_CATEGORY_LABELS[book.category]');

    // 每个栏目的条目共用一套记录列表：靠留白分组，不画分隔线，也不放封面
    expect(page).toContain('<ul class="record-list">');
    expect(declaration('.record-list', 'display')).toBe('grid');
    expect(declaration('.record-list', 'gap')).toBeDefined();
    const borderedRecords = rules.filter((rule) => (
      rule.selector.startsWith('.record__')
      && Object.keys(rule.declarations).some((property) => property.startsWith('border'))
    ));
    expect(borderedRecords.map((rule) => rule.selector)).toEqual([]);
    expect(rules.some((rule) => rule.selector.startsWith('.book-card'))).toBe(false);
  });

  it('keeps editions and access information inside the book detail panel', () => {
    const page = pageSource('books/[id].astro');

    expect(page).toContain('<dt>当前版次</dt>');
    expect(page).toContain('<details class="edition-popover">');
    expect(page).toContain('<span aria-hidden="true">·</span>');
    expect(page).toContain('<p class="edition-popover__title">版次记录</p>');
    expect(page).toContain('[...book.editions].reverse().map');
    expect(page).toContain('edition.checksum');
    expect(page).toContain('book.errata');
    expect(page).toContain('<dt>获取与权利</dt>');
    expect(page).toContain('book.rights');
    expect(page).toContain('book.download');
    expect(page).toContain('<p>本站不提供下载。</p>');
    expect(hasRule('.edition-popover__panel')).toBe(true);
    expect(declaration('.book-detail__edition', 'position')).toBe('relative');
    expect(declaration('.edition-popover', 'position')).toBe('static');
    expect(declaration('.edition-popover__panel', 'position')).toBe('absolute');
    expect(declaration('.edition-popover__panel', 'top')).toBe('calc(100% + 8px)');
    expect(declaration('.edition-popover__panel', 'overflow')).toBe('auto');
    expect(declaration('.edition-popover__panel', 'max-height')).toContain('60vh');
    expect(declaration('.edition-popover__panel', 'left', '@media (max-width: 600px)')).toBe('0');

    // 书目字段不画分隔线。事实表在 .book-header__body 里，不是 .book-header 的后代，
    // 所以覆盖挂在 .book-page 上。
    expect(declaration('.book-page .fact-list > div', 'border')).toBe('0');
    expect(declaration('.book-page .fact-list > div', 'display')).toBe('block');
  });

  it('keeps cover and identity above the introduction and stacks them on narrow screens', () => {
    const page = pageSource('books/[id].astro');
    const detailsIndex = page.indexOf('class="book-header__identity"');
    const introductionIndex = page.indexOf('class="prose prose--section book-introduction"');
    const coverIndex = page.indexOf('class="book-header__cover-panel"');

    expect(coverIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(coverIndex);
    expect(introductionIndex).toBeGreaterThan(detailsIndex);
    expect(declaration('.container.book-page', 'max-width')).toBe('860px');
    expect(declaration('.book-header__body', 'grid-template-columns')).toContain('clamp(220px, 30vw, 280px)');
    expect(declaration('.book-header__body', 'column-gap')).toContain('clamp(');
    expect(declaration('.book-header__body', 'grid-template-areas')).toContain('"cover identity"');
    expect(declaration('.book-header__body', 'grid-template-areas')).toContain('"introduction introduction"');
    expect(declaration('.book-header__body--without-cover', 'grid-template-areas')).toContain('"identity"');
    expect(declaration('.book-page .book-introduction', 'grid-area')).toBe('introduction');
    expect(declaration('.book-header__title', 'border')).toBe('0');

    // 窄屏：封面收窄，字段之间靠间距分组
    expect(declaration('.book-header__cover-link', 'width', '@media (max-width: 600px)')).toBe('min(100%, 420px)');
    expect(declaration('.book-page .fact-list > div + div', 'margin-top', '@media (max-width: 600px)')).toBe('28px');
  });
});
