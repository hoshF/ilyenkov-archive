import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../src/lib/editorial';
import {
  getPublicIfiNetwork,
  getPublicReadingsSeries,
  getPublicResearchers,
  getPublicResearchSites,
  type PublicResearcher,
} from '../src/lib/research-records';
import { getSiteData } from '../src/lib/site-data';
import { builtRoutePath, routeExists } from './helpers/pages';

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
  it('statically builds the public identity, summary and research breadcrumb in a single reading flow', () => {
    expect(routeExists(route)).toBe(true);
    const researcher = profile();
    const html = builtPage(route);
    const main = mainContent(html);
    expect(textContent(html.match(/<title>([\s\S]*?)<\/title>/)![1]))
      .toBe(`${researcher.name}｜${site.name}`);
    expect([...main.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(textContent(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1])).toBe(researcher.name);
    expect(textContent(main)).toContain(researcher.originalName);
    expect(researcher.latinName).toBe('Andrey D. Maidansky');
    expect(textContent(main)).toContain(researcher.latinName!);
    const intro = sectionById(main, 'researcher-intro-heading');
    expect(textContent(intro.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1])).toBe(researcher.summary);
    const breadcrumb = main.match(/<nav\b[^>]*aria-label="当前位置"[^>]*>([\s\S]*?)<\/nav>/)![1];
    expect(links(breadcrumb)).toEqual([
      { href: '/', label: '首页' }, { href: '/research', label: '世界研究' },
    ]);
    expect(breadcrumb).toContain('aria-current="page"');
    expect(textContent(breadcrumb)).toContain(researcher.name);
    expect([...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
      .map(([, content]) => textContent(content)))
      .toEqual(['简介', '研究方向', '角色', '学术入口', '本站译文']);
    expect(html).not.toMatch(/section-layout--rail|section-layout--indexed|section-layout__sidebar|section-layout__toc|section-layout__aside/);
  });

  it('maps only the current known public fields and roles to page-level Chinese labels', () => {
    const researcher = profile();
    const main = mainContent(builtPage(route));
    expect(researcher.researchFields).toEqual([
      'философия Спинозы', 'марксизм', 'история советской философии',
    ]);
    expect(researcher.roles).toEqual(['researcher', 'editor']);
    const fieldsSection = sectionById(main, 'researcher-fields-heading');
    const rolesSection = sectionById(main, 'researcher-roles-heading');
    const fields = textContent(fieldsSection.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1]);
    const roles = textContent(rolesSection.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1]);
    expect(fields).toBe('斯宾诺莎哲学、马克思主义、苏联哲学史。');
    expect(roles).toBe('研究者、编辑。');
    for (const raw of researcher.researchFields!) expect(fields).not.toContain(raw);
    for (const raw of researcher.roles!) expect(roles).not.toContain(raw);
  });

  it('offers only the selected public academic resources with distinct navigation labels', () => {
    const researcher = profile();
    const resources = sectionById(mainContent(builtPage(route)), 'researcher-resources-heading');
    expect(researcher.resources.map((resource) => resource.kind)).toEqual(['personal', 'orcid']);
    expect(links(resources)).toEqual(researcher.resources.map((resource) => ({
      href: resource.url, label: resourceLabels[resource.kind],
    })));
    expect(textContent(resources)).not.toMatch(/官方网站|文章来源/);
    expect(resources).not.toMatch(/<img\b|<svg\b|<button\b/);
  });

  it('derives every translation from Archive author identities and preserves its canonical order and metadata', async () => {
    const researcher = profile();
    const { articles } = await getSiteData();
    const expected = articles.filter((article) => article.authorIds.includes(researcher.personId));
    expect(expected).toHaveLength(24);
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

  it('includes all three coauthored translations with the complete Archive author signatures', async () => {
    const { articles } = await getSiteData();
    const records = [...translationsSection().matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
      .map(([, content]) => content);
    const coauthored = articles.filter((article) => article.authorIds.includes(profile().personId) && article.authorIds.length > 1);
    expect(coauthored.map((article) => article.id).sort()).toEqual([
      'evald-ilyenkov-and-soviet-philosophy',
      'ilyenkov-i-moskovskiy-logicheskiy-kruzhok-materialy-polemiki-2024',
      'evald-ilyenkovs-creative-marxism',
    ].sort());
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
    for (const personId of ['person-vesa-oittinen', 'person-evgeni-v-pavlov', 'person-elena-illesh']) {
      expect(publishedPersonIds).not.toContain(personId);
      expect(articles.some((article) => article.authorIds.includes(personId))).toBe(true);
    }
  });

  it('reduces the researchers hub to identity, summary and a single detail entrance', async () => {
    const main = mainContent(builtPage('/research/'));
    const researcher = profile();
    const entry = sectionById(main, 'researchers-heading');
    expect(textContent(entry)).toContain(researcher.name);
    expect(textContent(entry)).toContain(researcher.originalName);
    expect(textContent(entry)).toContain(researcher.summary);
    expect(links(entry)).toEqual([{ href: route, label: '了解研究者 →' }]);
    expect(entry).not.toMatch(/<ol\b|<ul\b|<li\b|<h4\b/);
    const { articles } = await getSiteData();
    for (const article of articles) expect(textContent(entry)).not.toContain(article.title);
    expect(routeExists('/research/researchers/')).toBe(false);
    const network = getPublicIfiNetwork();
    const ifi = sectionById(main, 'ifi-heading');
    expect(textContent(ifi)).toContain(network.summary);
    expect(links(ifi)).toEqual([{ href: '/research/ifi/', label: '了解 IFI →' }]);
    const series = getPublicReadingsSeries()[0];
    const readings = sectionById(main, 'readings-heading');
    expect(textContent(readings)).toContain(series.summary);
    expect(links(readings)).toEqual([{ href: '/research/readings/', label: '了解学术报告会 →' }]);
    const sites = sectionById(main, 'research-sites-heading');
    for (const site of getPublicResearchSites()) {
      expect(textContent(sites)).toContain(site.title);
      expect(links(sites)).toContainEqual({ href: site.url, label: site.title });
      for (const section of site.sections) expect(links(sites)).toContainEqual({ href: section.url, label: section.label });
    }
    expect([...main.matchAll(/<section\b/g)]).toHaveLength(4);
  });

  it('preserves primary navigation, static rendering and the private publication boundary', () => {
    const expected = [
      { href: '/ilyenkov', label: '伊里因科夫' }, { href: '/archive', label: '档案' },
      { href: '/research', label: '研究' }, { href: '/group', label: '小组' }, { href: '/books', label: '书籍' },
    ];
    expect(site.navigation).toEqual(expected);
    for (const href of ['/research/', route]) {
      const html = builtPage(href);
      const nav = html.match(/<nav\b[^>]*aria-label="主要导航"[^>]*>([\s\S]*?)<\/nav>/)![1];
      expect(links(nav)).toEqual(expected);
      expect(nav).toContain('href="/research" aria-current="page"');
      expect(html).not.toMatch(/<script\b|<astro-island\b|<style\b|\sstyle="|<form\b|<input\b/);
      for (const field of [
        'aliases', 'positioning_ru', 'affiliation', 'works_master', 'record_path',
        'record_id', 'source_path', 'author_zh', 'author_original', 'include_roles',
        'include_research_fields', '/Users/', 'ILYENKOV_ROOT', 'А. Д. Майданский', 'Andrey Maidansky',
      ]) expect(html, `${href}: ${field}`).not.toContain(field);
    }
  });
});
