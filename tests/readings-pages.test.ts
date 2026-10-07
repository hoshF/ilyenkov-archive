import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  formatHistoricalPeriod,
  getPublicIfiNetwork,
  getPublicReadings,
  getPublicReadingsSeries,
  type PublicReadingsSeries,
} from '../src/lib/research-records';
import { builtRoutePath, routeExists } from './helpers/pages';

const builtPage = (route: string): string => readFileSync(builtRoutePath(route), 'utf8');
const mainContent = (html: string): string => html.match(/<main>([\s\S]*?)<\/main>/)![1];
const decode = (value: string): string => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const textContent = (html: string): string => decode(html.replace(/<[^>]+>/g, '')).trim();
const compactText = (html: string): string => textContent(html).replace(/\s+/g, '');

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
  it('statically builds the public series identity with a research breadcrumb and four natural sections', () => {
    const series = getPublicReadingsSeries();
    expect(series).toHaveLength(1);
    expect(routeExists('/research/readings/')).toBe(true);
    const html = builtPage('/research/readings/');
    const main = mainContent(html);
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${series[0].title}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(series[0].title);
    expect(textContent(main)).toContain(series[0].name);
    const breadcrumb = main.match(/<nav\b[^>]*aria-label="当前位置"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(breadcrumb)).toEqual([
      { href: '/', label: '首页' },
      { href: '/research', label: '世界研究' },
    ]);
    expect(breadcrumb).toContain('aria-current="page"');
    expect(textContent(breadcrumb)).toContain(series[0].title);
    expect([...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, content]) => textContent(content)))
      .toEqual(['简介', '历史线索', '资料与入口', '已公开会议记录']);
    const intro = sectionById(main, 'readings-intro-heading');
    expect(textContent(intro)).toContain(series[0].summary);
    expect(textContent(intro)).toContain('学术会议系列');
    expect(intro).not.toContain(series[0].type);
    expect(textContent(intro)).not.toMatch(/创办|每年|连续举办|主办机构/);
  });

  it('uses the earliest archive relation for 1991 without turning it into a founding or first edition', () => {
    const series = getPublicReadingsSeries()[0];
    const earliest = getPublicReadings().find((record) => record.id === series.history.earliestArchivedEventId)!;
    expect(earliest.id).toBe('readings-1991-first');
    const history = sectionById(mainContent(builtPage('/research/readings/')), 'readings-history-heading');
    expect(compactText(history)).toContain(`目前公开档案中最早保存直接会程的会议可追溯到${earliest.period.start.slice(0, 4)}年。`);
    expect(textContent(history)).toContain(earliest.title);
    expect(textContent(history)).toContain(formatHistoricalPeriod(earliest.period));
    expect(textContent(history)).toContain(earliest.location ?? earliest.format!);
    expect(textContent(history)).not.toMatch(/首次举办|首次会议|创办于|始于|成立于/);
    for (const source of earliest.sources) {
      expect(links(history).map((link) => link.href)).toContain(source.url);
      expect(textContent(history)).toContain(source.title);
    }
  });

  it('resolves the first international relation to 1999 and explains the international numbering', () => {
    const series = getPublicReadingsSeries()[0];
    const events = getPublicReadings();
    const earliest = events.find((record) => record.id === series.history.earliestArchivedEventId)!;
    const first = events.find((record) => record.id === series.history.firstInternationalEventId)!;
    expect(first.id).toBe('readings-1999-i-first-international');
    expect(first.edition).toBe('第一届国际会议');
    const history = sectionById(mainContent(builtPage('/research/readings/')), 'readings-history-heading');
    const text = textContent(history);
    expect(compactText(history)).toContain(`${first.period.start.slice(0, 4)}年举行${first.title}，并由此开始国际会议编号。`);
    expect(text).toContain(formatHistoricalPeriod(first.period));
    expect(text).toContain(first.location ?? first.format!);
    expect(text.indexOf(earliest.title)).toBeLessThan(text.indexOf(first.title));
    expect(links(history).map((link) => link.href)).toEqual([
      ...earliest.sources.map((source) => source.url),
      ...first.sources.map((source) => source.url),
    ]);
    for (const source of first.sources) expect(text).toContain(source.title);
  });

  it('presents only the selected series resources with distinct page-level Chinese labels', () => {
    const series = getPublicReadingsSeries()[0];
    const resources = sectionById(mainContent(builtPage('/research/readings/')), 'readings-resources-heading');
    expect(links(resources)).toEqual(series.resources.map((resource) => ({
      href: resource.url,
      label: resourceLabels[resource.kind],
    })));
    expect([...resources.matchAll(/<li\b/g)]).toHaveLength(series.resources.length);
    for (const resource of series.resources) expect(Object.keys(resource).sort()).toEqual(['kind', 'url']);
    expect(textContent(resources)).not.toContain('官方网站');
    expect(resources).not.toMatch(/<img\b|<svg\b|<button\b/);
  });

  it('renders the current public event selection chronologically using public metadata and sources', () => {
    const events = getPublicReadings();
    const records = sectionById(mainContent(builtPage('/research/readings/')), 'readings-events-heading');
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
      expect(links(article).map((link) => link.href)).toEqual(event.sources.map((source) => source.url));
      for (const source of event.sources) expect(textContent(article)).toContain(source.title);
      expect(routeExists(`/research/readings/${event.id}/`)).toBe(false);
    }
  });

  it('makes the partial record selection and dates explicit without renumbering early or international events', () => {
    const events = getPublicReadings();
    const records = sectionById(mainContent(builtPage('/research/readings/')), 'readings-events-heading');
    expect(textContent(records)).toContain('以下为部分会议记录');
    expect(textContent(records)).toContain('所列日期以来源记载为准，不一定覆盖完整会期。');
    const early = events.find((record) => record.id === 'readings-1991-first')!;
    const firstInternational = events.find((record) => record.id === 'readings-1999-i-first-international')!;
    expect(early.edition).toBe('早期会议（未编号）');
    expect(firstInternational.edition).toBe('第一届国际会议');
    expect(textContent(records)).toContain(early.edition);
    expect(textContent(records)).toContain(firstInternational.edition);
    expect(textContent(records)).not.toMatch(/首次（未编号）|共\s*30\s*届|全部\s*30\s*届/);
  });

  it('reduces the research Readings block to a public series entry and retains the IFI entry', () => {
    const main = mainContent(builtPage('/research/'));
    const series = getPublicReadingsSeries()[0];
    const entry = sectionById(main, 'readings-heading');
    expect(textContent(entry)).toContain(series.title);
    expect(textContent(entry)).toContain(series.name);
    expect(textContent(entry)).toContain(series.summary);
    expect(links(entry)).toEqual([{ href: '/research/readings/', label: '了解学术报告会 →' }]);
    expect(entry).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
    for (const event of getPublicReadings()) expect(textContent(entry)).not.toContain(event.title);
    const ifi = getPublicIfiNetwork();
    const ifiEntry = sectionById(main, 'ifi-heading');
    expect(textContent(ifiEntry)).toContain(ifi.title);
    expect(textContent(ifiEntry)).toContain(ifi.summary);
    expect(links(ifiEntry)).toEqual([{ href: '/research/ifi/', label: '了解 IFI →' }]);
    expect([...main.matchAll(/<section\b/g)]).toHaveLength(4);
    expect(routeExists('/research/researchers/')).toBe(false);
  });

  it('preserves the five primary navigation entries and a static, single-flow public boundary', () => {
    const expected = [
      { href: '/ilyenkov', label: '伊里因科夫' },
      { href: '/archive', label: '档案' },
      { href: '/research', label: '研究' },
      { href: '/group', label: '小组' },
      { href: '/books', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const route of ['/research/', '/research/readings/']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      expect(links(nav)).toEqual(expected);
      expect(nav).toContain('href="/research" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="/);
      for (const restricted of [
        'positioning_ru', 'memorial_background_ru', 'continuity_summary_ru',
        'record_directory', 'local_directory', 'source_files', 'internal_notes',
        '/Users/', 'ILYENKOV_ROOT',
      ]) expect(html, `${route}: ${restricted}`).not.toContain(restricted);
    }
    const detail = builtPage('/research/readings/');
    expect(detail).not.toMatch(/section-layout--rail|section-layout--indexed|section-layout__sidebar|section-layout__toc|section-layout__aside|reading-page/);
    expect(detail).not.toMatch(/<aside\b|<form\b|<input\b|<button\b/);
    expect(textContent(mainContent(detail))).not.toMatch(/1980|2020|停办|恢复线上|每年举行|连续举办|代表主题/);
  });
});
