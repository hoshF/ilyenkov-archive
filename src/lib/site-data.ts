import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { renderPublicMarkdown } from './markdown';
import {
  resolvePublicationPath,
  websitePublicationArtifacts,
  type PublicationArtifact,
} from './publication-source';

const projectRoot = process.cwd();

const ArticleRecordSchema = z.object({
  schema_version: z.number(),
  slug: z.string().min(1),
  title_zh: z.string().min(1),
  primary_author_id: z.string().min(1),
  published_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_doi: z.string().nullable(),
  source_url: z.string().url(),
  source_license: z.string().nullable(),
  translation_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  rights_status: z.string(),
  blog_draft: z.boolean(),
}).passthrough();

const EditorialDescriptionsSchema = z.record(z.string(), z.string().min(1));
const HomeSchema = z.object({ featuredDocumentIds: z.array(z.string()).min(1) });
const StartGuideSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  items: z.array(z.object({ id: z.string(), reason: z.string().min(1) })),
});

const authorLabels: Record<string, string> = {
  maidansky: '安德烈·迈丹斯基',
};

export interface ReadableDocument {
  kind: 'readable';
  id: string;
  route: string;
  title: string;
  author: string;
  contentNature: '研究译文';
  publishedDate: string;
  description: string | null;
  html: string;
  sourceUrl: string;
  doiUrl: string | null;
  sourceLicense: string | null;
  rightsLabel: string;
  translationSha256: string;
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

function readPublicationJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolvePublicationPath(relativePath), 'utf8'));
}

function readEditorialJson(filename: string): unknown {
  return JSON.parse(readFileSync(path.join(projectRoot, 'editorial', filename), 'utf8'));
}

function doiUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://doi.org/${value}`;
}

function rightsLabel(status: string): string {
  if (status === 'author_permission') return '中文译文经作者许可公开';
  return '权利依据见公开研究记录';
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
  approvals: PublicationArtifact[],
): Promise<ReadableDocument[]> {
  const translationApprovals = approvals
    .filter((item) => item.content_category === 'translation')
    .sort((left, right) => left.source_path.localeCompare(right.source_path));

  return Promise.all(translationApprovals.map(async (approval) => {
    const match = approval.source_path.match(
      /^translation_workspace\/articles\/maidansky\/([^/]+)\/translation\.md$/,
    );
    if (!match) throw new Error(`Unsupported website-approved translation path: ${approval.source_path}`);
    const directory = match[1];
    if (!approval.presentation_metadata) {
      throw new Error(`Website translation lacks presentation metadata: ${approval.source_path}`);
    }
    const record = ArticleRecordSchema.parse(readPublicationJson(approval.presentation_metadata));
    if (record.blog_draft) throw new Error(`Public article is still marked draft: ${record.slug}`);
    if (record.slug !== directory) throw new Error(`Article slug does not match directory: ${directory}`);

    const markdownBytes = readFileSync(resolvePublicationPath(approval.bundle_path));
    const actualHash = createHash('sha256').update(markdownBytes).digest('hex');
    if (actualHash !== record.translation_sha256 || actualHash !== approval.sha256) {
      throw new Error(`Translation hash mismatch for ${record.slug}`);
    }

    const parsed = matter(markdownBytes.toString('utf8'));
    if (parsed.data.title !== record.title_zh) {
      throw new Error(`Translation title mismatch for ${record.slug}`);
    }

    return {
      kind: 'readable',
      id: record.slug,
      route: `/documents/${record.slug}`,
      title: record.title_zh,
      author: authorLabels[record.primary_author_id] ?? record.primary_author_id,
      contentNature: '研究译文',
      publishedDate: record.published_date,
      description: descriptions[record.slug] ?? null,
      html: await renderPublicMarkdown(parsed.content),
      sourceUrl: record.source_url,
      doiUrl: doiUrl(record.source_doi),
      sourceLicense: record.source_license,
      rightsLabel: rightsLabel(record.rights_status),
      translationSha256: record.translation_sha256,
    } satisfies ReadableDocument;
  }));
}

let cachedData: Promise<SiteData> | undefined;

export function getSiteData(): Promise<SiteData> {
  cachedData ??= (async () => {
    const descriptions = EditorialDescriptionsSchema.parse(readEditorialJson('article-descriptions.json'));
    const articles = await loadArticles(descriptions, websitePublicationArtifacts());
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
