import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const projectRoot = process.cwd();
const inputRoot = path.join(projectRoot, '.website-input');

const PublicationArtifactSchema = z.object({
  publication_id: z.string().min(1),
  source_path: z.string().min(1),
  bundle_path: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  content_category: z.string(),
  presentation_metadata: z.string().min(1).optional(),
});

const PublicationBundleSchema = z.object({
  schema_version: z.literal(1),
  channel: z.literal('website'),
  artifact_count: z.number().int().nonnegative(),
  revision_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  artifacts: z.array(PublicationArtifactSchema),
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
  if (data.artifact_count !== data.artifacts.length) {
    throw new Error('Website publication input count does not match its manifest');
  }
  return data;
}

export function websitePublicationArtifacts(): PublicationArtifact[] {
  return readPublicationBundle().artifacts;
}
