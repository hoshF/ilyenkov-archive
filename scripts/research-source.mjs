import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configuredRoot = process.env.ILYENKOV_RESEARCH_ROOT?.trim();
const researchRoot = configuredRoot
  ? path.resolve(projectRoot, configuredRoot)
  : path.resolve(projectRoot, '..', 'Ilyenkov');

function fail(message) {
  console.error(`Research source error: ${message}`);
  process.exit(1);
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function resolveResearchPath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    fail(`invalid source path: ${relativePath}`);
  }
  const resolved = path.resolve(researchRoot, relativePath);
  if (!resolved.startsWith(`${researchRoot}${path.sep}`)) {
    fail(`source path escapes research root: ${relativePath}`);
  }
  return resolved;
}

if (researchRoot === projectRoot) fail('research root cannot be the site repository');

const registryPath = resolveResearchPath('metadata/publication_registry.json');
if (!existsSync(registryPath)) {
  fail(`publication registry is unavailable; set ILYENKOV_RESEARCH_ROOT (resolved ${researchRoot})`);
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch (error) {
  fail(`cannot parse publication registry: ${error.message}`);
}

if (registry.schema_version !== 1 || registry.default !== 'private' || !Array.isArray(registry.items)) {
  fail('publication registry contract is invalid');
}

const approved = registry.items.filter((item) => (
  item.publication_channel === 'website'
  && item.editorial_status === 'approved'
  && item.readiness_status === 'ready'
  && item.scope_status === 'in_scope'
  && item.rights_status === 'allowed'
));

for (const item of approved) {
  const sourcePath = resolveResearchPath(item.path);
  if (!existsSync(sourcePath)) fail(`approved input is missing: ${item.path}`);
  if (!/^[0-9a-f]{64}$/.test(item.sha256) || sha256(sourcePath) !== item.sha256) {
    fail(`approved input revision does not match: ${item.path}`);
  }
}

console.log(`Research source validated: website-approved=${approved.length}`);
