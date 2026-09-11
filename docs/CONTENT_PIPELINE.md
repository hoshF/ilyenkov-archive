# 公开内容同步与静态构建

译文正文与结构化研究资料使用两条彼此独立、共同受 `website_public` 控制的输入通道。

```text
private/translation/publication.json
  │  只选择 publication_scope = website_public
  ▼
条目指定的 work.json + 同目录 <work_id>.md
  │  scripts/sync-translations.mjs
  ├─▶ .website-input/articles/<work_id>.md
  └─▶ .website-input/article-assets/<work_id>/<image>
  │  src/lib/site-data.ts 校验 frontmatter，src/lib/markdown.ts 编译正文
  ▼
dist/archive/<slug>/index.html + media/<image>
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

## 边界

两个同步器都只处理发布清单逐项指定的条目，不扫描其余研究目录，也不处理 `internal_public`。
可以输出哪些字段、哪些一律不输出，见[发布说明](PUBLICATION.md)。

生成的输入位于 `.website-input/`，只用于构建，不进入 Git，也不应手工修改。再次同步会更新变化的
文件并清理不再获准公开的条目。

获准公开的译文可用标准 Markdown 图片语法引用与正文同目录的图片，例如
`![图片替代文字](portrait.jpg "可选标题")`。同步器只复制正文实际引用的同目录
`jpg`、`jpeg`、`png`、`webp`、`gif` 或 `avif` 文件；不允许 `../` 跨目录引用。站点根路径和
`http(s)` 图片地址保留原样。替代文字是无障碍阅读所必需的，应描述图片内容而不是写“图片”。

译文的“原文信息”从 frontmatter 读取 `source_edition`、`source_url` 和 `doi`，有哪些字段就生成
哪些行，不写死在 Markdown 正文里。

## 命令顺序

`npm run publication:sync` 同时运行两个同步器；`publication:prepare` 复用这条命令，`check`、`test`
与 `build` 都先执行它。因此一次完整构建的顺序是：读取两个发布清单、同步全部构建输入、校验公开
数据、编译 Markdown、生成 Astro 静态页面。

`publication:check` 的退出码供 CI 区分两种情况：1 表示生成结果过期，2 表示同步本身失败。
