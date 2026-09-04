import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { z } from 'zod';
import { renderPublicMarkdown } from './markdown';
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
  sourceEdition: string;
  sourceUrl: string | null;
  doiUrl: string | null;
}

export interface WorkDocument {
  kind: 'work';
  id: string;
  route: string;
  title: string;
  author: '埃瓦尔德·伊里因科夫';
  year: string | null;
  genre: string;
  sourceUrl: string | null;
  chineseAvailability: '暂无公开译文';
  sourceAvailability: '原文外部可读' | '原文暂未提供';
  siteAvailability: '本站目前提供作品信息与公开来源记录';
  verificationLabel: '来源记录已人工核验' | '部分信息仍待核对';
  relatedRecord: string | null;
}

export type CanonicalDocument = ReadableDocument | WorkDocument;

export interface SiteData {
  articles: ReadableDocument[];
  works: WorkDocument[];
  documents: CanonicalDocument[];
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

    return {
      kind: 'readable',
      id,
      route: `/archive/${id}`,
      title: metadata.title_zh,
      originalTitle: metadata.title,
      html: await renderPublicMarkdown(article.content),
      sourceEdition: metadata.source_edition,
      sourceUrl: metadata.source_url ?? null,
      doiUrl: doiUrl(metadata.doi ?? null),
    } satisfies ReadableDocument;
  }));
}

let cachedData: Promise<SiteData> | undefined;

export function getSiteData(): Promise<SiteData> {
  cachedData ??= (async () => {
    const articles = await loadArticles();
    const works: WorkDocument[] = [];
    const documents: CanonicalDocument[] = [...articles, ...works];
    const uniqueRoutes = new Set(documents.map((document) => document.route));
    if (uniqueRoutes.size !== documents.length) throw new Error('Canonical document routes are not unique');
    return { articles, works, documents };
  })();

  return cachedData;
}
