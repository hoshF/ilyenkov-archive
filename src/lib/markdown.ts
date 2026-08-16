import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

export async function renderPublicMarkdown(markdown: string): Promise<string> {
  const rendered = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      allowDangerousHtml: false,
      footnoteLabel: '脚注',
      footnoteBackLabel: '返回正文',
    })
    .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: '' })
    .use(rehypeStringify)
    .process(markdown);

  return String(rendered);
}
