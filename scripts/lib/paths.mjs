import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** 两个同步器共用的目录：public 仓库、private 研究仓库、生成输入的落点。 */
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const researchRoot = path.resolve(
  process.env.ILYENKOV_ROOT?.trim() || path.join(projectRoot, '..', 'Ilyenkov'),
);

export const publicationRelative = 'web/publication.json';

export const outputRoot = path.join(projectRoot, '.website-input');
