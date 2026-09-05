import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBooks } from '../src/lib/books';
import { site } from '../src/lib/editorial';
import { getSiteData } from '../src/lib/site-data';
import { websiteWorks } from './helpers/publication';

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
    const { documents } = await getSiteData();
    const routes = documents.map((document) => document.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('does not expose local filesystem paths as public data', async () => {
    const data = await getSiteData();
    const publicRoutes = new Set(data.documents.map((document) => document.route));
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
      'about-us.astro',
      'about.astro',
    ]) {
      expect(existsSync(path.join(process.cwd(), 'src/pages', route))).toBe(true);
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
      'about-us.astro',
      'about.astro',
    ]) {
      const source = readFileSync(path.join(process.cwd(), 'src/pages', route), 'utf8');
      expect(source, `${route} should use SectionLayout`).toContain('SectionLayout');
    }
  });

  it('keeps in-page navigation local to real research sections', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/pages/research.astro'), 'utf8');
    const anchors = [...source.matchAll(/href: '(#[^']+)'/g)].map((match) => match[1]);
    const ids = new Set([...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors.every((anchor) => ids.has(anchor.slice(1)))).toBe(true);

    const layout = readFileSync(path.join(process.cwd(), 'src/components/SectionLayout.astro'), 'utf8');
    expect(layout).toContain('aria-label="页内目录"');
    expect(layout).not.toContain('<p>本页</p>');
  });

  it('uses location breadcrumbs on nested reading and catalogue pages', () => {
    const breadcrumb = readFileSync(path.join(process.cwd(), 'src/components/Breadcrumbs.astro'), 'utf8');
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
      const source = readFileSync(path.join(process.cwd(), 'src/pages', route), 'utf8');
      expect(source, `${route} should use location breadcrumbs`).toContain('Breadcrumbs');
    }

    const layout = readFileSync(path.join(process.cwd(), 'src/components/SectionLayout.astro'), 'utf8');
    expect(layout).toContain('<slot name="breadcrumb" />');
  });

  it('uses one restrained type scale across public page families', () => {
    const styles = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');
    for (const token of [
      '--text-meta: .875rem',
      '--text-secondary: .9375rem',
      '--text-body: 1rem',
      '--text-item: 1.125rem',
      '--text-section: 1.375rem',
      '--text-page: 1.75rem',
      '--text-display: 2.25rem',
    ]) {
      expect(styles).toContain(token);
    }

    expect(styles).toContain('.breadcrumbs { min-width: 0; color: var(--muted); font-size: var(--text-meta);');
    expect(styles).toContain('.page-title { margin: 0; font-size: var(--text-page);');
    expect(styles).toContain('.document-header h1 { margin: 36px 0 0; font-size: var(--text-page);');
    expect(styles).toContain('.prose { max-width: var(--reading); margin: 0 auto; font-size: var(--text-body);');
    expect(styles).not.toMatch(/font-size:\s*(?:34|42|58)px/);
    expect(styles).not.toContain('font-size: 19px');
  });

  it('keeps indexed navigation visible while jumping at every layout width', () => {
    const styles = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(styles).toContain('.section-layout--indexed');
    expect(styles).toContain('grid-template-columns: minmax(0, 216px) minmax(0, 144px) minmax(0, var(--reading))');
    expect(styles).toContain('@media (max-width: 1120px)');
    expect(styles).toContain('@media (max-width: 800px)');
    expect(styles).toContain('.section-layout__toc { position: sticky');
    expect(styles).toContain('@media (max-width: 600px)');
    expect(styles).toContain('.site-header {\n  position: sticky; top: 0; z-index: 50;');
    expect(styles).toContain('.section-layout--indexed .section-layout__intro { position: sticky; top: calc(var(--header-h) + 96px); }');
    expect(styles).toContain('.section-layout--indexed .section-layout__sidebar { display: block; position: sticky; top: calc(var(--header-h) + 96px); grid-column: 1; }');
    expect(styles).toContain('.section-layout--indexed .section-layout__intro { position: static; }');
    expect(styles).toContain('.section-layout--indexed { display: block; }');
    expect(styles).toContain('.section-layout--indexed .section-layout__sidebar { display: contents; }');
    expect(styles).toContain('.section-layout--indexed .section-layout__toc { position: sticky; top: var(--header-h); z-index: 10;');
    expect(styles).toContain('.research-series h2 { margin: 0; scroll-margin-top: calc(var(--header-h) + 32px);');
    expect(styles).toContain('.research-series h2 { scroll-margin-top: calc(var(--header-h) + 96px); }');
  });

  it('presents Ilyenkov section entrances without link underlines', () => {
    const styles = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');
    expect(styles).toContain('.topic-grid h2 a { text-decoration: none; }');
    expect(styles).toContain('.topic-grid h2 a:hover { text-decoration: none; }');
  });

  it('does not describe unpublished material as part of the current public sections', () => {
    const routes = [
      'ilyenkov/index.astro',
      'ilyenkov/life.astro',
      'ilyenkov/timeline.astro',
      'ilyenkov/circle.astro',
      'group.astro',
      'about.astro',
    ];
    const source = routes.map((route) => (
      readFileSync(path.join(process.cwd(), 'src/pages', route), 'utf8')
    )).join('\n');
    for (const staleCopy of [
      '当前作品目录只列出两部',
      '与同时代哲学家的往来',
      '同代人、国际会议和学生',
      '作为导师留下的学生回忆',
      '活动、翻译、出版、记录与交流',
    ]) {
      expect(source).not.toContain(staleCopy);
    }
  });

  it('publishes only documents selected by the upstream website channel', async () => {
    const { documents } = await getSiteData();
    expect(documents.some((document) => document.kind === 'readable' && document.html.length > 0)).toBe(true);
    expect(documents.some((document) => document.kind === 'work')).toBe(false);
  });
});

describe('public navigation', () => {
  const pageExists = (href: string): boolean => {
    const pages = path.join(process.cwd(), 'src/pages');
    const relative = href === '/' ? 'index' : href.replace(/^\//, '');
    return existsSync(path.join(pages, `${relative}.astro`))
      || existsSync(path.join(pages, relative, 'index.astro'));
  };

  it('points every header and footer link at a page that exists', () => {
    const links = site.navigation.flatMap((section) => [section, ...(section.children ?? [])]);
    const hrefs = ['/', ...links.map((link) => link.href), ...site.secondary.map((link) => link.href)];
    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs) {
      expect(pageExists(href), `navigation link has no page: ${href}`).toBe(true);
    }
  });

  it('does not repeat the full site navigation as a homepage entrance grid', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/pages/index.astro'), 'utf8');
    expect(source).not.toContain('从这里开始');
    expect(source).not.toContain('home-entrances');
    expect(source).not.toContain('const entrances');
  });

  it('links the homepage introduction to a dedicated about page', () => {
    const homepage = readFileSync(path.join(process.cwd(), 'src/pages/index.astro'), 'utf8');
    const aboutPage = readFileSync(path.join(process.cwd(), 'src/pages/about-us.astro'), 'utf8');
    expect(homepage).toContain('<h3><a href="/about-us">关于</a></h3>');
    expect(homepage).toContain('<a href="/about-us">了解小组与网站</a>');
    expect(aboutPage).toContain('<SectionLayout>');
    expect(aboutPage).toContain('为什么建立这个网站');
    expect(aboutPage).toContain('href="/about"');
  });

  it('keeps the group page focused on the group rather than repeating site outputs', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/pages/group.astro'), 'utf8');
    expect(source).toContain('<SectionLayout>');
    expect(source).toContain('讨论会、读书会、讲座、工作会议摘要与合作活动');
    expect(source).toContain('目前尚无完成公开选择的小组活动、会议或署名文章记录');
    for (const repeatedOutput of [
      'getSiteData',
      'getBooks',
      'toc={toc}',
      'group-result-list',
      'group-route-list',
      '<h2 id="translation-heading">翻译与数字化</h2>',
      '<h2 id="research-heading">资料整理</h2>',
    ]) {
      expect(source).not.toContain(repeatedOutput);
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
    const page = readFileSync(path.join(process.cwd(), 'src/pages/books/index.astro'), 'utf8');
    const detail = readFileSync(path.join(process.cwd(), 'src/pages/books/[id].astro'), 'utf8');
    const styles = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');

    expect(page).toContain('<SectionLayout>');
    expect(page).toContain('<header class="page-header" slot="intro">');
    expect(page).toContain('<div class="books-shelf">');
    expect(page).toContain('group.category !== \'translation\'');
    expect(page).toContain('<h2 id={`category-${group.category}`}>{group.label}</h2>');
    expect(page).toContain("group.category === 'translation' ? '书籍目录' : undefined");
    expect(detail).toContain('<dt>类型</dt>');
    expect(detail).toContain('BOOK_CATEGORY_LABELS[book.category]');
    expect(styles).toContain('.book-grid { display: grid; gap: 34px; margin: 0; padding: 0; list-style: none; }');
    expect(styles).not.toMatch(/\.book-entry[^{]*\{[^}]*border/);
    expect(styles).toContain('.book-grid { gap: 28px; }');
  });

  it('keeps editions and access information inside the book detail panel', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/pages/books/[id].astro'), 'utf8');
    const styles = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');

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
    expect(page).not.toContain('此处只维护它的公开身份与版本记录');
    expect(page).not.toContain('<h2 id="editions-heading">版次记录</h2>');
    expect(page).not.toContain('<h2 id="access-heading">获取与权利</h2>');

    expect(styles).toContain('.edition-popover__panel {');
    expect(styles).toContain('.book-detail__edition { position: relative; }');
    expect(styles).toContain('.edition-popover { position: static; }');
    expect(styles).toContain('position: absolute; top: calc(100% + 8px); right: 0; z-index: 30;');
    expect(styles).toContain('max-height: min(28rem, 60vh); overflow: auto;');
    expect(styles).toContain('width: min(360px, calc(100vw - 40px)); max-height: min(28rem, 60vh); overflow: auto;');
    expect(styles).toContain('.edition-popover__panel { right: auto; left: 0; width: 100%; padding: 16px; }');
    expect(styles).toContain('.book-page .fact-list > div { display: block; padding: 0; border: 0; }');
  });

  it('keeps cover and identity above the introduction and stacks them on narrow screens', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/pages/books/[id].astro'), 'utf8');
    const styles = readFileSync(path.join(process.cwd(), 'src/styles/global.css'), 'utf8');
    const detailsIndex = page.indexOf('class="book-header__identity"');
    const introductionIndex = page.indexOf('class="prose prose--section book-introduction"');
    const coverIndex = page.indexOf('class="book-header__cover-panel"');

    expect(coverIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(coverIndex);
    expect(introductionIndex).toBeGreaterThan(detailsIndex);
    expect(styles).toContain('.container.book-page { width: min(calc(100% - 40px), 860px); max-width: 860px;');
    expect(styles).toContain('grid-template-columns: clamp(220px, 30vw, 280px) minmax(0, 1fr);');
    expect(styles).toContain('column-gap: clamp(28px, 5vw, 48px);');
    expect(styles).toContain('"cover identity"');
    expect(styles).toContain('"introduction introduction";');
    expect(styles).toContain('.book-header__cover-link { display: block; width: 100%; max-width: none;');
    expect(styles).toContain('.book-page .book-introduction { grid-area: introduction; width: 100%; max-width: var(--reading); margin: 0; }');
    expect(styles).toContain('@media (max-width: 800px)');
    expect(styles).toContain('.book-header__cover-link { width: min(100%, 420px); max-width: 420px; }');
    expect(styles).toContain('.container.book-page { width: min(calc(100% - 2.5rem), 860px);');
    expect(styles).toContain('.book-header__title { padding: 0; border: 0; }');
    expect(styles).toContain('.book-page .fact-list > div + div { margin-top: 28px; }');
  });
});
