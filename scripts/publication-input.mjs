import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputRoot = path.join(projectRoot, '.website-input');
const manifestPath = path.join(inputRoot, 'publication-bundle.json');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const shaPattern = /^[0-9a-f]{64}$/;
const rightsBases = new Set(['author_permission', 'license_permits']);

function fail(message) {
  throw new Error(`Publication input error: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} fields are invalid`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function nullableString(value, label) {
  if (value !== null) nonEmptyString(value, label);
}

function httpUrl(value, label) {
  nonEmptyString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be a public HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.host) {
    fail(`${label} must be a public HTTP(S) URL`);
  }
}

function publicationDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${label} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(`${label} is not a calendar date`);
  }
}

function resolveInputPath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    fail(`invalid bundle path: ${relativePath}`);
  }
  const resolved = path.resolve(inputRoot, relativePath);
  if (!resolved.startsWith(`${inputRoot}${path.sep}`)) fail(`bundle path escapes input: ${relativePath}`);
  return resolved;
}

function filesBelow(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? filesBelow(path.join(directory, entry.name), rel) : [rel];
  });
}

function validateArtifact(rawArtifact, index) {
  const artifact = object(rawArtifact, `artifact ${index}`);
  exactKeys(artifact, [
    'publication_id', 'kind', 'slug', 'title', 'authors', 'published_date',
    'source', 'rights', 'content',
  ], `artifact ${index}`);
  if (!idPattern.test(artifact.publication_id)) fail(`artifact ${index} has an invalid publication ID`);
  if (artifact.kind !== 'translation') fail(`artifact ${artifact.publication_id} has an unsupported kind`);
  if (!idPattern.test(artifact.slug)) fail(`artifact ${artifact.publication_id} has an invalid slug`);
  nonEmptyString(artifact.title, `artifact ${artifact.publication_id} title`);
  publicationDate(artifact.published_date, `artifact ${artifact.publication_id} published_date`);

  if (!Array.isArray(artifact.authors) || artifact.authors.length === 0) {
    fail(`artifact ${artifact.publication_id} must have at least one author`);
  }
  const authorIds = new Set();
  for (const [authorIndex, rawAuthor] of artifact.authors.entries()) {
    const author = object(rawAuthor, `artifact ${artifact.publication_id} author ${authorIndex}`);
    exactKeys(author, ['id', 'display_name'], `artifact ${artifact.publication_id} author ${authorIndex}`);
    if (!idPattern.test(author.id)) fail(`artifact ${artifact.publication_id} has an invalid author ID`);
    nonEmptyString(author.display_name, `artifact ${artifact.publication_id} author display name`);
    if (authorIds.has(author.id)) fail(`artifact ${artifact.publication_id} has duplicate authors`);
    authorIds.add(author.id);
  }

  const source = object(artifact.source, `artifact ${artifact.publication_id} source`);
  exactKeys(source, ['url', 'doi', 'license'], `artifact ${artifact.publication_id} source`);
  httpUrl(source.url, `artifact ${artifact.publication_id} source URL`);
  nullableString(source.doi, `artifact ${artifact.publication_id} source DOI`);
  nullableString(source.license, `artifact ${artifact.publication_id} source license`);

  const rights = object(artifact.rights, `artifact ${artifact.publication_id} rights`);
  exactKeys(rights, ['basis'], `artifact ${artifact.publication_id} rights`);
  if (!rightsBases.has(rights.basis)) fail(`artifact ${artifact.publication_id} has an invalid rights basis`);

  const content = object(artifact.content, `artifact ${artifact.publication_id} content`);
  exactKeys(content, ['path', 'sha256'], `artifact ${artifact.publication_id} content`);
  const expectedPath = `artifacts/${artifact.publication_id}.md`;
  if (content.path !== expectedPath) fail(`artifact ${artifact.publication_id} has a non-canonical content path`);
  if (!shaPattern.test(content.sha256)) fail(`artifact ${artifact.publication_id} has an invalid content SHA-256`);

  const contentPath = resolveInputPath(content.path);
  if (!existsSync(contentPath)) fail(`artifact content is missing: ${content.path}`);
  const bytes = readFileSync(contentPath);
  if (sha256(bytes) !== content.sha256) fail(`artifact revision does not match: ${content.path}`);
  if (/^---\r?\n/.test(bytes.toString('utf8'))) {
    fail(`artifact content must not contain private front matter: ${content.path}`);
  }
  return artifact;
}

function validate() {
  if (!existsSync(manifestPath)) fail('temporary website bundle is missing; run publication:prepare');
  const manifest = object(JSON.parse(readFileSync(manifestPath, 'utf8')), 'bundle manifest');
  exactKeys(manifest, [
    'schema_version', 'channel', 'artifact_count', 'revision_sha256', 'artifacts',
  ], 'bundle manifest');
  if (
    manifest.schema_version !== 2
    || manifest.channel !== 'website'
    || !Number.isInteger(manifest.artifact_count)
    || manifest.artifact_count < 0
    || !Array.isArray(manifest.artifacts)
    || manifest.artifact_count !== manifest.artifacts.length
    || !shaPattern.test(manifest.revision_sha256)
  ) fail('bundle manifest contract is invalid');

  const artifacts = manifest.artifacts.map(validateArtifact);
  for (const [label, values] of [
    ['publication IDs', artifacts.map((artifact) => artifact.publication_id)],
    ['slugs', artifacts.map((artifact) => artifact.slug)],
    ['content paths', artifacts.map((artifact) => artifact.content.path)],
  ]) {
    if (new Set(values).size !== values.length) fail(`bundle has duplicate ${label}`);
  }

  const revision = createHash('sha256');
  for (const artifact of artifacts) {
    revision.update(`${artifact.content.path}\0${artifact.content.sha256}\n`);
  }
  if (revision.digest('hex') !== manifest.revision_sha256) fail('bundle revision SHA-256 does not match');

  const allowed = new Set([
    'publication-bundle.json',
    ...artifacts.map((artifact) => artifact.content.path),
  ]);
  const unexpected = filesBelow(inputRoot).filter((rel) => !allowed.has(rel));
  if (unexpected.length) fail(`unregistered files in temporary input: ${unexpected.join(', ')}`);
  console.log(`Publication input validated: website-approved=${manifest.artifact_count}`);
}

function prepare() {
  const configured = process.env.ILYENKOV_RESEARCH_ROOT?.trim();
  const researchRoot = configured
    ? path.resolve(projectRoot, configured)
    : path.resolve(projectRoot, '..', 'Ilyenkov');
  if (researchRoot === projectRoot) fail('research root cannot be the public repository');
  const builder = path.join(researchRoot, 'scripts', 'build_publication_bundle.py');
  if (!existsSync(builder)) {
    fail(`private publication builder is unavailable; set ILYENKOV_RESEARCH_ROOT (resolved ${researchRoot})`);
  }
  execFileSync('python3', [builder, '--channel', 'website', '--output', inputRoot], {
    cwd: researchRoot,
    stdio: 'inherit',
  });
  validate();
}

const command = process.argv[2] ?? 'validate';
if (command === 'prepare') prepare();
else if (command === 'validate') validate();
else fail(`unknown command: ${command}`);
