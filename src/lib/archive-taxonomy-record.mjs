import { z } from 'zod';

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TermSchema = z.object({
  label: z.string().trim().min(1),
}).strict();

const AssignmentSchema = z.object({
  topics: z.array(z.string().regex(idPattern)).default([]),
  persons: z.array(z.string().regex(idPattern)).default([]),
}).strict();

export const ArchiveTaxonomySchema = z.object({
  topics: z.record(z.string().regex(idPattern), TermSchema),
  persons: z.record(z.string().regex(idPattern), TermSchema),
  articles: z.record(z.string().regex(idPattern), AssignmentSchema),
}).strict();

