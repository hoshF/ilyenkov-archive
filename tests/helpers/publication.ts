import { readFileSync } from 'node:fs';
import path from 'node:path';

export const researchRoot = path.resolve(
  process.env.ILYENKOV_ROOT?.trim() || path.join(process.cwd(), '..', 'Ilyenkov'),
);

export interface WebsiteWork {
  work_id: string;
  work_json_path: string;
}

export function websiteWorks(): WebsiteWork[] {
  const publication = JSON.parse(readFileSync(
    path.join(researchRoot, 'web/publication.json'),
    'utf8',
  ));
  return publication.works.filter((work: Record<string, unknown>) => (
    work.publication_scope === 'website_public'
  ));
}
