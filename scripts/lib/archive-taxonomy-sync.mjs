import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { ArchiveTaxonomySchema } from '../../src/lib/archive-taxonomy-record.mjs';
import { publicationRelative } from './paths.mjs';
import { fail, object, readResearchJson, resolveResearchPath } from './validation.mjs';

export function plannedArchiveTaxonomy({ researchRoot, articleIds }) {
  const publication = readResearchJson(researchRoot, publicationRelative, publicationRelative);
  if (publication.archive_taxonomy === undefined) return null;
  const selection = object(publication.archive_taxonomy, 'archive_taxonomy');
  if (selection.publication_scope !== 'website_public') return null;
  if (Object.keys(selection).some((key) => !['publication_scope', 'editorial_path'].includes(key))) {
    fail('archive_taxonomy: unsupported selection field');
  }
  const relative = 'web/editorial/archive-taxonomy.json';
  if (selection.editorial_path !== relative) fail(`archive_taxonomy: editorial_path must be ${relative}`);
  const file = resolveResearchPath(researchRoot, relative, 'archive_taxonomy');
  if (!realpathSync(file).startsWith(`${path.join(realpathSync(researchRoot), 'web', 'editorial')}${path.sep}`)) {
    fail('archive_taxonomy: editorial_path escapes web/editorial');
  }
  const taxonomy = ArchiveTaxonomySchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  if (!Array.isArray(publication.works)) fail('publication works must be an array');
  const approved = publication.works.filter((entry) => entry.publication_scope === 'website_public');
  for (const [articleId, assignment] of Object.entries(taxonomy.articles)) {
    const matches = approved.filter((entry) => entry.work_id === articleId);
    if (matches.length !== 1) fail(`Archive taxonomy: ${articleId} requires exactly one website_public article selection, found ${matches.length}`);
    if (!articleIds.includes(articleId)) fail(`Archive taxonomy: ${articleId} has no generated public article`);
    for (const [kind, ids, vocabulary] of [
      ['topic', assignment.topics, taxonomy.topics], ['person', assignment.persons, taxonomy.persons],
    ]) {
      if (new Set(ids).size !== ids.length) fail(`Archive taxonomy: ${articleId} repeats ${kind}`);
      for (const id of ids) if (!Object.hasOwn(vocabulary, id)) fail(`Archive taxonomy: ${articleId} references an undefined ${kind} "${id}"`);
    }
  }
  const missing = articleIds.filter((id) => !Object.hasOwn(taxonomy.articles, id));
  if (missing.length) fail(`Archive taxonomy: missing assignment: ${missing.join(', ')}`);
  return taxonomy;
}
