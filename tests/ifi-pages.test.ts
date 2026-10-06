import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  formatHistoricalPeriod,
  getPublicIfiNetwork,
  getPublicIfiSymposiums,
  getPublicReadingsSeries,
  getPublicResearchers,
  getPublicResearchSites,
  type PublicIfiNetwork,
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

const activityLabels: Record<PublicIfiNetwork['activityModes'][number], string> = {
  symposium: '国际研讨会',
  webinar: '线上 Webinar',
  collective_reading: '集体阅读',
  discussion: '讨论',
};
const resourceLabels: Record<PublicIfiNetwork['resources'][number]['kind'], string> = {
  about: '组织介绍',
  history: '历史与活动',
  texts: '伊里因科夫文本',
  symposiums: 'Symposiums',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

describe('IFI public detail and research entry', () => {
  it('statically builds the detail page with the public network identity and research breadcrumb', () => {
    expect(routeExists('/research/ifi/')).toBe(true);
    const html = builtPage('/research/ifi/');
    const main = mainContent(html);
    const network = getPublicIfiNetwork();
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${network.title}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(network.title);
    expect(textContent(main)).toContain(`${network.name}（${network.abbreviation}）`);
    const breadcrumb = main.match(/<nav\b[^>]*aria-label="当前位置"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(breadcrumb)).toEqual([
      { href: '/', label: '首页' },
      { href: '/research', label: '世界研究' },
    ]);
    expect(breadcrumb).toContain('aria-current="page"');
    expect(textContent(breadcrumb)).toContain(network.title);
    expect(sections(main).map((section) => section.id)).toEqual([
      'ifi-intro-heading', 'ifi-formation-heading', 'ifi-activity-heading',
      'ifi-resources-heading', 'ifi-symposiums-heading',
    ]);
    expect(textContent(main)).toContain(network.summary);
    expect(links(main)).toContainEqual({ href: network.url, label: '官方网站' });
  });

  it('resolves formation through the public symposium relation without calling it a founding date', () => {
    const network = getPublicIfiNetwork();
    const symposium = getPublicIfiSymposiums().find((record) => record.id === network.formation.symposiumId)!;
    const formation = sectionById(mainContent(builtPage('/research/ifi/')), 'ifi-formation-heading');
    expect(textContent(formation)).toContain(symposium.period.start.slice(0, 4));
    expect(textContent(formation)).toContain(symposium.location);
    expect(textContent(formation)).toContain(symposium.title);
    expect(textContent(formation)).toContain(formatHistoricalPeriod(symposium.period));
    expect(textContent(formation)).not.toMatch(/成立于|正式成立|注册成立/);
    expect(links(formation).map((link) => link.href)).toEqual(symposium.sources.map((source) => source.url));
    for (const source of symposium.sources) {
      expect(textContent(formation)).toContain(source.title);
    }
  });

  it('presents only the public activity modes with Chinese labels in their source order', () => {
    const network = getPublicIfiNetwork();
    const activity = sectionById(mainContent(builtPage('/research/ifi/')), 'ifi-activity-heading');
    const text = textContent(activity);
    const positions = network.activityModes.map((mode) => text.indexOf(activityLabels[mode]));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(text).toContain('IFI 通过国际研讨会、线上 Webinar、集体阅读与讨论等形式持续开展研究交流。');
    expect(activity).not.toMatch(/<a\b|webinar-notes|workshop|panel|frequency/);
  });

  it('uses exactly the selected public official resource URLs and page-level labels', () => {
    const network = getPublicIfiNetwork();
    const resources = sectionById(mainContent(builtPage('/research/ifi/')), 'ifi-resources-heading');
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
  });

  it('keeps the independent symposium history chronological with public dates, places and sources', () => {
    const history = sectionById(mainContent(builtPage('/research/ifi/')), 'ifi-symposiums-heading');
    const symposiums = getPublicIfiSymposiums();
    const articles = [...history.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
      .map(([, content]) => content);
    expect(articles).toHaveLength(symposiums.length);
    for (const [index, symposium] of symposiums.entries()) {
      const article = articles[index];
      const title = article.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)![1];
      expect(textContent(title)).toBe(symposium.title);
      expect(textContent(article)).toContain(symposium.context);
      expect(textContent(article)).toContain(symposium.location);
      expect(textContent(article)).toContain(formatHistoricalPeriod(symposium.period));
      expect(links(article).map((link) => link.href)).toEqual(symposium.sources.map((source) => source.url));
    }
  });

  it('keeps the research IFI section as a short identity, formation and detail entrance', () => {
    const network = getPublicIfiNetwork();
    const symposiums = getPublicIfiSymposiums();
    const formation = symposiums.find((record) => record.id === network.formation.symposiumId)!;
    const main = mainContent(builtPage('/research/'));
    const entry = sectionFor(main, network.title);
    expect(textContent(entry)).toContain(network.summary);
    expect(textContent(entry)).toContain(formation.period.start.slice(0, 4));
    expect(textContent(entry)).toContain('形成');
    expect(textContent(entry)).not.toContain('成立于');
    expect(links(entry)).toEqual([{ href: '/research/ifi/', label: '了解 IFI →' }]);
    expect(entry).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
    for (const symposium of symposiums) expect(textContent(entry)).not.toContain(symposium.title);
    expect(sections(main)).toHaveLength(4);
  });

  it('retains the researchers and research sites while providing a Readings series entry', () => {
    const main = mainContent(builtPage('/research/'));
    const researchers = sectionFor(main, '研究者');
    for (const researcher of getPublicResearchers()) {
      expect(textContent(researchers)).toContain(researcher.name);
      expect(textContent(researchers)).toContain(researcher.originalName);
      expect(textContent(researchers)).toContain(researcher.summary);
      for (const work of researcher.works) {
        expect(textContent(researchers)).toContain(work.title);
        expect(textContent(researchers)).toContain(work.originalTitle);
        expect(links(researchers).map((link) => link.href)).toContain(work.archiveRoute);
        expect(links(researchers).map((link) => link.href)).toContain(work.source.url);
      }
    }
    const sites = sectionFor(main, '资料站点');
    for (const site of getPublicResearchSites()) {
      expect(textContent(sites)).toContain(site.title);
      expect(textContent(sites)).toContain(site.originalTitle);
      expect(textContent(sites)).toContain(site.summary);
      expect(links(sites).map((link) => link.href)).toContain(site.url);
      for (const section of site.sections) {
        expect(links(sites)).toContainEqual({ href: section.url, label: section.label });
      }
    }
    const series = getPublicReadingsSeries()[0];
    const readings = sectionFor(main, series.title);
    expect(textContent(readings)).toContain(series.name);
    expect(textContent(readings)).toContain(series.summary);
    expect(links(readings)).toEqual([{ href: '/research/readings/', label: '了解学术报告会 →' }]);
    expect(readings).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
  });

  it('keeps both pages static and preserves the five primary navigation entries', () => {
    const expected = [
      { href: '/ilyenkov', label: '伊里因科夫' },
      { href: '/archive', label: '档案' },
      { href: '/research', label: '研究' },
      { href: '/group', label: '小组' },
      { href: '/books', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const route of ['/research/', '/research/ifi/']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      expect(links(nav)).toEqual(expected);
      expect(nav).toContain('href="/research" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="/);
      for (const restricted of ['positioning_en', 'founded', 'formation_event_id', 'org-ifi', 'internal_notes', 'source_files', '/Users/', 'ILYENKOV_ROOT']) {
        expect(html, `${route}: ${restricted}`).not.toContain(restricted);
      }
    }
    const detail = builtPage('/research/ifi/');
    expect(detail).not.toMatch(/section-layout--rail|section-layout--indexed|section-layout__sidebar|section-layout__toc|section-layout__aside|reading-page/);
    expect(detail).not.toMatch(/<aside\b|<form\b|<input\b|<button\b/);
  });
});
