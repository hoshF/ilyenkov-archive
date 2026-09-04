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

  it('loads only public summaries and external sources for activity records', () => {
    const records = getPublicResearchRecords();
    expect(records.biography).toHaveLength(5);
    expect(records.military).toHaveLength(7);
    expect(records.congresses).toHaveLength(4);
    for (const record of [...records.biography, ...records.military, ...records.congresses]) {
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.summary.length).toBeGreaterThan(0);
      expect(record.period.start).toMatch(/^\d{4}/);
      expect(record.sources.length).toBeGreaterThan(0);
      expect(record.sources.every((source) => source.url.startsWith('https://'))).toBe(true);
    }
  });

  it('does not expose private research fields in generated website input', () => {
    const generated = readFileSync(path.join(process.cwd(), '.website-input', 'research-records.json'), 'utf8');
    for (const restricted of ['local_path', 'confidence', 'analysis', 'issues.json', 'source_scans', 'people.json', 'webinars', 'works_master.json', 'source_id', 'source_ids', '"supports"', '"use"', '/Users/']) {
      expect(generated).not.toContain(restricted);
    }
  });

  it('publishes exactly the five selected 1924–1953 biography coordinates', () => {
    const biography = getPublicBiographyRecords();
    expect(biography.map((record) => record.id)).toEqual([
      'biography-1924-birth',
      'biography-1941-school-university-evacuation',
      'biography-1950-graduation-postgraduate-recommendation',
      'biography-1950-1953-postgraduate-dissertation',
      'biography-1953-institute-of-philosophy',
    ]);
    for (const record of biography) {
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.summary.length).toBeGreaterThan(0);
      expect(record.period.start).toMatch(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/);
      expect(record.period.end).toMatch(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/);
      expect(record.sources.length).toBeGreaterThan(0);
      expect(record.sources.every((source) => source.url.startsWith('https://'))).toBe(true);
    }
    const publicBiography = JSON.stringify(biography);
    expect(publicBiography).not.toContain('1928');
    expect(publicBiography).not.toContain('1929');
  });

  it('builds one chronological timeline from the approved activity records', () => {
    const records = getPublicTimelineRecords();
    expect(records).toHaveLength(16);
    expect(records.map((record) => record.category)).toEqual([
      'biography', 'biography',
      'military', 'military', 'military', 'military', 'military', 'military', 'military',
      'biography', 'biography', 'biography',
      'congress', 'congress', 'congress', 'congress',
    ]);
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
    const lifePage = readFileSync(path.join(process.cwd(), 'src/pages/ilyenkov/life.astro'), 'utf8');
    for (const route of ['/ilyenkov/circle', '/ilyenkov/timeline', '/ilyenkov/works']) {
      expect(lifePage).toContain(route);
    }
    expect(lifePage).toContain('getPublicResearchRecords');
    expect(lifePage).toContain('getPublicBiographyRecords');
    expect(lifePage).toContain('getPublicWorks');
    expect(lifePage).not.toContain('ILYENKOV_ROOT');
  });

  it('publishes only the explicitly selected works with public sources', () => {
    const works = getPublicWorks();
    expect(works).toHaveLength(8);
    expect(works.map((work) => work.id)).toEqual([
      'work-dialectics-abstract-concrete-theoretical-knowledge',
      'work-war-writing-guards-mortars',
      'work-war-writing-rifle-artillery-training',
      'work-war-writing-breakthrough-guns',
      'work-war-writing-miniature-range',
      'work-war-writing-sergeant-school',
      'work-dialectics-abstract-concrete-capital',
      'work-dialectical-logic-history-theory',
    ]);
    for (const work of works) {
      expect(work.title.length).toBeGreaterThan(0);
      expect(work.originalTitle.length).toBeGreaterThan(0);
      expect(work.year).toMatch(/^\d{4}$/);
      expect(work.sources.length).toBeGreaterThan(0);
      expect(work.sources.every((source) => /^https?:\/\//.test(source.url))).toBe(true);
    }
    expect(works.filter((work) => work.type !== '战时写作').every((work) => work.sources.length === 2)).toBe(true);
    expect(works.find((work) => work.id === 'work-dialectics-abstract-concrete-theoretical-knowledge')).toMatchObject({
      title: '《论科学理论认识中抽象与具体的辩证法》',
      originalTitle: 'О диалектике абстрактного и конкретного в научно-теоретическом познании',
      year: '1955',
      type: '论文',
    });
    expect(works.filter((work) => work.type === '著作')).toHaveLength(2);
    const warWriting = works.filter((work) => work.type === '战时写作');
    expect(warWriting).toHaveLength(5);
    expect(warWriting.map((work) => work.title)).toEqual([
      '《近卫迫击炮开赴战场……》',
      '《射击与炮兵训练课程》',
      '《突破用火炮》',
      '《在微缩靶场旁》',
      '《在中士学校》',
    ]);
    for (const work of warWriting) {
      expect(work.year).toBe('1945');
      expect(work.originalTitle.length).toBeGreaterThan(0);
      expect(work.sources).toHaveLength(1);
      expect(work.sources[0].url.startsWith('http://filorus.ru/ilyenkov/texts/gaz/')).toBe(true);
    }
  });

  it('publishes nine representative Ilyenkov Readings with date-supporting sources', () => {
    const readings = getPublicReadings();
    expect(readings).toHaveLength(9);
    expect(readings.map((record) => record.period.start.slice(0, 4))).toEqual([
      '1991', '2002', '2004', '2014', '2016', '2018', '2019', '2021', '2022',
    ]);
    for (const record of readings) {
      expect(record.edition.length).toBeGreaterThan(0);
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.sources.every((source) => source.url.startsWith('https://'))).toBe(true);
    }
    expect(readings.find((record) => record.period.start.startsWith('2016'))).toMatchObject({
      edition: '第十八届',
      title: '伊里因科夫哲学与当代',
      location: '别尔哥罗德',
    });
    expect(readings.find((record) => record.period.start.startsWith('2018'))).toMatchObject({
      edition: '第二十届',
      title: '伊里因科夫与马克思哲学',
      location: '莫斯科',
    });
    for (const year of ['2021', '2022']) {
      const reading = readings.find((record) => record.period.start.startsWith(year));
      expect(reading).toMatchObject({ location: null, format: '线上' });
      expect(reading?.sources).toHaveLength(1);
    }
    expect(readings.filter((record) => record.period.start < '2021').every((record) => (
      record.location !== null && record.format === null
    ))).toBe(true);
  });

  it('publishes the selected IFI network and four confirmed symposiums only', () => {
    const network = getPublicIfiNetwork();
    const symposiums = getPublicIfiSymposiums();
    expect(network).toMatchObject({
      id: 'ifi-network',
      name: 'International Friends of Ilyenkov',
      abbreviation: 'IFI',
      founded: '2012',
    });
    expect(network.url).toBe('https://ilyenkovfriends.org/');
    expect(symposiums.map((record) => record.period.start.slice(0, 4))).toEqual([
      '2012', '2014', '2018', '2022',
    ]);
    for (const record of symposiums) {
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.location.length).toBeGreaterThan(0);
      expect(record.sources.length).toBeGreaterThan(0);
      expect(record.sources.every((source) => source.url.startsWith('https://ilyenkovfriends.org/'))).toBe(true);
    }
  });

  it('publishes the selected Maidansky research reading map only', () => {
    const researchers = getPublicResearchers();
    expect(researchers).toHaveLength(1);
    const [researcher] = researchers;
    expect(researcher).toMatchObject({
      id: 'researcher-andrey-maidansky',
      name: '安德烈·迈丹斯基',
      originalName: 'Андрей Дмитриевич Майданский',
    });
    expect(researcher.works.map((work) => work.title)).toEqual([
      '埃瓦尔德·伊里因科夫论自由意志',
      '伊里因科夫逻辑学中的思维与语言',
      '伊里因科夫家庭档案的新发现',
    ]);
    for (const work of researcher.works) {
      expect(work.originalTitle.length).toBeGreaterThan(0);
      expect(work.source.url.startsWith('https://')).toBe(true);
      expect(work.archiveRoute.startsWith('/archive/')).toBe(true);
    }
  });

  it('publishes the selected Filorus research site navigation only', () => {
    const sites = getPublicResearchSites();
    expect(sites).toHaveLength(1);
    const [site] = sites;
    expect(site).toMatchObject({
      id: 'research-site-filorus-reading-ilyenkov',
      title: '读伊里因科夫',
      originalTitle: 'Читая Ильенкова',
      url: 'https://filorus.ru/ilyenkov/biog.html',
    });
    expect(site.sections.map((section) => section.label)).toEqual([
      '年表', '回忆录', '档案文献', '讣告', '外部链接',
    ]);
    expect(site.sections.every((section) => section.url.startsWith('https://filorus.ru/ilyenkov/'))).toBe(true);
  });
});
