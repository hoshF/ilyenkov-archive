import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const generatedArticlesRoot = path.join(projectRoot, '.website-input', 'articles');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolveGeneratedArticlePath(id: string): string {
  if (!idPattern.test(id)) throw new Error(`Invalid generated article ID: ${id}`);
  return path.join(generatedArticlesRoot, `${id}.md`);
}

export function generatedArticleIds(): string[] {
  if (!existsSync(generatedArticlesRoot)) {
    throw new Error('Generated translation articles are unavailable; run npm run publication:prepare');
  }
  return readdirSync(generatedArticlesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}
