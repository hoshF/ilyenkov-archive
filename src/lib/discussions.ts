import { z } from 'zod';
import { readEditorialJson, site } from './editorial';

/**
 * 文章与论坛话题的人工关联：public 维护的稀疏编辑标注，键是文章已有的公开 ID，
 * 每篇至多一个话题。只保存话题编号与关系，不保存论坛标题、帖子或回复数。
 */
const DiscussionSchema = z.object({
  topicId: z.number().int().positive(),
  relation: z.enum(['article', 'related']),
}).strict();

export const DiscussionsSchema = z.record(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), DiscussionSchema);

const labels = { article: '讨论本文', related: '相关讨论' } as const;

export interface ArticleDiscussion {
  href: string;
  label: (typeof labels)[keyof typeof labels];
}

/**
 * 按已发布文章的 ID 解析讨论关联。关联到未发布文章的标注不静默忽略：private 撤回文章后，
 * public 须同步删除对应标注，否则构建失败。话题地址由 forumUrl 与 topicId 派生。
 */
export function articleDiscussions(
  publishedIds: readonly string[],
  source: unknown = readEditorialJson('discussions.json'),
  forumUrl: string = site.forumUrl,
): Map<string, ArticleDiscussion> {
  const entries = DiscussionsSchema.parse(source);
  const published = new Set(publishedIds);
  const stale = Object.keys(entries).filter((id) => !published.has(id));
  if (stale.length > 0) {
    throw new Error(`editorial/discussions.json links articles that are not published; remove these stale entries: ${stale.join(', ')}`);
  }
  return new Map(Object.entries(entries).map(([id, { topicId, relation }]) => [
    id,
    { href: new URL(`t/${topicId}`, forumUrl).href, label: labels[relation] },
  ]));
}
