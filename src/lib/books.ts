import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { renderPublicMarkdown } from './markdown';

const booksRoot = path.join(process.cwd(), 'editorial', 'books');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** YAML 会把不带引号的 2026-01-15 解析成 Date，两种写法都归一化为 YYYY-MM-DD。 */
const IsoDateSchema = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
);

const EditionSchema = z.object({
  version: z.string().trim().min(1),
  date: IsoDateSchema,
  checksum: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
}).strict();

/** 书的产出方式：译作是小组翻译成中文的；数字化文本保留原文语言，只做扫描/录入整理。 */
export const BOOK_CATEGORIES = ['translation', 'digitization'] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export const BOOK_CATEGORY_LABELS: Record<BookCategory, string> = {
  translation: '译作',
  digitization: '数字化文本',
};

const BookSchema = z.object({
  title: z.string().trim().min(1),
  original_title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1),
  cover: z.string().regex(/^\/covers\/[a-z0-9-]+\.(?:jpg|png|webp)$/).optional(),
  /** 原文出处：这段文字原本在哪本书/文集里，不是“翻译时用的印本”那种底本概念。 */
  original_source: z.string().trim().min(1).optional(),
  /** 原著初版年份，只用于列表页的一行元信息；不确定就留空，不要拿本站版次的年份顶替。 */
  original_year: z.string().regex(/^\d{4}$/).optional(),
  /** 原著体裁，自由格式（“著作”“专著”“文集”都可以），留空时列表页退回 category 的标签。 */
  work_type: z.string().trim().min(1).optional(),
  category: z.enum(BOOK_CATEGORIES).default('translation'),
  /** 文集/丛书名。多本书共享同一个 collection 时，列表页把它们聚在一起显示。 */
  collection: z.string().trim().min(1).optional(),
  /** 在文集里的位置，自由格式（“上卷”“第二册”“1”都可以），只在有 collection 时才有意义。 */
  volume_label: z.string().trim().min(1).optional(),
  rights: z.string().trim().min(1).optional(),
  download: z.object({
    label: z.string().trim().min(1),
    href: z.string().trim().min(1),
  }).strict().optional(),
  editions: z.array(EditionSchema).min(1),
  errata: z.array(z.string().trim().min(1)).optional(),
}).strict();

export type BookEdition = z.infer<typeof EditionSchema>;

export interface Book extends z.infer<typeof BookSchema> {
  id: string;
  route: string;
  /** 译者引言：由小组撰写的介绍性文字，不是书籍正文。 */
  introductionHtml: string;
  latestEdition: BookEdition;
}

function bookIds(): string[] {
  if (!existsSync(booksRoot)) return [];
  return readdirSync(booksRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .filter((id) => idPattern.test(id))
    .sort();
}

let cachedBooks: Promise<Book[]> | undefined;

export function getBooks(): Promise<Book[]> {
  cachedBooks ??= Promise.all(bookIds().map(async (id) => {
    const record = matter(readFileSync(path.join(booksRoot, `${id}.md`), 'utf8'));
    const metadata = BookSchema.parse(record.data);
    const introduction = record.content.trim();
    if (!introduction) throw new Error(`Book record has no translator introduction: ${id}`);

    const editions = [...metadata.editions].sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...metadata,
      id,
      route: `/books/${id}`,
      introductionHtml: await renderPublicMarkdown(introduction),
      latestEdition: editions[editions.length - 1],
      editions,
    } satisfies Book;
  }));

  return cachedBooks;
}

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
