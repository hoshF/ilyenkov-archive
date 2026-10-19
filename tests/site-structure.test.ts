import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { generatedArticleIds, resolveGeneratedArticlePath } from '../src/lib/article-source';
import { getBooks } from '../src/lib/books';
import { getGlossary } from '../src/lib/glossary';
import { site, readEditorialJson } from '../src/lib/editorial';
import { adjacentIssues, getGroupIssues, GroupIssueSchema } from '../src/lib/group';
import { getPublicIlyenkov, getPublicResearchers, getPublicIfiNetwork, getPublicReadingsSeries } from '../src/lib/research-records';
import { getSiteData } from '../src/lib/site-data';
import { builtRoutePath, componentSource, layoutSource, pageFileExists, pageSource, routeExists } from './helpers/pages';
import { researchRoot, websiteWorks } from './helpers/publication';
import { coversCodePoint, declaration, declarationsFor, fontFaces, rules } from './helpers/styles';

const ilyenkov = getPublicIlyenkov();

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
      expect(article.data.author, work.work_id).toEqual(workJson.authors.map((author: { name_zh: string }) => author.name_zh));
      expect(article.data.author_ids, work.work_id).toEqual(workJson.authors.map((author: { person_id: string }) => author.person_id));
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
    const html = readFileSync(builtRoutePath('/archive'), 'utf8');
    const records = html.match(/<ul class="record-list"[^>]*>([\s\S]*?)<\/ul>/)![1];
    const first = records.match(/<li>([\s\S]*?)<\/li>/)![1];
    expect(first).toMatch(/<p class="record__meta">\d{4} · [^<]+<\/p>/);
    expect(first).toMatch(/<p class="record__title"><a href="[^"]+">[^<]+<\/a><\/p>/);
    expect([...first.matchAll(/<a\b/g)]).toHaveLength(1);
    expect(first.indexOf('record__meta')).toBeLessThan(first.indexOf('record__title'));
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
    expect(detail).toMatch(/<h1\b[^>]*id="document-title"[^>]*set:html=\{document.titleHtml\}/);
    expect(detail).toContain('class="document-header__original"');
    expect(detail).toMatch(/class="prose(?: [a-z-]+)*" set:html=\{document.html\}/);
    expect(detail).toContain('id="source-info-heading"');
    expect(detail).toContain('class="document-nav"');
    // 译文与小组文章复用同一份目录交互。
    expect(detail).toContain('<ReadingTocBehavior />');
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
      expect(term.href).toMatch(/^\/archive\/(?:topic|person)\/[a-z0-9-]+\/$/);
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
    expect(main).toContain('href="/archive/"');

    // 404 不属于任何栏目：不套 SectionLayout、不出现面包屑、顶栏没有 active 项。
    expect(notFound).not.toContain('section-layout');
    expect(notFound).not.toContain('breadcrumbs');
    const nav = notFound.match(/<nav[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(nav).not.toContain('aria-current');
    expect([...nav.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(([, label]) => label))
      .toEqual(['伊里因科夫', '档案', '术语库', '研究', '小组', '书籍']);

    // 纯静态：没有脚本，也不在本轮引入 canonical / OG / robots meta。
    expect(notFound).not.toContain('<script');
    expect(notFound).not.toContain('rel="canonical"');
    expect(notFound).not.toContain('property="og:');
    expect(notFound).toContain('name="robots" content="noindex"');
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
      'contact/index.astro',
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
    // 只有译文页生成页内目录；小组期详情已回到 Natural Flow，不再产生锚点条目。
    const detail = pageSource('group/[id].astro');
    expect(detail).not.toContain('toc = [');
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

    // 栏目标题在 intro 槽里，页面不进入 indexed 形态；无导语时使用紧凑页首。
    expect(source).toMatch(/<SectionLayout\s+pinned(?:\s+modifier="[^"]+")?>/);
    expect(source).not.toContain('toc={toc}');
    expect(source).not.toContain('const toc =');
    expect(source).toContain('<header class="page-header" slot="intro">');
    expect(source).toContain('class="page-title">研究</h1>');

    // 实际输出依次呈现网络、研究者与学术活动三个站内入口。
    const html = readFileSync(builtRoutePath('/research'), 'utf8');
    const main = html.match(/<main>([\s\S]*?)<\/main>/)![1];
    const ids = [...main.matchAll(/<section\b[^>]*aria-labelledby="([^"]+)"[^>]*>/g)]
      .map((match) => match[1]);
    expect(ids).toEqual([
      'ifi-heading',
      'researchers-heading',
      'readings-heading',
    ]);
    for (const id of ids) {
      expect(main, `${id} should keep its heading target`).toMatch(new RegExp(`<h2\\b[^>]*id="${id}"`));
    }
    const text = main.replace(/<[^>]+>/g, '');
    expect(text).not.toMatch(/首批|目前先|后续将|正在逐步|第一阶段/);
    expect(text).not.toContain('从研究网络、研究者、学术活动与外部资料站点进入国际伊里因科夫研究。');
    expect(text).not.toContain('介绍与伊里因科夫研究密切相关的研究者。');
    expect(text).not.toMatch(/了解 IFI|了解研究者|了解学术报告会|其国际网络形成于|现存会程资料中最早的会议/);
    expect(main).not.toContain('research-sites-heading');
    expect(main).not.toContain('https://filorus.ru/');
    const entityTitles = [...main.matchAll(/<h2\b[^>]*><a href="([^"]+)">([^<]+)<\/a><\/h2>/g)]
      .map(([, href, title]) => ({ href, title }));
    expect(entityTitles).toEqual([
      { href: '/research/ifi/', title: '国际伊里因科夫之友' },
      { href: '/research/researchers/', title: '研究者' },
      { href: '/research/readings/', title: '伊里因科夫学术报告会' },
    ]);
    expect(main.match(/class="record__summary"/g)).toHaveLength(3);
    expect(declaration('.research-hub .record__original', 'margin')).toBe('4px 0 0');
    expect(declaration('.research-hub .record__summary', 'margin')).toBe('9px 0 0');

    // 深链接只保留标题自身的跳转留白；移动端沿用同一契约。
    for (const media of ['', '@media (max-width: 600px)']) {
      const heading = {
        ...declarationsFor('.research-series h2'),
        ...declarationsFor('.research-series h2', media),
      };
      expect(heading['scroll-margin-top']).toBe('32px');
    }

    // 栏目页不带脚本，也不新增 sticky 行为。
    expect(source).not.toContain('<script');
  });

  it('keeps breadcrumbs on book details and Ilyenkov subpages', () => {
    expect(pageSource('books/[id].astro')).toContain('Breadcrumbs');
    for (const name of ['life', 'timeline', 'works', 'circle']) {
      const page = readFileSync(builtRoutePath(`/ilyenkov/${name}`), 'utf8');
      expect(page).toContain('aria-label="当前位置"');
      const breadcrumb = page.match(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/)![0];
      expect(breadcrumb).toContain('href="/ilyenkov/"');
      expect(breadcrumb).toContain('aria-current="page"');
    }
  });

  it('uses one restrained type scale across public page families', () => {
    const scale = declarationsFor(':root');
    expect(scale['--text-meta']).toBe('.875rem');
    expect(scale['--text-secondary']).toBe('.9375rem');
    expect(scale['--text-body']).toBe('1rem');
    expect(scale['--text-item']).toBe('1.0625rem');
    expect(scale['--text-section']).toBe('1.1875rem');
    expect(scale['--text-page']).toBe('1.5rem');
    expect(scale['--text-display']).toBeUndefined();

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

  it('uses shared sans-serif typography for both article families', () => {
    expect(declaration(':root', 'font-family')).toBe('var(--sans)');
    expect(layoutSource('BaseLayout')).toContain("reading && 'reading-page'");
    expect(declaration('.reading-page .document-header', 'font-family')).toBe('var(--sans)');
    expect(declaration('.reading-page .prose', 'font-family')).toBe('var(--sans)');
    expect(declaration('.reading-page .prose', 'font-synthesis')).toBe('weight');
    expect(declaration('.reading-page .prose em', 'font-style')).toBe('normal');
    expect(declaration('.prose strong', 'font-synthesis')).toBe('weight');
  });

  it('sets CJK dashes and ellipses in the CJK interface font without touching quotes', () => {
    // 西文字体排在字体栈前面；破折号与省略号必须改由中文字体排，“——”才连成一条、“……”才占两个字宽。
    // 字体栈首项只为个别码位声明，其余字符仍落到原来的系统字体。
    const first = declaration(':root', '--sans')!.split(',')[0].trim().replace(/^"|"$/g, '');
    const faces = fontFaces.filter((face) => face['font-family'].replace(/^"|"$/g, '') === first);
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(face['unicode-range']).toBeDefined();
      expect(face.src).toMatch(/^local\(/);
      for (const codePoint of [0x2014, 0x2026]) expect(coversCodePoint(face['unicode-range'], codePoint)).toBe(true);
      // 西文与俄文引文没有语言标记：引号、撇号与拉丁、西里尔字母留给西文字体。
      for (const codePoint of [0x2018, 0x2019, 0x201C, 0x201D, 0x41, 0x416]) {
        expect(coversCodePoint(face['unicode-range'], codePoint)).toBe(false);
      }
    }
    // 正文、半粗标题与粗体标题都有对应字重，破折号跟随所在文字的粗细。
    const weightRange = (face: Record<string, string>) => {
      const [low, high = low] = face['font-weight'].split(/\s+/).map(Number);
      return [low, high];
    };
    for (const weight of [400, 600, 700]) {
      expect(faces.some((face) => {
        const [low, high] = weightRange(face);
        return weight >= low && weight <= high;
      })).toBe(true);
    }
    // 注释号不改变所在行的行高。
    expect(declaration('.prose sup', 'line-height')).toBe('0');
    expect(declaration('.document-header h1 sup', 'line-height')).toBe('0');
    expect(Number.parseFloat(declaration('.document-header h1 sup', 'font-size')!)).toBeLessThanOrEqual(.5);
  });

  it('keeps every text colour readable against the page in both schemes', () => {
    // WCAG 2 相对亮度对比度；普通文字至少 4.5:1。
    const luminance = (hex: string) => {
      const channels = hex.replace('#', '').match(/../g)!.map((pair) => Number.parseInt(pair, 16) / 255);
      const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    for (const media of ['', '@media (prefers-color-scheme: dark)']) {
      const tokens = declarationsFor(':root', media);
      for (const name of ['--ink', '--ink-soft', '--muted', '--label', '--accent', '--accent-hover']) {
        expect(contrast(tokens[name], tokens['--paper']), `${name} ${media}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('underlines content links and leaves navigation to its position', () => {
    // 正文区链接默认有细下划线：线色弱于文字，悬停时变实；不依赖悬停才能看出可点。
    const link = declarationsFor('a');
    expect(link['text-decoration-line']).toBe('underline');
    expect(link['text-decoration-color']).toMatch(/color-mix\(.*currentColor/);
    expect(Number.parseFloat(link['text-underline-offset'])).toBeGreaterThanOrEqual(.2);
    expect(declaration('a:hover', 'text-decoration-color')).toBe('currentColor');
    // 内容链接不取消下划线：档案与首页题名、首页入口、书目来源、人物入口、研究条目、学术入口与资料入口。
    for (const selector of [
      '.record__title a', '.home-more a', '.record__links a', '.entrance-card__label',
      '.research-hub .research-series h2 a', '.research-profile .section-layout__structured a',
      '.research-meetings__resources a',
    ]) {
      expect(declaration(selector, 'text-decoration'), selector).toBeUndefined();
    }
    // 导航性质的链接保持无下划线：刊名、主导航、面包屑、页内目录与提纲、档案分类、栏目子导航。
    for (const selector of [
      '.site-name', '.site-header__nav a', '.breadcrumbs a', '.section-layout__toc a', '.page-outline a',
      '.archive-facets__all a', '.archive-facets__term', '.ilyenkov-nav a', '.research-nav a',
    ]) {
      expect(declaration(selector, 'text-decoration'), selector).toBe('none');
    }
    // 键盘焦点统一为可见的描边，任何规则都不把链接的焦点框去掉。
    expect(declaration('a:focus-visible', 'outline')).toBe('2px solid var(--accent)');
    const hidden = rules.filter((rule) => /(^|\s)a\b|a:/.test(rule.selector) && /^(none|0)$/.test(rule.declarations.outline ?? ''));
    expect(hidden.map((rule) => rule.selector)).toEqual([]);
  });

  it('keeps record labels neutral and browser chrome on the page colour', () => {
    // 标签不可点击，不能借用链接色；暗色模式也不能比链接更亮。
    expect(declaration('.record__label', 'color')).toBe('var(--label)');
    expect(declaration(':root', '--label')).not.toBe(declaration(':root', '--accent'));
    const dark = '@media (prefers-color-scheme: dark)';
    expect(declaration(':root', '--label', dark)).toBeDefined();
    expect(declaration(':root', '--label', dark)).not.toBe(declaration(':root', '--accent', dark));
    const layout = layoutSource('BaseLayout');
    expect(layout).toContain(`<meta name="theme-color" content="${declaration(':root', '--paper')}" media="(prefers-color-scheme: light)" />`);
    expect(layout).toContain(`<meta name="theme-color" content="${declaration(':root', '--paper', dark)}" media="(prefers-color-scheme: dark)" />`);
  });

  it('uses the same reading presentation for translations and group articles', async () => {
    const { articles } = await getSiteData();
    const issues = await getGroupIssues();
    for (const document of [...articles, ...issues]) {
      const page = readFileSync(builtRoutePath(document.route), 'utf8');
      expect(page, document.route).toMatch(/<body[^>]*class="reading-page"/);
      expect(page, document.route).toContain('section-layout--reading');
      expect(page, document.route).toContain('class="document-header"');
      expect(page, document.route).not.toContain('class="breadcrumbs"');
      expect(page, document.route).toMatch(/<article[^>]*aria-labelledby="[^"]+"[^>]*>\s*<div class="prose(?: [a-z-]+)*">/);
    }

    // 两类文章沿用书籍正文的字号与行距；手机保留左右 20px 留白。
    expect(declaration('.reading-page .site-header', 'display', '@media (max-width: 600px)')).toBe('none');
    expect(declaration('.prose', 'font-size')).toBe('var(--text-body)');
    expect(declaration('.prose', 'line-height')).toBe('1.8');
    expect(declaration('.prose p', 'margin')).toBe('1em 0');
    expect(declaration('.reading-page .section-layout--reading', 'width', '@media (max-width: 600px)')).toContain('100% - 40px');
  });

  it('marks block quotations with a thin left rule instead of a card or narrower measure', () => {
    const quote = declarationsFor('.prose blockquote');
    expect(quote['border-left']).toBe('2px solid var(--line-strong)');
    expect(quote.background).toBeUndefined();
    expect(quote['background-color']).toBeUndefined();
    expect(quote['border-radius']).toBeUndefined();
    expect(quote['box-shadow']).toBeUndefined();
    // 右侧不收窄，字号与行高沿用正文。
    const [vertical, horizontal] = quote.margin.split(/\s+/);
    expect(Number.parseFloat(vertical)).toBeGreaterThan(1);
    expect(horizontal).toBe('0');
    expect(quote['font-size']).toBeUndefined();
    expect(quote['line-height']).toBeUndefined();
    // 手机只收窄线内缩进，不再加两侧外边距。
    const mobile = declarationsFor('.prose blockquote', '@media (max-width: 600px)');
    expect(mobile.margin).toBeUndefined();
    expect(Number.parseFloat(mobile['padding-left'])).toBeLessThan(Number.parseFloat(quote.padding.split(/\s+/).at(-1)!));
    // 多段引文的段距小于正文段距。
    expect(Number.parseFloat(declaration('.reading-page .prose blockquote p', 'margin')!))
      .toBeLessThan(Number.parseFloat(declaration('.reading-page .prose p', 'margin')!));
  });

  it('lands note jumps with context and marks the current note without moving text', () => {
    // 从注释点 ↩ 回到正文时，注释号停在视口上部约三成处，上方保留原句前文；题名上的注释号也一样。
    const ref = declarationsFor('.reading-page a[data-footnote-ref]');
    expect(ref['scroll-margin-top']).toMatch(/vh$/);
    const refMargin = Number.parseFloat(ref['scroll-margin-top']);
    expect(refMargin).toBeGreaterThanOrEqual(20);
    expect(refMargin).toBeLessThanOrEqual(45);
    // 注释号作为目标时只描边，不改字号、行高或位置。
    const refTarget = declarationsFor('.reading-page a[data-footnote-ref]:target');
    expect(refTarget.outline).toBeTruthy();
    for (const property of ['font-size', 'line-height', 'padding', 'margin', 'border', 'background']) {
      expect(refTarget[property], property).toBeUndefined();
    }
    // 跳到文末时注释条目离开顶边，当前条目左侧一条主色细线；细线绝对定位，正文不位移。
    expect(Number.parseFloat(declaration('.reading-page .prose .footnotes li', 'scroll-margin-top')!)).toBeGreaterThan(0);
    expect(declarationsFor('.reading-page .prose .footnotes li:target')).toEqual({ position: 'relative' });
    const mark = declarationsFor('.reading-page .prose .footnotes li:target::before');
    expect(mark.position).toBe('absolute');
    expect(mark.width).toBe('2px');
    expect(mark.background).toBe('var(--accent)');
    // 同一条注释里的后续段落有间距，条目之间的间距不变。
    expect(declaration('.reading-page .prose .footnotes li p + p', 'margin-top')).toBeDefined();
    expect(declaration('.reading-page .prose .footnotes li + li', 'margin-top')).toBe('.35em');
    // 减少动画时不做长距离平滑滚动；默认仍保持平滑。
    expect(declaration('html', 'scroll-behavior')).toBe('smooth');
    expect(declaration('html', 'scroll-behavior', '@media (prefers-reduced-motion: reduce)')).toBe('auto');
  });

  it('tightens article paragraph and heading spacing without changing the reading line', () => {
    const em = (value: string) => value.split(/\s+/).map((part) => Number.parseFloat(part));
    // 文章正文：字号与行高不变，段距收紧但仍小于一行，换段可辨。
    expect(declarationsFor('.reading-page .prose').font).toBeUndefined();
    expect(declaration('.reading-page .prose p', 'line-height')).toBeUndefined();
    const [paragraphGap] = em(declaration('.reading-page .prose p', 'margin')!);
    expect(paragraphGap).toBeLessThan(1);
    expect(paragraphGap).toBeGreaterThanOrEqual(.6);
    // 小节标题离上文远、离下文近：上距至少是下距的四倍。
    const [above, , below] = em(declaration('.reading-page .prose h2', 'margin')!);
    expect(above / below).toBeGreaterThanOrEqual(4);
    // 题名换行均衡；注释条目之间有间隔，条内段落不再叠加段距。
    expect(declaration('.document-header h1', 'text-wrap')).toBe('balance');
    expect(declaration('.reading-page .prose .footnotes li + li', 'margin-top')).toBeDefined();
    expect(declaration('.reading-page .prose .footnotes li p', 'margin')).toBe('0');
    // 原文信息紧跟分隔线，不继承小节标题的上距。
    expect(declaration('.reading-page .source-info h2', 'margin-top')).toBe('0');
  });

  it('keeps an unsectioned group issue single-column with its title in the content flow', () => {
    const source = pageSource('group/[id].astro');
    const page = readFileSync(path.join(process.cwd(), 'dist', 'group/0/index.html'), 'utf8');
    const main = page.match(/<main>([\s\S]*?)<\/main>/)![1];

    // 无分节文章不产生空侧栏，也不另设辅助内容。
    expect(source).not.toContain('pinned');
    expect(source).not.toContain('slot="aside"');
    expect(source).not.toContain('Breadcrumbs');

    // 产物里根本没有 rail，而不是把它藏起来。
    for (const gone of ['section-layout__sidebar', 'section-layout__toc', 'section-layout--rail',
      'section-layout--indexed', 'section-layout--pinned', 'section-layout__aside', '本期内容']) {
      expect(main, `期详情不应再出现 ${gone}`).not.toContain(gone);
    }

    // 期号与日期 → 题名 → 正文，同一条内容轴。
    const content = main.slice(main.indexOf('section-layout__content'));
    const introAt = content.indexOf('section-layout__intro');
    const metaAt = content.indexOf('class="record__meta"');
    const h1At = content.indexOf('<h1');
    const proseAt = content.indexOf('class="prose');
    for (const [name, at] of [['intro', introAt], ['meta', metaAt],
      ['h1', h1At], ['prose', proseAt]] as const) {
      expect(at, `${name} 应在内容栏内`).toBeGreaterThan(-1);
    }
    expect(metaAt).toBeLessThan(h1At);
    expect(h1At).toBeLessThan(proseAt);

    // 篇末保留返回小组与相邻期导航。
    expect(main.match(/返回小组工作/g)).toHaveLength(1);
    expect(content).not.toContain('class="breadcrumbs"');
    expect(main).toContain('href="/group/"');
  });

  it('includes original-source information even when an article has no body headings', async () => {
    // 阅读布局的空目录仍收为单栏；文章另有原文信息，因此目录不会为空。
    const fallback = '.section-layout--reading:not(.section-layout--indexed)';
    expect(declaration(fallback, 'display')).toBe('block');
    expect(declaration(fallback, 'width')).toBe('min(calc(100% - 40px), var(--reading))');

    const { articles } = await getSiteData();
    const withoutBodyHeadings = articles.filter((article) => article.headings.length === 0);
    expect(withoutBodyHeadings.map((article) => article.id)).toContain('history-and-social-ideals');
    for (const article of withoutBodyHeadings) {
      const page = readFileSync(builtRoutePath(article.route), 'utf8');
      expect(page, article.route).toContain('section-layout--reading');
      expect(page, article.route).toContain('section-layout--indexed');
      const toc = page.match(/<aside class="section-layout__toc"[\s\S]*?<\/aside>/)![0];
      // 没有小节时，目录只剩文末的去处：有注释区就先列注释，原文信息总在最后。
      const expected = page.includes('id="footnote-label"')
        ? ['footnote-label', 'source-info-heading']
        : ['source-info-heading'];
      expect([...toc.matchAll(/href="#([^"]+)"/g)].map(([, id]) => id)).toEqual(expected);
      expect(toc).toContain('原文信息');
    }
  });

  it('indexes each issue using its own headings and metadata', async () => {
    const issues = await getGroupIssues();
    const detail = pageSource('group/[id].astro');

    // 目录只列正文分节，不把文章分类当作章节。
    expect(detail).not.toContain('label: issue.kind');
    expect(detail).toContain('{issue.kind}');

    // 每期的期号、分类和标题都以该期元数据为准。
    expect(issues.length).toBeGreaterThan(0);
    const escapeText = (value: string) => value.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    for (const issue of issues) {
      expect(issue.kind.length, issue.route).toBeGreaterThan(0);
      const page = readFileSync(builtRoutePath(issue.route), 'utf8');
      expect(page, issue.route).toContain(`第 ${issue.issue} 期 · ${escapeText(issue.kind)}`);
      expect(page, issue.route).toContain(`<h1 id="issue-${issue.id}">${escapeText(issue.title)}</h1>`);

      const toc = page.match(/<aside class="section-layout__toc"[\s\S]*?<\/aside>/)?.[0];
      if (issue.headings.length === 0) {
        expect(toc, issue.route).toBeUndefined();
        expect(page, issue.route).not.toContain('section-layout--rail');
      } else {
        expect(toc, issue.route).toBeDefined();
        expect(page, issue.route).toContain('section-layout--indexed');
        expect([...toc!.matchAll(/href="([^"]+)"/g)].map(([, href]) => href))
          .toEqual(issue.headings.map((heading) => `#${escapeText(heading.id)}`));
        for (const heading of issue.headings) {
          expect(toc, issue.route).toContain(`>${escapeText(heading.text)}</a>`);
          expect(page, issue.route).toContain(`id="${escapeText(heading.id)}"`);
        }
      }
    }
  });

  it('keeps the header in normal flow and navigation sticky without header offsets', () => {
    // 未声明 position 时使用浏览器默认的 static；relative 也属于正常文档流。
    for (const rule of rules.filter(({ selector }) => (
      selector === '.site-header' || selector.endsWith(' .site-header')
    ))) {
      expect(['static', 'relative'], `${rule.selector} ${rule.media}`)
        .toContain(rule.declarations.position ?? 'static');
      expect(rule.declarations.top).toBeUndefined();
    }

    // 不再定义或引用固定页眉高度，包括媒体查询和阅读页的局部规则。
    for (const rule of rules) {
      expect(rule.declarations, `${rule.selector} ${rule.media}`).not.toHaveProperty('--header-h');
      for (const value of Object.values(rule.declarations)) {
        expect(value, `${rule.selector} ${rule.media}`).not.toContain('--header-h');
      }
    }

    // TOC 与 Archive 筛选侧栏独立吸顶，只保留版式自身的顶部留白。
    for (const selector of ['.section-layout__toc', '.section-layout--pinned .section-layout__sidebar']) {
      expect(declaration(selector, 'position'), selector).toBe('sticky');
      expect(declaration(selector, 'top'), selector).toBe('var(--section-top)');
    }
    for (const selector of ['.research-series h2', '.prose h2']) {
      for (const media of ['', '@media (max-width: 600px)']) {
        const heading = { ...declarationsFor(selector), ...declarationsFor(selector, media) };
        expect(heading['scroll-margin-top'], `${selector} ${media}`).toBe('32px');
      }
    }

    // 标题与导语归入正文那一栏，跟着正文滚；索引不占正文的阅读轴。
    expect(declaration('.section-layout--indexed', 'grid-template-areas')).toContain('"toc intro"');

    // 两栏 → 单栏
    expect(declaration('.section-layout--indexed', 'grid-template-columns')).toContain('var(--index)');
    // 译文版式：正文是行宽本身，两边各让出一个索引栏的宽度，正文因此落在正中。
    expect(declaration('.section-layout--reading', 'width'))
      .toContain('var(--reading) + (var(--index) + var(--index-gap)) * 2');
    // 索引列固定成 --index 宽，右侧留一列等宽空白，正文因此落在视觉中心。
    // 不能写成 minmax(var(--index), 1fr)：那样右栏会被撑开，正文随之右偏。
    expect(declaration('.section-layout--reading', 'grid-template-columns'))
      .toBe('minmax(0, var(--index)) minmax(0, var(--reading)) minmax(0, 1fr)');
    expect(declaration('.section-layout--indexed', 'grid-template-areas', '@media (max-width: 860px)')).toContain('"intro"');
    expect(declaration('.section-layout--indexed', 'display', '@media (max-width: 600px)')).toBe('block');
    expect(declaration('.section-layout--indexed .section-layout__toc', 'position', '@media (max-width: 600px)')).toBe('sticky');
    expect(declaration('.section-layout--indexed .section-layout__toc', 'top', '@media (max-width: 600px)')).toBe('0');
  });

  it('shares current-section marking between translations and group articles only', async () => {
    const { articles } = await getSiteData();
    const issues = await getGroupIssues();
    let sharedEnhancement: string | undefined;
    expect(articles.length + issues.length).toBeGreaterThan(0);
    for (const document of [...articles, ...issues]) {
      const page = readFileSync(builtRoutePath(document.route), 'utf8');
      const scripts = page.match(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g) ?? [];
      expect(scripts, document.route).toHaveLength(1);
      sharedEnhancement ??= scripts[0];
      expect(scripts[0], document.route).toBe(sharedEnhancement);
    }
    expect(componentSource('SectionLayout')).not.toContain('<script');
    for (const route of ['/research/', '/group/', '/about/', '/books/']) {
      const page = readFileSync(builtRoutePath(route), 'utf8');
      expect(page, route).not.toContain(sharedEnhancement!);
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

    // 860px 以下没有侧边余白：侧栏目录整份隐藏，改由页头之后的折叠目录接替，两份不会同时可见。
    expect(declaration('.section-layout--reading .section-layout__toc', 'display', '@media (max-width: 860px)')).toBe('none');
    expect(declaration('.reading-outline', 'display')).toBe('none');
    expect(declaration('.reading-outline', 'display', '@media (max-width: 860px)')).toBe('block');
    // 当前章节标记只作用于侧栏目录，不去操作折叠目录。
    const behavior = componentSource('ReadingTocBehavior');
    expect(behavior).toContain('.section-layout--reading .section-layout__toc');
    expect(behavior).not.toContain('page-outline');
  });

  it('gives phones and tablets a folded copy of the article index after the title', async () => {
    const { articles } = await getSiteData();
    const issues = await getGroupIssues();
    let withOutline = 0;
    let withoutOutline = 0;
    let withNotes = 0;
    for (const document of [...articles, ...issues]) {
      const page = readFileSync(builtRoutePath(document.route), 'utf8');
      const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => decodeURIComponent(id)));
      const linksIn = (fragment: string) => [...fragment.matchAll(/<a href="#([^"]+)">([^<]*)<\/a>/g)]
        .map(([, href, label]) => ({ id: decodeURIComponent(href), label }));
      const sidebar = page.match(/<aside class="section-layout__toc">([\s\S]*?)<\/aside>/)?.[1] ?? '';
      const sidebarLinks = linksIn(sidebar);
      const outline = page.match(/<div class="reading-outline">([\s\S]*?)<\/div>/)?.[1];

      // 注释区存在时目录才列“注释”，并排在原文信息之前，与文档中的先后一致。
      const hasNotes = page.includes('id="footnote-label"');
      const labels = sidebarLinks.map((link) => link.label);
      expect(labels.includes('注释'), document.route).toBe(hasNotes);
      if (hasNotes) withNotes += 1;
      if (labels.includes('注释') && labels.includes('原文信息')) {
        expect(labels.indexOf('注释'), document.route).toBe(labels.indexOf('原文信息') - 1);
      }

      if (sidebarLinks.length < 2) {
        // 只剩一项（例如只有“原文信息”）或没有目录时，不输出折叠目录。
        expect(outline, document.route).toBeUndefined();
        withoutOutline += 1;
        continue;
      }
      withOutline += 1;
      // 与侧栏同一份目录，每一项都指向页面里真实存在的目标；默认折叠，只用原生 details 与锚点。
      expect(outline, document.route).toBeDefined();
      expect(linksIn(outline!), document.route).toEqual(sidebarLinks);
      for (const link of sidebarLinks) expect(ids.has(link.id), `${document.route} #${link.id}`).toBe(true);
      expect(outline).toMatch(/^<details class="page-outline"><summary>本文目录<\/summary><nav aria-label="本文目录"><ol>/);
      expect(outline).not.toMatch(/<details[^>]*\sopen/);
      // 位置在页头（题名与原题）之后、正文之前。
      const header = page.indexOf('class="document-header"');
      const folded = page.indexOf('class="reading-outline"');
      const article = page.indexOf('<article');
      expect(header, document.route).toBeLessThan(folded);
      expect(folded, document.route).toBeLessThan(article);
    }
    // 这一组页面同时覆盖了有折叠目录、没有折叠目录与带注释入口三种情形。
    expect(withOutline).toBeGreaterThan(0);
    expect(withoutOutline).toBeGreaterThan(0);
    expect(withNotes).toBeGreaterThan(0);
  });

  it('stacks translations without a section index in one reading column', () => {
    // 无目录就没有功能左栏：基础规则是单栏块级，页面不生成任何网格列。
    const base = declarationsFor('.section-layout');
    expect(base.display).toBe('block');
    expect(base['grid-template-columns']).toBeUndefined();
    // 译文页仍然收到行宽：既不撑满版心，也不会长出第二列。
    const fallback = declarationsFor('.section-layout--reading:not(.section-layout--indexed)');
    expect(fallback.width).toBe('min(calc(100% - 40px), var(--reading))');
  });

  it('presents Ilyenkov section entrances as whole-card links', () => {
    expect(declaration('.entrance-card', 'text-decoration')).toBe('none');
    expect(declaration('.entrance-grid', 'grid-template-columns')).toBe('1fr');
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

    const active = declarationsFor('.site-header__nav a[aria-current=page]');
    // 当前项沿用普通目录文字颜色，以细下划线标示位置。
    expect(active.color).toBe('var(--ink-soft)');
    expect(active['text-decoration-thickness']).toBe('1px');
    expect(declaration('.site-header__nav a[aria-current=page]:hover', 'color')).toBe('var(--accent-hover)');
    expect(active['text-decoration']).toBe('underline');
    expect(active['text-decoration-color']).toBeUndefined();
    // 底线是文字自己的下划线：导航项不因为当前状态而变高。
    expect(active['border-bottom']).toBeUndefined();
  });

  it('marks the glossary as the current section on its index and entry pages', () => {
    const routes = ['/glossary/', ...getGlossary().slice(0, 1).map((entry) => entry.route)];
    for (const route of routes) {
      const html = readFileSync(builtRoutePath(route), 'utf8');
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      const current = [...nav.matchAll(/<a\b[^>]*>/g)]
        .filter(([link]) => /\baria-current="page"/.test(link));
      expect(current, route).toHaveLength(1);
      expect(current[0][0], route).toContain('href="/glossary/"');
    }
  });

  it('gives a sidebar only to pages that have a real one', () => {
    const read = (route: string) => readFileSync(path.join(process.cwd(), 'dist', route), 'utf8')
      .match(/<main>([\s\S]*?)<\/main>/)![1];

    // 有功能左栏：Archive 的 facet rail，译文页的页内目录。
    const archive = read('archive/index.html');
    expect(archive).toContain('section-layout--rail');
    expect(archive).toContain('archive-facets');
    expect(archive).toContain('section-layout__aside');
    expect(archive).toContain('section-layout--pinned');

    // 没有功能左栏的页面不留空栏，也不留 --rail 网格：整页就是一条内容流。
    for (const route of [
      'ilyenkov/index.html',
      'ilyenkov/life/index.html',
      'ilyenkov/timeline/index.html',
      'ilyenkov/works/index.html',
      'ilyenkov/circle/index.html',
      'research/index.html',
      'group/index.html',
      'books/index.html',
      'about/index.html',
    ]) {
      const main = read(route);
      expect(main, route).not.toContain('section-layout--rail');
      expect(main, route).not.toContain('section-layout__sidebar');
      expect(main, route).not.toContain('section-layout--pinned');
      // 页首回到内容流里：h1 与正文同在 .section-layout__content。
      const content = main.slice(main.indexOf('section-layout__content'));
      expect(content, `${route} 的 h1 应在内容栏`).toContain('<h1');
    }
  });

  it('keeps the rail when a page really has one, and matches the index', () => {
    // 非空目录产生辅助栏；文章的原文信息也是一个可跳转的章节。
    const source = componentSource('SectionLayout');
    expect(source).toContain("const indexed = toc.length > 0");

    for (const route of ['archive/ilyenkov-on-freedom-of-will/index.html']) {
      const main = readFileSync(path.join(process.cwd(), 'dist', route), 'utf8')
        .match(/<main>([\s\S]*?)<\/main>/)![1];
      expect(main, route).toContain('section-layout__toc');
      expect(main, route).toContain('section-layout--indexed');
      expect(main, route).toContain('section-layout--rail');
    }
    // 译文页把正文收到行宽并让目录吸附。
    const articleMain = readFileSync(
      path.join(process.cwd(), 'dist', 'archive/ilyenkov-on-freedom-of-will/index.html'),
      'utf8',
    ).match(/<main>([\s\S]*?)<\/main>/)![1];
    expect(articleMain).toContain('section-layout--reading');
    // 小组长文复用阅读布局；没有目录时不产生 --indexed 或 --pinned。
    const issueMain = readFileSync(path.join(process.cwd(), 'dist', 'group/0/index.html'), 'utf8')
      .match(/<main>([\s\S]*?)<\/main>/)![1];
    expect(issueMain).toContain('section-layout--reading');
    expect(issueMain).not.toContain('section-layout--pinned');
    expect(issueMain).not.toContain('section-layout--indexed');

    // 目录的每个条目都指向正文里真实存在的锚点，且没有重复。
    const article = readFileSync(
      path.join(process.cwd(), 'dist', 'archive/ilyenkov-on-freedom-of-will/index.html'),
      'utf8',
    );
    const main = article.match(/<main>([\s\S]*?)<\/main>/)![1];
    const toc = main.match(/<aside class="section-layout__toc"[\s\S]*?<\/aside>/)![0];
    const anchors = [...toc.matchAll(/href="#([^"]+)"/g)].map(([, id]) => id);
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors.at(-1)).toBe('source-info-heading');
    for (const id of anchors) {
      expect(article, `目录锚点 ${id} 不存在`).toContain(`id="${id}"`);
    }
  });

  it('keeps the title and lead on the content axis on every page', () => {
    // 页首属于页面本身：所有页面的 h1 都在 .section-layout__content 里，
    // 只有 --indexed（左栏是纯索引、display: contents）按网格排在正文那一列。
    const source = componentSource('SectionLayout');
    expect(source).toContain('<slot name="intro" />');
    expect(source).toContain('section-layout__content');

    for (const route of [
      'archive/index.html',
      'ilyenkov/index.html',
      'research/index.html',
      'group/index.html',
      'books/index.html',
      'about/index.html',
    ]) {
      const main = readFileSync(path.join(process.cwd(), 'dist', route), 'utf8')
        .match(/<main>([\s\S]*?)<\/main>/)![1];
      const contentAt = main.indexOf('section-layout__content');
      const h1At = main.indexOf('<h1');
      expect(h1At, `${route} 缺少 h1`).toBeGreaterThan(-1);
      expect(h1At, `${route} 的 h1 应在内容栏内`).toBeGreaterThan(contentAt);
      expect(main.indexOf('section-layout__intro'), `${route} 的页首应在内容栏内`)
        .toBeGreaterThan(contentAt);
    }
  });

  it('uses a visible publication name above the primary directory', () => {
    const layout = layoutSource('BaseLayout');
    const homepage = readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const header = homepage.match(/<header class="site-header">([\s\S]*?)<\/header>/)![1];

    // 刊头第一行只有文字刊名，与主页链接合一；图形字标不进页眉，链接保持单一可访问名称。
    const homeLinks = [...header.matchAll(/<a\b[^>]*href="\/"[^>]*>([\s\S]*?)<\/a>/g)];
    expect(homeLinks).toHaveLength(1);
    expect(homeLinks[0][0]).toContain(`aria-label="${site.name}首页"`);
    const mark = homeLinks[0][1];
    expect(mark).not.toMatch(/<svg|<img/);
    expect(header).not.toContain('evi-wordmark.svg');
    // 字标仍是站点品牌资源：favicon 与分享图照旧引用，源文件保留。
    expect(existsSync(path.join(process.cwd(), 'public', 'brand', 'evi-wordmark.svg'))).toBe(true);
    expect(homepage).toMatch(/<link rel="icon" href="\/favicon\.svg/);
    expect(homepage).toContain('/brand/share.png');

    // 刊名可见，就是首页链接的全部内容。
    expect(mark).toContain('site-name__text');
    expect(mark).toContain(`>${site.name}<`);
    expect(homepage).toContain(`<title>${site.name}</title>`);
    expect(homepage.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)![1]).toContain(site.name);
    expect(layout).toContain('site-name__text');

    // 一级栏目仍是页眉的主体，且顺序与 site.navigation 一致。
    const nav = header.match(/<nav[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect([...nav.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(([, label]) => label))
      .toEqual(site.navigation.map((item) => item.label));

    // 刊名与导航分为两行，目录允许自然换行。
    const navRule = declarationsFor('.site-header__nav');
    expect(declaration('.site-header__masthead', 'flex-direction')).toBe('column');
    expect(declaration('.site-header__masthead', 'width')).toBe('min(calc(100% - 40px), var(--reading))');
    expect(navRule['flex-wrap']).toBe('wrap');
    expect(navRule['justify-content']).not.toBe('flex-end');
    expect(navRule['margin-left']).toBeDefined();
  });

  it('keeps navigation typography unchanged and the mobile directory compact', () => {
    // 导航仍为 16px，不额外加粗；刊名单独承担第一层身份。
    const link = declarationsFor('.site-header__nav a');
    expect(link['font-size']).toBe('var(--text-body)');
    expect(link.color).toBe('var(--ink-soft)');
    expect(link['font-weight']).toBeUndefined();

    // 手机宽度下导航另起一行、退回 14px 并收紧间距，栏目可自然换行。
    const mobileNav = declarationsFor('.site-header__nav', '@media (max-width: 600px)');
    expect(mobileNav['font-size']).toBeUndefined();
    const mobileLink = declarationsFor('.site-header__nav a', '@media (max-width: 600px)');
    expect(mobileLink['font-size']).toBe('var(--text-meta)');
    // 链接左右内边距与导航负外边距相等，首项文字对齐正文左边线；内边距收紧到 8px 以内，
    // 375–393px 的常见手机仍排成一行。
    const [, horizontal] = mobileLink.padding.split(/\s+/).map(Number.parseFloat);
    expect(horizontal).toBeLessThanOrEqual(8);
    expect(Number.parseFloat(mobileNav['margin-left'])).toBe(-horizontal);
    // 只有更窄的屏幕排不下六项：改为三列两行，不让最后一项单独换行。
    const gridRules = rules.filter((rule) => rule.selector === '.site-header__nav' && rule.declarations.display === 'grid');
    expect(gridRules.length).toBeGreaterThan(0);
    for (const rule of gridRules) {
      const maxWidth = Number.parseFloat(rule.media.match(/max-width:\s*(\d+)px/)![1]);
      expect(maxWidth).toBeLessThan(375);
      expect(rule.declarations['grid-template-columns']).toBe(`repeat(${site.navigation.length / 2}, max-content)`);
    }
    expect(Number.parseFloat(link['min-height'])).toBeGreaterThanOrEqual(44);
    expect(declarationsFor('a:focus-visible').outline).toBeTruthy();

    // 普通项与当前项同属深色系，当前位置用细下划线标记，hover 使用 accent。
    const hover = declarationsFor('.site-header__nav a:hover');
    expect(hover.color).toBe('var(--accent-hover)');
  });

  it('gives the rights page a permanent entrance from every page', () => {
    // 《项目与权利》讲来源、授权与版本原则，此前只能从小组页正文的一句话走到。
    const hrefs = site.footer.map((link) => link.href);
    expect(hrefs).toContain('/about/');
    for (const href of hrefs) {
      expect(routeExists(href), `footer link has no page: ${href}`).toBe(true);
    }

    const layout = layoutSource('BaseLayout');
    expect(layout).toContain('class="site-footer"');
    expect(layout).toContain('site.footer.filter');
  });

  it('opens the homepage with a connected introduction before texts, research, group work and updates', () => {
    const homepage = readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const main = homepage.match(/<main>([\s\S]*?)<\/main>/)![1];
    for (const gone of ['home-shell', 'home-intro', 'home-recent', 'home-archive-link', 'home-work', 'home-about', 'home-ilyenkov']) {
      expect(main, `首页不应再有 ${gone}`).not.toContain(gone);
    }
    expect(declarationsFor('.home-page')['grid-template-columns']).toBeUndefined();

    // 首页唯一的可见 h1 由刊头站名承担，正文只保留普通定位句。
    expect([...homepage.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(main).not.toMatch(/<h1\b|home-masthead|sr-only/);
    expect(homepage).toContain(`<h1 class="site-name__text">${site.name}</h1>`);
    expect(main).toContain('<p class="home-positioning">伊里因科夫的中文译文与研究资料</p>');
    // 定位句保持段落语义，共用栏目标题的字形参数，保留自己的段间留白。
    expect(declaration('.home-positioning', 'font-size')).toBe('var(--text-home-section)');
    expect(declaration('.home-positioning', 'font-size', '@media (max-width: 600px)')).toBe('var(--text-item)');
    for (const property of ['color', 'font-weight', 'letter-spacing', 'line-height']) {
      expect(declaration('.home-positioning', property)).toBe(declaration('.home-page h2', property));
    }
    expect(declaration('.home-positioning', 'margin')).toBe('0 0 24px');
    expect(declaration('.home-positioning', 'padding')).toBeUndefined();
    const ordinaryHeader = readFileSync(builtRoutePath('/research'), 'utf8').match(/<header class="site-header">([\s\S]*?)<\/header>/)![1];
    expect(ordinaryHeader).toContain(`<span class="site-name__text">${site.name}</span>`);
    expect(ordinaryHeader).not.toMatch(/<h1\b/);

    // 定位、人物简介与延伸阅读组成同一开场，再进入实际内容栏目。
    const opening = main.match(/<div class="home-opening"[\s\S]*?<\/div>/)![0];
    expect(opening.indexOf('home-positioning')).toBeLessThan(opening.indexOf('home-summary'));
    expect(opening.indexOf('home-summary')).toBeLessThan(opening.indexOf('home-more'));
    expect(opening).not.toMatch(/<h[1-6]\b/);
    const order = [...main.matchAll(/<section class="([a-z-]+)"/g)].map(([, name]) => name);
    expect(order).toEqual(['home-content', 'home-research', 'home-group', 'home-updates']);
    expect(main.indexOf('home-opening')).toBeLessThan(main.indexOf('home-content'));

    // 每个 section 都有反映内容的标题，且没有 id 重复。
    expect([...main.matchAll(/<h2 id="([^"]+)"/g)].map(([, id]) => id))
      .toEqual(['content-heading', 'research-heading', 'group-heading', 'updates-heading']);
    expect([...main.matchAll(/<h2\b[^>]*>([^<]*)<\/h2>/g)].map(([, title]) => title))
      .toEqual(['文本', '研究', '中文伊里因科夫小组', '近期动态']);

    // 内容组织保持原生文本结构，不为首页增加交互或卡片系统。
    expect(main).not.toMatch(/<script\b|<input\b|<astro-island\b/);
    expect(main).not.toMatch(/class="[^"]*\bcard\b/);
  });

  it('reuses public editorial introductions and selected research entities', () => {
    const main = readFileSync(builtRoutePath('/'), 'utf8').match(/<main>([\s\S]*?)<\/main>/)![1];
    const person = main.match(/<div class="home-opening"[\s\S]*?<\/div>/)![0];
    const personPage = readFileSync(builtRoutePath('/ilyenkov'), 'utf8');
    expect(person).toContain(ilyenkov.summary);
    expect(personPage).toContain(ilyenkov.identity);
    expect(person.match(/<p class="home-summary">/g)).toHaveLength(1);
    for (const paragraph of ilyenkov.introduction) {
      expect(personPage.replace(/<[^>]*>/g, '')).toContain(paragraph);
      expect(person).not.toContain(paragraph);
    }
    const links = person.match(/<p class="home-more">[\s\S]*?<\/p>/)![0];
    expect(links).toContain('了解伊里因科夫：');
    const destinations = ['/ilyenkov/life/', '/ilyenkov/timeline/', '/ilyenkov/works/', '/ilyenkov/circle/'];
    expect([...links.matchAll(/href="([^"]+)"/g)].map(([, href]) => href)).toEqual(destinations);
    for (const href of destinations) {
      expect(routeExists(href)).toBe(true);
    }
    expect(declaration('.home-opening .home-more a:after', 'content')).toBe('none');
    expect(declaration('.home-opening .home-more a', 'white-space')).toBe('nowrap');
    expect(declaration('.home-more a:after', 'content')).toBe('" →"');
    const research = main.match(/<section class="home-research"[\s\S]*?<\/section>/)![0];
    const records = [
      { ...getPublicResearchers().find((record) => record.id === 'researcher-andrey-maidansky')!, href: '/research/researchers/andrey-maidansky/' },
      { ...getPublicResearchers().find((record) => record.id === 'researcher-elena-illesh')!, href: '/research/researchers/elena-illesh/' },
      { ...getPublicIfiNetwork(), href: '/research/ifi/' },
      { ...getPublicReadingsSeries().find((record) => record.id === 'ilyenkov-readings-series')!, href: '/research/readings/' },
    ];
    const researchHub = readFileSync(builtRoutePath('/research'), 'utf8').match(/<main>([\s\S]*?)<\/main>/)![1];
    const homeLinks = [...research.matchAll(/<h3\b[^>]*>\s*<a href="([^"]+)"/g)].map(([, href]) => href);
    const hubLinks = [...researchHub.matchAll(/<h2\b[^>]*>\s*<a href="([^"]+)"/g)].map(([, href]) => href);
    expect(homeLinks.sort()).toEqual(records.map((record) => record.href).sort());
    expect(hubLinks.sort()).toEqual(['/research/ifi/', '/research/researchers/', '/research/readings/'].sort());
    expect([...research.matchAll(/<h3\b/g)].length).toBe(records.length);
    for (const record of records) {
      expect(research).toContain(record.summary);
      expect(research).toContain(`href="${record.href}"`);
      expect(routeExists(record.href)).toBe(true);
    }
    expect(main).not.toMatch(/从哪里开始|持续关注|最近发布|home-content__note/);
  });

  it('keeps the primary navigation destinations while adding updates contextually', () => {
    const homepage = readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const nav = homepage.match(/<nav class="site-header__nav"[\s\S]*?<\/nav>/)![0];
    expect(site.navigation.map(({ href }) => href))
      .toEqual(['/ilyenkov/', '/archive/', '/glossary/', '/research/', '/group/', '/books/']);
    expect([...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href))
      .toEqual(site.navigation.map(({ href }) => href));
    expect(nav).not.toContain('href="/updates/"');
    const updates = homepage.match(/<section class="home-updates"[\s\S]*?<\/section>/)![0];
    expect(updates).toContain('<a href="/updates/">查看全部动态</a>');
  });

  it('samples public Archive texts without treating original years as publication dates', async () => {
    const { articles } = await getSiteData();
    const section = readFileSync(builtRoutePath('/'), 'utf8').match(/<section class="home-content"[\s\S]*?<\/section>/)![0];
    const items = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) => item);
    const sampled = articles.slice(0, 4);
    const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    expect(items).toHaveLength(sampled.length);
    sampled.forEach((entry, index) => {
      expect(items[index]).toContain(`<a href="${entry.route}">${escapeText(entry.title)}</a>`);
      expect(items[index]).toContain(escapeText(entry.authorLabel));
      expect(items[index]).toContain(`原文年份 ${entry.year}`);
      expect(items[index]).not.toContain('<time');
    });
    expect(section).toContain('href="/archive/"');
    expect(section).not.toMatch(/最新内容|公开日期|排序|倒序|最近发布/);
  });

  it('derives recent group work from public issues and shares its scope with Group', async () => {
    const section = readFileSync(builtRoutePath('/'), 'utf8').match(/<section class="home-group"[\s\S]*?<\/section>/)![0];
    expect(section).toContain(site.group.summary);
    expect(readFileSync(builtRoutePath('/group'), 'utf8')).not.toContain(site.group.summary);
    const issues = [...await getGroupIssues()].sort((left, right) => (
      right.published.localeCompare(left.published) || right.issue - left.issue
    )).slice(0, 3);
    const items = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) => item);
    expect(items).toHaveLength(issues.length);
    issues.forEach((issue, index) => {
      expect(items[index]).toContain(`href="${issue.route}"`);
      expect(items[index]).toContain(issue.title);
      expect(items[index]).toContain(issue.summary);
      expect(items[index]).toContain(`<time datetime="${issue.published}">${issue.published}</time>`);
    });
  });

  it('keeps Ilyenkov entrance descriptions outside the title links', () => {
    const html = readFileSync(builtRoutePath('/ilyenkov'), 'utf8');
    const nav = html.match(/<nav\b[^>]*aria-label="伊里因科夫栏目入口"[^>]*>([\s\S]*?)<\/nav>/)![1];
    const links = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    expect(links.map(([, href, label]) => ({ href, label }))).toEqual(
      ilyenkov.entrances.map((entrance) => ({ href: `/ilyenkov/${entrance.target}/`, label: entrance.label })),
    );
    expect([...nav.matchAll(/class="entrance-card__summary"/g)]).toHaveLength(ilyenkov.entrances.length);
    expect(nav).not.toContain('entrance-card__scope');
    for (const [, , label] of links) expect(label).not.toContain('entrance-card__summary');
  });

  it('uses the configured group identity without adding foreign names to the homepage', () => {
    const source = readEditorialJson('site.json') as { group: typeof site.group };
    expect(site.group).toEqual(source.group);
    const group = readFileSync(builtRoutePath('/group'), 'utf8');
    expect(group).toContain(`<h1 class="page-title">${site.group.name}</h1>`);
    expect(group).toContain(`${site.group.originalName}<br`);
    expect(group).toContain(site.group.englishName);
    const home = readFileSync(builtRoutePath('/'), 'utf8');
    expect(home).toContain(`<h2 id="group-heading">${site.group.name}</h2>`);
    expect(home).not.toContain(site.group.originalName);
    expect(home).not.toContain(site.group.englishName);
  });

  it('opens Group with its scope and context links, keeping the work heading compact', () => {
    const main = readFileSync(builtRoutePath('/group'), 'utf8').match(/<main>([\s\S]*?)<\/main>/)![1];
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(main).toContain('<h2 id="group-issues-heading">小组工作</h2>');
    expect(main).toContain('<h1 class="page-title">中文伊里因科夫小组');
    expect(main).not.toContain(site.group.summary);
    expect(main).toContain('href="/group/0/"');
    expect(main).toContain('href="/contact/"');
    expect(main).toContain('Китайская группа по изучению Ильенкова');
    expect(main).toContain('Chinese Ilyenkov Group');
    expect(main).not.toContain('entrance-card');
    const intro = main.match(/<header\b[^>]*class="page-header"[^>]*>([\s\S]*?)<\/header>/)![1];
    expect(intro).not.toContain('class="lead"');
    const entrances = main.match(/<nav\b[^>]*aria-label="小组相关入口"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect([...entrances.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)]
      .map(([, href, label]) => ({ href, label })))
      .toEqual([{ href: '/group/0/', label: '小组介绍' }, { href: '/contact/', label: '关注与联系' }]);
    expect(main.indexOf('aria-label="小组相关入口"')).toBeLessThan(main.indexOf('class="group-issues"'));
    expect(main).not.toContain('本页按期记录');
  });

  it('keeps the group page self-contained and the homepage free of site-scope copy', () => {
    expect(pageSource('index.astro')).not.toContain('/about');
    const groupPage = pageSource('group/index.astro');
    expect(groupPage).toContain('<SectionLayout');
    expect(groupPage).toContain('href="/contact/"');
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
      expect(issue.route).toBe(`/group/${issue.id}/`);
      // 期详情是动态路由：页面上限 = group/[id].astro 的 getStaticPaths。
      expect(pageFileExists('group/[id].astro'), 'group detail route should exist').toBe(true);
      expect(issue.route).toMatch(/^\/group\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/);
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

    // 列表不加载阅读交互；详情复用统一的目录组件。
    expect(source).not.toContain('<script');
    expect(detail).toContain('<ReadingTocBehavior />');
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
      expect(book.route).toBe(`/books/${book.id}/`);
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

    // 每个栏目的条目共用一套记录列表：靠留白分组，不画分隔线
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

  it('links only the Chinese book title, leaving original title and metadata outside the link', async () => {
    const html = readFileSync(builtRoutePath('/books'), 'utf8');
    for (const book of await getBooks()) {
      const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter((match) => match[1].includes(`href="${book.route}"`));
      expect(links, book.id).toHaveLength(1);
      expect(links[0][2], book.id).toContain(book.title);
      expect(links[0][2], book.id).not.toContain('record__original');
      expect(links[0][2], book.id).not.toContain('record__meta');
    }
  });

  it('keeps edition records visible and the auxiliary version list free of jump links', async () => {
    for (const book of await getBooks()) {
      const html = readFileSync(builtRoutePath(book.route), 'utf8');
      const main = html.match(/<main>([\s\S]*?)<\/main>/)![1];
      const sidebar = main.match(/<aside\b[^>]*class="book-edition-index"[^>]*>([\s\S]*?)<\/aside>/)![1];
      const current = main.match(/<dt>当前版次<\/dt>\s*<dd>([\s\S]*?)<\/dd>/)![1];
      const list = main.match(/<ol\b[^>]*class="record-list"[^>]*>([\s\S]*?)<\/ol>/)![1];
      const records = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
      const sidebarRecords = [...sidebar.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
      const editions = [...book.editions].reverse();

      expect(main, book.id).toContain('section-layout--rail');
      expect(main, book.id).toContain('section-layout--pinned');
      expect(main, book.id).not.toContain('section-layout--indexed');
      expect(main, book.id).toContain('aria-labelledby="book-edition-index-heading"');
      expect(sidebar, book.id).toMatch(/<p\b[^>]*id="book-edition-index-heading"[^>]*>版次记录<\/p>/);
      expect(records, book.id).toHaveLength(editions.length);
      expect(sidebarRecords, book.id).toHaveLength(editions.length);
      expect(sidebar, book.id).not.toMatch(/<a\b/);
      expect(current, book.id).not.toMatch(/<a\b/);
      expect(current, book.id).toContain(book.latestEdition.version);
      expect(current, book.id).toContain(`datetime="${book.latestEdition.date}"`);

      for (const [index, edition] of editions.entries()) {
        const record = records[index];
        const sidebarRecord = sidebarRecords[index];
        expect(record, `${book.id}: ${edition.version}`).toContain(edition.version);
        expect(record, `${book.id}: ${edition.version}`).toContain(`datetime="${edition.date}"`);
        expect(sidebarRecord, `${book.id}: ${edition.version}`).toContain(edition.version);
        expect(sidebarRecord, `${book.id}: ${edition.version}`).toContain(`datetime="${edition.date}"`);
        if (edition.note) expect(record, book.id).toContain(edition.note);
        if (edition.checksum) expect(record, book.id).toContain(edition.checksum);
      }
      for (const erratum of book.errata ?? []) expect(main, book.id).toContain(erratum);

      expect(main, book.id).toContain('<dt>获取与权利</dt>');
      if (book.rights) expect(main, book.id).toContain(book.rights);
      if (book.download) {
        expect(main, book.id).toContain(`href="${book.download.href}"`);
        expect(main, book.id).toContain(book.download.label);
      } else expect(main, book.id).toContain('本站不提供下载。');
      expect(main, book.id).not.toMatch(/<details\b|edition-popover/);
      expect(html, book.id).not.toMatch(/<script\b/);
    }
  });

  it('uses a small desktop-only auxiliary rail while retaining the book content width', () => {
    const desktop = '@media (min-width: 1101px)';
    expect(declaration('.container.book-page', 'display')).toBe('block');
    expect(declaration('.book-page .section-layout__sidebar', 'display')).toBe('none');
    expect(declaration('.container.book-page', 'max-width', desktop)).toBe('none');
    expect(declaration('.container.book-page', 'display', desktop)).toBe('grid');
    expect(declaration('.container.book-page', '--index', desktop)).toBe('160px');
    expect(declaration('.container.book-page', '--index-gap', desktop)).toBe('32px');
    expect(declaration('.container.book-page', 'grid-template-columns', desktop)).toBe('minmax(0, 1fr) minmax(0, var(--reading)) minmax(0, 1fr)');
    expect(declaration('.container.book-page', 'max-width')).toBe('var(--reading)');
    expect(declaration('.book-page .section-layout__sidebar', 'display', desktop)).toBe('block');
    expect(declaration('.section-layout--pinned .section-layout__sidebar', 'position')).toBe('sticky');
    expect(declaration('.book-page .section-layout__content', 'grid-column', desktop)).toBe('2');
    expect(declaration('.book-edition-index', 'font-size')).toBe('.75rem');
    expect(rules.some((rule) => rule.selector.includes('edition-popover'))).toBe(false);

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
    expect(declaration('.container.book-page', 'max-width')).toBe('var(--reading)');
    expect(declaration('.book-header__body', 'grid-template-columns')).toContain('clamp(220px, 30vw, 280px)');
    expect(declaration('.book-header__body', 'column-gap')).toContain('clamp(');
    expect(declaration('.book-header__body', 'grid-template-areas')).toContain('"cover identity"');
    expect(declaration('.book-header__body', 'grid-template-areas')).toContain('"introduction introduction"');
    expect(declaration('.book-header__body--without-cover', 'grid-template-areas')).toContain('"identity"');
    expect(declaration('.book-page .book-introduction', 'grid-area')).toBe('introduction');
    expect(declaration('.book-header__title', 'border')).toBe('0');

    // 窄屏：字段之间靠间距分组
    expect(declaration('.book-header__cover-link', 'width', '@media (max-width: 600px)')).toBe('min(100%, 420px)');
    expect(declaration('.book-page .fact-list > div + div', 'margin-top', '@media (max-width: 600px)')).toBe('28px');
  });
});


describe('centered reader-facing section layouts', () => {
  it('centers ordinary sections and the homepage on the reading column', () => {
    const selector = '.section-layout:not(.section-layout--rail):not(.section-layout--reading)';
    expect(declaration(selector, 'width', '@media (min-width: 601px)')).toBe('min(calc(100% - 40px), var(--reading))');
    expect(declaration(`${selector} .section-layout__content`, 'width', '@media (min-width: 601px)')).toBe('100%');
    for (const selector of ['.home-page']) {
      expect(declaration(selector, 'width')).toBe('min(calc(100% - 40px), var(--reading))');
    }
    expect(declaration('.book-page .book-introduction', 'margin')).toBe('0 auto');
    expect(declaration('.book-editions', 'margin')).toBe('0 auto');
  });

  it('keeps editorial process explanations out of public introductions', () => {
    for (const route of ['ilyenkov/index.astro', 'about.astro', 'group/index.astro', 'research.astro']) {
      const source = pageSource(route);
      for (const phrase of ['本栏的编辑导言', '会随公开选择', '私有仓库', '静态构建', '首批收录']) {
        expect(source, route).not.toContain(phrase);
      }
    }
    expect(pageSource('ilyenkov/index.astro')).not.toContain('国际研究见');
  });
});


describe('compact directory introductions', () => {
  it('removes redundant leads only from the selected directories', () => {
    for (const route of ['books/index.astro', 'research.astro', 'ilyenkov/timeline.astro', 'ilyenkov/circle.astro']) {
      const source = pageSource(route);
      const intro = source.match(/<header class="page-header" slot="intro">([\s\S]*?)<\/header>/)![1];
      expect(intro, route).toContain('<h1');
      expect(intro, route).not.toContain('class="lead"');
      expect(source, route).toMatch(/modifier="compact-intro(?: [^"]+)?"/);
    }
    expect(declaration('.compact-intro .section-layout__intro', 'margin-bottom')).toBe('24px');
    expect(declaration('.section-layout__intro', 'margin-bottom')).toBe('44px');
  });

  it('identifies the books directory with a compact title and no introductory lead', () => {
    const html = readFileSync(builtRoutePath('/books'), 'utf8');
    expect(html).toMatch(/<h1\b[^>]*>书籍<\/h1>/);
    expect(html).toContain('section-layout__intro');
    expect(pageSource('books/index.astro')).not.toContain('class="lead"');
    expect(html).toContain('books-shelf');
  });

  it('keeps archive filter identity beside the page title instead of below the list heading', () => {
    const source = componentSource('ArchiveIndexView');
    const intro = source.match(/<header class="page-header" slot="intro">([\s\S]*?)<\/header>/)![1];
    expect(intro).toContain('<h1');
    expect(intro).not.toContain('class="lead"');
    expect(intro).toContain("{current?.label ?? '全部文章'}");
    expect(intro).toContain('{current.count} 篇');
    expect(source.match(/class="archive-facets__context"/g)).toHaveLength(1);
    expect(declaration('.archive-facets__context', 'margin')).toBe('12px 0 0');
  });
});


describe('compact interface typography experiment', () => {
  it('preserves article heading sizes and separates content titles from directory labels', () => {
    const reading = declarationsFor('.reading-page');
    expect(reading['--text-page']).toBe('1.75rem');
    expect(reading['--text-page-mobile']).toBe('1.625rem');
    expect(reading['--text-section']).toBeUndefined();
    expect(reading['--text-item']).toBeUndefined();
    expect(declaration('.book-header__title h1', 'font-size')).toBe('var(--text-content-title)');
    expect(declaration('.entity-detail .page-title', 'font-size')).toBe('var(--text-content-title)');
    expect(declaration(':root', '--text-content-title', '@media (max-width: 600px)')).toBe('1.625rem');
  });
});


describe('directory spacing', () => {
  it('uses the section tier for group records and keeps directory headings close to entries', () => {
    expect(declaration('.group-issues > h2', 'font-size')).toBe('var(--text-section)');
    expect(declaration('.group-issues > h2', 'margin')).toBe('0 0 16px');
    expect(declaration('.group-index .section-layout__intro', 'margin-bottom')).toBe('24px');
    expect(declaration('.books-shelf .book-category > h2', 'margin-bottom')).toBe('16px');
    expect(declaration('.record-list', 'gap')).toBe('32px');
  });
  it('gives the research hub one section interval without changing entity detail spacing', () => {
    const selector = '.research-hub .research-series + .research-series';
    expect(declaration(selector, 'margin-top')).toBe('56px');
    expect(declaration(selector, 'padding-top')).toBe('0');
    expect(declaration(selector, 'border-top')).toBe('0');
    expect(declaration('.research-series + .research-series', 'margin-top')).toBe('60px');
    expect(declaration('.research-series + .research-series', 'padding-top')).toBe('60px');
    expect(pageSource('research.astro')).toContain('compact-intro research-hub');
    expect(pageSource('group/index.astro')).toContain('modifier="group-index"');
  });
});
