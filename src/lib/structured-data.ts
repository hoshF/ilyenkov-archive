import { site } from './editorial';
import type { Book } from './books';
import type { PublicIlyenkovProfile } from './research-records';
import type { ReadableDocument } from './site-data';

/**
 * schema.org 结构化数据：只描述页面上已经公开的事实，不新增编辑判断。
 * 站点实体（Organization / WebSite）每页各出现一次，页面实体通过 @id 引用它们，
 * 这样单页被单独抓取时也能解析出发布者与所属站点。
 */
export type JsonLdNode = Record<string, unknown>;


/** 内联进 <script> 的 JSON 不能出现会闭合标签或破坏解析的字符。 */
export function serializeJsonLd(nodes: readonly JsonLdNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const siteRoot = (pageUrl: URL): string => new URL('/', pageUrl).href;
const absolute = (pageUrl: URL, path: string): string => new URL(path, pageUrl).href;
// 站点实体的 @id 用绝对地址：同一实现在不同页面、不同抓取器里都指向同一个节点。
const organizationId = (pageUrl: URL): string => `${siteRoot(pageUrl)}#organization`;
const websiteId = (pageUrl: URL): string => `${siteRoot(pageUrl)}#website`;

export function organizationNode(pageUrl: URL): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': organizationId(pageUrl),
    name: site.group.name,
    alternateName: [site.group.englishName, site.group.originalName],
    url: siteRoot(pageUrl),
    description: site.group.summary,
    email: site.contact.email,
  };
}

export function websiteNode(pageUrl: URL): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': websiteId(pageUrl),
    url: siteRoot(pageUrl),
    name: site.name,
    description: site.description,
    inLanguage: 'zh-CN',
    publisher: { '@id': organizationId(pageUrl) },
  };
}

export function webPageNode(pageUrl: URL, title: string, description: string): JsonLdNode {
  return {
    '@type': 'WebPage',
    '@id': `${pageUrl.href}#webpage`,
    url: pageUrl.href,
    name: title,
    description,
    inLanguage: 'zh-CN',
    isPartOf: { '@id': websiteId(pageUrl) },
  };
}

/**
 * 译文页：原文作者、原文题名、发表年份与原文出处都来自发布输入，
 * 用 translationOfWork 明确“这是某部作品的译本”，供搜索引擎与 AI 区分原作与译文。
 */
export function articleNode(pageUrl: URL, document: ReadableDocument): JsonLdNode {
  const authors = document.author.map((name) => ({ '@type': 'Person', name }));
  return {
    '@type': 'ScholarlyArticle',
    '@id': `${pageUrl.href}#article`,
    url: pageUrl.href,
    headline: document.title,
    name: document.title,
    alternativeHeadline: document.originalTitle,
    inLanguage: 'zh-CN',
    author: authors,
    publisher: { '@id': organizationId(pageUrl) },
    mainEntityOfPage: { '@id': `${pageUrl.href}#webpage` },
    isAccessibleForFree: true,
    isBasedOn: document.sourceUrl ?? undefined,
    translationOfWork: {
      '@type': 'CreativeWork',
      name: document.originalTitle,
      datePublished: document.year,
      author: authors,
    },
    about: document.topics.map((topic) => ({ '@type': 'Thing', name: topic.label })),
  };
}

export function bookNode(pageUrl: URL, book: Book): JsonLdNode {
  return {
    '@type': 'Book',
    '@id': `${pageUrl.href}#book`,
    url: pageUrl.href,
    name: book.title,
    alternateName: book.original_title,
    inLanguage: book.category === 'translation' ? 'zh-CN' : undefined,
    image: book.cover ? absolute(pageUrl, book.cover) : undefined,
  };
}

export function personNode(
  pageUrl: URL,
  profile: PublicIlyenkovProfile,
  portrait: { src: string } | undefined,
): JsonLdNode {
  const [birthDate, deathDate] = profile.lifespan.split('—');
  return {
    '@type': 'Person',
    '@id': `${pageUrl.href}#person`,
    url: pageUrl.href,
    name: profile.identity,
    alternateName: profile.originalName,
    birthDate,
    deathDate,
    description: profile.description,
    sameAs: (profile.resources ?? []).filter((resource) => resource.kind === 'wikipedia_zh').map((resource) => resource.url),
    image: portrait ? absolute(pageUrl, portrait.src) : undefined,
    mainEntityOfPage: { '@id': `${pageUrl.href}#webpage` },
  };
}
