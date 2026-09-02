import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { z } from 'zod';
import { readEditorialJson } from './editorial';
import { renderPublicMarkdown } from './markdown';
import { generatedPostIds, resolveGeneratedPostPath } from './post-source';

const EditorialDescriptionsSchema = z.record(z.string(), z.string().min(1));
const PublicUrlSchema = z.string().refine((value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.host);
  } catch {
    return false;
  }
}, 'Invalid public URL');
const GeneratedPostSchema = z.object({
  title: z.string().trim().min(1),
  title_zh: z.string().trim().min(1),
  source_edition: z.string().trim().min(1),
  source_url: PublicUrlSchema.optional(),
  doi: z.string().trim().min(1).optional(),
  rights_status: z.enum(['author_permission', 'license_permits']),
  type: z.literal('translation'),
  generated_from: z.string().regex(/^Ilyenkov:translation\/.+\.md$/),
  generated_rev: z.string().regex(/^[0-9a-f]{12}(?:-dirty)?$/).optional(),
}).strict();
const HomeSchema = z.object({ featuredDocumentIds: z.array(z.string()).min(1) });
const StartGuideSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  items: z.array(z.object({ id: z.string(), reason: z.string().min(1) })),
});

export interface ReadableDocument {
  kind: 'readable';
  id: string;
  route: string;
  title: string;
  originalTitle: string;
  description: string | null;
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

export interface ResolvedGuideItem {
  document: CanonicalDocument;
  reason: string;
}

export interface SiteData {
  articles: ReadableDocument[];
  works: WorkDocument[];
  documents: CanonicalDocument[];
  featured: ReadableDocument[];
  guide: {
    title: string;
    introduction: string;
    items: ResolvedGuideItem[];
  };
}

function doiUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://doi.org/${value}`;
}

export function validateEditorialReferences(
  ids: string[],
  documents: CanonicalDocument[],
  label: string,
): CanonicalDocument[] {
  const byId = new Map(documents.map((document) => [document.id, document]));
  return ids.map((id) => {
    const document = byId.get(id);
    if (!document) throw new Error(`${label} references unknown public document ID: ${id}`);
    return document;
  });
}

async function loadArticles(
  descriptions: Record<string, string>,
): Promise<ReadableDocument[]> {
  return Promise.all(generatedPostIds().map(async (id) => {
    const postPath = resolveGeneratedPostPath(id);
    const post = matter(readFileSync(postPath, 'utf8'));
    const metadata = GeneratedPostSchema.parse(post.data);
    if (!metadata.generated_from.endsWith(`/${id}.md`)) {
      throw new Error(`Generated post source does not match its filename: ${id}`);
    }

    return {
      kind: 'readable',
      id,
      route: `/documents/${id}`,
      title: metadata.title_zh,
      originalTitle: metadata.title,
      description: descriptions[id] ?? null,
      html: await renderPublicMarkdown(post.content),
      sourceEdition: metadata.source_edition,
      sourceUrl: metadata.source_url ?? null,
      doiUrl: doiUrl(metadata.doi ?? null),
    } satisfies ReadableDocument;
  }));
}

let cachedData: Promise<SiteData> | undefined;

export function getSiteData(): Promise<SiteData> {
  cachedData ??= (async () => {
    const descriptions = EditorialDescriptionsSchema.parse(readEditorialJson('article-descriptions.json'));
    const articles = await loadArticles(descriptions);
    const works: WorkDocument[] = [];
    const documents: CanonicalDocument[] = [...articles, ...works];
    const uniqueRoutes = new Set(documents.map((document) => document.route));
    if (uniqueRoutes.size !== documents.length) throw new Error('Canonical document routes are not unique');

    const home = HomeSchema.parse(readEditorialJson('home.json'));
    const featured = validateEditorialReferences(home.featuredDocumentIds, documents, 'Home')
      .map((document) => {
        if (document.kind !== 'readable') throw new Error(`Home feature is not readable: ${document.id}`);
        return document;
      });

    const guideRecord = StartGuideSchema.parse(readEditorialJson('start.json'));
    const guideDocuments = validateEditorialReferences(
      guideRecord.items.map((item) => item.id),
      documents,
      'Start guide',
    );

    return {
      articles,
      works,
      documents,
      featured,
      guide: {
        title: guideRecord.title,
        introduction: guideRecord.introduction,
        items: guideRecord.items.map((item, index) => ({
          document: guideDocuments[index],
          reason: item.reason,
        })),
      },
    };
  })();

  return cachedData;
}
