import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBooks } from '../src/lib/books';
import { site } from '../src/lib/editorial';
import { getSiteData } from '../src/lib/site-data';
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

    // 字号只从 token 取。:root 的 16px 是这套 rem 的基准，其余任何像素字号都是漏网的旧值。
    const pixelSized = rules.filter((rule) => (
      rule.selector !== ':root' && /\d+px/.test(rule.declarations['font-size'] ?? '')
    ));
    expect(pixelSized.map((rule) => rule.selector)).toEqual([]);
  });

  it('keeps the header and the indexed navigation in place while jumping', () => {
    expect(declaration('.site-header', 'position')).toBe('sticky');
    expect(declaration('.site-header', 'top')).toBe('0');
    expect(declarationsFor(':root')['--header-h']).toBeDefined();

    // 标题栏高度只在 --header-h 里定义一次：吸顶位置和锚点落点都从它推出来，
    // 不再有第二处需要跟着改的像素值。
    for (const [selector, property, media] of [
      ['.section-layout--indexed .section-layout__intro', 'top', ''],
      ['.section-layout__toc', 'top', ''],
      ['.section-layout--indexed .section-layout__sidebar', 'top', '@media (max-width: 1120px)'],
      ['.section-layout--indexed .section-layout__toc', 'top', '@media (max-width: 600px)'],
      ['.research-series h2', 'scroll-margin-top', ''],
      ['.research-series h2', 'scroll-margin-top', '@media (max-width: 600px)'],
    ] as const) {
      expect(declaration(selector, property, media), `${selector} ${property}`).toContain('var(--header-h)');
    }

    // 左栏与目录吸在打开页面时的位置，只有正文滚动
    expect(declaration('.section-layout--indexed .section-layout__intro', 'position')).toBe('sticky');
    expect(declaration('.section-layout__toc', 'position')).toBe('sticky');

    // 三栏 → 两栏 → 单栏
    expect(declaration('.section-layout--indexed', 'grid-template-columns')).toContain('minmax(0, 216px)');
    expect(declaration('.section-layout--indexed', 'grid-template-columns', '@media (max-width: 1120px)')).toContain('minmax(0, 248px)');
    expect(declaration('.section-layout--indexed', 'display', '@media (max-width: 600px)')).toBe('block');
    expect(declaration('.section-layout--indexed .section-layout__toc', 'position', '@media (max-width: 600px)')).toBe('sticky');
  });

  it('presents Ilyenkov section entrances without link underlines', () => {
    expect(declaration('.topic-grid h2 a', 'text-decoration')).toBe('none');
    expect(declaration('.topic-grid h2 a:hover', 'text-decoration')).toBe('none');
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

    expect(page).toContain('<SectionLayout>');
    expect(page).toContain('<header class="page-header" slot="intro">');
    expect(page).toContain('<div class="books-shelf">');
    expect(page).toContain('group.category !== \'translation\'');
    expect(page).toContain('<h2 id={`category-${group.category}`}>{group.label}</h2>');
    expect(page).toContain("group.category === 'translation' ? '书籍目录' : undefined");
    expect(detail).toContain('<dt>类型</dt>');
    expect(detail).toContain('BOOK_CATEGORY_LABELS[book.category]');

    // 目录式条目：靠留白分组，不画分隔线，也不再有封面框
    expect(declaration('.book-grid', 'display')).toBe('grid');
    expect(declaration('.book-grid', 'gap')).toBeDefined();
    expect(declaration('.book-grid', 'gap', '@media (max-width: 600px)')).toBeDefined();
    const borderedEntries = rules.filter((rule) => (
      rule.selector.startsWith('.book-entry')
      && Object.keys(rule.declarations).some((property) => property.startsWith('border'))
    ));
    expect(borderedEntries.map((rule) => rule.selector)).toEqual([]);
    expect(rules.some((rule) => rule.selector.startsWith('.book-card'))).toBe(false);
  });

  it('keeps editions and access information inside the book detail panel', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/pages/books/[id].astro'), 'utf8');

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

    expect(hasRule('.edition-popover__panel')).toBe(true);
    expect(declaration('.book-detail__edition', 'position')).toBe('relative');
    expect(declaration('.edition-popover', 'position')).toBe('static');
    expect(declaration('.edition-popover__panel', 'position')).toBe('absolute');
    expect(declaration('.edition-popover__panel', 'top')).toBe('calc(100% + 8px)');
    expect(declaration('.edition-popover__panel', 'overflow')).toBe('auto');
    expect(declaration('.edition-popover__panel', 'max-height')).toContain('60vh');
    expect(declaration('.edition-popover__panel', 'left', '@media (max-width: 600px)')).toBe('0');

    // 书目字段不画分隔线。覆盖必须挂在 .book-page 上：事实表在 .book-header__body 里，
    // 那是 <header class="book-header"> 的兄弟节点，挂在 .book-header 上会静默失效。
    expect(declaration('.book-page .fact-list > div', 'border')).toBe('0');
    expect(declaration('.book-page .fact-list > div', 'display')).toBe('block');
  });

  it('keeps cover and identity above the introduction and stacks them on narrow screens', () => {
    const page = readFileSync(path.join(process.cwd(), 'src/pages/books/[id].astro'), 'utf8');
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
