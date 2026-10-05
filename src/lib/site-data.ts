import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { z } from 'zod';
import { buildCache } from './cache';
import { renderPublicMarkdown, type ArticleHeading } from './markdown';
import { generatedArticleIds, resolveGeneratedArticlePath } from './article-source';
import {
  assertEveryTermHasArticles,
  assertTaxonomyCoversArticles,
  getArchiveTaxonomy,
  type ArticleTaxonomy,
  type TermWithArticles,
} from './archive-taxonomy';

const PublicUrlSchema = z.string().refine((value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.host);
  } catch {
    return false;
  }
}, 'Invalid public URL');
const GeneratedArticleSchema = z.object({
  title: z.string().trim().min(1),
  title_zh: z.string().trim().min(1),
  /** 原文作者；不从 translation/<contributor>/ 目录推导。 */
  author: z.array(z.string().trim().min(1)).min(1).refine(
    (names) => new Set(names).size === names.length,
    'Author names must be unique',
  ),
  /** 原文文献的发表年份，不是译文年份。 */
  year: z.string().regex(/^\d{4}$/),
  title_notes: z.array(z.string().trim().min(1)).default([]),
  source_edition: z.string().trim().min(1),
  source_url: PublicUrlSchema.optional(),
  doi: z.string().trim().min(1).optional(),
  type: z.literal('translation'),
  generated_from: z.string().regex(/^Ilyenkov:translation\/.+\.md$/),
  generated_rev: z.string().regex(/^[0-9a-f]{12}(?:-dirty)?$/).optional(),
}).strict();

export interface ReadableDocument {
  kind: 'readable';
  id: string;
  route: string;
  title: string;
  titleHtml: string;
  originalTitle: string;
  author: string[];
  /** 列表与详情页共用的作者署名。 */
  authorLabel: string;
  year: string;
  /** public 编辑分类；缺指派时是空数组，页面本轮不展示。 */
  topics: ArticleTaxonomy['topics'];
  persons: ArticleTaxonomy['persons'];
  html: string;
  headings: ArticleHeading[];
  sourceEdition: string;
  sourceUrl: string | null;
  doiUrl: string | null;
}

export interface SiteData {
  articles: ReadableDocument[];
  /** Archive 左栏的分类词表，每个词条带命中数与目标链接。 */
  facets: {
    topics: TermWithArticles[];
    persons: TermWithArticles[];
  };
}

function doiUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://doi.org/${value}`;
}

/**
 * 一篇译文的作者署名：多人用顿号连接。列表页与详情页读同一个字符串，
 * 两处不会出现不同的写法。
 */
export function authorLabel(author: string[]): string {
  return author.join('、');
}

/**
 * 全站唯一的一篇文章顺序：原文发表年份由新到旧，同年按中文题名、再按 id，
 * 因此构建结果是确定的，不依赖文件系统的读取顺序。
 * 归档列表与译文页的上下篇都读这一份顺序；首页“最新内容”混合其他公开成果，
 * 但保留译文之间的这一相对顺序，不把原文年份解释为网站发布日。
 */
function byPublicationYearDescending(
  left: ReadableDocument,
  right: ReadableDocument,
): number {
  return right.year.localeCompare(left.year)
    || left.title.localeCompare(right.title, 'zh-Hans-CN')
    || left.id.localeCompare(right.id);
}

async function loadArticles(): Promise<ReadableDocument[]> {
  const ids = generatedArticleIds();
  // 分类与已公开文章集合必须完全一致；不一致时在这里就构建失败。
  assertTaxonomyCoversArticles(ids);
  const taxonomy = getArchiveTaxonomy();

  const articles = await Promise.all(ids.map(async (id) => {
    const articlePath = resolveGeneratedArticlePath(id);
    const article = matter(readFileSync(articlePath, 'utf8'));
    const metadata = GeneratedArticleSchema.parse(article.data);
    if (!metadata.generated_from.endsWith(`/${id}.md`)) {
      throw new Error(`Generated article source does not match its filename: ${id}`);
    }

    const { html, titleHtml, headings } = await renderPublicMarkdown(article.content, {
      imageBaseUrl: `/archive/${id}/media/`,
      title: metadata.title_zh,
      titleNotes: metadata.title_notes,
    });

    return {
      kind: 'readable',
      id,
      route: `/archive/${id}`,
      title: metadata.title_zh,
      titleHtml,
      originalTitle: metadata.title,
      author: metadata.author,
      authorLabel: authorLabel(metadata.author),
      year: metadata.year,
      topics: taxonomy.get(id)?.topics ?? [],
      persons: taxonomy.get(id)?.persons ?? [],
      html,
      headings,
      sourceEdition: metadata.source_edition,
      sourceUrl: metadata.source_url ?? null,
      doiUrl: doiUrl(metadata.doi ?? null),
    } satisfies ReadableDocument;
  }));

  return articles.sort(byPublicationYearDescending);
}

export const getSiteData = buildCache(async (): Promise<SiteData> => {
  const articles = await loadArticles();
  const uniqueRoutes = new Set(articles.map((article) => article.route));
  if (uniqueRoutes.size !== articles.length) throw new Error('Article routes are not unique');
  // 左栏 facet 的词表与命中数；每个词条必须真有文章，否则构建失败。
  const facets = assertEveryTermHasArticles(articles);
  return { articles, facets };
});
