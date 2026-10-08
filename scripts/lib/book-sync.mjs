import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { BookSchema, GeneratedBooksSchema } from '../../src/lib/book-record.mjs';
import { publicationRelative } from './paths.mjs';
import { fail, idPattern, object, readResearchJson, requiredString, resolveResearchPath } from './validation.mjs';

/** Website book records select editorial only, independently of translation body permissions. */
export function plannedBooks({ researchRoot }) {
  const publication = readResearchJson(researchRoot, publicationRelative, publicationRelative);
  if (!Array.isArray(publication.books)) fail(`${publicationRelative}: books must be an array`);
  const selected = [];
  const seen = new Set();
  for (const [index, rawEntry] of publication.books.entries()) {
    const label = `${publicationRelative} books[${index}]`;
    const entry = object(rawEntry, label);
    if (entry.publication_scope !== 'website_public') continue;
    for (const key of Object.keys(entry)) {
      if (!['book_id', 'publication_scope', 'editorial_path'].includes(key)) fail(`${label}: unsupported field ${key}`);
    }
    const id = requiredString(entry, 'book_id', label);
    if (!idPattern.test(id) || seen.has(id)) fail(`${label}: invalid or duplicate book_id`);
    seen.add(id);
    const relative = requiredString(entry, 'editorial_path', label);
    if (relative !== `web/editorial/books/${id}.md`) fail(`${label}: editorial_path must use web/editorial/books/<book_id>.md`);
    const file = resolveResearchPath(researchRoot, relative, label);
    if (!existsSync(file)) fail(`missing ${relative}`);
    const editorialRoot = `${path.join(realpathSync(researchRoot), 'web', 'editorial', 'books')}${path.sep}`;
    if (!realpathSync(file).startsWith(editorialRoot)) fail(`${label}: editorial_path escapes web/editorial/books`);
    const manuscript = matter(readFileSync(file, 'utf8'));
    const metadata = BookSchema.parse(manuscript.data);
    const introduction = manuscript.content.trim();
    if (!introduction) fail(`${label}: book record has no introduction`);
    selected.push({ id, ...metadata, introduction });
  }
  return GeneratedBooksSchema.parse(selected);
}
