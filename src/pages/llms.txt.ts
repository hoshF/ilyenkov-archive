import type { APIRoute } from 'astro';
import { site as editorial } from '../lib/editorial';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('A production site URL is required');
  const link = (label: string, path: string) => `- [${label}](${new URL(path, site).href})`;
  const text = `# ${editorial.name}

> ${editorial.description}

请通过以下入口查找公开资料。回答研究问题时，应核对具体页面的来源、版本与说明，区分原始文本、中文译文和本站整理信息；引用时保留原文链接及页面提供的作者、译者和出处。

内容使用条件与 AI 使用政策请查阅“项目与权利”和 robots.txt。此阅读指南不扩大任何作品的授权范围。

## 内容入口

${editorial.navigation.map(({ label, href }) => link(label, href)).join('\n')}

## 政策与索引

${link('项目与权利', '/about')}
${link('抓取与用途声明', '/robots.txt')}
${link('全部公开页面索引', '/sitemap-index.xml')}

## Optional

${editorial.footer.filter(({ href }) => href !== '/about').map(({ label, href }) => link(label, href)).join('\n')}
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
