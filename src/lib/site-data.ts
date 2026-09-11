import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { z } from 'zod';
import { buildCache } from './cache';
import { renderPublicMarkdown, type ArticleHeading } from './markdown';
import { generatedArticleIds, resolveGeneratedArticlePath } from './article-source';

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
  originalTitle: string;
  html: string;
  headings: ArticleHeading[];
  sourceEdition: string;
  sourceUrl: string | null;
  doiUrl: string | null;
}

export interface SiteData {
  articles: ReadableDocument[];
}

function doiUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://doi.org/${value}`;
}

async function loadArticles(): Promise<ReadableDocument[]> {
  return Promise.all(generatedArticleIds().map(async (id) => {
    const articlePath = resolveGeneratedArticlePath(id);
    const article = matter(readFileSync(articlePath, 'utf8'));
    const metadata = GeneratedArticleSchema.parse(article.data);
    if (!metadata.generated_from.endsWith(`/${id}.md`)) {
      throw new Error(`Generated article source does not match its filename: ${id}`);
    }

    const { html, headings } = await renderPublicMarkdown(article.content, {
      imageBaseUrl: `/archive/${id}/media/`,
    });

    return {
      kind: 'readable',
      id,
      route: `/archive/${id}`,
      title: metadata.title_zh,
      originalTitle: metadata.title,
      html,
      headings,
      sourceEdition: metadata.source_edition,
      sourceUrl: metadata.source_url ?? null,
      doiUrl: doiUrl(metadata.doi ?? null),
    } satisfies ReadableDocument;
  }));
}

export const getSiteData = buildCache(async (): Promise<SiteData> => {
  const articles = await loadArticles();
  const uniqueRoutes = new Set(articles.map((article) => article.route));
  if (uniqueRoutes.size !== articles.length) throw new Error('Article routes are not unique');
  return { articles };
});
