import type { APIRoute, GetStaticPaths } from 'astro';
import { imageResponse } from '../../lib/media';
import { portraitName } from '../../lib/portrait';
import { getPublicIlyenkov, resolvePortraitPath } from '../../lib/research-records';

// 只在总页选择了照片时生成 /ilyenkov/portrait.<ext>。
export const getStaticPaths: GetStaticPaths = () => {
  const { portrait } = getPublicIlyenkov();
  return portrait ? [{ params: { portrait: portraitName(portrait) }, props: { file: resolvePortraitPath(portrait) } }] : [];
};

export const GET: APIRoute<{ file: string }> = ({ params, props }) => imageResponse(props.file, params.portrait ?? '');
