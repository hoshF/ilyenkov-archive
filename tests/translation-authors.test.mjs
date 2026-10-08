import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalPersonRegistry, translationAuthors } from '../scripts/lib/translation-authors.mjs';
import { generatedArticleIds, resolveGeneratedArticlePath } from '../src/lib/article-source';
import { getPublicResearchers } from '../src/lib/research-records';
import { getSiteData } from '../src/lib/site-data';
import { researchRoot, websiteWorks } from './helpers/publication';

const projectRoot = process.cwd();
const roots = [];
const maidansky = { person_id: 'person-andrey-maidansky', name_zh: '安德烈·迈丹斯基' };
const oittinen = { person_id: 'person-vesa-oittinen', name_zh: '韦萨·奥伊蒂宁' };
const pavlov = { person_id: 'person-evgeni-v-pavlov', name_zh: '叶夫根尼·V·巴甫洛夫' };
const illesh = { person_id: 'person-elena-illesh', name_zh: '叶莲娜·伊列什' };
const identities = [maidansky, oittinen, pavlov, illesh];
const label = 'translation/fixture/selected-work/work.json';
const readJson = (root, relative) => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function writeJson(root, relative, value) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function registryFixture(records = identities.map(({ person_id }) => ({ person_id }))) {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-author-registry-'));
  roots.push(root);
  writeJson(root, 'people/persons.json', { records });
  return root;
}

/** Isolated CLI project: synthetic bodies only; its output cannot touch real generated input. */
function syncFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-translation-author-sync-'));
  roots.push(root);
  const sourceRoot = path.join(root, 'private');
  const publicRoot = path.join(root, 'public');
  mkdirSync(path.join(publicRoot, 'scripts'), { recursive: true });
  cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
  cpSync(path.join(projectRoot, 'scripts/sync-translations.mjs'), path.join(publicRoot, 'scripts/sync-translations.mjs'));
  symlinkSync(path.join(projectRoot, 'node_modules'), path.join(publicRoot, 'node_modules'), 'dir');
  writeJson(sourceRoot, 'people/persons.json', {
    records: identities.map(({ person_id }) => ({
      person_id,
      aliases: ['private alias sentinel'],
      roles: ['private role sentinel'],
      positioning_ru: 'private positioning sentinel',
      research_fields: ['private field sentinel'],
      resources: { personal: 'https://private-facts.example.test/' },
    })),
  });
  const choices = [
    ['selected-work', 'website_public', [pavlov, maidansky]],
    ['internal-illesh-one', 'internal_public', [illesh]],
    ['internal-illesh-two', 'internal_public', [illesh]],
    ['young-hegel', 'internal_public', undefined],
  ];
  const works = choices.map(([id, publication_scope, authors]) => {
    const work_json_path = `translation/fixture/${id}/work.json`;
    const work = {
      work_id: id, title: `Original ${id}`, title_zh: `测试：${id}`,
      year: '1999', source_edition: 'Synthetic fixture source',
      source_url: 'https://source.example.test/',
      ...(authors ? { authors } : {}),
    };
    writeJson(sourceRoot, work_json_path, work);
    writeFileSync(path.join(sourceRoot, path.dirname(work_json_path), `${id}.md`), `# Synthetic ${id}\n\nSynthetic fixture body for ${id}.\n`);
    return { work_id: id, work_json_path, publication_scope };
  });
  // Both channels share one manifest; author identities do not require researcher publication.
  writeJson(sourceRoot, 'web/publication.json', { works, records: [] });
  const articlesRoot = path.join(publicRoot, '.website-input/articles');
  const assetsRoot = path.join(publicRoot, '.website-input/article-assets');
  return {
    sourceRoot,
    articlesRoot,
    assetsRoot,
    mutate(relative, callback) {
      const value = readJson(sourceRoot, relative);
      callback(value);
      writeJson(sourceRoot, relative, value);
    },
    run() {
      return spawnSync(process.execPath, ['scripts/sync-translations.mjs'], {
        cwd: publicRoot,
        env: { ...process.env, ILYENKOV_ROOT: sourceRoot },
        encoding: 'utf8', timeout: 10_000,
      });
    },
    article(id = 'selected-work') {
      return matter(readFileSync(path.join(articlesRoot, `${id}.md`), 'utf8'));
    },
  };
}

describe('canonical translation author registry', () => {
  it('loads unique canonical identities without requiring researcher publications', () => {
    const registry = canonicalPersonRegistry(registryFixture());
    expect(registry).toBeInstanceOf(Map);
    expect([...registry.keys()]).toEqual(identities.map((author) => author.person_id));
    expect(translationAuthors({ authors: [oittinen, pavlov, illesh] }, label, registry)).toEqual({
      names: [oittinen.name_zh, pavlov.name_zh, illesh.name_zh],
      ids: [oittinen.person_id, pavlov.person_id, illesh.person_id],
    });
  });

  it.each([null, {}, 'not an array', []])('rejects malformed registry records %j', (records) => {
    expect(() => canonicalPersonRegistry(registryFixture(records))).toThrow(/people\/persons\.json.*records/);
  });

  it.each([null, [], {}, { person_id: '' }, { person_id: '   ' }, { person_id: 'person-\nunknown' }])(
    'rejects malformed canonical person %j', (record) => {
      expect(() => canonicalPersonRegistry(registryFixture([record]))).toThrow(/people\/persons\.json/);
    },
  );

  it('rejects a duplicate canonical person identity', () => {
    expect(() => canonicalPersonRegistry(registryFixture([
      { person_id: maidansky.person_id }, { person_id: maidansky.person_id },
    ]))).toThrow(new RegExp(`people/persons\\.json.*${maidansky.person_id}`));
  });

  it('resolves all current selected author IDs against the real canonical registry', () => {
    const registry = canonicalPersonRegistry(researchRoot);
    for (const selected of websiteWorks()) {
      const work = readJson(researchRoot, selected.work_json_path);
      const authors = translationAuthors(work, selected.work_json_path, registry);
      expect(authors.ids, selected.work_id).toEqual(work.authors.map((author) => author.person_id));
      expect(authors.names, selected.work_id).toEqual(work.authors.map((author) => author.name_zh));
    }
  });
});

describe('translation author input contract', () => {
  const registry = new Map(identities.map((author) => [author.person_id, { person_id: author.person_id }]));

  it.each([undefined, null, [], '安德烈·迈丹斯基', {}])('requires a non-empty authors object array %j', (authors) => {
    expect(() => translationAuthors({ authors }, label, registry)).toThrow(/authors/);
  });

  it.each(['author', 'author_ids'])('rejects legacy %s even alongside valid authors', (field) => {
    expect(() => translationAuthors({ authors: [maidansky], [field]: [maidansky.name_zh] }, label, registry))
      .toThrow(new RegExp(field));
    expect(() => translationAuthors({ [field]: [maidansky.name_zh] }, label, registry))
      .toThrow(/author/);
  });

  it.each([
    { name_zh: maidansky.name_zh },
    { person_id: maidansky.person_id },
    { ...maidansky, person_id: '' },
    { ...maidansky, name_zh: '   ' },
    { ...maidansky, person_id: 42 },
    { ...maidansky, name_zh: [] },
    { ...maidansky, person_id: `${maidansky.person_id}\n` },
    { ...maidansky, name_zh: `${maidansky.name_zh}\n` },
    { ...maidansky, role: 'researcher' },
    null,
    '安德烈·迈丹斯基',
    [],
  ])('rejects an invalid strict author object %j', (author) => {
    expect(() => translationAuthors({ authors: [author] }, label, registry)).toThrow(/authors/);
  });

  it('rejects one canonical person twice even if display names differ', () => {
    expect(() => translationAuthors({ authors: [maidansky, { ...maidansky, name_zh: '另一署名' }] }, label, registry))
      .toThrow(new RegExp(`${maidansky.person_id}|duplicate|repeat`, 'i'));
  });

  it('reports the work path and unknown person identity together', () => {
    expect(() => translationAuthors({ authors: [{ person_id: 'person-unknown', name_zh: '未知作者' }] }, label, registry))
      .toThrow(/translation\/fixture\/selected-work\/work\.json.*person-unknown/);
  });

  it('preserves supplied author order and display names rather than sorting canonical people', () => {
    expect(translationAuthors({ authors: [pavlov, maidansky] }, label, registry)).toEqual({
      names: [pavlov.name_zh, maidansky.name_zh], ids: [pavlov.person_id, maidansky.person_id],
    });
  });
});

describe('translation author generation and publication selection', () => {
  it('requires the web manifest even when both former manifests exist', () => {
    const input = syncFixture();
    const manifest = readJson(input.sourceRoot, 'web/publication.json');
    writeJson(input.sourceRoot, 'translation/publication.json', { works: manifest.works });
    writeJson(input.sourceRoot, 'research/publication.json', { records: manifest.records });
    rmSync(path.join(input.sourceRoot, 'web/publication.json'));
    const result = input.run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('missing web/publication.json');
    expect(existsSync(input.articlesRoot)).toBe(false);
    expect(existsSync(input.assetsRoot)).toBe(false);
  });

  it('cleans revoked articles and images while retaining only approved references', () => {
    const input = syncFixture();
    const selectedDirectory = path.join(input.sourceRoot, 'translation/fixture/selected-work');
    const revokedDirectory = path.join(input.sourceRoot, 'translation/fixture/internal-illesh-one');
    const keptImage = Buffer.from('Synthetic kept image');
    writeFileSync(path.join(selectedDirectory, 'kept.png'), keptImage);
    writeFileSync(path.join(selectedDirectory, 'removed.png'), 'Synthetic removed image');
    writeFileSync(path.join(selectedDirectory, 'unreferenced.png'), 'Synthetic unreferenced image');
    writeFileSync(path.join(revokedDirectory, 'revoked.png'), 'Synthetic revoked image');
    writeFileSync(path.join(selectedDirectory, 'selected-work.md'), '# Synthetic title\n\n![Kept](kept.png)\n\n![Removed](removed.png)\n');
    writeFileSync(path.join(revokedDirectory, 'internal-illesh-one.md'), '# Synthetic title\n\n![Revoked](revoked.png)\n');
    input.mutate('web/publication.json', (manifest) => {
      manifest.works.find((work) => work.work_id === 'internal-illesh-one').publication_scope = 'website_public';
    });
    const first = input.run();
    expect(first.status, first.stderr).toBe(0);
    expect(readdirSync(input.articlesRoot).sort()).toEqual(['internal-illesh-one.md', 'selected-work.md']);
    expect(readdirSync(path.join(input.assetsRoot, 'selected-work')).sort()).toEqual(['kept.png', 'removed.png']);
    expect(readFileSync(path.join(input.assetsRoot, 'selected-work/kept.png'))).toEqual(keptImage);
    expect(existsSync(path.join(input.assetsRoot, 'internal-illesh-one/revoked.png'))).toBe(true);

    input.mutate('web/publication.json', (manifest) => {
      manifest.works.find((work) => work.work_id === 'internal-illesh-one').publication_scope = 'internal_public';
    });
    writeFileSync(path.join(selectedDirectory, 'selected-work.md'), '# Synthetic title\n\n![Kept](kept.png)\n');
    const second = input.run();
    expect(second.status, second.stderr).toBe(0);
    expect(readdirSync(input.articlesRoot)).toEqual(['selected-work.md']);
    expect(readdirSync(path.join(input.assetsRoot, 'selected-work'))).toEqual(['kept.png']);
    expect(readFileSync(path.join(input.assetsRoot, 'selected-work/kept.png'))).toEqual(keptImage);
    expect(existsSync(path.join(input.assetsRoot, 'internal-illesh-one'))).toBe(false);
  });

  it('generates aligned author arrays without registry facts or unpublished works', () => {
    const input = syncFixture();
    const result = input.run();
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(input.articlesRoot)).toEqual(['selected-work.md']);
    expect(input.article().data.author).toEqual([pavlov.name_zh, maidansky.name_zh]);
    expect(input.article().data.author_ids).toEqual([pavlov.person_id, maidansky.person_id]);
    for (const name of ['aliases', 'roles', 'positioning_ru', 'research_fields', 'resources', 'private alias sentinel']) {
      expect(JSON.stringify(input.article().data)).not.toContain(name);
    }
    for (const id of ['internal-illesh-one', 'internal-illesh-two', 'young-hegel']) {
      expect(existsSync(path.join(input.articlesRoot, `${id}.md`))).toBe(false);
    }
    const before = readFileSync(path.join(input.articlesRoot, 'selected-work.md'), 'utf8');
    input.mutate('web/publication.json', (manifest) => {
      manifest.records.push({ kind: 'researcher_profile', record_id: maidansky.person_id, publication_scope: 'website_public' });
    });
    const again = input.run();
    expect(again.status, again.stderr).toBe(0);
    expect(readFileSync(path.join(input.articlesRoot, 'selected-work.md'), 'utf8')).toBe(before);
  });

  it('fails the CLI with work path and unknown author rather than retaining only its display name', () => {
    const input = syncFixture();
    input.mutate(label, (work) => { work.authors[0].person_id = 'person-unknown'; });
    const result = input.run();
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/translation\/fixture\/selected-work\/work\.json.*person-unknown/);
    expect(existsSync(path.join(input.articlesRoot, 'selected-work.md'))).toBe(false);
  });

  it('rejects a Young Hegel without authors only when selected for website publication', () => {
    const input = syncFixture();
    input.mutate('web/publication.json', (manifest) => {
      manifest.works.find((work) => work.work_id === 'young-hegel').publication_scope = 'website_public';
    });
    const result = input.run();
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/translation\/fixture\/young-hegel\/work\.json.*authors/);
    expect(existsSync(path.join(input.articlesRoot, 'young-hegel.md'))).toBe(false);
  });

  it.each([
    ['evald-ilyenkov-and-soviet-philosophy', [maidansky, oittinen]],
    ['evald-ilyenkovs-creative-marxism', [maidansky, pavlov]],
    ['ilyenkov-i-moskovskiy-logicheskiy-kruzhok-materialy-polemiki-2024', [maidansky, illesh]],
    ['ascent-toward-the-ideal', [maidansky]],
  ])('aligns display and identity in the real generated article %s', async (id, authors) => {
    const generated = matter(readFileSync(resolveGeneratedArticlePath(id), 'utf8')).data;
    const selected = websiteWorks().find((work) => work.work_id === id);
    const work = readJson(researchRoot, selected.work_json_path);
    expect(work.authors).toEqual(authors);
    expect(generated.author).toEqual(authors.map((author) => author.name_zh));
    expect(generated.author_ids).toEqual(authors.map((author) => author.person_id));
    expect(generated.author.map((name, index) => [name, generated.author_ids[index]]))
      .toEqual(authors.map((author) => [author.name_zh, author.person_id]));
    const document = (await getSiteData()).articles.find((article) => article.id === id);
    expect(document.author).toEqual(generated.author);
    expect(document.authorIds).toEqual(generated.author_ids);
    expect(document.authorLabel).toBe(generated.author.join('、'));
  });

  it('covers every selected article without expanding the current publication boundary', async () => {
    const selected = websiteWorks();
    const generatedIds = generatedArticleIds();
    expect(selected).toHaveLength(25);
    expect(generatedIds).toEqual(selected.map((work) => work.work_id).sort());
    const { articles } = await getSiteData();
    for (const article of articles) {
      expect(article.authorIds, article.id).toHaveLength(article.author.length);
      expect(new Set(article.authorIds).size, article.id).toBe(article.authorIds.length);
      expect(article.authorLabel, article.id).toBe(article.author.join('、'));
    }
    for (const id of ['bankir-1988', 'prezident-chitaet-buharina-1988', 'young-hegel']) {
      expect(generatedIds).not.toContain(id);
    }
    const publicResearcherNames = getPublicResearchers().map((researcher) => researcher.name);
    for (const author of [oittinen, pavlov, illesh]) {
      expect(articles.some((article) => article.authorIds.includes(author.person_id))).toBe(true);
      expect(publicResearcherNames).not.toContain(author.name_zh);
    }
  });
});
