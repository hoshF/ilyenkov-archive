import type { APIRoute, GetStaticPaths } from 'astro';
import { imageResponse } from '../../../../lib/media';
import { getPublicResearchers, resolvePortraitPath } from '../../../../lib/research-records';
import { portraitName, researcherSlug } from '../../../../lib/portrait';

// 只为已选择照片的研究者生成 /research/researchers/<slug>/portrait.<ext>。
export const getStaticPaths: GetStaticPaths = () => getPublicResearchers()
  .filter((researcher) => researcher.portrait)
  .map((researcher) => ({
    params: { slug: researcherSlug(researcher), portrait: portraitName(researcher.portrait!) },
    props: { file: resolvePortraitPath(researcher.portrait!) },
  }));

export const GET: APIRoute<{ file: string }> = ({ params, props }) => (
  imageResponse(props.file, params.portrait ?? '')
);
