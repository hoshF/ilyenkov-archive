import { z } from 'zod';

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
/** @type {readonly ['translation', 'digitization']} */
export const BOOK_CATEGORIES = ['translation', 'digitization'];

export const BookSchema = z.object({
  title: z.string().trim().min(1),
  original_title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1),
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


export const GeneratedBooksSchema = z.array(BookSchema.extend({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  introduction: z.string().trim().min(1),
}).strict()).refine((books) => new Set(books.map((book) => book.id)).size === books.length,
  { message: 'Generated book identities must be unique' });
