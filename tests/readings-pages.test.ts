import { readFileSync } from 'node:fs';
import { renderPublicMarkdown } from '../src/lib/markdown';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  formatHistoricalPeriod,
  getPublicIfiNetwork,
  getPublicReadings,
  getPublicReadingsSeries,
  type PublicReadingsSeries,
} from '../src/lib/research-records';
import { builtRoutePath, routeExists, withoutHiddenDecoration } from './helpers/pages';

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

function sectionById(html: string, id: string): string {
  const section = [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)]
    .find(([, attributes]) => attributes.includes(`aria-labelledby="${id}"`));
  expect(section, `section for ${id}`).toBeDefined();
  return section![2];
}

const resourceLabels: Record<PublicReadingsSeries['resources'][number]['kind'], string> = {
  archive: 'Readings 资料档案',
  society: '“辩证法与文化”学会',
  historical_archive: '历史会议目录',
};

const pageSeries = (): PublicReadingsSeries => {
  const series = getPublicReadingsSeries().find((record) => record.id === 'ilyenkov-readings-series');
  if (!series) throw new Error('The current Readings page requires its selected public series');
  return series;
};

describe('Readings public series detail and research entry', () => {
  it('statically renders the generated series identity and selected introduction', async () => {
    const series = pageSeries();
    expect(series.id).toBe('ilyenkov-readings-series');
    expect(routeExists('/research/readings')).toBe(true);
    const html = builtPage('/research/readings');
    const main = mainContent(html);
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${series.title}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(series.title);
    expect(textContent(main)).toContain(series.name);
    expect(main).toContain('aria-label="当前位置"');
    const breadcrumb = main.match(/<nav\b[^>]*aria-label="当前位置"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(breadcrumb)).toEqual([{ href: '/', label: '首页' }, { href: '/research/', label: '研究' }]);
    expect(textContent(breadcrumb)).toContain(series.title);
    expect([...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, content]) => textContent(content)))
      .toEqual(['简介', ...[...new Set(getPublicReadings().map((record) => Math.floor(Number(record.period.start.slice(0, 4)) / 10) * 10))].map((decade) => `${decade} 年代`)]);
    const intro = sectionById(main, 'readings-intro-heading');
    const prose = intro.match(/<div class="prose prose--section">([\s\S]*?)<\/div>/)![1];
    const paragraphs = [...prose.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(([, content]) => textContent(content));
    expect(series.editorial).toBeDefined();
    const expected = await Promise.all(series.editorial!.introduction.map(async (paragraph) => (
      textContent((await renderPublicMarkdown(paragraph)).html)
    )));
    expect(paragraphs).toEqual(expected);
    expect(intro).not.toContain(series.type);
  });

  it('keeps type metadata out of the authored introduction', () => {
    const main = mainContent(builtPage('/research/readings'));
    expect(sectionById(main, 'readings-intro-heading')).not.toContain('class="record__label"');
    expect(textContent(sectionById(main, 'readings-intro-heading'))).not.toContain(pageSeries().type);
  });

  it('presents only the selected series resources with distinct page-level Chinese labels', () => {
    const series = pageSeries();
    const resources = mainContent(builtPage('/research/readings')).match(/<aside\b[^>]*aria-labelledby="readings-resources-heading"[^>]*>([\s\S]*?)<\/aside>/)![1];
    expect(textContent(resources)).toContain('资料入口');
    expect(links(resources)).toEqual(series.resources.map((resource) => ({
      href: resource.url,
      label: resourceLabels[resource.kind],
    })));
    expect([...resources.matchAll(/<li\b/g)]).toHaveLength(series.resources.length);
    for (const resource of series.resources) expect(Object.keys(resource).sort()).toEqual(['kind', 'url']);
    expect(textContent(resources)).not.toContain('官方网站');
    expect(resources).not.toMatch(/<img\b|<svg\b|<button\b/);
    const main = mainContent(builtPage('/research/readings'));
    expect(main.lastIndexOf('</article>')).toBeLessThan(main.indexOf('<aside'));
  });

  it('renders every selected event chronologically by decade with expandable sources', () => {
    const events = getPublicReadings();
    const main = mainContent(builtPage('/research/readings'));
    const articles = [...main.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(([, content]) => content);
    expect(articles).toHaveLength(events.length);
    expect(events.map((event) => event.period.start)).toEqual(events.map((event) => event.period.start).sort());
    for (const [index, event] of events.entries()) {
      const article = articles[index];
      expect(textContent(article.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1])).toBe(event.title);
      expect(textContent(article)).toContain(event.edition);
      expect(textContent(article)).toContain(formatHistoricalPeriod(event.period));
      expect(textContent(article)).toContain(event.location ?? event.format!);
      expect(links(article).map((link) => link.href)).toEqual(event.sources.map((source) => source.url));
      expect(article).toMatch(/<details class="record-sources">/);
      expect(textContent(article)).toContain(`资料来源 · ${event.sources.length}`);
      expect(main).toContain(`id="${event.id}"`);
      const decade = Math.floor(Number(event.period.start.slice(0, 4)) / 10) * 10;
      expect(sectionById(main, `readings-${decade}-heading`)).toContain(`id="${event.id}"`);
      expect(routeExists(`/research/readings/${event.id}/`)).toBe(false);
      if (/^\d{4}$/.test(event.period.start) && /^\d{4}$/.test(event.period.end)) {
        const date = textContent(article.match(/<p class="record__meta">([\s\S]*?)<\/p>/)![1]);
        expect(date).toBe(formatHistoricalPeriod(event.period));
        expect(date).not.toMatch(/月|日/);
      }
    }
  });

  it('provides neighboring research links and an expandable outline covering every decade', () => {
    const main = mainContent(builtPage('/research/readings'));
    const nav = main.match(/<nav\b[^>]*aria-label="研究专题"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(nav)).toEqual([
      { href: '/research/ifi/', label: getPublicIfiNetwork().title },
      { href: '/research/researchers/', label: '研究者' },
      { href: '/research/readings/', label: pageSeries().title },
    ]);
    expect(nav).toContain('href="/research/readings/" aria-current="page"');
    expect([...nav.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    for (const link of links(nav)) expect(routeExists(link.href)).toBe(true);
    const outline = main.match(/<details class="page-outline">([\s\S]*?)<\/details>/)![1];
    const decades = [...new Set(getPublicReadings().map((record) => Math.floor(Number(record.period.start.slice(0, 4)) / 10) * 10))];
    expect(links(outline).map((link) => link.href)).toEqual([
      '#readings-intro-heading', ...decades.map((decade) => `#readings-${decade}-heading`), '#readings-resources-heading',
    ]);
    for (const { href } of links(outline)) expect(main).toContain(`id="${href.slice(1)}"`);
  });

  it('reduces the research Readings block to a public series entry and retains the IFI entry', () => {
    const main = mainContent(builtPage('/research'));
    const series = pageSeries();
    const entry = sectionById(main, 'readings-heading');
    expect(textContent(entry)).toContain(series.title);
    expect(textContent(entry)).toContain(series.name);
    expect(textContent(entry)).toContain(series.summary);
    const heading = entry.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1];
    expect(links(heading)).toEqual([{ href: '/research/readings/', label: series.title }]);
    const paragraphs = [...entry.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
      .map(([, content]) => textContent(content));
    expect(paragraphs).toEqual([series.name, series.summary]);
    expect(links(entry)).toEqual([{ href: '/research/readings/', label: series.title }]);
    expect(entry).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
    for (const event of getPublicReadings()) expect(textContent(entry)).not.toContain(event.title);
    const ifi = getPublicIfiNetwork();
    const ifiEntry = sectionById(main, 'ifi-heading');
    expect(textContent(ifiEntry)).toContain(ifi.title);
    expect(textContent(ifiEntry)).toContain(ifi.summary);
    expect(links(ifiEntry)).toEqual([{ href: '/research/ifi/', label: ifi.title }]);
    expect([...main.matchAll(/<section\b/g)]).toHaveLength(3);
    expect(routeExists('/research/researchers/')).toBe(true);
  });

  it('preserves the primary navigation entries and a static, single-flow public boundary', () => {
    const expected = [
      { href: '/ilyenkov/', label: '伊里因科夫' },
      { href: '/archive/', label: '档案' },
      { href: '/glossary/', label: '术语库' },
      { href: '/research/', label: '研究' },
      { href: '/group/', label: '小组' },
      { href: '/books/', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const route of ['/research', '/research/readings']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      // 站内栏目之后是论坛入口“讨论”；它不参与当前栏目标记。
      expect(links(withoutHiddenDecoration(nav))).toEqual([...expected, { href: site.forumUrl, label: '讨论' }]);
      expect(nav).toContain('href="/research/" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="/);
      for (const restricted of [
        'positioning_ru', 'memorial_background_ru', 'continuity_summary_ru',
        'record_directory', 'local_directory', 'source_files', 'internal_notes',
        '/Users/', 'ILYENKOV_ROOT',
      ]) expect(html, `${route}: ${restricted}`).not.toContain(restricted);
    }
    const detail = builtPage('/research/readings');
    expect(detail).not.toContain('section-layout__sidebar');
    expect(detail).toContain('research-meetings');
    expect(detail).not.toMatch(/section-layout--indexed|class="section-layout__toc"|reading-page/);
    expect(detail).not.toMatch(/<form\b|<input\b|<button\b/);
  });
});

describe('meeting date readability and precision', () => {
  it.each([
    ['1991-02-14', '1991-02-15', '1991.02.14–15'],
    ['2026-04-05', '2026-04-05', '2026.04.05'],
    ['1998', '1998', '1998'],
    ['2018-04-19', '2018-05-16', '2018.04.19–05.16'],
    ['1999-12-31', '2000-01-01', '1999.12.31–2000.01.01'],
  ])('formats %s through %s without repeating common date parts', (start, end, expected) => {
    expect(formatHistoricalPeriod({ start, end })).toBe(expected);
  });
});
