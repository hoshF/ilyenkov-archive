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

译文通道采用**显式允许**模型：private `work.json` 的字段默认不进入 public，只有发布契约允许、
同步器显式序列化、且 `GeneratedArticleSchema` 显式接受的字段才会出现在生成输入里。译文允许公开
的来源字段与 private-only 字段的完整清单见[发布说明](PUBLICATION.md)的"译文的公开字段"一节。

生成的输入位于 `.website-input/`，只用于构建，不进入 Git，也不应手工修改。再次同步会更新变化的
文件并清理不再获准公开的条目。

同步时去掉正本中整行的内部 `block-id` 注释，代码示例里的注释保留。正文开头的一级标题由页面
题名替代；其中的脚注引用写入生成 frontmatter 的 `title_notes` 数组，与正文共同编号并保留回链。

获准公开的译文可用标准 Markdown 图片语法引用与正文同目录的图片，例如
`![图片替代文字](portrait.jpg "可选标题")`。同步器只复制正文实际引用的同目录
`jpg`、`jpeg`、`png`、`webp`、`gif` 或 `avif` 文件；不允许 `../` 跨目录引用。站点根路径和
`http(s)` 图片地址保留原样。替代文字是无障碍阅读所必需的，应描述图片内容而不是写“图片”。

译文的“原文信息”从 frontmatter 读取 `source_edition`、`source_url` 和 `doi`，有哪些字段就生成
哪些行，不写死在 Markdown 正文里。

## 文章集合的规范顺序

译文集合只有**一个**规范顺序，由 `src/lib/site-data.ts` 的 `getSiteData()` 给出：

```text
year DESC  →  title_zh ASC（zh-Hans-CN）  →  id ASC
```

第三级 `id` 让结果完全确定，不依赖文件系统的读取顺序。`year` 是原文文献的发表年份（语义见
[发布说明](PUBLICATION.md)），因此这个顺序是"原文发表年份由新到旧"。

档案的两个消费者读的都是这一份顺序，都不自行排序：

| 消费者 | 用它做什么 |
| --- | --- |
| `/archive/` | 文库列表 |
| `/archive/[id]` | 上一篇 / 下一篇 |

也就是说顺序属于**文章集合的契约**，不是某个页面的视觉选择；某页需要另一种呈现时，应该显式说明
理由，而不是就地 `sort()`。

## 首页的最新内容

首页的“最新内容”是独立的展示聚合：复用获准公开的译文集合与 `editorial/group/` 的小组按期记录，
取四项，不建立新的内容事实文件。译文的类型显示为“译文”，小组记录的类型直接使用其 `kind`；标题、
作者（适用时）、日期与链接都从现有记录派生。

有可靠本站公开日期的小组记录优先，按 `published` 倒序，同日期按中文标题、链接排序，日期标为
“公开日期”。译文目前未记录本站公开日期，随后沿用 `getSiteData()` 提供的档案规范顺序；`year` 只显示为
“原文年份”，不参与与公开日期的比较，也不表示译文在本站公开的先后。首页说明这一限制，不改变档案顺序。

若要严格按本站首次公开日期排列译文，需要 private 对应版本的发布清单明确记录 `website_published`，
再由公开字段允许清单、同步器与生成 schema 显式接收；现有契约尚未提供此字段。不得从原文年份、Git 提交、
研究记录的历史 `period` 或书籍内部版次日期推断网站公开日期。

## 公开动态

`editorial/updates.json` 是 public 自行维护的简短动态数组，不经过两个 private 同步通道，也不写入
`.website-input/`。数据读取时校验真实的 ISO 日期、简短纯文本说明及可选链接，按日期倒序排列；同一天
保留文件中的编辑顺序。首页读取最近四条，`/updates/` 展示全部，两者复用同一列表组件与同一事实源。

动态不生成单独正文页面，也不需要客户端 JavaScript。日期表示已确认的公开工作变化发生日期，不自动从
Git 提交或构建时间推断网站上线日期；完整字段约定与维护规则见[发布说明](PUBLICATION.md)的“近期动态”。

## RSS 订阅

`src/pages/rss.xml.ts` 使用 `@astrojs/rss` 的静态 GET 端点生成 `/rss.xml`，读取 `getGroupIssues()` 的
`published`、`summary` 与 `getUpdates()` 的 `date`、`summary`，复用现有事实源，只输出摘要与链接。
条目按真实日期倒序，日期以 UTC 零点编码为 RSS `pubDate`，不表示已知具体公开时刻；不从原文年份、
研究历史日期、书籍版次、Git 提交或构建时间推断。
尚未记录 `website_published` 的译文不作为内容条目纳入；未来接入须先补齐上述 private 发布事实与公开字段契约。

同一站内页面的比较忽略尾斜线、查询与锚点。动态指向某内容条目且日期相同时，优先保留内容项；
不同日期的后续变化仍保留为动态。
动态有站内链接时链接对应页面，外部或缺失链接时回到 `/updates/`，不虚构动态详情地址。每条动态使用
稳定、独立的 GUID，不能只用共享的动态页链接作为身份。内容 GUID 来自稳定页面路径；动态 GUID
由日期、摘要与原链接的 SHA-256 指纹派生，不依赖数组位置或构建时间，完全相同的动态只输出一次。
编辑既有动态的日期、摘要或原链接会改变 GUID，订阅器可能将其识别为新条目；仅调整链接文字不会改变身份。

Feed 的绝对 URL 与 HTML 订阅发现链接共用 `astro.config.mjs` 的 `site`；当前基址与域名迁移规则见
[部署说明](DEPLOYMENT.md)。生成过程不读取或输出文章正文、受限内容或 private-only 元数据。

## 命令顺序

`npm run publication:sync` 同时运行两个同步器；`publication:prepare` 复用这条命令，`check`、`test`
与 `build` 都先执行它。因此一次完整构建的顺序是：读取两个发布清单、同步全部构建输入、校验公开
数据、编译 Markdown、生成 Astro 静态页面。

`publication:check` 的退出码供 CI 区分两种情况：1 表示生成结果过期，2 表示同步本身失败。
