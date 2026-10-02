import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { buildCache } from './cache';
import { renderPublicMarkdown, type ArticleHeading } from './markdown';

const groupRoot = path.join(process.cwd(), 'editorial', 'group');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** YAML 会把不带引号的 2026-10-01 解析成 Date，两种写法都归一化为 YYYY-MM-DD。 */
const IsoDateSchema = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
);

/**
 * 一期的公开元数据。`published` 是这一期在网站公开的日期，不是文本所记历史事件的日期；
 * 后一种日期属于研究记录，见 src/lib/research-records.ts。
 */
export const GroupIssueSchema = z.object({
  issue: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
  /** 简短类型标签：小组说明、研究、讨论记录、资料整理等。 */
  kind: z.string().trim().min(1),
  published: IsoDateSchema,
  /** 列表页用的简短摘要。 */
  summary: z.string().trim().min(1),
}).strict();

export type GroupIssueRecord = z.infer<typeof GroupIssueSchema>;

export interface GroupIssue extends GroupIssueRecord {
  id: string;
  route: string;
  html: string;
  /** 正文的二级标题；没有二级标题时为空，详情页据此决定是否显示页内目录。 */
  headings: ArticleHeading[];
}

function recordIds(): string[] {
  if (!existsSync(groupRoot)) return [];
  return readdirSync(groupRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .filter((id) => idPattern.test(id))
    .sort();
}

/**
 * 按期号从新到旧。排序只看 issue，不依赖文件名字符串——`10.md` 的字符串序在 `2.md` 之前，
 * 但期号是数字。id 只作为同号记录的兜底比较，让顺序始终确定。
 */
function byIssueDescending(left: GroupIssue, right: GroupIssue): number {
  return right.issue - left.issue || left.id.localeCompare(right.id);
}

export const getGroupIssues = buildCache((): Promise<GroupIssue[]> => (
  Promise.all(recordIds().map(async (id) => {
    const record = matter(readFileSync(path.join(groupRoot, `${id}.md`), 'utf8'));
    const metadata = GroupIssueSchema.parse(record.data);
    if (metadata.issue !== Number(id)) {
      throw new Error(`Group record filename does not match its issue number: ${id}`);
    }

    const body = record.content.trim();
    if (!body) throw new Error(`Group record has no body: ${id}`);

    const rendered = await renderPublicMarkdown(body);
    return {
      ...metadata,
      id,
      route: `/group/${id}`,
      html: rendered.html,
      headings: rendered.headings,
    } satisfies GroupIssue;
  })).then((issues) => {
    const seenIssues = new Set<number>();
    for (const issue of issues) {
      if (seenIssues.has(issue.issue)) throw new Error(`Group issue number is not unique: ${issue.issue}`);
      seenIssues.add(issue.issue);
    }
    return issues.sort(byIssueDescending);
  })
));

/** 相邻期按期号取，不按列表位置：上一期 = issue - 1，下一期 = issue + 1。 */
export function adjacentIssues(
  issues: GroupIssue[],
  issue: GroupIssueRecord,
): { previous: GroupIssue | null; next: GroupIssue | null } {
  return {
    previous: issues.find((candidate) => candidate.issue === issue.issue - 1) ?? null,
    next: issues.find((candidate) => candidate.issue === issue.issue + 1) ?? null,
  };
}
