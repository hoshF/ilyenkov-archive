import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generatedArticleIds,
  resolveGeneratedArticlePath,
} from '../src/lib/article-source';
import {
  getPublicBiographyRecords,
  getPublicIfiNetwork,
  getPublicIfiSymposiums,
  getPublicReadings,
  getPublicResearchers,
  getPublicResearchRecords,
  getPublicResearchSites,
  getPublicTimelineRecords,
  getPublicWorks,
} from '../src/lib/research-records';
import { pageSource } from './helpers/pages';
import { researchRoot, websiteWorks } from './helpers/publication';

describe('translation sync boundary', () => {
  it('checks generated articles against the private website_public selection', () => {
    const output = execFileSync('node', ['scripts/sync-translations.mjs', '--check'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const selected = websiteWorks();
    expect(selected.length).toBeGreaterThan(0);
    expect(output).toContain(`stale=0 articles=${selected.length}`);
    expect(generatedArticleIds()).toEqual(selected.map((work) => work.work_id).sort());
  });

  it('combines each work.json with its Markdown as a frontmatter article', () => {
    for (const selected of websiteWorks()) {
      const work = JSON.parse(readFileSync(path.join(researchRoot, selected.work_json_path), 'utf8'));
      const article = matter(readFileSync(resolveGeneratedArticlePath(selected.work_id), 'utf8'));
      const textRelative = path.posix.join(
        path.posix.dirname(selected.work_json_path),
        `${selected.work_id}.md`,
      );
      expect(article.data).toMatchObject({
        title: work.title,
        title_zh: work.title_zh,
        source_edition: work.source_edition,
        source_url: work.source_url,
        type: 'translation',
        generated_from: `Ilyenkov:${textRelative}`,
      });
      if (work.doi) expect(article.data.doi).toBe(work.doi);
      expect(article.content).not.toMatch(/^---\r?\n/);
      expect(article.content.length).toBeGreaterThan(1000);
    }
  });

  it('keeps generated website text outside the public Git content tree', () => {
    const source = readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(source).toContain('.website-input/');
    expect(resolveGeneratedArticlePath(generatedArticleIds()[0])).toContain('/.website-input/articles/');
  });
});

describe('research record publication boundary', () => {
  it('keeps generated activity records synchronized with the private website_public selection', () => {
    const output = execFileSync('node', ['scripts/sync-research-records.mjs', '--check'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(output).toContain('stale=0');
  });

  it('does not expose private research fields in generated website input', () => {
    const generated = readFileSync(path.join(process.cwd(), '.website-input', 'research-records.json'), 'utf8');
    for (const restricted of ['local_path', 'confidence', 'analysis', 'issues.json', 'source_scans', 'people.json', 'webinars', 'works_master.json', 'source_id', 'source_ids', '"supports"', '"use"', '/Users/']) {
      expect(generated).not.toContain(restricted);
    }
  });

  it('keeps every published record inside the public field contract', () => {
    const records = getPublicResearchRecords();
    const activities = [...records.biography, ...records.military, ...records.congresses];
    const publicUrl = /^https?:\/\//;

    expect(activities.length).toBeGreaterThan(0);
    for (const record of activities) {
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.summary.length).toBeGreaterThan(0);
      expect(record.period.start).toMatch(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/);
      expect(record.period.end).toMatch(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/);
      expect(record.sources.length).toBeGreaterThan(0);
      expect(record.sources.every((source) => publicUrl.test(source.url))).toBe(true);
    }

    for (const work of getPublicWorks()) {
      expect(work.title.length).toBeGreaterThan(0);
      expect(work.originalTitle.length).toBeGreaterThan(0);
      expect(work.year).toMatch(/^\d{4}$/);
      expect(work.sources.length).toBeGreaterThan(0);
      expect(work.sources.every((source) => publicUrl.test(source.url))).toBe(true);
    }

    for (const reading of getPublicReadings()) {
      expect(reading.edition.length).toBeGreaterThan(0);
      expect(reading.title.length).toBeGreaterThan(0);
      expect(reading.sources.length).toBeGreaterThan(0);
      expect(reading.sources.every((source) => publicUrl.test(source.url))).toBe(true);
    }

    for (const symposium of getPublicIfiSymposiums()) {
      expect(symposium.title.length).toBeGreaterThan(0);
      expect(symposium.location.length).toBeGreaterThan(0);
      expect(symposium.sources.every((source) => publicUrl.test(source.url))).toBe(true);
    }

    const network = getPublicIfiNetwork();
    expect(network.founded).toMatch(/^\d{4}$/);
    expect(publicUrl.test(network.url)).toBe(true);

    for (const researcher of getPublicResearchers()) {
      expect(researcher.name.length).toBeGreaterThan(0);
      for (const work of researcher.works) {
        expect(work.originalTitle.length).toBeGreaterThan(0);
        expect(publicUrl.test(work.source.url)).toBe(true);
        expect(work.archiveRoute.startsWith('/archive/')).toBe(true);
      }
    }

    for (const site of getPublicResearchSites()) {
      expect(site.title.length).toBeGreaterThan(0);
      expect(publicUrl.test(site.url)).toBe(true);
      expect(site.sections.every((section) => publicUrl.test(section.url))).toBe(true);
    }
  });

  it('does not decide a disputed date on the public side', () => {
    // 童年迁居莫斯科可以公开，1928／1929 的争议年份由研究系统裁决，不进网站。
    const biography = JSON.stringify(getPublicBiographyRecords());
    expect(biography).not.toContain('1928');
    expect(biography).not.toContain('1929');
  });

  it('builds one chronological timeline from the approved activity records', () => {
    const records = getPublicTimelineRecords();
    expect(records.length).toBeGreaterThan(0);
    expect(new Set(records.map((record) => record.category))).toEqual(
      new Set(['biography', 'military', 'congress']),
    );
    expect(records.every((record) => (
      record.categoryLabel.length > 0
      && record.title.length > 0
      && record.summary.length > 0
      && record.sources.length > 0
    ))).toBe(true);
    expect(records.every((record, index) => (
      index === 0 || records[index - 1].period.start <= record.period.start
    ))).toBe(true);
  });

  it('provides the life page only with already-public research coordinates', () => {
    const lifePage = pageSource('ilyenkov/life.astro');
    for (const route of ['/ilyenkov/circle', '/ilyenkov/timeline', '/ilyenkov/works']) {
      expect(lifePage).toContain(route);
    }
    expect(lifePage).toContain('getPublicResearchRecords');
    expect(lifePage).toContain('getPublicBiographyRecords');
    expect(lifePage).toContain('getPublicWorks');
    expect(lifePage).not.toContain('ILYENKOV_ROOT');
  });
});
