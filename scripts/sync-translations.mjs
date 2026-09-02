import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchRoot = path.resolve(
  process.env.ILYENKOV_ROOT?.trim() || path.join(projectRoot, '..', 'Ilyenkov'),
);
const publicationRelative = 'translation/publication.json';
const publicationPath = path.join(researchRoot, publicationRelative);
const postsRoot = path.join(projectRoot, '.website-input', 'posts');
const websiteScope = 'website_public';
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const rightsStatuses = new Set(['author_permission', 'license_permits']);

function fail(message) {
  throw new Error(`Translation sync error: ${message}`);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function requiredString(record, key, label) {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: missing ${key}`);
  if (/\r|\n/.test(value)) fail(`${label}: ${key} must be one line`);
  return value.trim();
}

function optionalString(record, key, label) {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: ${key} must be a non-empty string`);
  if (/\r|\n/.test(value)) fail(`${label}: ${key} must be one line`);
  return value.trim();
}

function resolveResearchPath(relative, label) {
  if (path.isAbsolute(relative) || relative.includes('\0')) fail(`${label} must be relative`);
  const resolved = path.resolve(researchRoot, relative);
  if (!resolved.startsWith(`${researchRoot}${path.sep}`)) fail(`${label} escapes Ilyenkov`);
  return resolved;
}

function readJson(file, label) {
  if (!existsSync(file)) fail(`missing ${label}`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
}

function dropLeadingTitle(body, title) {
  const lines = body.split(/\r?\n/);
  if (lines[0]?.trim() === `# ${title}` || lines[0]?.trim() === `#${title}`) lines.shift();
  return lines.join('\n').replace(/^\n+/, '');
}

function gitOutput(arguments_) {
  try {
    return execFileSync('git', ['-C', researchRoot, ...arguments_], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function upstreamRevision(paths) {
  const revision = gitOutput(['log', '-1', '--format=%H', '--', ...paths]);
  if (!revision) return null;
  const dirty = gitOutput(['status', '--porcelain', '--', ...paths]);
  return `${revision.slice(0, 12)}${dirty ? '-dirty' : ''}`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function renderPost(work, body, textRelative, revision) {
  const lines = [
    '---',
    `title: ${yamlString(work.title)}`,
    `title_zh: ${yamlString(work.title_zh)}`,
    `source_edition: ${yamlString(work.source_edition)}`,
  ];
  if (work.source_url) lines.push(`source_url: ${yamlString(work.source_url)}`);
  if (work.doi) lines.push(`doi: ${yamlString(work.doi)}`);
  lines.push(
    `rights_status: ${yamlString(work.rights_status)}`,
    'type: translation',
    `generated_from: ${yamlString(`Ilyenkov:${textRelative}`)}`,
  );
  if (revision) lines.push(`generated_rev: ${yamlString(revision)}`);
  lines.push('---', '', body, '');
  return lines.join('\n');
}

function publicationWorks() {
  if (researchRoot === projectRoot) fail('Ilyenkov source cannot be the public repository');
  const publication = object(readJson(publicationPath, publicationRelative), publicationRelative);
  if (!Array.isArray(publication.works)) fail(`${publicationRelative}: works must be an array`);

  const selected = [];
  const seen = new Set();
  for (const [index, rawEntry] of publication.works.entries()) {
    const label = `${publicationRelative} works[${index}]`;
    const entry = object(rawEntry, label);
    if (entry.publication_scope !== websiteScope) continue;
    const workId = requiredString(entry, 'work_id', label);
    const workJsonRelative = requiredString(entry, 'work_json_path', label);
    if (!idPattern.test(workId)) fail(`${label}: invalid work_id`);
    if (seen.has(workId)) fail(`${publicationRelative}: duplicate website work_id ${workId}`);
    seen.add(workId);
    selected.push({ workId, workJsonRelative });
  }
  return selected;
}

function plannedPosts() {
  return new Map(publicationWorks().map(({ workId, workJsonRelative }) => {
    const workPath = resolveResearchPath(workJsonRelative, `${workId} work_json_path`);
    const textRelative = path.posix.join(path.posix.dirname(workJsonRelative), `${workId}.md`);
    const textPath = resolveResearchPath(textRelative, `${workId} Markdown path`);
    const work = object(readJson(workPath, workJsonRelative), workJsonRelative);
    if (work.work_id !== workId) fail(`${workJsonRelative}: work_id must be ${workId}`);

    const metadata = {
      title: requiredString(work, 'title', workJsonRelative),
      title_zh: requiredString(work, 'title_zh', workJsonRelative),
      source_edition: requiredString(work, 'source_edition', workJsonRelative),
      source_url: optionalString(work, 'source_url', workJsonRelative),
      doi: optionalString(work, 'doi', workJsonRelative),
      rights_status: requiredString(work, 'rights_status', workJsonRelative),
    };
    if (!rightsStatuses.has(metadata.rights_status)) fail(`${workJsonRelative}: unsupported rights_status`);
    if (!existsSync(textPath)) fail(`missing ${textRelative}`);

    const body = dropLeadingTitle(
      stripFrontmatter(readFileSync(textPath, 'utf8')),
      metadata.title_zh,
    );
    if (!body) fail(`${textRelative}: Markdown body is empty`);
    const revision = upstreamRevision([publicationRelative, workJsonRelative, textRelative]);
    return [`${workId}.md`, renderPost(metadata, body, textRelative, revision)];
  }));
}

function sync({ checkOnly = false } = {}) {
  const planned = plannedPosts();
  mkdirSync(postsRoot, { recursive: true });
  const stale = [];
  let written = 0;

  for (const entry of readdirSync(postsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || planned.has(entry.name)) continue;
    if (checkOnly) stale.push(`${entry.name}: no longer listed as ${websiteScope}`);
    else unlinkSync(path.join(postsRoot, entry.name));
  }

  for (const [filename, content] of planned) {
    const target = path.join(postsRoot, filename);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === content) continue;
    if (checkOnly) stale.push(`${filename}: generated post is missing or out of date`);
    else {
      writeFileSync(target, content, 'utf8');
      written += 1;
    }
  }

  for (const message of stale) console.error(message);
  console.log(`Translation posts synced: written=${written} stale=${stale.length} posts=${planned.size}`);
  if (checkOnly && stale.length) process.exitCode = 1;
}

try {
  sync({ checkOnly: process.argv.includes('--check') });
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
