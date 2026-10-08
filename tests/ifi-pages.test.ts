import { renderPublicMarkdown } from '../src/lib/markdown';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  formatHistoricalPeriod,
  getPublicIfiNetwork,
  getPublicIfiSymposiums,
  getPublicReadingsSeries,
  getPublicResearchers,
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

const resourceLabels: Record<PublicIfiNetwork['resources'][number]['kind'], string> = {
  about: '组织介绍',
  history: '历史与活动',
  texts: '伊里因科夫文本',
  symposiums: 'Symposiums',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

describe('IFI public detail and research entry', () => {
  it('statically builds the detail page with the public network identity without duplicate breadcrumb titles', () => {
    expect(routeExists('/research/ifi')).toBe(true);
    const html = builtPage('/research/ifi');
    const main = mainContent(html);
    const network = getPublicIfiNetwork();
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${network.title}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(network.title);
    expect(textContent(main)).toContain(`${network.name}（${network.abbreviation}）`);
    expect(main).not.toContain('aria-label="当前位置"');
    expect(sections(main).map((section) => section.id)).toEqual([
      'ifi-intro-heading',
      'ifi-symposiums-heading',
    ]);
    expect(links(main)).toContainEqual({ href: network.url, label: '官方网站' });
  });

  it('presents the editorial introduction without separate formation or activity sections', async () => {
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
  });

  it('keeps the independent symposium history chronological with public dates, places and sources', () => {
    const history = sectionById(mainContent(builtPage('/research/ifi')), 'ifi-symposiums-heading');
    const symposiums = getPublicIfiSymposiums();
    expect(textContent(history.match(/<p class="research-series__lead">([\s\S]*?)<\/p>/)![1]))
      .toBe(getPublicIfiNetwork().editorial!.symposiumsLead);
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
    const researcher = getPublicResearchers().find((record) => record.id === 'researcher-andrey-maidansky')!;
    const researchers = sectionById(main, 'researcher-andrey-maidansky-heading');
    expect(textContent(researchers)).toContain(researcher.name);
    expect(textContent(researchers)).toContain(researcher.originalName);
    expect(textContent(researchers)).toContain(getPublicResearchers().find((record) => record.id === 'researcher-andrey-maidansky')!.editorial!.workDescription);
    expect(links(researchers)).toEqual([{
      href: '/research/researchers/andrey-maidansky/', label: researcher.name,
    }]);
    expect(researchers).not.toMatch(/<ol\b|<li\b|<article\b|<h3\b/);
    expect(main).not.toContain('research-sites-heading');
    const series = getPublicReadingsSeries()[0];
    const readings = sectionFor(main, series.title);
    expect(textContent(readings)).toContain(series.name);
    expect(textContent(readings)).toContain(series.summary);
    expect(links(readings)).toEqual([{ href: '/research/readings/', label: series.title }]);
    expect(readings).not.toMatch(/<ol\b|<ul\b|<li\b|<article\b|<h3\b/);
    expect(sections(main).map((section) => section.heading)).toEqual([
      getPublicIfiNetwork().title, researcher.name, series.title,
    ]);
  });

  it('keeps both pages static and preserves the five primary navigation entries', () => {
    const expected = [
      { href: '/ilyenkov/', label: '伊里因科夫' },
      { href: '/archive/', label: '档案' },
      { href: '/research/', label: '研究' },
      { href: '/group/', label: '小组' },
      { href: '/books/', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const route of ['/research', '/research/ifi']) {
      const html = builtPage(route);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      expect(links(nav)).toEqual(expected);
      expect(nav).toContain('href="/research/" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="/);
      for (const restricted of ['positioning_en', 'founded', 'formation_event_id', 'org-ifi', 'internal_notes', 'source_files', '/Users/', 'ILYENKOV_ROOT']) {
        expect(html, `${route}: ${restricted}`).not.toContain(restricted);
      }
    }
    const detail = builtPage('/research/ifi');
    expect(detail).toContain('section-layout__sidebar');
    expect(detail).not.toMatch(/section-layout--indexed|class="section-layout__toc"|reading-page/);
    expect(detail).not.toMatch(/<form\b|<input\b|<button\b/);
  });
});
