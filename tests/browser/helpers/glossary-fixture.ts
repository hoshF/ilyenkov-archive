import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const projectRoot = process.cwd();

/** Build the unchanged production page with fictional inputs in a temporary project. */
export async function buildGlossaryFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'ilyenkov-glossary-browser-'));
  const cleanup = () => rm(root, { recursive: true, force: true });
  try {
    const files = [
      'src/pages/glossary/index.astro', 'src/layouts/BaseLayout.astro',
      'src/components/SectionLayout.astro', 'src/styles/global.css',
      'src/lib/glossary.ts', 'src/lib/glossary-query.ts', 'src/lib/glossary-record.mjs',
      'src/lib/cache.ts', 'src/lib/editorial.ts',
      'public/favicon.svg', 'public/favicon.ico', 'public/brand',
    ];
    for (const file of files) {
      const target = path.join(root, file);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(projectRoot, file), target, { recursive: true });
    }
    await symlink(path.join(projectRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    const json = async (relative: string, value: unknown) => {
      const file = path.join(root, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(value));
    };
    const entry = (collection: string, id: string, zh_preferred: string, type?: string) => ({
      collection, id, zh_preferred, canonical: `Synthetic ${id}`, forms: [], zh_alternatives: [], notes: '',
      ...(type ? { type } : {}),
    });
    await json('.website-input/glossary.json', [
      entry('fixture-alpha', 'shared', '测试思维'),
      entry('fixture-alpha', 'action', '测试行动'),
      entry('fixture-beta', 'shared', '测试思维'),
      entry('terms', 'shared', '测试思维'),
      entry('glossary', 'person', '测试人物', 'person'),
      entry('glossary', 'work', '测试著作', 'work'),
    ]);
    await json('editorial/site.json', {
      name: 'Synthetic glossary site', subtitleRu: 'Тестовый сайт', description: 'Synthetic description.',
      group: { name: 'Synthetic group', originalName: 'Synthetic original', englishName: 'Synthetic English', summary: 'Synthetic summary.' },
      contact: { email: 'fixture@example.test' }, forumUrl: 'https://forum.example.test/',
      navigation: [{ label: '术语库', href: '/glossary/' }], footer: [{ label: '术语库', href: '/glossary/' }],
    });
    await json('package.json', { type: 'module' });
    await writeFile(path.join(root, 'astro.config.mjs'), "export default { site: 'https://example.test/', output: 'static', trailingSlash: 'always' };\n");
    await exec(process.execPath, [path.join(projectRoot, 'node_modules/astro/bin/astro.mjs'), 'build'], {
      cwd: root, timeout: 30_000,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ILYENKOV_ROOT: path.join(root, 'no-private-repository') },
    });
    return { directory: path.join(root, 'dist'), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
