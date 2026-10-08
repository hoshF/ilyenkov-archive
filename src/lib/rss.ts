import { createHash } from 'node:crypto';
import type { RSSFeedItem } from '@astrojs/rss';
import XMLBuilder from 'fast-xml-builder';
import { getGroupIssues, type GroupIssue } from './group';
import { getUpdates, type Update } from './updates';

type PublishedContent = Pick<GroupIssue, 'title' | 'kind' | 'route' | 'published' | 'summary'>;

export interface PublicRssItem extends RSSFeedItem {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  customData: string;
}

const guidBuilder = new XMLBuilder({ ignoreAttributes: false, suppressBooleanAttributes: false });
const guidData = (guid: string): string => guidBuilder.build({
  guid: { '@_isPermaLink': 'false', '#text': guid },
});

function publicDate(date: string): Date {
  const value = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw new Error(`RSS requires a real website publication date: ${date}`);
  }
  // RSS 使用 Date 表达日期；UTC 零点是统一编码，不表示已知的公开时刻。
  return value;
}

/** 同一站内页面忽略尾斜线、查询与锚点；外部来源不冒充本站内容。 */
function pageIdentity(link: string | undefined, siteUrl: URL): string | null {
  if (!link) return null;
  const url = new URL(link, siteUrl);
  return url.origin === siteUrl.origin ? url.pathname.replace(/\/+$/, '') || '/' : null;
}

/** 只适配已有公开日期和摘要，不读取译文年份、历史日期、正文或构建日期。 */
export function collectRssItems(
  issues: PublishedContent[],
  updates: Update[],
  siteUrl: URL | string,
): PublicRssItem[] {
  const base = new URL(siteUrl);
  const publications = new Set<string>();
  const seenUpdates = new Set<string>();
  const items: PublicRssItem[] = issues.map((issue) => {
    const identity = pageIdentity(issue.route, base);
    if (!identity) throw new Error(`RSS content must link to a site page: ${issue.route}`);
    publications.add(`${issue.published}:${identity}`);
    return {
      title: `新增${issue.kind}：${issue.title}`,
      link: new URL(issue.route, base).href,
      pubDate: publicDate(issue.published),
      description: issue.summary,
      customData: guidData(`urn:ilyenkov:content:${identity}`),
    };
  });

  for (const update of updates) {
    const identity = pageIdentity(update.link, base);
    // 同页同日的动态由内容条目代表；不同日期的后续公开变化仍保留。
    if (identity && publications.has(`${update.date}:${identity}`)) continue;
    const hash = createHash('sha256')
      .update(JSON.stringify([update.date, update.summary, update.link ?? '']))
      .digest('hex');
    if (seenUpdates.has(hash)) continue;
    seenUpdates.add(hash);
    items.push({
      title: `近期动态：${update.summary}`,
      link: new URL(identity ? update.link! : '/updates/', base).href,
      pubDate: publicDate(update.date),
      description: update.summary,
      customData: guidData(`urn:ilyenkov:update:${hash}`),
    });
  }

  return items.sort((left, right) => (
    right.pubDate.getTime() - left.pubDate.getTime()
      || left.title.localeCompare(right.title, 'zh-Hans-CN')
      || left.customData.localeCompare(right.customData)
  ));
}

export async function getRssItems(siteUrl: URL | string): Promise<PublicRssItem[]> {
  return collectRssItems(await getGroupIssues(), getUpdates(), siteUrl);
}
