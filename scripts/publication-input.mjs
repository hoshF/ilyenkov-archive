import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputRoot = path.join(projectRoot, '.website-input');
const manifestPath = path.join(inputRoot, 'publication-bundle.json');

function fail(message) {
  throw new Error(`Publication input error: ${message}`);
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
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

function validate() {
  if (!existsSync(manifestPath)) fail('temporary website bundle is missing; run publication:prepare');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (
    manifest.schema_version !== 1
    || manifest.channel !== 'website'
    || !Array.isArray(manifest.artifacts)
    || manifest.artifact_count !== manifest.artifacts.length
  ) fail('bundle manifest contract is invalid');

  const allowed = new Set(['publication-bundle.json']);
  for (const artifact of manifest.artifacts) {
    if (!/^[0-9a-f]{64}$/.test(artifact.sha256)) fail(`invalid SHA-256: ${artifact.bundle_path}`);
    const artifactPath = resolveInputPath(artifact.bundle_path);
    if (!existsSync(artifactPath) || sha256(artifactPath) !== artifact.sha256) {
      fail(`artifact revision does not match: ${artifact.bundle_path}`);
    }
    allowed.add(artifact.bundle_path);
    if (artifact.presentation_metadata) {
      const metadataPath = resolveInputPath(artifact.presentation_metadata);
      if (!existsSync(metadataPath)) fail(`presentation metadata is missing: ${artifact.presentation_metadata}`);
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
      if (metadata.translation_sha256 !== artifact.sha256) {
        fail(`presentation metadata does not bind artifact: ${artifact.bundle_path}`);
      }
      allowed.add(artifact.presentation_metadata);
    }
  }
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
