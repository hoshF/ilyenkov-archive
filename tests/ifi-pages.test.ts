import { renderPublicMarkdown } from '../src/lib/markdown';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  formatHistoricalPeriod,
  getPublicIfiNetwork,
  getPublicIfiSymposiums,
  getPublicReadingsSeries,
  type PublicIfiNetwork,
} from '../src/lib/research-records';
import { builtRoutePath, routeExists } from './helpers/pages';
import { declaration } from './helpers/styles';

const builtPage = (route: string): string => readFileSync(builtRoutePath(route), 'utf8');
const mainContent = (html: string): string => html.match(/<main>([\s\S]*?)<\/main>/)![1];
const decode = (value: string): string => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const textContent = (html: string): string => decode(html.replace(/<[^>]+>/g, '')).trim();

function links(html: string): { href: string; label: string }[] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(([, href, label]) => ({ href: decode(href), label: textContent(label) }));
}

function sections(html: string): { id: string; heading: string; html: string }[] {
  return [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map(([, attributes, content]) => ({
    id: attributes.match(/aria-labelledby="([^"]+)"/)?.[1] ?? '',
    heading: textContent(content.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''),
    html: content,
  }));
}

function sectionById(html: string, id: string): string {
  const section = sections(html).find((section) => section.id === id);
  expect(section, `section for ${id}`).toBeDefined();
  return section!.html;
}

function sectionFor(html: string, heading: string): string {
  const section = sections(html).find((section) => section.heading.includes(heading));
  expect(section, `section for ${heading}`).toBeDefined();
  return section!.html;
}

const resourceLabels: Record<PublicIfiNetwork['resources'][number]['kind'], string> = {
  about: '组织介绍',
  history: '历史与活动',
  texts: '伊里因科夫文本',
  symposiums: '研讨会资料',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

describe('IFI public detail and research entry', () => {
  it('statically builds the detail page with its public identity and research breadcrumb', () => {
    expect(routeExists('/research/ifi')).toBe(true);
    const html = builtPage('/research/ifi');
    const main = mainContent(html);
    const network = getPublicIfiNetwork();
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${network.title}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(network.title);
    expect(textContent(main)).toContain(`${network.name}（${network.abbreviation}）`);
    expect(main).toContain('aria-label="当前位置"');
    const breadcrumb = main.match(/<nav\b[^>]*aria-label="当前位置"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(breadcrumb)).toEqual([{ href: '/', label: '首页' }, { href: '/research/', label: '研究' }]);
    expect(textContent(breadcrumb)).toContain(network.title);
    expect(sections(main).map((section) => section.id)).toEqual([
      'ifi-intro-heading',
      'ifi-formation-heading',
      'ifi-symposiums-heading',
      ...(getPublicIfiSymposiums().some((record) => record.status === 'planned') ? ['ifi-planned-heading'] : []),
    ]);
    expect(links(main)).toContainEqual({ href: network.url, label: '官方网站' });
  });

  it('presents the selected editorial introduction without duplicating its paragraphs', async () => {
    const main = mainContent(builtPage('/research/ifi'));
    const intro = sectionById(main, 'ifi-intro-heading');
    const editorial = getPublicIfiNetwork().editorial!;
    expect(editorial).toBeDefined();
    const paragraphs = [...intro.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
      .map(([, content]) => textContent(content));
    const expected = await Promise.all(editorial.introduction.map(async (paragraph) => (
      textContent((await renderPublicMarkdown(paragraph)).html)
    )));
    expect(paragraphs).toEqual(expected);
  });

  it('uses exactly the selected public official resource URLs and page-level labels', () => {
    const network = getPublicIfiNetwork();
    const resources = mainContent(builtPage('/research/ifi')).match(/<aside\b[^>]*aria-labelledby="ifi-resources-heading"[^>]*>([\s\S]*?)<\/aside>/)![1];
    expect(textContent(resources)).toContain('资料入口');
    expect(links(resources)).toEqual([
      { href: network.url, label: '官方网站' },
      ...network.resources.map((resource) => ({
        href: resource.url,
        label: resourceLabels[resource.kind],
      })),
    ]);
    expect([...resources.matchAll(/<li\b/g)]).toHaveLength(network.resources.length + 1);
    expect(resources).not.toMatch(/webinar-notes|downloads?|source_files|\.pdf(?:["?#]|$)/);
    expect(resources).not.toMatch(/<img\b|<svg\b|<button\b/);
    expect(mainContent(builtPage('/research/ifi')).lastIndexOf('</article>'))
      .toBeLessThan(mainContent(builtPage('/research/ifi')).indexOf('<aside'));
  });

  it('separates formation, confirmed symposiums and planned activities with all selected sources', () => {
    const main = mainContent(builtPage('/research/ifi'));
    const network = getPublicIfiNetwork();
    const symposiums = getPublicIfiSymposiums();
    const groups = [
      { heading: 'ifi-formation-heading', records: symposiums.filter((record) => record.id === network.formation.symposiumId) },
      { heading: 'ifi-symposiums-heading', records: symposiums.filter((record) => record.id !== network.formation.symposiumId && record.status === 'confirmed') },
      { heading: 'ifi-planned-heading', records: symposiums.filter((record) => record.status === 'planned') },
    ].filter((group) => group.records.length > 0);
    expect(textContent(main)).toContain(network.editorial!.symposiumsLead);
    expect([...main.matchAll(/<article\b/g)]).toHaveLength(symposiums.length);
    for (const group of groups) {
      const section = sectionById(main, group.heading);
      const articles = [...section.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(([, content]) => content);
      expect(articles).toHaveLength(group.records.length);
      for (const [index, symposium] of group.records.entries()) {
        const article = articles[index];
        expect(textContent(article.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1])).toBe(symposium.title);
        expect(textContent(article)).toContain(symposium.context);
        expect(textContent(article)).toContain(symposium.location);
        expect(textContent(article)).toContain(formatHistoricalPeriod(symposium.period));
        expect(textContent(article)).toContain({ in_person: '现场会议', online: '线上会议', hybrid: '现场与线上会议' }[symposium.format]);
        expect(links(article).map((link) => link.href)).toEqual(symposium.sources.map((source) => source.url));
        expect(article).toMatch(/<details class="record-sources">/);
        expect(textContent(article)).toContain(`资料来源 · ${symposium.sources.length}`);
        if (symposium.status === 'planned') expect(textContent(article)).toContain('计划举行');
        else expect(textContent(article)).not.toContain('计划举行');
      }
    }
  });

  it('provides neighboring research links and a native expandable outline with valid targets', () => {
    const main = mainContent(builtPage('/research/ifi'));
    const nav = main.match(/<nav\b[^>]*aria-label="研究专题"[^>]*>([\s\S]*?)<\/nav>/)![1];
    const network = getPublicIfiNetwork();
    expect(links(nav)).toEqual([
      { href: '/research/ifi/', label: network.title },
      { href: '/research/researchers/', label: '研究者' },
      { href: '/research/readings/', label: getPublicReadingsSeries()[0].title },
    ]);
    expect(nav).toContain('href="/research/ifi/" aria-current="page"');
    expect([...nav.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    for (const link of links(nav)) expect(routeExists(link.href)).toBe(true);
    const outline = main.match(/<details class="page-outline">([\s\S]*?)<\/details>/)![1];
    const expected = [...sections(main).map((section) => `#${section.id}`), '#ifi-resources-heading'];
    expect(links(outline).map((link) => link.href)).toEqual(expected);
    for (const { href } of links(outline)) expect(main).toContain(`id="${href.slice(1)}"`);
  });

  it('uses the shared centered reading column and stacks the date column on phones', () => {
    expect(declaration('.section-layout:not(.section-layout--rail):not(.section-layout--reading)', 'width', '@media (min-width: 601px)'))
      .toBe('min(calc(100% - 40px), var(--reading))');
    expect(declaration(':root', '--reading')).toBe('672px');
    expect(declaration('.timeline-record', 'grid-template-columns')).toBe('130px minmax(0, 1fr)');
    expect(declaration('.timeline-record', 'grid-template-columns', '@media (max-width: 600px)')).toBe('minmax(0, 1fr)');
    expect(declaration('.research-meetings__resources .section-layout__structured', 'flex-wrap')).toBe('wrap');
  });

  it('keeps the research IFI section as a linked identity and short summary', () => {
    const network = getPublicIfiNetwork();
    const symposiums = getPublicIfiSymposiums();
    const html = builtPage('/research');
    const main = mainContent(html);
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1])).toBe(`研究｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe('研究');
    const entry = sectionFor(main, network.title);
    const heading = entry.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1];
    expect(links(heading)).toEqual([{ href: '/research/ifi/', label: network.title }]);
    const paragraphs = [...entry.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
      .map(([, content]) => textContent(content));
    expect(paragraphs).toEqual([`${network.name}（${network.abbreviation}）`, network.summary]);
    expect(links(entry)).toEqual([{ href: '/research/ifi/', label: network.title }]);
    expect(entry).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
    for (const symposium of symposiums) expect(textContent(entry)).not.toContain(symposium.title);
    expect(sections(main)).toHaveLength(3);
  });

  it('retains the researcher and Readings series entries', () => {
    const main = mainContent(builtPage('/research'));
    const researchers = sectionById(main, 'researchers-heading');
    expect(links(researchers)).toEqual([{ href: '/research/researchers/', label: '研究者' }]);
    expect(main).not.toContain('research-sites-heading');
    const series = getPublicReadingsSeries()[0];
    const readings = sectionFor(main, series.title);
    expect(textContent(readings)).toContain(series.name);
    expect(textContent(readings)).toContain(series.summary);
    expect(links(readings)).toEqual([{ href: '/research/readings/', label: series.title }]);
    expect(readings).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
    expect(sections(main).map((section) => section.heading)).toEqual([
      getPublicIfiNetwork().title, '研究者', series.title,
    ]);
  });

  it('keeps both pages static and preserves the primary navigation entries', () => {
    const expected = [
      { href: '/ilyenkov/', label: '伊里因科夫' },
      { href: '/archive/', label: '档案' },
      { href: '/glossary/', label: '术语库' },
      { href: '/research/', label: '研究' },
      { href: '/group/', label: '小组' },
      { href: '/books/', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const route of ['/research', '/research/ifi']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      // 站内栏目之后是论坛入口“讨论”；它不参与当前栏目标记。
      expect(links(nav)).toEqual([...expected, { href: site.forumUrl, label: '讨论' }]);
      expect(nav).toContain('href="/research/" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="/);
      for (const restricted of ['positioning_en', 'founded', 'formation_event_id', 'org-ifi', 'internal_notes', 'source_files', '/Users/', 'ILYENKOV_ROOT']) {
        expect(html, `${route}: ${restricted}`).not.toContain(restricted);
      }
    }
    const detail = builtPage('/research/ifi');
    expect(detail).not.toContain('section-layout__sidebar');
    expect(detail).toContain('research-meetings');
    expect(detail).not.toMatch(/section-layout--indexed|class="section-layout__toc"|reading-page/);
    expect(detail).not.toMatch(/<form\b|<input\b|<button\b/);
  });
});
