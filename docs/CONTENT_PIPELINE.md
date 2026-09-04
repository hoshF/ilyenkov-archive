# 公开内容同步与静态构建

## 整体流程

译文正文与结构化研究资料使用两条彼此独立、共同受 `website_public` 控制的输入通道：

```text
private/translation/publication.json
  │  只选择 publication_scope = website_public
  ▼
条目指定的 work.json + 同目录 <work_id>.md
  │  scripts/sync-translations.mjs
  ▼
.website-input/articles/<work_id>.md
  │  gray-matter 拆分 frontmatter 与 Markdown 正文
  ▼
src/lib/markdown.ts 将 Markdown 编译为 HTML
  │  src/pages/archive/[id].astro 生成每篇文章路由
  ▼
dist/archive/<slug>/index.html
```

```text
private/research/publication.json
  │  只选择 publication_scope = website_public
  ▼
条目指定的结构化记录 + 明确选择的公开来源
  │  scripts/sync-research-records.mjs
  ▼
.website-input/research-records.json
  │  src/lib/research-records.ts 校验并适配
  ▼
人物、年表、作品目录与研究栏目静态页面
```

## 1. 译文同步为 articles

`scripts/sync-translations.mjs` 读取 private 的发布清单，只处理 `website_public`。每个条目必须指向
有效的 `work.json`，且同目录必须存在 `<work_id>.md`。脚本不会扫描其余研究目录，也不会处理
`internal_public`。

生成的 frontmatter 包含：

- 原文标题和中文标题；
- 原文版本、原文链接和 DOI；
- 内容类型、private 相对来源和上游 Git revision。

articles 位于 `.website-input/`，因此只用于网站构建，不进入 Git。再次同步会更新变化的 articles，并清理
已不再标记为 `website_public` 的生成文章。

## 2. 研究资料同步为结构化输入

`scripts/sync-research-records.mjs` 读取 private 的研究发布清单，只处理清单逐项指定的记录、来源和
公开字段，不扫描整个研究目录。同步器分别验证路径、日期、来源关联与公开 URL，再生成单一的
`.website-input/research-records.json`。页面只通过 `src/lib/research-records.ts` 的严格 schema 和读取
接口使用这些数据。

生成结果不含 private 路径、来源 ID、内部状态、扫描件、日志或问题记录。`--check` 只比较现有生成
文件与计划输出，不改写内容。

## 3. frontmatter 与正文

`src/lib/site-data.ts` 使用 `gray-matter` 读取 article，并用严格 schema 校验 frontmatter。生成文件不应
手工修改；`npm run publication:check` 可以检查 articles 是否仍与 private 一致。

文章末尾的“原文信息”不在 Markdown 正文里硬编码。页面从 frontmatter 读取
`source_edition`、`source_url` 和 `doi`，有哪些字段就生成哪些行。

## 4. Markdown 如何变成 HTML

`src/lib/markdown.ts` 使用 Unified 流水线：

1. `remark-parse` 把 Markdown 解析成语法树；
2. `remark-gfm` 加入表格、脚注等 GFM 语法；
3. 本站插件处理中文访谈标签和重复“注释”标题；
4. `remark-rehype` 把 Markdown 语法树转为 HTML 语法树；
5. `rehype-sanitize` 过滤不安全原始 HTML；
6. `rehype-stringify` 输出 HTML 字符串。

## 5. Astro 如何生成页面

`src/pages/archive/[id].astro` 的 `getStaticPaths()` 在构建时取得全部 articles，为每个 slug 生成一个
静态路由。页面模板用 `set:html` 放入已经消毒的正文 HTML，再根据 frontmatter 生成原文信息。

`npm run publication:sync` 同时运行译文与研究资料同步器；`publication:prepare` 复用这条命令。
`npm run build` 会先自动执行 `publication:prepare`，所以完整顺序是：读取两个发布清单、同步全部构建
输入、校验公开数据、编译 Markdown、生成 Astro 静态页面。

相关的 Astro 概念可对照官方的 [Markdown](https://docs.astro.build/en/guides/markdown-content/)、
[Astro 组件](https://docs.astro.build/en/basics/astro-components/) 和
[静态路由](https://docs.astro.build/en/guides/routing/#static-ssg-mode) 文档。
