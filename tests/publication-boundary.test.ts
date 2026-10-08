import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generatedArticleAssets,
  generatedArticleIds,
  resolveGeneratedArticleAssetPath,
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
    expect(output).toContain(`written=0/${selected.length}`);
    expect(output).toContain('stale=0');
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

  it('lets only explicitly allowed fields reach the generated article', () => {
    // 显式允许模型：private work.json 的字段默认不公开。这里同时锁住两侧——
    // 生成输入的键集合，以及每个 private-only 字段都不在其中。
    const allowed = new Set([
      // 发布契约允许公开的来源字段
      'title', 'title_zh', 'author', 'author_ids', 'year', 'source_edition', 'source_url', 'doi',
      // public 生成字段
      'title_notes', 'type', 'generated_from', 'generated_rev',
    ]);
    const privateOnly = new Set([
      'work_id', 'source_path', 'rights_status', 'source_text_status',
      'orcid', 'udc', 'copyright', 'translator',
    ]);

    for (const selected of websiteWorks()) {
      const work = JSON.parse(readFileSync(path.join(researchRoot, selected.work_json_path), 'utf8'));
      const article = matter(readFileSync(resolveGeneratedArticlePath(selected.work_id), 'utf8'));
      const keys = Object.keys(article.data);

      expect(keys.filter((key) => !allowed.has(key)), selected.work_id).toEqual([]);
      expect(keys.filter((key) => privateOnly.has(key)), selected.work_id).toEqual([]);
      for (const key of privateOnly) {
        expect(keys, `${selected.work_id} should not carry ${key}`).not.toContain(key);
      }

      // 契约允许 ≠ 一定出现：可选来源字段缺省时整行不写，不产生空值。
      for (const optional of ['source_url', 'doi']) {
        if (!(optional in article.data)) expect(work[optional], selected.work_id).toBeUndefined();
      }
    }
  });

  it('keeps generated website text outside the public Git content tree', () => {    const source = readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
    expect(source).toContain('.website-input/');
    expect(resolveGeneratedArticlePath(generatedArticleIds()[0])).toContain('/.website-input/articles/');
  });

  it('publishes only local images referenced by approved translation Markdown', () => {
    const assets = generatedArticleAssets();
    expect(assets.length).toBeGreaterThan(0);
    for (const { id, asset } of assets) {
      const selected = websiteWorks().find((work) => work.work_id === id);
      expect(selected).toBeDefined();
      const sourceMarkdown = readFileSync(path.join(
        researchRoot,
        path.posix.dirname(selected!.work_json_path),
        `${id}.md`,
      ), 'utf8');
      expect(sourceMarkdown).toContain(`](${asset})`);
      expect(readFileSync(resolveGeneratedArticleAssetPath(id, asset)).length).toBeGreaterThan(0);
    }
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
    for (const restricted of ['local_path', 'confidence', 'analysis', 'issues.json', 'source_scans', 'people.json', 'webinars', 'works_master.json', 'source_id', 'source_ids', '"supports"', '"use"', '"positioning_en"', '"founded"', '"formation_event_id"', '"organization_id"', '"local_directory"', '"record_directory"', '"earliest_archived_event_directory"', '"first_international_event_directory"', '"positioning_ru"', '"memorial_background_ru"', '"continuity_summary_ru"', '/Users/']) {
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
    expect(publicUrl.test(network.url)).toBe(true);
    expect(getPublicIfiSymposiums().filter((symposium) => (
      symposium.id === network.formation.symposiumId
    ))).toHaveLength(1);
    expect(network.activityModes.every((mode) => (
      ['symposium', 'webinar', 'collective_reading', 'discussion'].includes(mode)
    ))).toBe(true);
    expect(network.resources.every((resource) => (
      ['about', 'history', 'texts', 'symposiums', 'youtube', 'facebook'].includes(resource.kind)
      && publicUrl.test(resource.url)
    ))).toBe(true);
    expect(network).not.toHaveProperty('founded');
    expect(network).not.toHaveProperty('positioning_en');

    for (const researcher of getPublicResearchers()) {
      expect(researcher.personId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(researcher.name.length).toBeGreaterThan(0);
      expect(researcher.originalName.length).toBeGreaterThan(0);
      expect(researcher.summary.length).toBeGreaterThan(0);
      for (const resource of researcher.resources) {
        expect(['personal', 'orcid', 'institution']).toContain(resource.kind);
        expect(publicUrl.test(resource.url)).toBe(true);
      }
      for (const privateField of ['works', 'aliases', 'positioning_ru', 'record_path', 'record_id']) {
        expect(researcher).not.toHaveProperty(privateField);
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
    expect(new Set(records.map((record) => record.id))).toEqual(
      new Set(getPublicResearchRecords().timeline.recordIds),
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
