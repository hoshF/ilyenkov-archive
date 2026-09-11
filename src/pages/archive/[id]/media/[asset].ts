import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import {
  generatedArticleAssets,
  resolveGeneratedArticleAssetPath,
} from '../../../../lib/article-source';

const contentTypes: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const getStaticPaths: GetStaticPaths = () => generatedArticleAssets().map(({ id, asset }) => ({
  params: { id, asset },
  props: { assetPath: resolveGeneratedArticleAssetPath(id, asset) },
}));

export const GET: APIRoute<{ assetPath: string }> = ({ params, props }) => {
  const extension = params.asset?.split('.').at(-1)?.toLowerCase() ?? '';
  return new Response(readFileSync(props.assetPath), {
    headers: {
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
