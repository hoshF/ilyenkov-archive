import { z } from 'zod';

/** @type {readonly ['person', 'organization', 'institution', 'work', 'journal']} */
export const GLOSSARY_NAME_TYPES = ['person', 'organization', 'institution', 'work', 'journal'];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SlugSchema = z.string().refine((value) => slugPattern.exec(value)?.[0] === value,
  { message: 'Must be a complete lowercase slug' });
const NonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0,
  { message: 'Must be a non-empty string' });

export const GeneratedGlossaryRecordSchema = z.object({
  collection: SlugSchema,
  id: SlugSchema,
  canonical: NonEmptyStringSchema,
  forms: z.array(NonEmptyStringSchema),
  zh_preferred: NonEmptyStringSchema,
  zh_alternatives: z.array(NonEmptyStringSchema),
  notes: z.string(),
  type: z.enum(GLOSSARY_NAME_TYPES).optional(),
}).strict().superRefine((entry, context) => {
  if (entry.collection === 'glossary' && entry.type === undefined) {
    context.addIssue({ code: 'custom', path: ['type'], message: 'Names require a type' });
  } else if (entry.collection !== 'glossary' && Object.hasOwn(entry, 'type')) {
    context.addIssue({ code: 'custom', path: ['type'], message: 'Only names may have a type' });
  }
});

export const GeneratedGlossarySchema = z.array(GeneratedGlossaryRecordSchema).superRefine((entries, context) => {
  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    const identity = `${entry.collection}/${entry.id}`;
    if (seen.has(identity)) {
      context.addIssue({ code: 'custom', path: [index, 'id'], message: `Duplicate glossary identity ${identity}` });
    }
    seen.add(identity);
  }
});
