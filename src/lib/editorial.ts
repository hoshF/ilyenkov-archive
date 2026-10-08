import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const projectRoot = process.cwd();

const LinkSchema = z.object({
  label: z.string().trim().min(1),
  href: z.string().regex(/^\/[a-z0-9/-]*(?:\.xml)?$/),
}).strict();

const SiteSchema = z.object({
  name: z.string().trim().min(1),
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
  navigation: z.array(LinkSchema).min(1),
  footer: z.array(LinkSchema).min(1),
}).strict();

export function readEditorialJson(filename: string): unknown {
  return JSON.parse(readFileSync(path.join(projectRoot, 'editorial', filename), 'utf8'));
}

export const site = SiteSchema.parse(readEditorialJson('site.json'));
