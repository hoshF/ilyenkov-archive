import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  getPublicIfiNetwork,
  getPublicReadingsSeries,
  getPublicResearchers,
  type PublicResearcher,
} from '../src/lib/research-records';
import { getSiteData } from '../src/lib/site-data';
import { researcherPortrait } from '../src/lib/portrait';
import { builtRoutePath, routeExists, withoutHiddenDecoration } from './helpers/pages';
import { declaration } from './helpers/styles';

const route = '/research/researchers/andrey-maidansky/';
const builtPage = (href: string): string => readFileSync(builtRoutePath(href), 'utf8');
const mainContent = (html: string): string => html.match(/<main>([\s\S]*?)<\/main>/)![1];
const decode = (value: string): string => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const textContent = (html: string): string => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const links = (html: string): { href: string; label: string }[] => (
  [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(([, href, label]) => ({ href: decode(href), label: textContent(label) }))
);
function sectionById(html: string, id: string): string {
  const section = [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)]
    .find(([, attributes]) => attributes.includes(`aria-labelledby="${id}"`));
  expect(section, `section for ${id}`).toBeDefined();
  return section![2];
}
const profile = (): PublicResearcher => getPublicResearchers()
  .find((record) => record.id === 'researcher-andrey-maidansky')!;
const translationsSection = (): string => sectionById(mainContent(builtPage(route)), 'researcher-translations-heading');
const resourceLabels: Record<PublicResearcher['resources'][number]['kind'], string> = {
  personal: '个人学术页', orcid: 'ORCID', institution: '机构学术页',
};

describe('canonical researcher detail and research hub entry', () => {
  it('statically builds the public identity, editorial introduction in a single reading flow', () => {
    expect(routeExists(route)).toBe(true);
    const researcher = profile();
    const html = builtPage(route);
    const main = mainContent(html);
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${researcher.name}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(researcher.name);
    expect(textContent(main)).toContain(researcher.originalName);
    expect(textContent(main)).toContain(researcher.latinName!);
    const intro = sectionById(main, 'researcher-intro-heading');
    const paragraphs = [...intro.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(([, content]) => textContent(content));
    expect(paragraphs).toEqual(getPublicResearchers().find((record) => record.id === 'researcher-andrey-maidansky')!.editorial!.introduction.map((paragraph) => paragraph.replace(/\*\*/g, '')));
    expect(intro).toContain('<strong>');
    expect(main).toContain('aria-label="当前位置"');
    expect([...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
      .map(([, content]) => textContent(content)))
      .toEqual(['简介', '本站译文']);
    expect(html).toContain('section-layout__sidebar');
    expect(html).not.toMatch(/section-layout--indexed|class="section-layout__toc"/);
  });

  it.each(getPublicResearchers())('keeps shared research navigation and breadcrumb on $name', (researcher) => {
    const href = `/research/researchers/${researcher.id.replace(/^researcher-/, '')}/`;
    const main = mainContent(builtPage(href));
    const nav = main.match(/<nav\b[^>]*aria-label="研究专题"[^>]*>([\s\S]*?)<\/nav>/)![1];
    const expected = [
      { href: '/research/ifi/', label: getPublicIfiNetwork().title },
      { href: '/research/researchers/', label: '研究者' },
      { href: '/research/readings/', label: getPublicReadingsSeries()[0].title },
    ];
    expect(links(nav)).toEqual(expected);
    expect([...nav.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect(nav).toContain('href="/research/researchers/" aria-current="page"');
    for (const link of links(nav)) expect(routeExists(link.href)).toBe(true);
    const breadcrumb = main.match(/<nav\b[^>]*aria-label="当前位置"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(breadcrumb)).toEqual([{ href: '/', label: '首页' }, { href: '/research/', label: '研究' }, { href: '/research/researchers/', label: '研究者' }]);
    expect(textContent(breadcrumb)).toContain(researcher.name);
  });

  it('keeps the introduction and translations without redundant fields or work sections', () => {
    const main = mainContent(builtPage(route));
    expect(main).not.toContain('researcher-fields-heading');
    expect(main).not.toContain('researcher-work-heading');
    expect(textContent(main)).not.toContain(getPublicResearchers().find((record) => record.id === 'researcher-andrey-maidansky')!.editorial!.workDescription);
  });

  it('offers only the selected public academic resources with distinct navigation labels', () => {
    const researcher = profile();
    const main = mainContent(builtPage(route));
    const resources = main.match(/<aside\b[^>]*aria-labelledby="researcher-resources-heading"[^>]*>([\s\S]*?)<\/aside>/)![1];
    expect(links(resources)).toEqual(researcher.resources.map((resource) => ({
      href: resource.url, label: resourceLabels[resource.kind],
    })));
    expect(textContent(resources)).toContain('学术入口');
    for (const resource of researcher.resources) expect(links(main).filter((link) => link.href === resource.url)).toHaveLength(1);
    expect(textContent(resources)).not.toMatch(/官方网站|文章来源/);
    expect(resources).not.toMatch(/<img\b|<svg\b|<button\b/);
  });

  it('derives every translation from Archive author identities and preserves its canonical order and metadata', async () => {
    const researcher = profile();
    const { articles } = await getSiteData();
    const expected = articles.filter((article) => article.authorIds.includes(researcher.personId));
    const translations = translationsSection();
    const records = [...translations.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
      .map(([, content]) => content);
    expect(records).toHaveLength(expected.length);
    expect(links(translations)).toEqual(expected.map((article) => ({ href: article.route, label: article.title })));
    for (const [index, article] of expected.entries()) {
      const record = records[index];
      expect(textContent(record.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1])).toBe(article.title);
      expect(textContent(record)).toContain(article.originalTitle);
      expect(textContent(record)).toContain(`${article.year} · ${article.authorLabel}`);
      expect(existsSync(builtRoutePath(article.route))).toBe(true);
    }
    expect(expected.map((article) => article.year)).toEqual(expected.map((article) => article.year).sort().reverse());
  });

  it('includes coauthored translations with the complete Archive author signatures', async () => {
    const { articles } = await getSiteData();
    const records = [...translationsSection().matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
      .map(([, content]) => content);
    const coauthored = articles.filter((article) => article.authorIds.includes(profile().personId) && article.authorIds.length > 1);
    for (const article of coauthored) {
      const record = records.find((record) => links(record).some((link) => link.href === article.route))!;
      expect(textContent(record)).toContain(article.authorLabel);
      for (const name of article.author) expect(textContent(record)).toContain(name);
    }
  });

  it('keeps translations confined to the public Archive and leaves authors without researcher profiles in Archive', async () => {
    const { articles } = await getSiteData();
    const translations = translationsSection();
    const excluded = articles.filter((article) => !article.authorIds.includes(profile().personId));
    for (const article of excluded) expect(links(translations).map((link) => link.href)).not.toContain(article.route);
    for (const id of ['bankir-1988', 'prezident-chitaet-buharina-1988', 'young-hegel']) {
      expect(articles.some((article) => article.id === id)).toBe(false);
      expect(translations).not.toContain(`/archive/${id}`);
    }
    const publishedPersonIds = getPublicResearchers().map((researcher) => researcher.personId);
    expect(publishedPersonIds).toContain('person-elena-illesh');
    const illeshMain = mainContent(builtPage('/research/researchers/elena-illesh/'));
    const illeshTranslations = sectionById(illeshMain, 'researcher-translations-heading');
    expect(links(illeshTranslations).map((link) => link.href)).toEqual(
      articles.filter((article) => article.authorIds.includes('person-elena-illesh')).map((article) => article.route),
    );
    for (const id of ['bankir-1988', 'prezident-chitaet-buharina-1988']) {
      expect(illeshMain).not.toContain(`/archive/${id}`);
    }
    for (const personId of ['person-vesa-oittinen', 'person-evgeni-v-pavlov']) {
      expect(publishedPersonIds).not.toContain(personId);
      expect(articles.some((article) => article.authorIds.includes(personId))).toBe(true);
    }
  });

  it.each(getPublicResearchers())('lists every selected researcher and builds its detail: $name', (researcher) => {
    const main = mainContent(builtPage('/research/researchers/'));
    const entry = sectionById(main, `${researcher.id}-heading`);
    const href = `/research/researchers/${researcher.id.replace(/^researcher-/, '')}/`;
    expect(links(entry)).toEqual([{ href, label: researcher.name }]);
    expect(textContent(entry)).toContain(researcher.originalName);
    expect(textContent(entry)).toContain(researcher.editorial?.workDescription ?? researcher.summary);
    expect(routeExists(href)).toBe(true);
    expect(textContent(mainContent(builtPage(href)))).toContain(researcher.name);
    expect(links(sectionById(mainContent(builtPage('/research/')), 'researchers-heading')))
      .toEqual([{ href: '/research/researchers/', label: '研究者' }]);
  });

  it('preserves primary navigation, static rendering and the private publication boundary', () => {
    const expected = [
      { href: '/ilyenkov/', label: '伊里因科夫' }, { href: '/archive/', label: '档案' },
      { href: '/glossary/', label: '术语库' },
      { href: '/research/', label: '研究' }, { href: '/group/', label: '小组' }, { href: '/books/', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const href of ['/research/', route]) {
      const html = builtPage(href);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      // 站内栏目之后是论坛入口“讨论”；它不参与当前栏目标记。
      expect(links(withoutHiddenDecoration(nav))).toEqual([...expected, { href: site.forumUrl, label: '讨论' }]);
      expect(nav).toContain('href="/research/" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="|<form\b|<input\b/);
      for (const field of [
        'aliases', 'positioning_ru', 'affiliation', 'works_master', 'record_path',
        'record_id', 'source_path', 'author_zh', 'author_original', 'include_roles',
        'include_research_fields', '/Users/', 'ILYENKOV_ROOT', 'А. Д. Майданский', 'Andrey Maidansky',
      ]) expect(html, `${href}: ${field}`).not.toContain(field);
    }
  });
});

describe('researcher portrait standard', () => {
  function pngHeader(width: number, height: number): Buffer {
    const header = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
    header.writeUInt32BE(13, 8);
    header.write('IHDR', 12, 'ascii');
    header.writeUInt32BE(width, 16);
    header.writeUInt32BE(height, 20);
    header.writeUInt8(8, 24);
    return header;
  }

  it('shows no portrait or placeholder for researchers without a selected photo', () => {
    for (const researcher of getPublicResearchers().filter((record) => !record.portrait)) {
      const href = `/research/researchers/${researcher.id.replace(/^researcher-/, '')}/`;
      const main = mainContent(builtPage(href));
      expect(main, href).not.toMatch(/<img\b/);
      expect(builtPage(href), href).not.toContain('research-profile--portrait');
    }
  });

  it('aligns a 3:4 portrait with the first section heading, inset from the line edge, and below the name on narrow screens', () => {
    // 宽屏与中屏：照片 160×213 挂在第一节标题上，底边与标题底边对齐，距正文右边线 24px。
    expect(declaration('.researcher-heading', 'position')).toBe('relative');
    expect(declaration('.researcher-portrait', 'position')).toBe('absolute');
    expect(declaration('.researcher-portrait', 'bottom')).toBe('0');
    expect(declaration('.researcher-portrait', 'right')).toBe('24px');
    expect(declaration('.researcher-portrait', 'width')).toBe('160px');
    expect(declaration('.researcher-portrait', 'height')).toBe('213px');
    expect(declaration('.researcher-portrait', 'object-fit')).toBe('cover');
    expect(declaration('.researcher-portrait', 'object-position')).toBe('center top');
    // 照片向上伸到页首右侧时，面包屑与页首让出照片宽度加两侧间距。
    for (const selector of ['.research-profile--portrait .section-layout__breadcrumb', '.research-profile--portrait .section-layout__intro']) {
      expect(declaration(selector, 'padding-right'), selector).toBe('calc(160px + 24px * 2)');
    }
    // 窄屏：照片回到文档流，在姓名之下、第一节标题之上，宽度等于行宽，高度按 3:4 推出。
    const narrow = '@media (max-width: 600px)';
    expect(declaration('.researcher-portrait', 'position', narrow)).toBe('static');
    expect(declaration('.researcher-portrait', 'width', narrow)).toBe('100%');
    expect(declaration('.researcher-portrait', 'height', narrow)).toBe('auto');
    expect(declaration('.researcher-portrait', 'aspect-ratio', narrow)).toBe('3 / 4');
    expect(declaration('.research-profile--portrait .section-layout__intro', 'padding-right', narrow)).toBe('0');
  });

  it('requires each portrait file to be at least the largest display size', async () => {
    const researcher = { ...profile(), id: 'researcher-portrait-size-fixture', portrait: 'researcher-portrait-size-fixture.png' };
    const file = path.join(process.cwd(), '.website-input', 'portraits', researcher.portrait);
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      writeFileSync(file, pngHeader(559, 1000));
      await expect(researcherPortrait(researcher)).rejects.toThrow(/at least 560×747/);
      writeFileSync(file, pngHeader(900, 746));
      await expect(researcherPortrait(researcher)).rejects.toThrow(/at least 560×747/);
      writeFileSync(file, pngHeader(560, 747));
      await expect(researcherPortrait(researcher)).resolves.toEqual({
        src: '/research/researchers/portrait-size-fixture/portrait.png',
      });
    } finally {
      rmSync(file, { force: true });
    }
  });
});
