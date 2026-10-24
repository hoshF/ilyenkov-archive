import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION = '1.5.2';
const STAGING_PREFIX = '.ilyenkov-pagefind-patch-';
const FILES = [
  { name: 'pagefind.js', options: 'options2',
    original: '252d272bd34d483d19a752060f6a065114d15ab12c42d8f905ca565e2768a009',
    patched: 'a50bf2d5addc649a50dbcef8593c41b157becd13042c1367263c5caa5ca87df6' },
  { name: 'pagefind-worker.js', options: 'options',
    original: '4ca50d25bcab9e1c3afbc00ab5f7761114e83c8fc1b83d38655af1558b650c2a',
    patched: '9c01e0f6e94a56c4e42e1050c16f1346a84735c24cfaf27588d401d189043dc3' },
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function replacements(options) {
  return [
    // The public search still rejects via initError; only the background promise is handled.
    [`this.init(${options}?.language);`, `this.init(${options}?.language).catch(error=>{this.primary.initError??=error;});`],
    ['catch(e){console.error(`Failed to load the index chunk ${url}:\n${e?.toString()}`);}}async loadChunk(hash)',
      'catch(e){console.error(`Failed to load the index chunk ${url}:\n${e?.toString()}`);throw e;}}async loadChunk(hash)'],
    // Handle speculative preloading only; public preload/search still see the cached rejection.
    [`this.preload(term,${options});`, `this.preload(term,${options}).catch(()=>{});`],
  ];
}

async function assertNoPendingPatch(directory) {
  if ((await readdir(directory)).some(name => name.startsWith(STAGING_PREFIX))) {
    throw new Error('Incomplete Pagefind patch transaction; regenerate with npm run search:index');
  }
}

async function readPair(directory) {
  const installed = JSON.parse(await readFile(new URL('../node_modules/pagefind/package.json', import.meta.url), 'utf8'));
  const entry = JSON.parse(await readFile(path.join(directory, 'pagefind-entry.json'), 'utf8'));
  if (installed.version !== VERSION || entry.version !== VERSION) {
    throw new Error(`Unsupported Pagefind version: package=${installed.version}, index=${entry.version}; expected ${VERSION}`);
  }
  const pair = await Promise.all(FILES.map(async file => {
    const target = path.join(directory, file.name);
    const bytes = await readFile(target);
    const source = bytes.toString('utf8');
    if (!source.startsWith(`const pagefind_version="${VERSION}";`)) {
      throw new Error(`Unsupported Pagefind runtime version: ${file.name}`);
    }
    const hash = sha256(bytes);
    const state = hash === file.original ? 'original' : hash === file.patched ? 'patched' : 'unknown';
    if (state === 'unknown') throw new Error(`Unknown Pagefind ${VERSION} bytes: ${file.name} (${hash})`);
    let output = source;
    for (const [before, after] of replacements(file.options)) {
      const from = state === 'original' ? before : after;
      const absent = state === 'original' ? after : before;
      if (output.split(from).length !== 2 || output.includes(absent)) {
        throw new Error(`Ambiguous Pagefind patch point: ${file.name}`);
      }
      if (state === 'original') output = output.replace(before, after);
    }
    if (sha256(output) !== file.patched) throw new Error(`Unexpected patched hash: ${file.name}`);
    return { ...file, target, state, output };
  }));
  if (pair[0].state !== pair[1].state) throw new Error('Partially patched Pagefind runtime pair; regenerate with npm run search:index');
  return pair;
}

/** Verify the exact deployed runtime pair without changing files. @param {string} directory */
export async function verifyPatchedPagefindRuntime(directory) {
  await assertNoPendingPatch(directory);
  const pair = await readPair(directory);
  if (pair[0].state !== 'patched') throw new Error('Pagefind runtimes are not patched');
  return pair.map(file => ({ name: file.name, sha256: file.patched }));
}

/** Patch only the two fixed browser runtimes. @param {string} directory */
export async function patchPagefindRuntime(directory) {
  await assertNoPendingPatch(directory);
  const pair = await readPair(directory);
  if (pair[0].state === 'patched') return { changed: 0, files: await verifyPatchedPagefindRuntime(directory) };

  const staging = await mkdtemp(path.join(directory, STAGING_PREFIX));
  const moved = [];
  try {
    for (const file of pair) {
      await writeFile(path.join(staging, file.name), file.output, { flag: 'wx' });
      if (sha256(await readFile(path.join(staging, file.name))) !== file.patched) {
        throw new Error(`Staged Pagefind hash mismatch: ${file.name}`);
      }
    }
    // Remove both original paths before publishing either replacement: an interrupted pair is invalid.
    for (const file of pair) {
      await rename(file.target, path.join(staging, `original-${file.name}`));
      moved.push(file);
    }
    for (const file of pair) await rename(path.join(staging, file.name), file.target);
    for (const file of pair) {
      if (sha256(await readFile(file.target)) !== file.patched) throw new Error(`Written Pagefind hash mismatch: ${file.name}`);
    }
  } catch (error) {
    const failures = [];
    for (const file of moved.toReversed()) {
      try { await rename(path.join(staging, `original-${file.name}`), file.target); }
      catch (rollbackError) { failures.push(rollbackError); }
    }
    if (failures.length) {
      // Leave the staging fence and invalidate final paths if rollback cannot restore the pair.
      const removed = await Promise.allSettled(pair.map(file => rm(file.target, { force: true })));
      for (const result of removed) if (result.status === 'rejected') failures.push(result.reason);
    } else {
      try { await rm(staging, { recursive: true }); }
      catch (cleanupError) { failures.push(cleanupError); }
    }
    throw new AggregateError([error, ...failures], 'Pagefind runtime patch failed; output is not deployable; regenerate with npm run search:index');
  }
  // Keep the fence if cleanup fails: --check rejects unfinished transactions even with valid JS.
  await rm(staging, { recursive: true });
  return { changed: 2, files: await verifyPatchedPagefindRuntime(directory) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/patch-pagefind-runtime.mjs [--check]');
    const directory = path.resolve('dist/pagefind');
    const files = args[0] === '--check'
      ? await verifyPatchedPagefindRuntime(directory)
      : (await patchPagefindRuntime(directory)).files;
    console.info(`Pagefind ${VERSION} runtime patch verified`);
    for (const file of files) console.info(`${file.sha256}  ${file.name}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
