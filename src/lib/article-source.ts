import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const generatedArticlesRoot = path.join(projectRoot, '.website-input', 'articles');
const generatedArticleAssetsRoot = path.join(projectRoot, '.website-input', 'article-assets');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:avif|gif|jpe?g|png|webp)$/i;

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

export function resolveGeneratedArticleAssetPath(id: string, asset: string): string {
  if (!idPattern.test(id)) throw new Error(`Invalid generated article ID: ${id}`);
  if (!assetPattern.test(asset)) throw new Error(`Invalid generated article asset: ${asset}`);
  return path.join(generatedArticleAssetsRoot, id, asset);
}

export function generatedArticleAssets(): Array<{ id: string; asset: string }> {
  if (!existsSync(generatedArticleAssetsRoot)) return [];
  return readdirSync(generatedArticleAssetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && idPattern.test(entry.name))
    .flatMap((directory) => readdirSync(
      path.join(generatedArticleAssetsRoot, directory.name),
      { withFileTypes: true },
    )
      .filter((entry) => entry.isFile() && assetPattern.test(entry.name))
      .map((entry) => ({ id: directory.name, asset: entry.name })))
    .sort((left, right) => `${left.id}/${left.asset}`.localeCompare(`${right.id}/${right.asset}`));
}
