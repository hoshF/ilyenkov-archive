import { readFileSync } from 'node:fs';
import { renderPublicMarkdown } from '../src/lib/markdown';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  formatHistoricalPeriod,
  getPublicIfiNetwork,
  getPublicReadings,
  getPublicReadingsSeries,
  getPublicResearchers,
  type PublicReadingsSeries,
} from '../src/lib/research-records';
import { builtRoutePath, routeExists } from './helpers/pages';

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

describe('Readings public series detail and research entry', () => {
  it('statically renders the generated series identity and selected introduction', async () => {
    const series = getPublicReadingsSeries();
    expect(series).toHaveLength(1);
    expect(routeExists('/research/readings')).toBe(true);
    const html = builtPage('/research/readings');
    const main = mainContent(html);
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${series[0].title}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(series[0].title);
    expect(textContent(main)).toContain(series[0].name);
    expect(main).not.toContain('aria-label="当前位置"');
    expect([...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, content]) => textContent(content)))
      .toEqual(['简介', '已公开会议记录']);
    const intro = sectionById(main, 'readings-intro-heading');
    const prose = intro.match(/<div class="prose prose--section">([\s\S]*?)<\/div>/)![1];
    const paragraphs = [...prose.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(([, content]) => textContent(content));
    expect(series[0].editorial).toBeDefined();
    const expected = await Promise.all(series[0].editorial!.introduction.map(async (paragraph) => (
      textContent((await renderPublicMarkdown(paragraph)).html)
    )));
    expect(paragraphs).toEqual(expected);
    expect(intro).not.toContain(series[0].type);
  });

  it('omits redundant type, history and event source rows', () => {
    const main = mainContent(builtPage('/research/readings'));
    expect(sectionById(main, 'readings-intro-heading')).not.toContain('class="record__label"');
    expect(main).not.toContain('来源：');
  });

  it('presents only the selected series resources with distinct page-level Chinese labels', () => {
    const series = getPublicReadingsSeries()[0];
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
  });

  it('renders the current public event selection chronologically without source links', () => {
    const events = getPublicReadings();
    const records = sectionById(mainContent(builtPage('/research/readings')), 'readings-events-heading');
    const articles = [...records.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
      .map(([, content]) => content);
    expect(articles).toHaveLength(events.length);
    expect(events.map((event) => event.period.start)).toEqual(events.map((event) => event.period.start).sort());
    for (const [index, event] of events.entries()) {
      const article = articles[index];
      expect(textContent(article.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1])).toBe(event.title);
      expect(textContent(article)).toContain(event.edition);
      expect(textContent(article)).toContain(formatHistoricalPeriod(event.period));
      expect(textContent(article)).toContain(event.location ?? event.format!);
      expect(links(article)).toEqual([]);
      expect(article).not.toContain('record__sources');
      expect(routeExists(`/research/readings${event.id}/`)).toBe(false);
    }
  });

  it('reduces the research Readings block to a public series entry and retains the IFI entry', () => {
    const main = mainContent(builtPage('/research'));
    const series = getPublicReadingsSeries()[0];
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
    expect([...main.matchAll(/<section\b/g)]).toHaveLength(2 + getPublicResearchers().length);
    expect(routeExists('/research/researchers/')).toBe(false);
  });

  it('preserves the five primary navigation entries and a static, single-flow public boundary', () => {
    const expected = [
      { href: '/ilyenkov/', label: '伊里因科夫' },
      { href: '/archive/', label: '档案' },
      { href: '/research/', label: '研究' },
      { href: '/group/', label: '小组' },
      { href: '/books/', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const route of ['/research', '/research/readings']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      expect(links(nav)).toEqual(expected);
      expect(nav).toContain('href="/research/" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="/);
      for (const restricted of [
        'positioning_ru', 'memorial_background_ru', 'continuity_summary_ru',
        'record_directory', 'local_directory', 'source_files', 'internal_notes',
        '/Users/', 'ILYENKOV_ROOT',
      ]) expect(html, `${route}: ${restricted}`).not.toContain(restricted);
    }
    const detail = builtPage('/research/readings');
    expect(detail).toContain('section-layout__sidebar');
    expect(detail).not.toMatch(/section-layout--indexed|class="section-layout__toc"|reading-page/);
    expect(detail).not.toMatch(/<form\b|<input\b|<button\b/);
  });
});
