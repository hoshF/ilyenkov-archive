import type { APIRoute, GetStaticPaths } from 'astro';
import {
  generatedArticleAssets,
  resolveGeneratedArticleAssetPath,
} from '../../../../lib/article-source';
import { imageResponse } from '../../../../lib/media';

export const getStaticPaths: GetStaticPaths = () => generatedArticleAssets().map(({ id, asset }) => ({
  params: { id, asset },
  props: { assetPath: resolveGeneratedArticleAssetPath(id, asset) },
}));

export const GET: APIRoute<{ assetPath: string }> = ({ params, props }) => (
  imageResponse(props.assetPath, params.asset ?? '')
);
