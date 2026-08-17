import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const projectRoot = process.cwd();
const inputRoot = path.join(projectRoot, '.website-input');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const shaPattern = /^[0-9a-f]{64}$/;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function isPublicationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

const AuthorSchema = z.object({
  id: z.string().regex(idPattern),
  display_name: z.string().trim().min(1),
}).strict();

const PublicationArtifactSchema = z.object({
  publication_id: z.string().regex(idPattern),
  kind: z.literal('translation'),
  slug: z.string().regex(idPattern),
  title: z.string().trim().min(1),
  authors: z.array(AuthorSchema).min(1),
  published_date: z.string().refine(isPublicationDate, 'Invalid publication date'),
  source: z.object({
    url: z.string().refine(isHttpUrl, 'Invalid public source URL'),
    doi: z.string().trim().min(1).nullable(),
    license: z.string().trim().min(1).nullable(),
  }).strict(),
  rights: z.object({
    basis: z.enum(['author_permission', 'license_permits']),
  }).strict(),
  content: z.object({
    path: z.string().min(1),
    sha256: z.string().regex(shaPattern),
  }).strict(),
}).strict().superRefine((artifact, context) => {
  if (artifact.content.path !== `artifacts/${artifact.publication_id}.md`) {
    context.addIssue({
      code: 'custom',
      path: ['content', 'path'],
      message: 'Content path must use the public publication ID',
    });
  }
  const authorIds = artifact.authors.map((author) => author.id);
  if (new Set(authorIds).size !== authorIds.length) {
    context.addIssue({ code: 'custom', path: ['authors'], message: 'Duplicate author IDs' });
  }
});

const PublicationBundleSchema = z.object({
  schema_version: z.literal(2),
  channel: z.literal('website'),
  artifact_count: z.number().int().nonnegative(),
  revision_sha256: z.string().regex(shaPattern),
  artifacts: z.array(PublicationArtifactSchema),
}).strict().superRefine((bundle, context) => {
  if (bundle.artifact_count !== bundle.artifacts.length) {
    context.addIssue({ code: 'custom', path: ['artifact_count'], message: 'Artifact count mismatch' });
  }
  for (const [label, values] of [
    ['publication IDs', bundle.artifacts.map((artifact) => artifact.publication_id)],
    ['slugs', bundle.artifacts.map((artifact) => artifact.slug)],
    ['content paths', bundle.artifacts.map((artifact) => artifact.content.path)],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', path: ['artifacts'], message: `Duplicate ${label}` });
    }
  }
});

export type PublicationArtifact = z.infer<typeof PublicationArtifactSchema>;

export function resolvePublicationPath(relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new Error(`Invalid publication input path: ${relativePath}`);
  }
  const resolved = path.resolve(inputRoot, relativePath);
  if (!resolved.startsWith(`${inputRoot}${path.sep}`)) {
    throw new Error(`Publication input path escapes bundle: ${relativePath}`);
  }
  return resolved;
}

export function readPublicationBundle(): z.infer<typeof PublicationBundleSchema> {
  const manifest = resolvePublicationPath('publication-bundle.json');
  if (!existsSync(manifest)) {
    throw new Error('Website publication input is unavailable; run npm run publication:prepare');
  }
  const data = PublicationBundleSchema.parse(JSON.parse(readFileSync(manifest, 'utf8')));
  const revision = createHash('sha256');
  for (const artifact of data.artifacts) {
    revision.update(`${artifact.content.path}\0${artifact.content.sha256}\n`);
  }
  if (revision.digest('hex') !== data.revision_sha256) {
    throw new Error('Website publication input revision does not match its manifest');
  }
  return data;
}

export function websitePublicationArtifacts(): PublicationArtifact[] {
  return readPublicationBundle().artifacts;
}
