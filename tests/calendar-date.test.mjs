import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCalendarDate } from '../src/lib/calendar-date.mjs';
import { BookSchema, GeneratedBooksSchema } from '../src/lib/book-record.mjs';
import { GroupIssueSchema, getGroupAnnouncement } from '../src/lib/group';
import { UpdateSchema } from '../src/lib/updates';
import { collectRssItems } from '../src/lib/rss';
import { plannedBooks } from '../scripts/lib/book-sync.mjs';

const injected = vi.hoisted(() => ({ announcement: undefined }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFileSync(file, ...args) {
      if (injected.announcement !== undefined && String(file) === path.join(process.cwd(), 'editorial/group-announcement.md')) {
        return injected.announcement;
      }
      return actual.readFileSync(file, ...args);
    },
  };
});

afterEach(() => { injected.announcement = undefined; });

const validDates = ['2026-01-15', '2024-02-29', '2000-02-29', '1900-02-28', '2026-04-30'];
const invalidDates = [
  '2026-02-29', '1900-02-29', '2100-02-29', '2026-02-31', '2026-04-31',
  '2026-13-01', '2026-00-01', '2026-01-00', '0000-00-00', '2026-01-32',
  '2026-1-15', '2026-01-5', '2026/01/15', '2026-01-15T00:00:00Z',
  ' 2026-01-15', '2026-01-15 ', '2026', '2026-01', '',
];
const book = (date) => ({ title: 'Synthetic book', author: 'Synthetic author', editions: [{ version: 'v1', date }] });
const issue = (date) => ({ issue: 0, title: 'Synthetic issue', kind: '研究', published: date, summary: 'Synthetic summary' });
const update = (date) => ({ date, summary: 'Synthetic update' });
const rssIssue = (date) => ({ ...issue(date), route: '/group/0/' });
const site = 'https://example.test/';

describe('complete calendar dates across public channels', () => {
  it.each(validDates)('accepts %s without changing its value or UTC encoding', (date) => {
    expect(isCalendarDate(date)).toBe(true);
    expect(BookSchema.parse(book(date)).editions[0].date).toBe(date);
    expect(GeneratedBooksSchema.parse([{ ...book(date), id: 'synthetic-book', introduction: 'Introduction' }])[0].editions[0].date).toBe(date);
    expect(GroupIssueSchema.parse(issue(date)).published).toBe(date);
    expect(UpdateSchema.parse(update(date)).date).toBe(date);
    for (const items of [collectRssItems([rssIssue(date)], [], site), collectRssItems([], [update(date)], site)]) {
      expect(items[0].pubDate.toISOString()).toBe(`${date}T00:00:00.000Z`);
    }
  });

  it.each(invalidDates)('rejects %j at each input schema and at the RSS boundary', (date) => {
    expect(isCalendarDate(date)).toBe(false);
    for (const [schema, input, field] of [
      [BookSchema, book(date), ['editions', 0, 'date']],
      [GroupIssueSchema, issue(date), ['published']],
      [UpdateSchema, update(date), ['date']],
    ]) {
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error.issues.some((entry) => JSON.stringify(entry.path) === JSON.stringify(field))).toBe(true);
    }
    expect(GeneratedBooksSchema.safeParse([{ ...book(date), id: 'synthetic-book', introduction: 'Introduction' }]).success).toBe(false);
    expect(() => collectRssItems([rssIssue(date)], [], site)).toThrow(/real website publication date/);
    expect(() => collectRssItems([], [update(date)], site)).toThrow(/real website publication date/);
  });

  it.each(validDates)('accepts valid YAML Date inputs and quoted strings: %s', (date) => {
    const yamlDate = matter(`---\npublished: ${date}\n---\n`).data.published;
    expect(yamlDate).toBeInstanceOf(Date);
    expect(BookSchema.parse(book(yamlDate)).editions[0].date).toBe(date);
    expect(GroupIssueSchema.parse(issue(yamlDate)).published).toBe(date);
    const quoted = matter(`---\npublished: '${date}'\n---\n`).data.published;
    expect(GroupIssueSchema.parse(issue(quoted)).published).toBe(date);
    expect(BookSchema.parse(book(quoted)).editions[0].date).toBe(date);
    // JSON updates retain their string-only input contract.
    expect(UpdateSchema.safeParse(update(yamlDate)).success).toBe(false);
  });

  it.each([...validDates, ...invalidDates])('validates announcement input before rendering: %j', async (date) => {
    injected.announcement = `---\npublished: ${JSON.stringify(date)}\n---\n## Synthetic announcement\n\nSynthetic body.\n`;
    if (validDates.includes(date)) {
      expect((await getGroupAnnouncement()).published).toBe(date);
    } else {
      await expect(getGroupAnnouncement()).rejects.toMatchObject({ issues: [expect.objectContaining({ path: ['published'] })] });
    }
  });

  it('rejects an invalid quoted edition date during book sync input validation', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ilyenkov-calendar-date-'));
    try {
      const editorial = path.join(root, 'web/editorial/books');
      mkdirSync(editorial, { recursive: true });
      writeFileSync(path.join(root, 'web/publication.json'), JSON.stringify({ books: [{
        book_id: 'synthetic-book', publication_scope: 'website_public', editorial_path: 'web/editorial/books/synthetic-book.md',
      }] }));
      const manuscript = path.join(editorial, 'synthetic-book.md');
      const write = (date) => writeFileSync(manuscript, `---\ntitle: Synthetic book\nauthor: Synthetic author\neditions:\n  - version: v1\n    date: '${date}'\n---\nSynthetic introduction.\n`);
      write('2024-02-29');
      expect(plannedBooks({ researchRoot: root })[0].editions[0].date).toBe('2024-02-29');
      write('2026-02-31');
      expect(() => plannedBooks({ researchRoot: root })).toThrow(/real calendar date/);
      expect(readFileSync(manuscript, 'utf8')).toContain('2026-02-31');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves original publication years independent of complete-date validation', () => {
    expect(BookSchema.parse({ ...book('2024-02-29'), original_year: '1997' }).original_year).toBe('1997');
  });
});
