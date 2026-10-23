import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const roots = [];
const image = Buffer.from('Synthetic image bytes');

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-translation-check-'));
  roots.push(root);
  const publicRoot = path.join(root, 'public');
  const privateRoot = path.join(root, 'private');
  const write = (base, relative, content) => {
    const file = path.join(base, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const writeJson = (relative, value) => write(privateRoot, relative, JSON.stringify(value));
  mkdirSync(path.join(publicRoot, 'scripts'), { recursive: true });
  cpSync(path.join(projectRoot, 'scripts/lib'), path.join(publicRoot, 'scripts/lib'), { recursive: true });
  cpSync(path.join(projectRoot, 'scripts/sync-translations.mjs'), path.join(publicRoot, 'scripts/sync-translations.mjs'));
  symlinkSync(path.join(projectRoot, 'node_modules'), path.join(publicRoot, 'node_modules'), 'dir');
  const selection = {
    work_id: 'selected-work', publication_scope: 'website_public',
    work_json_path: 'translation/fixture/selected-work/work.json',
  };
  const work = {
    work_id: selection.work_id, title: 'Synthetic original', title_zh: '虚构译文',
    year: '2000', source_edition: 'Synthetic source',
    authors: [{ person_id: 'person-fixture', name_zh: '虚构作者' }],
  };
  writeJson('web/publication.json', { works: [selection] });
  writeJson('people/persons.json', { records: [{ person_id: 'person-fixture' }] });
  writeJson(selection.work_json_path, work);
  write(privateRoot, 'translation/fixture/selected-work/selected-work.md', '# Synthetic title\n\nSynthetic body.\n\n![Synthetic image](image.png)\n');
  write(privateRoot, 'translation/fixture/selected-work/image.png', image);
  return {
    root, publicRoot, work,
    articles: path.join(publicRoot, '.website-input/articles'),
    assets: path.join(publicRoot, '.website-input/article-assets'),
    writeOutput: (relative, content) => write(publicRoot, `.website-input/${relative}`, content),
    writeWork: (value) => writeJson(selection.work_json_path, value),
    clearSelection: () => writeJson('web/publication.json', { works: [] }),
    run: (checkOnly = true) => spawnSync(process.execPath,
      ['scripts/sync-translations.mjs', ...(checkOnly ? ['--check'] : [])], {
        cwd: publicRoot, env: { ...process.env, ILYENKOV_ROOT: privateRoot },
        encoding: 'utf8', timeout: 10_000,
      }),
  };
}

/** Do not follow dependency symlinks; reads may change access time, so compare write metadata. */
function snapshot(root) {
  const entries = [];
  const visit = (file) => {
    const stat = lstatSync(file, { bigint: true });
    const kind = stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'file';
    entries.push({
      path: path.relative(root, file), kind, mode: stat.mode, inode: stat.ino,
      size: stat.size, mtime: stat.mtimeNs, ctime: stat.ctimeNs,
      ...(kind === 'file' ? { content: readFileSync(file) } : {}),
      ...(kind === 'symlink' ? { target: readlinkSync(file) } : {}),
    });
    if (kind === 'directory') for (const name of readdirSync(file).sort()) visit(path.join(file, name));
  };
  visit(root);
  return entries;
}

function checkWithoutChanges(input, expectedStatus) {
  const before = snapshot(input.root);
  const result = input.run();
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(expectedStatus);
  expect(snapshot(input.root)).toEqual(before);
  return result;
}

describe('translation sync check mode filesystem contract', () => {
  it.each([
    ['no generated root', []],
    ['only the generated root', ['.website-input']],
    ['only the article directory', ['.website-input/articles']],
    ['only the image directory', ['.website-input/article-assets']],
  ])('reports missing outputs without creating anything: %s', (_label, directories) => {
    const input = fixture();
    for (const relative of directories) mkdirSync(path.join(input.publicRoot, relative), { recursive: true });
    const result = checkWithoutChanges(input, 1);
    expect(result.stderr).toMatch(/selected-work\.md:.*missing or out of date/);
    expect(result.stderr).toMatch(/selected-work\/image\.png:.*missing or out of date/);
    expect(result.stderr).not.toMatch(/sync error:/);
  });

  it('returns success for matching existing outputs without rewriting them', () => {
    const input = fixture();
    const written = input.run(false);
    expect(written.status, written.stderr).toBe(0);
    const result = checkWithoutChanges(input, 0);
    expect(result.stderr).toBe('');
  });

  it('reports changed article and image contents without replacing them', () => {
    const input = fixture();
    expect(input.run(false).status).toBe(0);
    input.writeOutput('articles/selected-work.md', 'Outdated article');
    input.writeOutput('article-assets/selected-work/image.png', 'Outdated image');
    const result = checkWithoutChanges(input, 1);
    expect(result.stderr).toMatch(/selected-work\.md:.*out of date/);
    expect(result.stderr).toMatch(/selected-work\/image\.png:.*out of date/);
  });

  it('reports withdrawn articles, images and image directories without removing them', () => {
    const input = fixture();
    expect(input.run(false).status).toBe(0);
    input.writeOutput('articles/withdrawn-work.md', 'Withdrawn article');
    input.writeOutput('article-assets/selected-work/unused.png', 'Unreferenced image');
    input.writeOutput('article-assets/withdrawn-work/image.png', 'Withdrawn image');
    const result = checkWithoutChanges(input, 1);
    expect(result.stderr).toMatch(/withdrawn-work\.md:.*no longer listed/);
    expect(result.stderr).toMatch(/selected-work\/unused\.png:.*no longer referenced/);
    expect(result.stderr).toMatch(/withdrawn-work\/:.*no longer listed/);
    const written = input.run(false);
    expect(written.status, written.stderr).toBe(0);
    expect(existsSync(path.join(input.articles, 'withdrawn-work.md'))).toBe(false);
    expect(existsSync(path.join(input.assets, 'selected-work/unused.png'))).toBe(false);
    expect(existsSync(path.join(input.assets, 'withdrawn-work'))).toBe(false);
  });

  it('creates the necessary directories and outputs in normal write mode', () => {
    const input = fixture();
    expect(existsSync(path.join(input.publicRoot, '.website-input'))).toBe(false);
    const result = input.run(false);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(path.join(input.articles, 'selected-work.md'), 'utf8')).toContain('Synthetic body.');
    expect(readFileSync(path.join(input.assets, 'selected-work/image.png'))).toEqual(image);
    checkWithoutChanges(input, 0);
  });

  it('returns success for an empty selection without creating empty output directories', () => {
    const input = fixture();
    input.clearSelection();
    checkWithoutChanges(input, 0);
    expect(existsSync(path.join(input.publicRoot, '.website-input'))).toBe(false);
    const written = input.run(false);
    expect(written.status, written.stderr).toBe(0);
    expect(readdirSync(input.articles)).toEqual([]);
    expect(readdirSync(input.assets)).toEqual([]);
  });

  it('preserves outputs and reports a validation failure separately from stale data', () => {
    const input = fixture();
    expect(input.run(false).status).toBe(0);
    input.writeWork({ ...input.work, year: 'invalid' });
    const result = checkWithoutChanges(input, 2);
    expect(result.stderr).toMatch(/Translation sync error:.*year/);
  });
});
