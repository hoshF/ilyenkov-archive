import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const projectRoot = process.cwd();

const LinkSchema = z.object({
  label: z.string().trim().min(1),
  href: z.string().regex(/^\/[a-z0-9/-]*(?:\.xml)?$/),
}).strict();

export const SiteSchema = z.object({
  name: z.string().trim().min(1),
  /** 刊头第二行的俄文全名，单行西里尔字母，页面以 lang="ru" 输出。 */
  subtitleRu: z.string().trim().regex(/^[\p{Script=Cyrillic}][\p{Script=Cyrillic} .-]*$/u),
  description: z.string().trim().min(1),
  group: z.object({
    name: z.string().trim().min(1),
    originalName: z.string().trim().min(1),
    englishName: z.string().trim().min(1),
    summary: z.string().trim().min(1),
  }).strict(),
  contact: z.object({
    email: z.email(),
  }).strict(),
  /** 论坛基址：主导航“讨论”、各处“讨论社区”与文章讨论话题的地址都由它派生，迁移域名只改这一处。 */
  forumUrl: z.url({ protocol: /^https$/ }).regex(/\/$/, { message: 'forumUrl must end with /' }),
  navigation: z.array(LinkSchema).min(1),
  footer: z.array(LinkSchema).min(1),
}).strict();

export function readEditorialJson(filename: string): unknown {
  return JSON.parse(readFileSync(path.join(projectRoot, 'editorial', filename), 'utf8'));
}

export const site = SiteSchema.parse(readEditorialJson('site.json'));
