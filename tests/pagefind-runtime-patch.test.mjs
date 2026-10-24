import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { patchPagefindRuntime, verifyPatchedPagefindRuntime } from '../scripts/patch-pagefind-runtime.mjs';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, rename: vi.fn(actual.rename), writeFile: vi.fn(actual.writeFile) };
});
const actual = await vi.importActual('node:fs/promises');
const exec = promisify(execFile);
const project = process.cwd();
const command = path.join(project, 'scripts/patch-pagefind-runtime.mjs');
const filenames = ['pagefind.js', 'pagefind-worker.js'];
const hashes = [
  'a50bf2d5addc649a50dbcef8593c41b157becd13042c1367263c5caa5ca87df6',
  '9c01e0f6e94a56c4e42e1050c16f1346a84735c24cfaf27588d401d189043dc3',
];
let seed;
let root;
let directory;

async function digest(directory) {
  const files = {};
  async function visit(relative) {
    for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else files[name] = createHash('sha256').update(await fs.readFile(path.join(directory, name))).digest('hex');
    }
  }
  await visit('');
  return files;
}

beforeAll(async () => {
  seed = await fs.mkdtemp(path.join(tmpdir(), 'pagefind-patch-seed-'));
  await fs.mkdir(path.join(seed, 'archive/fiction'), { recursive: true });
  await fs.writeFile(path.join(seed, 'archive/fiction/index.html'), '<html lang="en"><body data-pagefind-body><h1>Fictional alpha</h1><p>alpha synthetic content</p></body></html>');
  await exec(process.execPath, [path.join(project, 'node_modules/pagefind/lib/runner/bin.cjs'), '--site', seed, '--glob', 'archive/*/index.html']);
}, 30_000);
afterAll(async () => { await fs.rm(seed, { recursive: true, force: true }); });
beforeEach(async () => {
  vi.mocked(fs.rename).mockImplementation(actual.rename);
  vi.mocked(fs.writeFile).mockImplementation(actual.writeFile);
  root = await fs.mkdtemp(path.join(tmpdir(), 'pagefind-patch-contract-'));
  directory = path.join(root, 'dist/pagefind');
  await fs.cp(path.join(seed, 'pagefind'), directory, { recursive: true });
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

test('patches both real generated runtimes and preserves every other artifact', async () => {
  const before = await digest(directory);
  expect((await patchPagefindRuntime(directory)).changed).toBe(2);
  const after = await digest(directory);
  expect(Object.keys(after).filter(name => after[name] !== before[name]).sort()).toEqual([...filenames].sort());
  expect(await verifyPatchedPagefindRuntime(directory)).toEqual(filenames.map((name, i) => ({ name, sha256: hashes[i] })));
});

test('repeated execution and the read-only CLI check preserve bytes and modification times', async () => {
  await patchPagefindRuntime(directory);
  const before = await digest(directory);
  const times = await Promise.all(filenames.map(name => fs.stat(path.join(directory, name))));
  expect((await patchPagefindRuntime(directory)).changed).toBe(0);
  await exec(process.execPath, [command, '--check'], { cwd: root });
  expect(await digest(directory)).toEqual(before);
  expect((await Promise.all(filenames.map(name => fs.stat(path.join(directory, name))))).map(s => s.mtimeMs)).toEqual(times.map(s => s.mtimeMs));
});

test('rejects an unknown index version without modifying any files', async () => {
  const entry = path.join(directory, 'pagefind-entry.json');
  const data = JSON.parse(await fs.readFile(entry, 'utf8'));
  await fs.writeFile(entry, JSON.stringify({ ...data, version: '2.0.0' }));
  const before = await digest(directory);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Unsupported Pagefind version/);
  expect(await digest(directory)).toEqual(before);
});

test('rejects an unknown runtime version before writing either file', async () => {
  const file = path.join(directory, filenames[1]);
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('pagefind_version="1.5.2"', 'pagefind_version="2.0.0"'));
  const before = await digest(directory);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Unsupported Pagefind runtime version/);
  expect(await digest(directory)).toEqual(before);
});

test('rejects unknown bytes in one file without partially modifying the other', async () => {
  await fs.appendFile(path.join(directory, filenames[1]), '\n');
  const before = await digest(directory);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Unknown Pagefind/);
  expect(await digest(directory)).toEqual(before);
});

test('rejects duplicated modification points as unknown runtime bytes', async () => {
  await fs.appendFile(path.join(directory, filenames[0]), 'this.init(options2?.language);');
  const before = await digest(directory);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Unknown Pagefind/);
  expect(await digest(directory)).toEqual(before);
});

test('rejects a mixed original and patched runtime pair', async () => {
  await patchPagefindRuntime(directory);
  await fs.copyFile(path.join(seed, 'pagefind', filenames[1]), path.join(directory, filenames[1]));
  const before = await digest(directory);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Partially patched/);
  await expect(verifyPatchedPagefindRuntime(directory)).rejects.toThrow(/Partially patched/);
  expect(await digest(directory)).toEqual(before);
});

test('rejects an individually partial patch', async () => {
  const file = path.join(directory, filenames[0]);
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('this.init(options2?.language);', 'this.init(options2?.language).catch(error=>{this.primary.initError??=error;});'));
  const before = await digest(directory);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Unknown Pagefind/);
  expect(await digest(directory)).toEqual(before);
});

test('a staging write failure leaves the original pair unchanged and unverifiable', async () => {
  const before = await digest(directory);
  vi.mocked(fs.writeFile).mockImplementation(async (file, ...args) => {
    if (String(file).includes('.ilyenkov-pagefind-patch-') && path.basename(String(file)) === filenames[1]) throw new Error('Injected staging EIO');
    return actual.writeFile(file, ...args);
  });
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/not deployable/);
  expect(await digest(directory)).toEqual(before);
  await expect(verifyPatchedPagefindRuntime(directory)).rejects.toThrow(/not patched/);
});

test('a publication rename failure rolls both files back', async () => {
  const before = await digest(directory);
  vi.mocked(fs.rename).mockImplementation(async (from, to) => {
    if (String(from).includes('.ilyenkov-pagefind-patch-') && path.basename(String(from)) === filenames[1]) throw new Error('Injected publication EIO');
    return actual.rename(from, to);
  });
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/not deployable/);
  expect(await digest(directory)).toEqual(before);
  await expect(verifyPatchedPagefindRuntime(directory)).rejects.toThrow(/not patched/);
});

test('failed rollback invalidates runtime paths and leaves a fence that rejects future checks', async () => {
  vi.mocked(fs.rename).mockImplementation(async (from, to) => {
    if (String(from).includes('.ilyenkov-pagefind-patch-') && String(from).endsWith('pagefind-worker.js')) throw new Error('Injected publication and rollback EIO');
    return actual.rename(from, to);
  });
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/not deployable/);
  for (const name of filenames) await expect(fs.access(path.join(directory, name))).rejects.toThrow();
  await expect(verifyPatchedPagefindRuntime(directory)).rejects.toThrow(/Incomplete/);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Incomplete/);
  await expect(exec(process.execPath, [command, '--check'], { cwd: root })).rejects.toMatchObject({ code: 1 });
});

test('a pending transaction is rejected even if both final hashes are valid', async () => {
  await patchPagefindRuntime(directory);
  await fs.mkdir(path.join(directory, '.ilyenkov-pagefind-patch-interrupted'));
  await expect(verifyPatchedPagefindRuntime(directory)).rejects.toThrow(/Incomplete/);
  await expect(patchPagefindRuntime(directory)).rejects.toThrow(/Incomplete/);
});

test('the CLI rejects another installed package version without changing the generated pair', async () => {
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.copyFile(command, path.join(root, 'scripts/patch-pagefind-runtime.mjs'));
  await fs.mkdir(path.join(root, 'node_modules/pagefind'), { recursive: true });
  await fs.writeFile(path.join(root, 'node_modules/pagefind/package.json'), JSON.stringify({ version: '2.0.0' }));
  const before = await digest(directory);
  await expect(exec(process.execPath, ['scripts/patch-pagefind-runtime.mjs'], { cwd: root })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('Unsupported Pagefind version') });
  expect(await digest(directory)).toEqual(before);
});
