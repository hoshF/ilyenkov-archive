import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const projectRoot = process.cwd();
const defaultResearchRoot = path.resolve(projectRoot, '..', 'Ilyenkov');

const PublicationRegistrySchema = z.object({
  schema_version: z.literal(1),
  default: z.literal('private'),
  items: z.array(z.object({
    id: z.string().min(1),
    path: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    content_category: z.string(),
    publication_channel: z.enum(['public_repository', 'website']),
    editorial_status: z.string(),
    readiness_status: z.string(),
    scope_status: z.string(),
    rights_status: z.string(),
  }).passthrough()),
}).passthrough();

export type PublicationRegistry = z.infer<typeof PublicationRegistrySchema>;
export type PublicationRecord = PublicationRegistry['items'][number];

export function resolveResearchRoot(): string {
  const configured = process.env.ILYENKOV_RESEARCH_ROOT?.trim();
  const root = configured ? path.resolve(projectRoot, configured) : defaultResearchRoot;
  if (root === projectRoot) throw new Error('Research root cannot be the site repository');
  if (!existsSync(path.join(root, 'metadata', 'publication_registry.json'))) {
    throw new Error(
      `Ilyenkov research root is unavailable at ${root}; set ILYENKOV_RESEARCH_ROOT`,
    );
  }
  return root;
}

export function resolveResearchPath(relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new Error(`Invalid research source path: ${relativePath}`);
  }
  const root = resolveResearchRoot();
  const resolved = path.resolve(root, relativePath);
  const prefix = `${root}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new Error(`Research source path escapes root: ${relativePath}`);
  }
  return resolved;
}

export function readPublicationRegistry(): PublicationRegistry {
  const raw = JSON.parse(
    readFileSync(resolveResearchPath('metadata/publication_registry.json'), 'utf8'),
  );
  return PublicationRegistrySchema.parse(raw);
}

export function websiteApprovedRecords(): PublicationRecord[] {
  return readPublicationRegistry().items.filter((item) => (
    item.publication_channel === 'website'
    && item.editorial_status === 'approved'
    && item.readiness_status === 'ready'
    && item.scope_status === 'in_scope'
    && item.rights_status === 'allowed'
  ));
}
