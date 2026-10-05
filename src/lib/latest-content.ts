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
 * 按内容记录日期排列的阅读入口，不是网站发布历史。
 * 译文只有原文年份；小组成果有公开日期。保持原有精度，不补月份或日期。
 * 研究的历史事件日期与书籍的内部版次日期不进入这个集合。
 * 将来研究、会议记录或资料成为公开成果时，可直接沿用小组记录的 kind。
 */
export function collectLatestContent(
  articles: Pick<ReadableDocument, 'title' | 'route' | 'authorLabel' | 'year'>[],
  issues: Pick<GroupIssue, 'title' | 'route' | 'kind' | 'published'>[],
): ContentEntry[] {
  const entries: ContentEntry[] = [
    ...articles.map((article) => ({
      type: '译文',
      title: article.title,
      href: article.route,
      author: article.authorLabel,
      date: article.year,
      dateLabel: '原文年份',
    })),
    ...issues.map((issue) => ({
      type: issue.kind,
      title: issue.title,
      href: issue.route,
      date: issue.published,
      dateLabel: '公开日期',
    })),
  ];

  return entries.sort((left, right) => (
    (right.date ?? '').localeCompare(left.date ?? '')
      || left.title.localeCompare(right.title, 'zh-Hans-CN')
      || left.href.localeCompare(right.href)
  ));
}

export async function getLatestContent(): Promise<ContentEntry[]> {
  const [{ articles }, issues] = await Promise.all([getSiteData(), getGroupIssues()]);
  return collectLatestContent(articles, issues);
}
