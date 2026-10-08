import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plannedBooks } from '../scripts/lib/book-sync.mjs';
import { BookSchema, GeneratedBooksSchema } from '../src/lib/book-record.mjs';
import { getBooks } from '../src/lib/books';
import { builtRoutePath } from './helpers/pages';
import { researchRoot } from './helpers/publication';

const injected = vi.hoisted(() => ({ records: null, missing: false, reads: [], file: `${process.cwd()}/.website-input/books.json` }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, readFileSync(file, ...options) {
    injected.reads.push(String(file));
    if (String(file) === injected.file) {
      if (injected.missing) throw new Error('missing generated book input');
      if (injected.records) return JSON.stringify(injected.records);
    }
    return actual.readFileSync(file, ...options);
  } };
});
const projectRoot = process.cwd();
const roots = [];
afterEach(() => {
  injected.records = null; injected.missing = false; injected.reads = [];
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
const manuscript = (title = 'Synthetic book') => `---\ntitle: ${title}\nauthor: Synthetic author\noriginal_year: '2000'\ncategory: translation\neditions:\n  - version: synthetic-build\n    date: 2020-01-02\n    note: Synthetic edition note.\n---\n\nSynthetic **introduction**.\n`;
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-books-contract-')); roots.push(root);
  const sourceRoot = path.join(root, 'private'); const publicRoot = path.join(root, 'public');
  const write = (relative, data) => {
    const target = path.join(sourceRoot, relative); mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
  };
  const manifest = { books: [{ book_id: 'sample-book', publication_scope: 'website_public', editorial_path: 'web/editorial/books/sample-book.md' }],
    works: [{ work_id: 'private-body', publication_scope: 'internal_public', work_json_path: 'private/body/work.json' }] };
  write('web/publication.json', manifest); write('web/editorial/books/sample-book.md', manuscript());
  write('private/body/private-body.md', 'PRIVATE_BODY_SENTINEL');
  return { root, sourceRoot, manifest, write,
    plan: () => plannedBooks({ researchRoot: sourceRoot }),
    save: () => write('web/publication.json', manifest),
    generated: () => JSON.parse(readFileSync(path.join(publicRoot, '.website-input/books.json'), 'utf8')),
    run(checkOnly = false) {
      mkdirSync(path.join(publicRoot, 'scripts'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'scripts/sync-books.mjs'), path.join(publicRoot, 'scripts/sync-books.mjs'));
      mkdirSync(path.join(publicRoot, 'src/lib'), { recursive: true });
      cpSync(path.join(projectRoot, 'src/lib/book-record.mjs'), path.join(publicRoot, 'src/lib/book-record.mjs'));
      if (!existsSync(path.join(publicRoot, 'node_modules'))) symlinkSync(path.join(projectRoot, 'node_modules'), path.join(publicRoot, 'node_modules'), 'dir');
      return spawnSync(process.execPath, ['scripts/sync-books.mjs', ...(checkOnly ? ['--check'] : [])], {
        cwd: publicRoot, env: { ...process.env, ILYENKOV_ROOT: sourceRoot }, encoding: 'utf8', timeout: 10_000,
      });
    },
  };
}

describe('explicit website book publication', () => {
  it('projects the current selected metadata and Markdown without editing their meaning', () => {
    const publication = JSON.parse(readFileSync(path.join(researchRoot, 'web/publication.json'), 'utf8'));
    const records = plannedBooks({ researchRoot });
    const selections = publication.books.filter((entry) => entry.publication_scope === 'website_public');
    expect(records).toEqual(selections.map((entry) => {
      const source = matter(readFileSync(path.join(researchRoot, entry.editorial_path), 'utf8'));
      return { id: entry.book_id, ...BookSchema.parse(source.data), introduction: source.content.trim() };
    }));
    expect(GeneratedBooksSchema.safeParse(records).success).toBe(true);
    expect(JSON.stringify(records)).not.toMatch(/editorial_path|work_json_path|publication_scope/);
  });

  it.each(['internal_public', 'unauthorized', 'unselected'])('does not read %s editorial or derive approval from an internal work', (scope) => {
    const input = fixture(); const before = input.plan();
    if (scope !== 'unselected') input.manifest.books.push({ book_id: 'private-book', publication_scope: scope, editorial_path: 'private/missing.md' });
    input.write('web/editorial/books/private-book.md', 'INVALID_UNSELECTED_SENTINEL'); input.save();
    expect(input.plan()).toEqual(before);
    expect(JSON.stringify(input.plan())).not.toMatch(/PRIVATE_BODY_SENTINEL|UNSELECTED_SENTINEL/);
    expect(input.manifest.works[0].publication_scope).toBe('internal_public');
  });

  it('does not read full text or other files mentioned by a selected introduction', () => {
    const input = fixture(); input.write('web/editorial/books/sample-book.md', `${manuscript()}\n{{work:private-body}}\n`);
    expect(input.plan()[0].introduction).toContain('{{work:private-body}}');
    expect(JSON.stringify(input.plan())).not.toContain('PRIVATE_BODY_SENTINEL');
    expect(input.plan()[0]).not.toHaveProperty('download');
  });

  it.each(['', null, '../private.md', 'people/persons.json', 'web/editorial/books/other-book.md'])('rejects invalid editorial locator %j', (editorialPath) => {
    const input = fixture(); input.manifest.books[0].editorial_path = editorialPath; input.save();
    expect(() => input.plan()).toThrow();
  });
  it('rejects a missing selected file instead of loading an old public editorial', () => {
    const input = fixture(); rmSync(path.join(input.sourceRoot, 'web/editorial/books/sample-book.md'));
    input.write('editorial/books/sample-book.md', manuscript()); expect(() => input.plan()).toThrow(/missing/);
  });
  it('rejects symlink escapes even when the selected locator has the expected name', () => {
    const input = fixture(); input.write('private/outside.md', manuscript());
    const target = path.join(input.sourceRoot, 'web/editorial/books/sample-book.md'); rmSync(target);
    symlinkSync(path.join(input.sourceRoot, 'private/outside.md'), target);
    expect(() => input.plan()).toThrow(/escapes/);
  });
  it.each([
    (input) => { input.manifest.books.push({ ...input.manifest.books[0] }); },
    (input) => { input.manifest.books[0].book_id = '../private'; },
    (input) => { input.manifest.books[0].work_json_path = 'private/body/work.json'; },
    (input) => { input.manifest.books = {}; },
    (input) => { delete input.manifest.books; },
  ])('rejects malformed or duplicate selected entries', (change) => {
    const input = fixture(); change(input); input.save(); expect(() => input.plan()).toThrow();
  });
  it.each([
    (text) => text.replace('title: Synthetic book', 'title: ""'),
    (text) => text.replace('category: translation', 'category: private'),
    (text) => text.replace('category: translation', 'category: translation\nsource_path: private/file'),
    (text) => text.slice(0, text.lastIndexOf('---') + 3),
  ])('rejects malformed metadata and missing introductions', (change) => {
    const input = fixture(); input.write('web/editorial/books/sample-book.md', change(manuscript()));
    expect(() => input.plan()).toThrow();
  });
  it('updates and cleans withdrawn records through the actual CLI, including the empty selection', () => {
    const input = fixture(); expect(input.run().status).toBe(0);
    input.write('web/editorial/books/sample-book.md', manuscript('Changed public title'));
    expect(input.run(true).status).toBe(1); expect(input.run().status).toBe(0);
    expect(input.generated()[0].title).toBe('Changed public title');
    input.manifest.books = []; input.save();
    expect(input.run(true).status).toBe(1); expect(input.run().status).toBe(0);
    expect(input.generated()).toEqual([]);
    const checked = input.run(true); expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout).toContain('written=0 stale=0');
    expect(existsSync(path.join(input.root, 'public/.website-input/articles'))).toBe(false);
  });
});

describe('generated book renderer boundary', () => {
  it('consumes generated values and retains public ordering, edition formatting and Markdown rendering', async () => {
    const first = fixture().plan()[0];
    injected.records = [{ ...first, id: 'z-book' }, { ...first, id: 'a-book', title: 'Changed generated title',
      editions: [{ version: 'later', date: '2022-01-01' }, { version: 'earlier', date: '2020-01-01' }] }];
    const books = await getBooks();
    expect(books.map((book) => book.id)).toEqual(['a-book', 'z-book']);
    expect(books[0].title).toBe('Changed generated title');
    expect(books[0].latestEdition.version).toBe('later');
    expect(books[0].introductionHtml).toContain('<strong>introduction</strong>');
    expect(injected.reads).toContain(injected.file);
  });
  it('requires generated input without an editorial fallback and allows no selected books', async () => {
    injected.missing = true; expect(() => getBooks()).toThrow(/missing generated/);
    expect(injected.reads).toEqual([injected.file]);
    injected.missing = false; injected.records = []; expect(await getBooks()).toEqual([]);
  });
  it('renders every selected current book in the static detail page', async () => {
    for (const book of await getBooks()) {
      const html = readFileSync(builtRoutePath(book.route), 'utf8');
      expect(html).toContain(book.title);
      expect(html).toContain(book.introductionHtml);
      expect(html).toContain(book.latestEdition.version);
      // 封面属于第三方素材，书籍选择不授权复制或发布封面。
      expect(html).not.toContain('/covers/');
      if (!book.download) expect(html).toContain('本站不提供下载。');
    }
  });
});
