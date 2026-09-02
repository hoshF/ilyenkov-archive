import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const generatedPostsRoot = path.join(projectRoot, '.website-input', 'posts');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolveGeneratedPostPath(id: string): string {
  if (!idPattern.test(id)) throw new Error(`Invalid generated post ID: ${id}`);
  return path.join(generatedPostsRoot, `${id}.md`);
}

export function generatedPostIds(): string[] {
  if (!existsSync(generatedPostsRoot)) {
    throw new Error('Generated translation posts are unavailable; run npm run publication:prepare');
  }
  return readdirSync(generatedPostsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}
