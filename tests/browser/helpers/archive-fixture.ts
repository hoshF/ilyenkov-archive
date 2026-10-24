import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { patchPagefindRuntime } from '../../../scripts/patch-pagefind-runtime.mjs';

const exec = promisify(execFile);

/** Build the real search component and a real Pagefind index, with fictional articles only. */
export async function buildArchiveFixture() {
  const project = process.cwd();
  const root = await mkdtemp(path.join(tmpdir(), 'ilyenkov-archive-browser-'));
  const cleanup = () => rm(root, { recursive: true, force: true });
  const write = async (relative: string, text: string) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  };
  try {
    await mkdir(path.join(root, 'src/components'), { recursive: true });
    await cp(path.join(project, 'src/components/ArchiveSearch.astro'), path.join(root, 'src/components/ArchiveSearch.astro'));
    await write('src/pages/archive/index.astro', `---
import ArchiveSearch from '../../components/ArchiveSearch.astro';
---
<html lang="en"><head><meta charset="utf-8" /><title>Fictional archive</title></head>
<body><ArchiveSearch /><ul data-archive-list><li><a href="/archive/alpha-1/">Fictional catalogue article</a></li></ul></body></html>
`);
    for (const [query, count] of [['alpha', 12], ['beta', 2]] as const) {
      for (let i = 1; i <= count; i++) {
        await write(`public/archive/${query}-${i}/index.html`, `<!doctype html><html lang="en"><head><title>Fictional ${query} ${i}</title></head><body><main data-pagefind-body><h1 data-pagefind-meta="title">Fictional ${query} ${i}</h1><p>${query} synthetic archive content ${i}.</p><span data-pagefind-filter="topic">fictional</span></main></body></html>`);
      }
    }
    await symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    await write('package.json', '{"type":"module"}');
    await write('astro.config.mjs', "export default { site: 'https://example.test/', output: 'static', trailingSlash: 'always' };\n");
    const options = {
      cwd: root, timeout: 30_000,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ILYENKOV_ROOT: path.join(root, 'no-private-repository') },
    };
    await exec(process.execPath, [path.join(project, 'node_modules/astro/bin/astro.mjs'), 'build'], options);
    await exec(process.execPath, [path.join(project, 'node_modules/pagefind/lib/runner/bin.cjs'), '--site', 'dist', '--glob', 'archive/*/index.html'], options);
    await patchPagefindRuntime(path.join(root, 'dist/pagefind'));
    return { directory: path.join(root, 'dist'), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
