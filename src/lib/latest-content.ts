import { getGroupIssues, type GroupIssue } from './group';
import { getSiteData, type ReadableDocument } from './site-data';

/** 首页的内容入口，身份与日期均派生自现有栏目，不另建事实文件。 */
export interface ContentEntry {
  type: string;
  title: string;
  href: string;
  author?: string;
  date?: string;
  dateLabel?: string;
}

export const HOME_CONTENT_LIMIT = 4;

/**
 * 有本站公开日期的内容优先，按公开日期倒序。
 * 译文未记录本站公开日期，随后保留 getSiteData 的档案顺序；year 仅作书目信息。
 * 不将原文年份与公开日期混排，也不推断或补造公开日期。
 * 研究的历史事件日期与书籍的内部版次日期不进入这个集合。
 * 将来研究、会议记录或资料成为公开成果时，可直接沿用小组记录的 kind。
 */
export function collectLatestContent(
  articles: Pick<ReadableDocument, 'title' | 'route' | 'authorLabel' | 'year'>[],
  issues: Pick<GroupIssue, 'title' | 'route' | 'kind' | 'published'>[],
): ContentEntry[] {
  const publishedIssues = [...issues].sort((left, right) => (
    right.published.localeCompare(left.published)
      || left.title.localeCompare(right.title, 'zh-Hans-CN')
      || left.route.localeCompare(right.route)
  ));

  return [
    ...publishedIssues.map((issue) => ({
      type: issue.kind,
      title: issue.title,
      href: issue.route,
      date: issue.published,
      dateLabel: '公开日期',
    })),
    ...articles.map((article) => ({
      type: '译文',
      title: article.title,
      href: article.route,
      author: article.authorLabel,
      date: article.year,
      dateLabel: '原文年份',
    })),
  ];
}

export async function getLatestContent(): Promise<ContentEntry[]> {
  const [{ articles }, issues] = await Promise.all([getSiteData(), getGroupIssues()]);
  return collectLatestContent(articles, issues);
}
