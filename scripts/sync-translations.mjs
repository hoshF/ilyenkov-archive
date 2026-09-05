import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { outputRoot, projectRoot, researchRoot } from './lib/paths.mjs';
import { runSync, writeGenerated } from './lib/sync.mjs';
import {
  fail,
  idPattern,
  object,
  optionalString,
  readResearchJson,
  requiredString,
  resolveResearchPath,
} from './lib/validation.mjs';

const publicationRelative = 'translation/publication.json';
const articlesRoot = path.join(outputRoot, 'articles');
const websiteScope = 'website_public';

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

function renderArticle(work, body, textRelative, revision) {
  const lines = [
    '---',
    `title: ${yamlString(work.title)}`,
    `title_zh: ${yamlString(work.title_zh)}`,
    `source_edition: ${yamlString(work.source_edition)}`,
  ];
  if (work.source_url) lines.push(`source_url: ${yamlString(work.source_url)}`);
  if (work.doi) lines.push(`doi: ${yamlString(work.doi)}`);
  lines.push(
    'type: translation',
    `generated_from: ${yamlString(`Ilyenkov:${textRelative}`)}`,
  );
  if (revision) lines.push(`generated_rev: ${yamlString(revision)}`);
  lines.push('---', '', body, '');
  return lines.join('\n');
}

function publicationWorks() {
  if (researchRoot === projectRoot) fail('Ilyenkov source cannot be the public repository');
  const publication = readResearchJson(researchRoot, publicationRelative, publicationRelative);
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

function plannedArticles() {
  return new Map(publicationWorks().map(({ workId, workJsonRelative }) => {
    const textRelative = path.posix.join(path.posix.dirname(workJsonRelative), `${workId}.md`);
    const textPath = resolveResearchPath(researchRoot, textRelative, `${workId} Markdown path`);
    const work = readResearchJson(researchRoot, workJsonRelative, workJsonRelative);
    if (work.work_id !== workId) fail(`${workJsonRelative}: work_id must be ${workId}`);

    const metadata = {
      title: requiredString(work, 'title', workJsonRelative),
      title_zh: requiredString(work, 'title_zh', workJsonRelative),
      source_edition: requiredString(work, 'source_edition', workJsonRelative),
      source_url: optionalString(work, 'source_url', workJsonRelative),
      doi: optionalString(work, 'doi', workJsonRelative),
    };
    if (!existsSync(textPath)) fail(`missing ${textRelative}`);

    const body = dropLeadingTitle(
      stripFrontmatter(readFileSync(textPath, 'utf8')),
      metadata.title_zh,
    );
    if (!body) fail(`${textRelative}: Markdown body is empty`);
    const revision = upstreamRevision([publicationRelative, workJsonRelative, textRelative]);
    return [`${workId}.md`, renderArticle(metadata, body, textRelative, revision)];
  }));
}

runSync('Translation', ({ checkOnly }) => {
  const planned = plannedArticles();
  mkdirSync(articlesRoot, { recursive: true });
  const stale = [];
  let written = 0;

  for (const entry of readdirSync(articlesRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || planned.has(entry.name)) continue;
    if (checkOnly) stale.push(`${entry.name}: no longer listed as ${websiteScope}`);
    else unlinkSync(path.join(articlesRoot, entry.name));
  }

  for (const [filename, content] of planned) {
    if (!writeGenerated(path.join(articlesRoot, filename), content, { checkOnly })) continue;
    if (checkOnly) stale.push(`${filename}: generated article is missing or out of date`);
    else written += 1;
  }

  for (const message of stale) console.error(message);
  console.log(`Translation articles synced: written=${written} stale=${stale.length} articles=${planned.size}`);
  if (checkOnly && stale.length) process.exitCode = 1;
});
