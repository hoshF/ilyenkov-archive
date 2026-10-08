import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { buildCache } from './cache';
import { renderPublicMarkdown } from './markdown';
import { BookSchema, GeneratedBooksSchema, BOOK_CATEGORIES } from './book-record.mjs';
export { BOOK_CATEGORIES } from './book-record.mjs';
export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export const BOOK_CATEGORY_LABELS: Record<BookCategory, string> = {
  translation: '译作', digitization: '数字化文本',
};

const booksPath = path.join(process.cwd(), '.website-input', 'books.json');

export type BookEdition = z.infer<typeof BookSchema>['editions'][number];

export interface Book extends z.infer<typeof BookSchema> {
  id: string;
  route: string;
  /** 译者引言：由小组撰写的介绍性文字，不是书籍正文。 */
  introductionHtml: string;
  latestEdition: BookEdition;
}

export const getBooks = buildCache((): Promise<Book[]> => {
  const records = GeneratedBooksSchema.parse(JSON.parse(readFileSync(booksPath, 'utf8')));
  return Promise.all([...records].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0).map(async (record) => {
    const { id, introduction, ...metadata } = record;
    const editions = [...metadata.editions].sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...metadata,
      id,
      route: `/books/${id}`,
      introductionHtml: (await renderPublicMarkdown(introduction)).html,
      latestEdition: editions[editions.length - 1],
      editions,
    } satisfies Book;
  }));
});

export interface BookCollection {
  name: string;
  books: Book[];
}

export interface BookGroup {
  category: BookCategory;
  label: string;
  /** 不属于任何文集的单本书。 */
  standalone: Book[];
  /** 按 collection 字段聚在一起的书，顺序取第一次出现的顺序。 */
  collections: BookCollection[];
}

/**
 * 按产出方式（category）分组，组内再按文集（collection）聚类。
 * 空分类不出现在结果里，页面不需要自己判断“这一类有没有书”。
 */
export function groupBooks(books: Book[]): BookGroup[] {
  return BOOK_CATEGORIES.map((category) => {
    const standalone: Book[] = [];
    const collectionOrder: string[] = [];
    const collectionBooks = new Map<string, Book[]>();

    for (const book of books) {
      if (book.category !== category) continue;
      if (!book.collection) {
        standalone.push(book);
        continue;
      }
      if (!collectionBooks.has(book.collection)) {
        collectionBooks.set(book.collection, []);
        collectionOrder.push(book.collection);
      }
      collectionBooks.get(book.collection)!.push(book);
    }

    return {
      category,
      label: BOOK_CATEGORY_LABELS[category],
      standalone,
      collections: collectionOrder.map((name) => ({ name, books: collectionBooks.get(name)! })),
    };
  }).filter((group) => group.standalone.length > 0 || group.collections.length > 0);
}
