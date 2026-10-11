import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { publicationRelative } from './paths.mjs';
import { GeneratedGlossarySchema, GLOSSARY_NAME_TYPES } from '../../src/lib/glossary-record.mjs';
import { fail, idPattern, object, readResearchJson, resolveResearchPath } from './validation.mjs';

const sourcePattern = /^glossary\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;
const nameTypes = new Set(GLOSSARY_NAME_TYPES);

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => nonEmptyString(item, `${label}[${index}]`));
}

function readGlossary(researchRoot, relative) {
  const file = resolveResearchPath(researchRoot, relative, relative);
  if (!existsSync(file) || !statSync(file).isFile()) fail(`missing glossary file ${relative}`);
  const allowedRoot = `${path.join(realpathSync(researchRoot), 'glossary')}${path.sep}`;
  if (!realpathSync(file).startsWith(allowedRoot)) fail(`${relative} escapes glossary`);
  let entries;
  try {
    entries = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${relative} is not valid JSON`);
    throw error;
  }
  if (!Array.isArray(entries)) fail(`${relative} must be a word-entry array`);
  return entries;
}

/** Project approved entries from explicitly selected tables without changing source records. */
export function plannedGlossary({ researchRoot }) {
  const publication = readResearchJson(researchRoot, publicationRelative, publicationRelative);
  if (!Object.hasOwn(publication, 'glossary')) return [];
  const label = `${publicationRelative} glossary`;
  const selection = object(publication.glossary, label);
  if (selection.publication_scope !== 'website_public') return [];
  for (const key of Object.keys(selection)) {
    if (!['publication_scope', 'source_paths'].includes(key)) fail(`${label}: unsupported field ${key}`);
  }
  if (!Array.isArray(selection.source_paths)) fail(`${label}: source_paths must be an array`);

  const seenPaths = new Set();
  const selected = [];
  for (const relative of selection.source_paths) {
    const match = typeof relative === 'string' ? sourcePattern.exec(relative) : null;
    if (!match || match[0] !== relative) fail(`${label}: source_paths must use glossary/<slug>.json`);
    if (seenPaths.has(relative)) fail(`${label}: duplicate source_path ${relative}`);
    seenPaths.add(relative);
    const collection = match[1];
    const seenIds = new Set();
    for (const [index, rawEntry] of readGlossary(researchRoot, relative).entries()) {
      const entryLabel = `${relative}[${index}]`;
      const entry = object(rawEntry, entryLabel);
      const id = nonEmptyString(entry.id, `${entryLabel}: id`);
      if (seenIds.has(id)) fail(`${relative}: duplicate id ${id}`);
      seenIds.add(id);
      if (entry.status !== 'approved') continue;
      if (idPattern.exec(id)?.[0] !== id) fail(`${entryLabel}: invalid id ${id}`);
      if (typeof entry.notes !== 'string') fail(`${entryLabel}: notes must be a string`);
      const projected = {
        collection,
        id,
        canonical: nonEmptyString(entry.canonical, `${entryLabel}: canonical`),
        forms: stringArray(entry.forms, `${entryLabel}: forms`),
        zh_preferred: nonEmptyString(entry.zh_preferred, `${entryLabel}: zh_preferred`),
        zh_alternatives: stringArray(entry.zh_alternatives, `${entryLabel}: zh_alternatives`),
        notes: entry.notes,
      };
      if (collection === 'glossary') {
        if (!nameTypes.has(entry.type)) fail(`${entryLabel}: invalid glossary type`);
        projected.type = entry.type;
      }
      selected.push(projected);
    }
  }
  return GeneratedGlossarySchema.parse(selected);
}
