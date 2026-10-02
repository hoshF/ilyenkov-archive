import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { generatedArticleIds, resolveGeneratedArticlePath } from '../src/lib/article-source';
import { getBooks } from '../src/lib/books';
import { site } from '../src/lib/editorial';
import { adjacentIssues, getGroupIssues, GroupIssueSchema } from '../src/lib/group';
import { getSiteData } from '../src/lib/site-data';
import { componentSource, layoutSource, pageFileExists, pageSource, routeExists } from './helpers/pages';
import { researchRoot, websiteWorks } from './helpers/publication';
import { declaration, declarationsFor, hasRule, rules } from './helpers/styles';

describe('website-approved data adapter', () => {
  it('loads every approved translation without assuming a current artifact count', async () => {
    const data = await getSiteData();
    expect(data.articles).toHaveLength(websiteWorks().length);
    expect(data.articles.every((article) => article.html.length > 1000)).toBe(true);
  });

  it('gives every archive article a publication year and at least one author', async () => {
    const { articles } = await getSiteData();
    expect(articles.length).toBeGreaterThan(0);

    for (const article of articles) {
      expect(article.year, article.id).toMatch(/^\d{4}$/);
      expect(article.author.length, article.id).toBeGreaterThan(0);
      expect(new Set(article.author).size, article.id).toBe(article.author.length);
      expect(article.author.every((name) => name.trim().length > 0), article.id).toBe(true);
      // 列表与详情页读同一个署名。
      expect(article.authorLabel).toBe(article.author.join('、'));
    }
  });

  it('orders archive articles by publication year, newest first, deterministically', async () => {
    const { articles } = await getSiteData();
    expect(articles.every((article, index) => (
      index === 0 || articles[index - 1].year >= article.year
    ))).toBe(true);

    // 同年内按中文题名、再按 id：与文件系统读取顺序无关。
    const expected = [...articles].sort((left, right) => (
      right.year.localeCompare(left.year)
        || left.title.localeCompare(right.title, 'zh-Hans-CN')
        || left.id.localeCompare(right.id)
    ));
    expect(articles.map((article) => article.id)).toEqual(expected.map((article) => article.id));

    // 顺序真的按年份倒排，而不是恰好碰巧。
    expect(articles[0].year >= articles[articles.length - 1].year).toBe(true);
    const years = new Set(articles.map((article) => article.year));
    expect(years.size).toBeGreaterThan(1);
  });

  it('carries year and author into the generated frontmatter without leaking private fields', async () => {
    for (const work of websiteWorks()) {
      const article = matter(readFileSync(resolveGeneratedArticlePath(work.work_id), 'utf8'));
      const workJson = JSON.parse(readFileSync(path.join(researchRoot, work.work_json_path), 'utf8'));

      expect(article.data.year, work.work_id).toBe(workJson.year);
      expect(article.data.author, work.work_id).toEqual(workJson.author);
      expect(article.content).not.toMatch(/^---\r?\n/);
    }

    // 生成物里仍然没有 private 侧的字段。
    const sample = readFileSync(resolveGeneratedArticlePath(generatedArticleIds()[0]), 'utf8');
    for (const restricted of [
      'rights_status',
      'source_text_status',
      'source_path',
      'orcid',
      'udc',
      'copyright',
      'translator',
    ]) {
      expect(sample, `generated input should not leak ${restricted}`).not.toContain(restricted);
    }
  });

  it('shows year and author on the archive list and the article page', () => {
    // 列表版式现在住在三个 Archive 路由共用的视图组件里。
    const list = componentSource('ArchiveIndexView');

    // 克制的档案条目：元信息一行（年份 · 作者），题名是唯一入口。
    expect(list).toContain('<p class="record__meta">{article.year} · {article.authorLabel}</p>');
    expect(list).toContain('<p class="record__title"><a href={article.route}>{article.title}</a></p>');
    // 保留记录列表与分组容器，不引入卡片或脚本。
    expect(list).toContain('<ul class="record-list"');
    expect(list).toContain('class="archive-year"');
    expect(list).not.toContain('<script');
    expect(list).not.toContain('record__links');
    // 列表页只消费公开的文章身份，不认识 private 侧的字段。
    for (const forbidden of ['rights_status', 'source_text_status', 'source_path', 'orcid', 'udc']) {
      expect(list, `archive list should not know ${forbidden}`).not.toContain(forbidden);
    }

    // 详情页只加同一行身份信息，不动 existing 阅读结构。
    const detail = pageSource('archive/[id].astro');
    expect(detail).toContain('<p class="record__meta">{document.year} · {document.authorLabel}</p>');
    expect(detail).toContain('<h1 id="document-title" set:html={document.titleHtml} />');
    expect(detail).toContain('class="document-header__original"');
    expect(detail).toContain('class="prose" set:html={document.html}');
    expect(detail).toContain('id="source-info-heading"');
    expect(detail).toContain('class="document-nav"');
    // 译文页的页内目录高亮脚本仍在，且只有这一段。
    expect(detail).toContain('<script>');
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
    // 公开的站内路由：文章页、译文媒体、以及左栏分类页。
    const publicRoutes = new Set(data.articles.map((article) => article.route));
    for (const term of [...data.facets.topics, ...data.facets.persons]) {
      publicRoutes.add(term.href);
    }
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
    // 分类只暴露站内路由，不带文件系统路径。
    for (const term of [...data.facets.topics, ...data.facets.persons]) {
      expect(term.href).toMatch(/^\/archive\/(?:topic|person)\/[a-z0-9-]+$/);
    }
    expect(strings.some((value) => value.startsWith('file:'))).toBe(false);
  });

  it('ships a static 404 so unknown paths stop falling back to the homepage', () => {
    // Cloudflare Pages 在输出里找不到 /404.html 时会把未知路径交给站点根页面并返回 200
    // （soft 404）。Astro 的 src/pages/404.astro 会生成 dist/404.html，Pages 随后用它
    // 响应找不到的静态路径——所以只需要这一个文件，不要 catch-all 路由。
    expect(pageFileExists('404.astro'), '404.astro should exist').toBe(true);

    const notFound = readFileSync(path.join(process.cwd(), 'dist', '404.html'), 'utf8');
    const main = notFound.match(/<main>([\s\S]*?)<\/main>/)![1];

    // 说明这是不存在的地址，并给出两个最基本的出口。
    expect(main).toContain('没有找到这个页面');
    expect(main).toContain('href="/"');
    expect(main).toContain('href="/archive"');

    // 404 不属于任何栏目：不套 SectionLayout、不出现面包屑、顶栏没有 active 项。
    expect(notFound).not.toContain('section-layout');
    expect(notFound).not.toContain('breadcrumbs');
    const nav = notFound.match(/<nav aria-label="主要导航">([\s\S]*?)<\/nav>/)![1];
    expect(nav).not.toContain('aria-current');
    expect([...nav.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(([, label]) => label))
      .toEqual(['伊里因科夫', '档案', '研究', '小组', '书籍']);

    // 纯静态：没有脚本，也不在本轮引入 canonical / OG / robots meta。
    expect(notFound).not.toContain('<script');
    expect(notFound).not.toContain('rel="canonical"');
    expect(notFound).not.toContain('property="og:');
    expect(notFound).not.toContain('name="robots"');
    // 与其它页面一样只有一个 h1。
    expect([...notFound.matchAll(/<h1\b/g)]).toHaveLength(1);
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
      'group/index.astro',
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
      'research.astro',
      'group/index.astro',
      'about.astro',
    ]) {
      const source = pageSource(route);
      expect(source, `${route} should use SectionLayout`).toContain('SectionLayout');
    }

    // Archive 的文库视图由三个路由共用：路由文件只选数据，版式在共享组件里。
    for (const route of ['archive/index.astro', 'archive/topic/[id].astro', 'archive/person/[id].astro']) {
      expect(pageSource(route), `${route} should render the shared archive view`)
        .toContain('ArchiveIndexView');
    }
    const view = componentSource('ArchiveIndexView');
    expect(view).toContain('<SectionLayout');
    expect(view).toContain('slot="intro"');
    expect(view).toContain('slot="aside"');
  });

  it('keeps in-page anchor targets local to real sections wherever a page has them', () => {
    // 小组期详情有页内索引：锚点与右栏题名必须来自同一个 issue id，条目是真跳转而不是装饰。
    const detail = pageSource('group/[id].astro');
    expect(detail).toContain('toc = [{ href: `#issue-${issue.id}`, label: issue.kind }]');
    expect(detail).toContain('id={`issue-${issue.id}`}');

    // 没传 toc 的页面不产生页内锚点，因此也不需要 scroll-margin 之外的跳转支持。
    const layout = componentSource('SectionLayout');
    expect(layout).toContain('aria-labelledby="section-toc-label"');
    expect(layout).toContain('id="section-toc-label">{tocLabel}</p>');
    // 默认标签仍是页内目录；需要另一种结构时由页面传 tocLabel。
    expect(layout).toContain("tocLabel = '页内目录'");
    expect(layout).not.toContain('<p>本页</p>');
  });

  it('keeps the research page a plain section page with stable section targets', () => {
    const source = pageSource('research.astro');

    // 栏目身份在左栏：h1、导语与边界说明都在 intro 槽里，页面不再进入 indexed 形态。
    expect(source).toContain('<SectionLayout pinned>');
    expect(source).not.toContain('toc={toc}');
    expect(source).not.toContain('const toc =');
    expect(source).toContain('<header class="page-header" slot="intro">');
    expect(source).toContain('class="page-title">世界研究</h1>');

    // 四个 section 的 id 仍是稳定的深链接目标，顺序不变。
    const ids = [...source.matchAll(/id="([a-z-]+-heading)"/g)].map((match) => match[1]);
    expect(ids).toEqual([
      'ifi-heading',
      'researchers-heading',
      'research-sites-heading',
      'readings-heading',
    ]);
    for (const id of ids) {
      expect(source, `${id} should keep its anchor target`).toContain(`aria-labelledby="${id}"`);
    }

    // 深链接跳转时避让固定站点标题栏；栏目页不再有目录横条。
    expect(declaration('.research-series h2', 'scroll-margin-top')).toContain('var(--header-h)');
    expect(declaration('.research-series h2', 'scroll-margin-top', '@media (max-width: 600px)'))
      .toBe('calc(var(--header-h) + 32px)');

    // 只有标题栏 / 页内目录这种吸顶元素需要避让；本页不带脚本，也不新增 sticky 行为。
    expect(source).not.toContain('<script');
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

  it('reserves the reading serif for continuous reading text', () => {
    // 界面一律无衬线；衬线只给连续正文——译文页（BaseLayout 的 reading）与小组期详情
    // （group-issue-page 局部复用同一套字体语义）。
    expect(declaration(':root', 'font-family')).toBe('var(--sans)');
    expect(layoutSource('BaseLayout')).toContain("reading && 'reading-page'");

    const serifRules = rules.filter((rule) => (
      Object.values(rule.declarations).some((value) => value.includes('var(--serif)'))
    ));
    expect(serifRules.length).toBeGreaterThan(0);
    expect(serifRules.every((rule) => (
      rule.selector.startsWith('.reading-page') || rule.selector.startsWith('.group-issue-page')
    ))).toBe(true);
    expect(declaration('.group-issue-page .prose', 'font-family')).toBe('var(--serif)');
  });

  it('keeps the group issue reading column whole at intermediate widths', () => {
    // 左栏从“标题栏”变成“结构与去向栏”之后，它仍然不值得占掉 248px：双栏容不下整行
    // 阅读宽度时提前收成单栏。选择器必须压过既有的 .section-layout--indexed（同层，
    // 那条在 ≤860px 才生效），否则 801–1040 会退化成窄左栏 + 672 正文。
    expect(declaration('.section-layout--indexed.group-issue-page', 'grid-template-columns', '@media (max-width: 1040px)'))
      .toBe('minmax(0, 1fr)');
    expect(declaration('.section-layout--indexed.group-issue-page', 'grid-template-areas', '@media (max-width: 1040px)'))
      .toContain('"content"');
    // 单栏时左栏回到普通文档流。
    expect(declaration('.section-layout--indexed.group-issue-page .section-layout__toc', 'position', '@media (max-width: 1040px)'))
      .toBe('static');
    // 宽屏模板：左栏（第一列）一列放位置、结构和出口，右栏是标题与正文。
    // grid-area 的行列由列宽决定，不能只看名字：toc 必须留在第一列。
    const wide = declaration('.section-layout--indexed.group-issue-page', 'grid-template-areas', '@media (min-width: 1041px)');
    expect(wide).toContain('"toc breadcrumb"');
    expect(wide).toContain('"toc content"');
    expect(wide).toContain('"toc aside"');
    // 去向被明确放进左栏那一格。
    expect(declaration('.section-layout__aside', 'grid-area')).toBe('aside');

    // 正文与篇末导航共用同一条水平基准：窄于行宽时一起填满，而不是一个靠左一个居中。
    expect(declaration('.group-issue-page .document-nav', 'margin-left')).toBe('0');
    expect(declaration('.group-issue-page .document-nav', 'margin-right')).toBe('0');
    expect(declaration('.document-nav', 'margin')).toContain('auto');

    // 只借阅读字体，不启用 reading-page：窄屏的站点标题栏与面包屑保持可见。
    const detail = pageSource('group/[id].astro');
    expect(detail).toContain('modifier="group-issue-page"');
    expect(detail).not.toContain('reading={');
    expect(detail).toContain('<BaseLayout title={issue.title}');
    expect(declaration('.reading-page .site-header', 'display', '@media (max-width: 600px)')).toBe('none');
  });

  it('puts the issue title and metadata in the content column, not the sidebar', () => {
    const source = pageSource('group/[id].astro');

    // 左栏的 markup 只有两种东西：左栏自己的槽位，以及右栏内容。
    const sidebar = source.slice(
      source.indexOf('<SectionLayout'),
      source.indexOf('<p class="section-note" slot="aside">'),
    );
    const content = source.slice(source.indexOf('<header class="page-header">'));

    // 左栏：位置（面包屑）、本期的结构索引、返回入口。
    expect(source).toContain('<Breadcrumbs slot="breadcrumb"');
    expect(source).toContain('slot="aside"');
    expect(source).toContain('返回小组工作');
    expect(source).toContain('tocLabel="本期内容"');
    expect(source).toContain('toc={toc}');

    // 左栏不再承担主标题与 metadata：正文列随后才是标题区。
    expect(sidebar).not.toContain('<h1');
    expect(sidebar).not.toContain('record__meta');

    // 右栏：metadata 与主标题组成完整阅读单元，主标题与正文同属一个内容区。
    expect(content).toContain('class="record__meta"');
    expect(content).toContain('<h1');
    expect(content).toContain('class="page-header"');
    expect(content).toContain('class="prose');
    expect(content.indexOf('record__meta')).toBeLessThan(content.indexOf('<h1'));
    expect(content.indexOf('<h1')).toBeLessThan(content.indexOf('class="prose'));

    // 左栏索引与右栏题名对齐：条目指向右栏真实存在的锚点，不是装饰。
    expect(source).toContain('toc = [{ href: `#issue-${issue.id}`, label: issue.kind }]');
    expect(source).toContain('id={`issue-${issue.id}`}');

    // 结构索引与页内目录分开一套：条目不一定都是跳转，位置与去向在左栏末尾。
    expect(componentSource('SectionLayout')).toContain('class="section-layout__structured"');
    expect(hasRule('.section-layout__structured')).toBe(true);
    expect(hasRule('.section-layout__aside')).toBe(true);
  });

  it('lists only the content kinds the issue actually has', async () => {
    const issues = await getGroupIssues();
    const detail = pageSource('group/[id].astro');

    // 左栏“本期内容”取真实的 kind，而不是一组未来可能存在的空栏目。
    expect(detail).toContain('label: issue.kind');
    const kinds = new Set(issues.map((issue) => issue.kind));
    expect(kinds.size).toBeGreaterThan(0);
    for (const kind of kinds) {
      expect(kind.length).toBeGreaterThan(0);
    }

    // 本期只有一种内容类型时，左栏只有一项。
    const tocEntry = detail.match(/const toc = \[([\s\S]*?)\];/);
    expect(tocEntry).not.toBeNull();
    expect(tocEntry![1].match(/\{ href:/g)).toHaveLength(1);
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

  it('marks the current section only where a translation is being read', () => {
    // 高亮由脚本给出，脚本只随译文页输出：其他用 SectionLayout 的栏目页不加载它，
    // 共用组件本身也不带脚本。
    expect(pageSource('archive/[id].astro')).toContain('<script>');
    expect(componentSource('SectionLayout')).not.toContain('<script');
    for (const route of [
      'research.astro',
      'group/index.astro',
      'group/[id].astro',
      'about.astro',
      'books/index.astro',
    ]) {
      expect(pageSource(route), `${route} should carry no script`).not.toContain('<script');
    }

    // 状态写在目录条目上，用的是 location，不和顶栏当前栏目的 page 混用。
    const active = rules.filter((rule) => rule.selector.includes('[aria-current=location]'));
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((rule) => rule.selector.includes('.section-layout__toc'))).toBe(true);

    // 标记线绝对定位，出现和消失都不推动文字。
    expect(declaration(
      '.section-layout--reading .section-layout__toc a[aria-current=location]:before',
      'position',
    )).toBe('absolute');

    // 窄屏译文页仍然不显示目录，本轮没有顺手做手机目录。
    expect(declaration(
      '.section-layout--reading .section-layout__toc',
      'display',
      '@media (max-width: 600px)',
    )).toBe('none');
  });

  it('stacks translations without a section index in one reading column', () => {
    // 无目录时侧栏仍包含题名；退出网格，避免三栏命名区域生成隐式列并挤窄题名。
    const fallback = declarationsFor('.section-layout--reading:not(.section-layout--indexed)');
    expect(fallback.display).toBe('block');
    expect(fallback.width).toBe('min(calc(100% - 40px), var(--reading))');
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

  it('marks the current section in the main navigation', () => {
    const layout = layoutSource('BaseLayout');
    expect(layout).toContain("aria-current={current(item.href) ? 'page' : undefined}");

    const active = declarationsFor('.site-header__masthead nav a[aria-current=page]');
    expect(active.color).toBe('var(--accent-dark)');
    expect(active['text-decoration']).toBe('underline');
    // 底线是文字自己的下划线：导航项不因为当前状态而变高，--header-h 仍然算得准。
    expect(active['border-bottom']).toBeUndefined();
  });

  it('gives the rights page a permanent entrance from every page', () => {
    // 《项目与权利》讲来源、授权与版本原则，此前只能从小组页正文的一句话走到。
    const hrefs = site.footer.map((link) => link.href);
    expect(hrefs).toContain('/about');
    for (const href of hrefs) {
      expect(routeExists(href), `footer link has no page: ${href}`).toBe(true);
    }

    const layout = layoutSource('BaseLayout');
    expect(layout).toContain('class="site-footer"');
    expect(layout).toContain('site.footer.map');
  });

  it('lists every primary section from the navigation on the homepage', () => {
    // 首页目录的名称与去向来自 site.json 的 navigation；首页只补一句职责说明。
    // 渲染产物里页身的目的地必须与一级导航逐项一致，顺序也一致。
    const homepage = readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const main = homepage.match(/<main>([\s\S]*?)<\/main>/)![1];
    const sections = main.match(/<ul class="home-sections"[\s\S]*?<\/ul>/)![0];

    const rendered = [...sections.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
      .map(([, href, label]) => ({ href, label }));
    expect(rendered).toEqual(site.navigation.map(({ href, label }) => ({ href, label })));

    // 每个栏目一句非空说明，且没有硬编码 label（名称只来自 navigation）。
    const descriptions = [...sections.matchAll(/class="home-sections__description"[^>]*>([^<]+)</g)]
      .map(([, text]) => text.trim());
    expect(descriptions).toHaveLength(site.navigation.length);
    expect(descriptions.every((text) => text.length > 0)).toBe(true);
    // 栏目说明与 navigation 的 label 不是一回事：说明不重复栏目名。
    for (const { label } of site.navigation) {
      expect(descriptions.some((text) => text === label), label).toBe(false);
    }
  });

  it('keeps the homepage directory and the primary navigation in step', () => {
    // 首页在构建期按 href 对齐两份数据：navigation 多一个一级栏目、首页多一条说明，
    // 都会让构建失败。这里锁定契约本身，避免以后用 try/catch 把它软化。
    const source = pageSource('index.astro');
    expect(source).toContain('site.navigation');
    expect(source).toContain('Homepage has no description for the primary section');
    expect(source).toContain('Homepage describes sections that are not in the primary navigation');
    expect(source, 'homepage must not hardcode a primary label').not.toContain("label: '");
  });

  it('samples the archive without inventing a publishing timeline', async () => {
    const { articles } = await getSiteData();
    const homepage = readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const main = homepage.match(/<main>([\s\S]*?)<\/main>/)![1];
    const list = main.match(/<ol class="home-recent__list"[\s\S]*?<\/ol>/)![0];

    // 抽样条数与规范顺序的前三条一致：首页不重新排序。
    expect(articles.length).toBeGreaterThan(3);
    const sampled = articles.slice(0, 3);
    for (const article of sampled) {
      expect(list).toContain(`href="${article.route}"`);
    }
    expect([...list.matchAll(/<li>/g)]).toHaveLength(3);

    // 每条显示与 /archive/ 相同的身份行：原文发表年份 · 作者。
    for (const article of sampled) {
      expect(list).toContain(
        `<p class="record__meta">${article.year} · ${article.authorLabel}</p>`,
      );
    }

    // 抽样是"原文发表年份由新到旧"，不是网站发布动态：不得出现更新时间语义。
    for (const phrase of ['最近的文章', '最新文章', '最近更新', '最近发表']) {
      expect(main, phrase).not.toContain(phrase);
    }
    expect(main).toContain('按原文发表年份排列');
  });

  it('keeps the group page self-contained and the homepage free of site-scope copy', () => {
    expect(pageSource('index.astro')).not.toContain('/about');
    const groupPage = pageSource('group/index.astro');
    expect(groupPage).toContain('<SectionLayout');
    expect(groupPage).toContain('href="/about"');
  });

  it('keeps the group pages on their own public editorial channel', () => {
    const layout = componentSource('SectionLayout');
    expect(layout).toContain('<slot />');

    for (const route of ['group/index.astro', 'group/[id].astro']) {
      const source = pageSource(route);
      expect(source, `${route} should use SectionLayout`).toContain('<SectionLayout');

      // 小组工作是 public 仓库自维护的正式内容：只读 editorial/group，不经过译文同步通道，
      // 也不消费档案与书籍的数据层。
      for (const foreignSource of [
        'getSiteData',
        'getBooks',
        'getPublicResearchRecords',
        'article-source',
        '.website-input',
      ]) {
        expect(source, `${route} should not depend on ${foreignSource}`).not.toContain(foreignSource);
      }
    }
  });
});

describe('group work channel', () => {
  it('reads every published issue from the public editorial channel', async () => {
    const issues = await getGroupIssues();
    expect(issues.length).toBeGreaterThan(0);

    for (const issue of issues) {
      expect(issue.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(issue.id).toBe(String(issue.issue));
      expect(issue.route).toBe(`/group/${issue.id}`);
      // 期详情是动态路由：页面上限 = group/[id].astro 的 getStaticPaths。
      expect(pageFileExists('group/[id].astro'), 'group detail route should exist').toBe(true);
      expect(issue.route).toMatch(/^\/group\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(Number.isInteger(issue.issue) && issue.issue >= 0).toBe(true);
      expect(issue.title.length).toBeGreaterThan(0);
      expect(issue.kind.length).toBeGreaterThan(0);
      expect(issue.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(issue.summary.length).toBeGreaterThan(0);
      expect(issue.html.length).toBeGreaterThan(1000);
      // frontmatter 承担题名：正文不再重复一级标题。
      expect(issue.html).not.toContain('<h1');
      expect(issue.headings.every((heading) => heading.id.length > 0)).toBe(true);
    }
  });

  it('sorts issues by number, newest first, without relying on filenames', async () => {
    const issues = await getGroupIssues();
    expect(issues.every((issue, index) => (
      index === 0 || issues[index - 1].issue > issue.issue
    ))).toBe(true);
  });

  it('derives adjacent issues from the issue number rather than the list position', async () => {
    // 相邻期 = issue ± 1。列表是降序的，所以不能拿“列表里的下一个”当期号上的相邻期。
    const sample = [
      { issue: 6, id: '6', route: '/group/6', title: 't', kind: 'k', published: '2026-01-01', summary: 's', html: '', headings: [] },
      { issue: 5, id: '5', route: '/group/5', title: 't', kind: 'k', published: '2026-01-01', summary: 's', html: '', headings: [] },
      { issue: 4, id: '4', route: '/group/4', title: 't', kind: 'k', published: '2026-01-01', summary: 's', html: '', headings: [] },
    ];
    expect(adjacentIssues(sample, sample[1])).toMatchObject({
      previous: { issue: 4 },
      next: { issue: 6 },
    });
    expect(adjacentIssues(sample, sample[2])).toMatchObject({ previous: null, next: { issue: 5 } });
    expect(adjacentIssues(sample, sample[0])).toMatchObject({ previous: { issue: 5 }, next: null });

    // 实际内容：最新一期没有下一期，第 0 期没有上一期。
    const issues = await getGroupIssues();
    expect(adjacentIssues(issues, issues[0]).next).toBeNull();
    expect(adjacentIssues(issues, issues.at(-1)!).previous).toBeNull();
  });

  it('validates the issue frontmatter contract and rejects unknown fields', () => {
    const record = {
      issue: 0,
      title: '标题',
      kind: '小组说明',
      published: '2026-10-01',
      summary: '摘要',
    };

    expect(GroupIssueSchema.safeParse(record).success).toBe(true);
    // YAML 会把不带引号的日期解析成 Date，两种写法都必须通过。
    expect(GroupIssueSchema.safeParse({ ...record, published: new Date('2026-10-01') }).success).toBe(true);

    expect(GroupIssueSchema.safeParse({ ...record, issue: -1 }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, issue: 0.5 }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, issue: '0' }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, published: '2026-10' }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, title: '  ' }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, summary: '' }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, unknown_field: 'x' }).success).toBe(false);
    expect(GroupIssueSchema.safeParse({ ...record, issue: undefined }).success).toBe(false);
  });

  it('presents each issue as a dated archive entry with the title as the only entrance', async () => {
    const source = pageSource('group/index.astro');
    // 注释里也会提到被移除的东西，所以只在真正的模板上断言。
    const template = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const issues = await getGroupIssues();
    expect(issues.length).toBeGreaterThan(0);

    // 记录容器，不是会产生视觉编号的有序列表；记录列表本身也不画项目符号。
    expect(template).toContain('<ul class="record-list"');
    expect(template).not.toContain('<ol class="record-list"');
    expect(declaration('.record-list', 'list-style')).toBe('none');

    // 每条只有两层：期号 + 日期，然后题名。
    expect(template).toMatch(
      /<p class="record__meta">第 \{issue\.issue\} 期 · <time datetime=\{issue\.published\}>\{issue\.published\}<\/time><\/p>/,
    );
    // 题名是唯一入口：它就是那条路由。
    expect(template).toContain('<p class="record__title"><a href={issue.route}>{issue.title}</a></p>');

    // 列表页不展示摘要、类型和重复入口。
    for (const dropped of ['record__summary', 'record__links', '阅读全文', 'issue.kind', 'issue.summary']) {
      expect(template, `group list should not render ${dropped}`).not.toContain(dropped);
    }

    // kind 与 summary 仍在记录里；详情页照旧展示，本轮只改列表。
    for (const issue of issues) {
      expect(issue.kind.length).toBeGreaterThan(0);
      expect(issue.summary.length).toBeGreaterThan(0);
    }
    const detail = pageSource('group/[id].astro');
    expect(detail).toContain('{issue.kind}');
    expect(detail).toContain('issue.summary');

    // 两个页面都不带脚本。
    expect(source).not.toContain('<script');
    expect(detail).not.toContain('<script');
  });

  it('refuses a filename that disagrees with the issue number', () => {
    // 文件名就是期号的公共形式：/group/<id> 必须指向 issue 本身，不能再有第二套编号。
    expect(readFileSync(path.join(process.cwd(), 'src/lib/group.ts'), 'utf8'))
      .toContain('does not match its issue number');
  });

  it('keeps group records as public editorial Markdown rather than generated input', () => {
    const records = readdirSync(path.join(process.cwd(), 'editorial', 'group'));
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((name) => name.endsWith('.md'))).toBe(true);

    // 生成输入只由同步器写入，小组内容不属于那里。
    const sources = readFileSync(path.join(process.cwd(), 'src/lib/group.ts'), 'utf8');
    expect(sources).toContain("'editorial'");
    expect(sources).not.toContain('.website-input');
    expect(sources).not.toContain('article-source');
  });

  it('explains the public meaning of each published issue date', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/lib/group.ts'), 'utf8');
    expect(source).toContain('网站公开的日期');

    const publication = readFileSync(path.join(process.cwd(), 'docs/PUBLICATION.md'), 'utf8');
    expect(publication).toContain('editorial/group/<issue>.md');
    expect(publication).toContain('网站公开的日期');
    expect(publication).toContain('published');
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
    // 详情页与列表页同一书目口径：体裁取 work_type，而不是本站的维护类别。
    expect(componentSource('BookCard')).toContain('book.work_type ?? BOOK_CATEGORY_LABELS[book.category]');
    expect(detail).toContain('<dt>体裁</dt>');
    expect(detail).toContain('book.work_type');

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

  it('keeps the fact list on what the book is, not on how the site maintains it', () => {
    const detail = pageSource('books/[id].astro');

    // 原著初版年份：标签必须说清是原著，而不是与版次日期混读的“年份”。
    expect(detail).toContain('<dt>原著初版</dt>');
    expect(detail).toContain('{book.original_year}');
    expect(detail).not.toContain('<dt>年份</dt>');

    // 体裁取原作品的体裁，与列表页一致。
    expect(detail).toContain('<dt>体裁</dt>');
    expect(detail).not.toContain('<dt>类型</dt>');

    // category 是本站维护该记录的内容类别，继续用于列表分组，但不再作为事实表字段展示。
    expect(detail).not.toContain('BOOK_CATEGORY_LABELS');
    expect(detail).not.toContain('book.category');
    // 数据层不动：列表分组仍按 category，卡片仍以 work_type 为主、category 仅作缺省。
    expect(pageSource('books/index.astro')).toContain("group.category === 'translation'");
    expect(componentSource('BookCard')).toContain('book.work_type ?? BOOK_CATEGORY_LABELS[book.category]');

    // 事实表只保留这本书的公开身份。
    const factKeys = [...detail.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1]);
    expect(factKeys).toEqual(['作者', '原著初版', '体裁', '原文出处', '当前版次', '获取与权利']);
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
