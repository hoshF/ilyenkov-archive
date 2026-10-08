import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plannedArchiveTaxonomy } from '../scripts/lib/archive-taxonomy-sync.mjs';
import { researchRoot } from './helpers/publication';
import { getArchiveTaxonomy, getArchiveVocabulary } from '../src/lib/archive-taxonomy';

const injected = vi.hoisted(() => ({ value: null, missing: false, reads: [] }));
vi.mock('node:fs', async (original) => {
  const actual = await original();
  return { ...actual, readFileSync(file, ...options) {
    injected.reads.push(String(file));
    if (String(file) === path.join(process.cwd(), '.website-input/archive-taxonomy.json')) {
      if (injected.missing) throw new Error('missing generated taxonomy');
      if (injected.value) return JSON.stringify(injected.value);
    }
    return actual.readFileSync(file, ...options);
  } };
});
const roots = []; const projectRoot = process.cwd();
afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  injected.value = null; injected.missing = false; injected.reads = [];
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'archive-taxonomy-contract-')); roots.push(root);
  const sourceRoot = path.join(root, 'private'), publicRoot = path.join(root, 'public');
  const taxonomy = { topics: { topic: { label: 'Synthetic topic' } }, persons: { person: { label: 'Synthetic person' } },
    articles: { 'public-article': { topics: ['topic'], persons: ['person'] } } };
  const manifest = { archive_taxonomy: { publication_scope: 'website_public', editorial_path: 'web/editorial/archive-taxonomy.json' },
    works: [{ work_id: 'public-article', publication_scope: 'website_public' }, { work_id: 'private-article', publication_scope: 'internal_public' }] };
  const write = (relative, value) => {
    const file = path.join(sourceRoot, relative); mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(value));
  };
  const save = () => { write('web/publication.json', manifest); write('web/editorial/archive-taxonomy.json', taxonomy); };
  save();
  const output = path.join(publicRoot, '.website-input/archive-taxonomy.json');
  return { sourceRoot, taxonomy, manifest, save, output,
    plan: (articleIds = ['public-article']) => plannedArchiveTaxonomy({ researchRoot: sourceRoot, articleIds }),
    run(check = false) {
      cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/sync-archive-taxonomy.mjs'), path.join(publicRoot, 'scripts/sync-archive-taxonomy.mjs'));
      mkdirSync(path.join(publicRoot, 'src/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'src/lib/archive-taxonomy-record.mjs'), path.join(publicRoot, 'src/lib/archive-taxonomy-record.mjs'));
      if (!existsSync(path.join(publicRoot, 'node_modules'))) symlinkSync(path.join(projectRoot, 'node_modules'), path.join(publicRoot, 'node_modules'), 'dir');
      mkdirSync(path.join(publicRoot, '.website-input/articles'), { recursive: true });
      writeFileSync(path.join(publicRoot, '.website-input/articles/public-article.md'), 'GENERATED_ARTICLE_BODY_NOT_READ');
      return spawnSync(process.execPath, ['scripts/sync-archive-taxonomy.mjs', ...(check ? ['--check'] : [])], {
        cwd: publicRoot, env: { ...process.env, ILYENKOV_ROOT: sourceRoot }, encoding: 'utf8', timeout: 10000,
      });
    },
  };
}

describe('explicit archive taxonomy publication', () => {
  it('projects current private vocabulary and assignments without duplicating article facts', () => {
    const manifest = JSON.parse(readFileSync(path.join(researchRoot, 'web/publication.json'), 'utf8'));
    const source = JSON.parse(readFileSync(path.join(researchRoot, manifest.archive_taxonomy.editorial_path), 'utf8'));
    const articleIds = readdirSync(path.join(projectRoot, '.website-input/articles')).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3));
    expect(plannedArchiveTaxonomy({ researchRoot, articleIds })).toEqual(source);
    expect(JSON.parse(readFileSync(path.join(projectRoot, '.website-input/archive-taxonomy.json'), 'utf8'))).toEqual(source);
    for (const assignment of Object.values(source.articles)) expect(Object.keys(assignment).sort()).toEqual(['persons', 'topics']);
  });
  it.each(['internal_public', 'unauthorized', 'unselected'])('does not read %s taxonomy', (scope) => {
    const input = fixture();
    if (scope === 'unselected') delete input.manifest.archive_taxonomy;
    else input.manifest.archive_taxonomy = { publication_scope: scope, editorial_path: 'missing/private.json' };
    input.save(); rmSync(path.join(input.sourceRoot, 'web/editorial/archive-taxonomy.json'));
    expect(input.plan()).toBeNull();
  });
  it.each(['private-article', 'unselected-article', 'dangling-article'])('rejects article reference %s without granting publication', (id) => {
    const input = fixture(); const before = structuredClone(input.manifest.works);
    input.taxonomy.articles[id] = { topics: [], persons: [] }; input.save();
    expect(() => input.plan(['public-article', id])).toThrow(/website_public article selection/);
    expect(input.manifest.works).toEqual(before);
  });
  it('requires a generated article and exactly one approved identity', () => {
    const input = fixture(); expect(() => input.plan([])).toThrow(/no generated public article/);
    input.manifest.works.push({ ...input.manifest.works[0] }); input.save();
    expect(() => input.plan()).toThrow(/found 2/);
  });
  it('requires complete assignments without inventing classification for a new article', () => {
    const input = fixture(); expect(() => input.plan(['public-article', 'new-article'])).toThrow(/missing assignment/);
  });
  it.each([
    (input) => { input.taxonomy.articles['public-article'].topics = ['unknown']; },
    (input) => { input.taxonomy.articles['public-article'].persons = ['unknown']; },
    (input) => { input.taxonomy.articles['public-article'].topics = ['topic', 'topic']; },
    (input) => { input.taxonomy.articles['public-article'].title = 'Duplicated article fact'; },
    (input) => { input.taxonomy.topics.topic.label = ''; },
    (input) => { input.manifest.archive_taxonomy.editorial_path = 'people/persons.json'; },
  ])('rejects malformed classifications and unsupported locators', (change) => {
    const input = fixture(); change(input); input.save(); expect(() => input.plan()).toThrow();
  });
  it('rejects missing manuscripts and symlink escapes', () => {
    const input = fixture(); const file = path.join(input.sourceRoot, 'web/editorial/archive-taxonomy.json'); rmSync(file);
    expect(() => input.plan()).toThrow();
    const outside = path.join(input.sourceRoot, 'outside.json'); writeFileSync(outside, JSON.stringify(input.taxonomy)); symlinkSync(outside, file);
    expect(() => input.plan()).toThrow(/escapes/);
  });
  it('updates labels from private and cleans withdrawn taxonomy through the actual CLI', () => {
    const input = fixture(); expect(input.run().status).toBe(0);
    input.taxonomy.topics.topic.label = 'Changed label'; input.save();
    expect(input.run(true).status).toBe(1); expect(input.run().status).toBe(0);
    expect(JSON.parse(readFileSync(input.output, 'utf8')).topics.topic.label).toBe('Changed label');
    delete input.manifest.archive_taxonomy; input.save();
    expect(input.run(true).status).toBe(1); expect(existsSync(input.output)).toBe(true);
    expect(input.run().status).toBe(0); expect(existsSync(input.output)).toBe(false);
    expect(input.run(true).status).toBe(0);
  });
  it('fails closed and clears old taxonomy when an article is withdrawn; check remains read-only', () => {
    const input = fixture(); expect(input.run().status).toBe(0);
    input.manifest.works[0].publication_scope = 'internal_public'; input.save();
    expect(input.run(true).status).toBe(2); expect(existsSync(input.output)).toBe(true);
    const failed = input.run(); expect(failed.status).toBe(2); expect(failed.stderr).toMatch(/website_public/);
    expect(existsSync(input.output)).toBe(false);
  });
  it('renders only generated taxonomy and has no fallback when that input is missing', () => {
    const input = fixture(); injected.value = input.taxonomy;
    expect(getArchiveTaxonomy().get('public-article').topics).toEqual([{ id: 'topic', label: 'Synthetic topic' }]);
    expect(getArchiveVocabulary().persons).toEqual([{ id: 'person', label: 'Synthetic person' }]);
    expect(injected.reads.every((file) => file.includes('/.website-input/'))).toBe(true);
    injected.missing = true; expect(() => getArchiveTaxonomy()).toThrow(/missing generated taxonomy/);
    expect(existsSync(path.join(projectRoot, 'editorial/archive-taxonomy.json'))).toBe(false);
  });
});
