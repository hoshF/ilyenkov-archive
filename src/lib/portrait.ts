import { readFileSync } from 'node:fs';
import { imageMetadata } from 'astro/assets/utils';
import { resolvePortraitPath, type PublicIlyenkovProfile, type PublicResearcher } from './research-records';

/**
 * 人物照片按 3:4 显示：宽屏与中屏 160×213，窄屏铺满行宽，最宽 560px（600px 视口）。
 * 原图至少等于最大显示尺寸，任何宽度下都不放大。
 */
const minimumWidth = 560;
const minimumHeight = 747;

export const researcherSlug = (researcher: Pick<PublicResearcher, 'id'>): string => (
  researcher.id.replace(/^researcher-/, '')
);

/** 公开路径只保留扩展名：<人物页>/portrait.<ext>。 */
export const portraitName = (portrait: string): string => `portrait.${portrait.split('.').at(-1)}`;

async function checkedPortrait(owner: string, portrait: string, src: string): Promise<{ src: string }> {
  const { width, height } = await imageMetadata(readFileSync(resolvePortraitPath(portrait)), src);
  if (width < minimumWidth || height < minimumHeight) {
    throw new Error(`${owner}: portrait must be at least ${minimumWidth}×${minimumHeight}, got ${width}×${height}`);
  }
  return { src };
}

export async function researcherPortrait(researcher: PublicResearcher): Promise<{ src: string } | undefined> {
  if (!researcher.portrait) return undefined;
  return checkedPortrait(researcher.id, researcher.portrait,
    `/research/researchers/${researcherSlug(researcher)}/${portraitName(researcher.portrait)}`);
}

export async function ilyenkovPortrait(profile: PublicIlyenkovProfile): Promise<{ src: string; credit: string } | undefined> {
  if (!profile.portrait) return undefined;
  const { src } = await checkedPortrait(profile.id, profile.portrait, `/ilyenkov/${portraitName(profile.portrait)}`);
  return { src, credit: profile.portraitCredit! };
}
