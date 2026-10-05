import { z } from 'zod';
import { buildCache } from './cache';
import { readEditorialJson } from './editorial';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Update date must be a real calendar date');

const PublicLinkSchema = z.string().trim().min(1).refine((value) => {
  // 只接受站内绝对路由与 http(s)，避免协议相对地址、控制字符与反斜线。
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol)
      && Boolean(parsed.host)
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}, 'Update link must be a public site route or HTTP(S) URL');

/**
 * public 自行维护的公开变化记录。日期是所述变化的日期，说明作为普通文本输出；
 * 动态没有正文或独立内容路由，也不代替译文、研究和小组记录的事实源。
 */
export const UpdateSchema = z.object({
  date: DateSchema,
  summary: z.string().trim().min(1),
  link: PublicLinkSchema.optional(),
  link_label: z.string().trim().min(1).optional(),
}).strict().refine((update) => !update.link_label || Boolean(update.link), {
  message: 'Update link label requires a link',
  path: ['link_label'],
});

export const UpdatesSchema = z.array(UpdateSchema);
export type Update = z.infer<typeof UpdateSchema>;
export const HOME_UPDATES_LIMIT = 4;

/** 日期倒序；同日保留 editorial 中的顺序，不另设排序字段。空数组同样有效。 */
export function parseUpdates(records: unknown): Update[] {
  return UpdatesSchema.parse(records).sort((left, right) => right.date.localeCompare(left.date));
}

export const getUpdates = buildCache((): Update[] => parseUpdates(readEditorialJson('updates.json')));
