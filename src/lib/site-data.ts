import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { renderPublicMarkdown } from './markdown';
import {
  resolvePublicationPath,
  websitePublicationArtifacts,
  type PublicationArtifact,
} from './publication-source';

const projectRoot = process.cwd();

const EditorialDescriptionsSchema = z.record(z.string(), z.string().min(1));
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
  author: string;
  contentNature: '研究译文';
  publishedDate: string;
  description: string | null;
  html: string;
  sourceUrl: string;
  doiUrl: string | null;
  sourceLicense: string | null;
  rightsLabel: string;
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

function readEditorialJson(filename: string): unknown {
  return JSON.parse(readFileSync(path.join(projectRoot, 'editorial', filename), 'utf8'));
}

function doiUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://doi.org/${value}`;
}

function rightsLabel(basis: PublicationArtifact['rights']['basis']): string {
  if (basis === 'author_permission') return '中文译文经作者许可公开';
  return '中文译文依据所列原文许可公开';
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
    .filter((item) => item.kind === 'translation')
    .sort((left, right) => left.slug.localeCompare(right.slug));

  return Promise.all(translationApprovals.map(async (approval) => {
    const markdownBytes = readFileSync(resolvePublicationPath(approval.content.path));
    const actualHash = createHash('sha256').update(markdownBytes).digest('hex');
    if (actualHash !== approval.content.sha256) {
      throw new Error(`Translation hash mismatch for ${approval.slug}`);
    }

    const author = approval.authors.map((item) => item.display_name).join('、');

    return {
      kind: 'readable',
      id: approval.slug,
      route: `/documents/${approval.slug}`,
      title: approval.title,
      author,
      contentNature: '研究译文',
      publishedDate: approval.published_date,
      description: descriptions[approval.slug] ?? null,
      html: await renderPublicMarkdown(markdownBytes.toString('utf8')),
      sourceUrl: approval.source.url,
      doiUrl: doiUrl(approval.source.doi),
      sourceLicense: approval.source.license,
      rightsLabel: rightsLabel(approval.rights.basis),
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
