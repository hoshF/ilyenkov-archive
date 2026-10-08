# 公开内容同步与静态构建

本文件说明输入输出、转换、关系解析和派生数据。可发布的字段、权限与日期含义以
[发布说明](PUBLICATION.md)为准；栏目和编辑文件职责见[架构说明](ARCHITECTURE.md)。

## 统一 private 入口与生成通道

private 根目录的 `web/publication.json` 是唯一发布选择入口；`works` 由译文同步器消费，
`records` 与必选的 `timeline`、`works_catalog`、`life`、`circle` 根对象由研究同步器消费。
`work_json_path`、`record_path`、`source_path` 相对 private 仓库根目录解析，不以 `web/` 为基准。
接口引用已有事实、原文、译文与来源文件，不复制其 canonical 内容；IFI、Readings、生平、年表、
作品目录、交往页面的公开文字在 `web/editorial/` 中维护，经对应选择中的 `editorial_path` 明确选择。

```text
private/web/publication.json → works
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
private/web/publication.json → records + timeline + works_catalog + life + circle
  │  records 只选择 publication_scope = website_public
  ▼
条目指定的结构化记录 + 明确选择的公开来源与成稿
  │  scripts/sync-research-records.mjs
  ▼
.website-input/research-records.json
  │  src/lib/research-records.ts 校验并适配
  ▼
人物、年表、作品目录与研究栏目静态页面
```

同步器只处理同一清单中逐项指定的 `website_public` 条目，不扫描其他研究目录，也不处理
`internal_public`。
字段必须同时由发布契约允许、同步器显式序列化、public schema 显式接受，private 新字段不会自动透传。
生成输入不进入 Git，不手工修改；再次同步更新变化文件并清理不再获准公开的条目。

## 译文转换

同步去掉整行内部 `block-id` 注释，保留代码示例中的注释。正文开头的一级标题由页面题名替代；
该标题的脚注引用进入 frontmatter `title_notes`，与正文共同编号并保留回链。

正文以 Markdown 引用同目录图片时，同步器只复制实际引用的 `jpg`、`jpeg`、`png`、`webp`、`gif`
或 `avif`，不允许 `../` 跨目录引用，不扫描或整目录复制附件。站点根路径与 `http(s)` 图片地址
保留原样。图片公开权限由 private 发布决定控制，替代文字应描述图片内容。

“原文信息”按生成 frontmatter 中实际存在的 `source_edition`、`source_url`、`doi` 呈现，不写死在
Markdown 正文里。完整字段见发布说明的[译文的公开字段](PUBLICATION.md#译文的公开字段)。

### 作者身份

被选中的 work 的 `authors[]` 在 `people/persons.json` 中逐项解析 canonical `person_id`；
registry 身份须唯一，未知 ID 使同步失败。保持原始作者顺序，从同一对象数组生成：

```text
private work.authors[]             public generated article
  ├── person_id  ────────────────▶ author_ids[]
  └── name_zh    ────────────────▶ author[]
```

两数组等长、逐项对应，不分别维护；`ReadableDocument.authorIds` 用于身份关联，`author` 与
`authorLabel` 用于显示完整署名。作者不从目录名、别名或 Archive 分类推断，身份验证不复制完整人物
记录，也不要求已有 researcher publication。输入拒绝规则见
[译文作者输入与身份边界](PUBLICATION.md#译文作者输入与身份边界)。

## 研究者同步与本站译文

`researcher_profile` 按 `record_path: people/persons.json`、`record_id = person_id` 唯一定位人物。
中文姓名和 summary 来自 publication，其他允许字段取自该 person；资源 URL 按 `resource_kinds`
明确选择。未知、重复、缺失或非法资源使同步失败，不用 works master、source index 或精选作品定位。
允许字段及拒绝规则见[研究者身份与公开字段](PUBLICATION.md#研究者身份与公开字段)。

```text
private person.person_id
  ├─ researcher publication ─▶ researcher.personId
  └─ work.authors[] + translation publication ─▶ document.authorIds
                                                  │
公开 Archive documents ── 按 personId 筛选 ─────────┘
                         ▼
                  研究者页的本站译文列表
```

详情页仅对公开 `getSiteData()` 集合执行 `authorIds.includes(personId)`，保留档案规范顺序及完整
合著署名，不生成 `works[]` 副本或读取 private 作品目录。研究者与译文的公开选择独立；新增或撤下
profile 不改变文章集合，没有译文的 profile 也可成立。

## Readings 活动定位与系列同步

`ilyenkov_readings` 通过非空 `record_directory` 唯一匹配 private event 的 `local_directory`。
目标必须是正式 Readings edition，所选 `source_path` 属于同一活动目录；独立纪念会不是 edition。
公开题名直接取所选 event 的 `title_zh`；publication 不保存题名副本。
不接受 `record_id`，包括同时提供正确 directory 的双 locator 输入，也不按年份查找。目录只用于
同步定位，generated identity 使用 `public_id`。输入契约见[Readings 活动定位](PUBLICATION.md#readings-活动定位)。

可选 `ilyenkov_readings_series` 从 `research/readings/series.json` 按 `record_id = series_id`
选择唯一记录，并校验名称、类型、两条历史关系与所选资源。字段见
[Readings series 的公开字段](PUBLICATION.md#readings-series-的公开字段)。

两条历史关系在同步阶段独立完成映射：

1. 在 `research/readings/events.json` 中用 `earliest_archived_event_directory` 与
   `first_international_event_directory` 各自定位唯一 edition。
2. 最早归档关系由 canonical series 指定，不校验固定年份或编号状态；第一届国际会议须有
   `edition_roman === "I"`。
3. 对相同 event 找到唯一 `website_public`、`ilyenkov_readings` publication。
4. 输出对应 `public_id` 到 `history.earliestArchivedEventId`、`history.firstInternationalEventId`。

选中的记录和来源引用须恰好匹配一项，缺失或多项匹配均失败，不通过首项或 Map 覆盖消解歧义。
未公开、重复匹配、错误活动身份都使同步失败；public schema 再确认每条关系在公开 `readings`
集合中唯一解析。选择 series 不替代其关联活动的发布选择，也不复制活动列表和日期。

Readings 来源 URL 按 `current → original → archive → 既有 flat url` 选择首个非空值，再校验为合法
`http(s)` 地址；优先值无效时失败，不通过 fallback 掩盖错误。数组形式取第一项，不输出抓取时间或
其他 archive metadata。单个 event 记录表示一届会议，不另建 session 集合。

## IFI 网络同步

所选 `research/friends/organization.json` 记录提供官网 URL、身份和获准字段；中文题名与 summary
来自 publication。官网 URL 不由 publication 覆盖，资源按 `resource_kinds` 逐项读取，不自动扩大
选择。完整契约见[IFI 网络的公开字段](PUBLICATION.md#ifi-网络的公开字段)。

形成关系在同步阶段完成映射：

1. 用 `formation_event_id` 在 `research/friends/events.json` 中找到唯一活动。
2. 确认活动属于 `org-ifi`、类型为 `symposium`、状态为 `confirmed`。
3. 按活动 `record_path` 与 `record_id` 找到唯一 `website_public`、`ifi_symposium` publication。
4. 输出其 `public_id` 到 `formation.symposiumId`，不透传 private event ID。

归属、类型、状态错误，活动不存在、未公开或重复发布，都使同步失败；public schema 再确认关系在
`ifiSymposiums` 中唯一解析。即使 private 与 public ID 字面相同，也须经过映射。

`activity_modes` 按原顺序映射为 `activityModes`，资源输出为选定的 `{ kind, url }`。network 不复制
形成活动的日期、地点或题名，也不嵌入 symposium 列表；独立 symposium 继续按各自 publication
与来源契约输出。公开资源链接不意味着复制对应页面全文。

## 年表与作品目录

研究同步器先生成 `records` 选择的获准记录，再按 `timeline.record_kinds` 从这些结果生成
`timeline.recordIds`。每个 public ID 只引用一条获准活动记录，不重复保存事实；类型选择不扩大
`website_public` 范围。`record_kinds` 可为空，空选择只生成空年表；未知或重复类型使同步失败。
`getPublicTimelineRecords()` 解析这些引用后按日期排序，添加界面分类标签。

`timeline.editorial` 读取根选择指定的年表成稿，`worksCatalog.editorial` 读取作品目录成稿。
`getPublicTimelineEditorial()` 与 `getPublicWorksEditorial()` 只返回对应生成文字。作品仍由
`getPublicWorks()` 从共享 `works` 集合读取，页面按类型分组；成稿的 `typeNotes` 只提供各类型的
内容说明，可以为空对象；键必须匹配获准作品类型。分组、排序和格式由 public 维护，不将页面
事实另存到成稿中。

两项根选择和成稿均必需，缺失或无效时失败，没有 public fallback。成稿路径与字段限制见
[发布说明](PUBLICATION.md#年表与作品目录)。

## 生平与交往

研究同步器从必选的 `life`、`circle` 根选择读取成稿，只解析已有 `website_public` 结果中的引用。
成稿中的 `record_ids` 是 publication 的 `public_id`，不按 private 原始 ID 读取未公开记录。
`record_kind` 采用对应类型的获准集合；明确给出的 ID 列表限定子集，不改变其他页面的事实集合。

生平阶段按成稿顺序生成 `recordIds` 与期间或去重年份；空引用不生成 metadata，活动与作品引用
不能混合。明确填写的摘要进入生成 stage；省略时不保存摘要副本，`getPublicLife()` 按所引活动
顺序连接共享摘要，作品阶段不能省略摘要。public 页面只格式化生成期间和年份，不用集合首末项
或页面 ID 白名单推断分期。

交往分区按成稿顺序生成 `recordKind`、题名、导语与 `recordIds`。`getPublicCircle()` 从共享集合
解析每区记录并按期间、题名排序，将地点与状态统一为真实值或空值；`records` 只在读取时提供，
不保存到生成分区中。页面映射 HTML 标识并渲染真实的地点与状态。

空 stages、sections 与引用数组均合法，未知、未公开、重复或错误类型的引用使同步或 schema 校验
失败，不扫描成稿目录、不复制事实、不自动发布引用对象。字段与路径限制见
[发布说明](PUBLICATION.md#生平与交往)。

## 公开成稿同步

所选 `ifi_network`、`ilyenkov_readings_series` 或 `researcher_profile` publication 的 `editorial_path` 指向 private
`web/editorial/` 中的成稿。研究同步器读取并校验类型允许的字段，分别写入生成 network、series 或 researcher
的可选 `editorial`。IFI 允许 `introduction` 与 `symposiumsLead`，Readings 只允许 `introduction`；研究者只允许 `introduction` 与非空单行 `workDescription`；
额外字段使同步失败。路径限制与字段契约见[公开编辑文字](PUBLICATION.md#公开编辑文字)。
不输出 locator、不扫描成稿目录、不复制 canonical 记录。

未选择成稿时不生成 `editorial`；选定文件缺失或字段无效时同步失败。页面只读取
`.website-input/research-records.json` 中的成稿，`introduction` 经 `renderPublicMarkdown()` 渲染；
不存在时省略简介、IFI 导语及研究者工作说明，不读取 private 文件或 public 文字副本。

## public 编辑输入与缓存

`editorial/` 的站点配置、小组工作、分类与动态直接由 public 读取，不经过
private 同步通道，也不进入 `.website-input/`。站点配置由 `src/lib/editorial.ts` 校验。`summary` 与 `introduction` 的使用分工见架构说明；
公开编辑叙述的权限边界见发布说明的[公开编辑文字](PUBLICATION.md#公开编辑文字)。

使用 `buildCache` 的数据 getter 在生产构建中只加载一次，在开发中每次调用重新读取。
`src/lib/editorial.ts` 的站点 JSON 则在模块加载时解析；外部 JSON 更改可能需要重启开发
服务器，不应把页面刷新当作所有配置均会重新加载。private 更改须先重新同步生成输入。

## 文章集合与首页派生

`getSiteData()` 提供唯一规范顺序：

```text
year DESC → title_zh ASC（zh-Hans-CN）→ id ASC
```

`id` 决定同年份、同题名的稳定次序。Archive 列表、上一篇／下一篇、研究者译文筛选与首页文本均
保留该顺序；`year` 表示原文文献年份，不是本站公开日期。

首页各区块分别读取既有集合，不另建聚合事实源：

- **文本**：截取 Archive 前四项，显示题名、完整作者、原文年份与链接。
- **研究**：读取 Maidansky、IFI、Readings 的公开 summary 与详情入口，不维护首页专属摘要。
- **最近小组工作**：按 `published` 倒序，同日按期号倒序，截取最多三项。
- **近期动态**：读取同一 updates 集合的最近四项；`/updates/` 展示完整列表。

这些数量是当前页面的展示限制，不是数据 schema 要求。日期不得由原文年份、历史事件、Git 提交或
构建时间推断；接入译文本站首次公开日期的条件见[RSS 的公开边界](PUBLICATION.md#rss-的公开边界)。

## 公开动态

`getUpdates()` 校验 `editorial/updates.json`，按真实 ISO 日期倒序，同一天保留编辑顺序。首页和
完整动态流复用同一组件，不生成动态详情页。字段及维护规则见[近期动态](PUBLICATION.md#近期动态)。

## RSS 订阅

`src/pages/rss.xml.ts` 使用 `@astrojs/rss` 静态 GET 生成 `/rss.xml`；`src/lib/rss.ts` 读取小组记录
的 `published`、`summary` 与动态的 `date`、`summary`，只输出摘要和链接。没有 `website_published`
的译文不作为内容项纳入。日期按 UTC 零点编码为 `pubDate`，不表示已知具体公开时刻。

同一站内页面的比较忽略尾斜线、查询和锚点。动态指向同页、同日的内容时保留内容项，其他日期的
后续变化保留。动态有站内链接时指向该页面，外部或缺失链接时回到 `/updates/`。

内容 GUID 来自稳定页面路径，动态 GUID 来自日期、摘要和原链接的 SHA-256 指纹；完全相同的动态
只输出一次。更改日期、摘要或原链接会改变 GUID，仅改链接文字不会。条目按日期倒序，再按中文
标题、GUID 保持确定顺序，不依赖文件读取或构建时间。

Feed 与 HTML 订阅发现使用 `astro.config.mjs` 的同一个 `site` 基址，见[部署说明](DEPLOYMENT.md)。
RSS 不读取文章正文或 private-only 元数据，权限与日期约束见发布说明。

## 命令顺序

`publication:sync` 依次执行译文、研究与书籍同步器；`publication:prepare` 复用该命令。`check`、`test`
与 `build` 均先同步。`verify` 的实际顺序为：

```text
publication sync → astro check → astro build → vitest run
```

`publication:check` 仅比较生成输入，退出码 1 表示输入过期，2 表示同步失败；不改写文件。


## Ilyenkov 人物总页

`ilyenkov_profile` 发布条目显式选择 `people/persons.json` 中唯一的人物身份、中文姓名、
已获准的 biography 出生记录与 `web/editorial/ilyenkov.json` 成稿。原名取自 person，
生年取自所选出生记录的开始日期，死亡年份取自 person 的 `death_year`。
成稿只维护 `summary`、`description`、`introduction` 与有序 `entrances`；入口只含
`target`、`label`、`summary`，target 为 life、timeline、works、circle。public 映射路由。
介绍只允许 `{{identity}}`、`{{originalName}}`、`{{lifespan}}` 三种显式引用，
同步时以获准人物事实投影替换，未知引用失败；不读取或发布任意被提及的研究记录。
首页消费短摘要与入口名称，总页消费完整介绍与入口导语；子页继续消费原有共享集合。
撤回发布条目后删除生成 `ilyenkov`，不回退到 public 文字；需要该资料的页面缺少输入时构建失败。

## 文章搜索

`npm run build`、`test`、`verify` 在 Astro 静态构建后执行 `search:index`。Pagefind 只读取
`dist/archive/*/index.html` 中标记的文章题名、作者、原题名和正文区域，分类过滤复用现有
文章分类；搜索元数据直接使用公开文章题名。导航、其他栏目和 private 文件不进入索引。

索引输出到 `dist/pagefind/`，每次生成前清空这一生成目录，撤回的文章不会保留旧片段。
索引随静态产物部署，不独立维护文章清单或搜索正文。浏览器仅在搜索时加载索引，分类页
搜索限定当前分类；清空关键词恢复普通列表，加载失败时保留分类与文章列表。

`npm run dev` 先构建搜索索引，开发服务器从 `dist/pagefind/` 提供搜索资源。修改公开正文
或分类后，执行 `npm run build` 并刷新浏览器，以更新开发搜索索引。


## 网站书籍成稿

`web/publication.json` 的 `books` 逐项选择 `website_public` 的网站书籍记录。
`editorial_path` 指向 private `web/editorial/books/<book_id>.md`，目录内其他成稿不扫描。
`scripts/sync-books.mjs` 通过 `src/lib/book-record.mjs` 校验 front matter，保留 Markdown 介绍，
输出 `.website-input/books.json`。`src/lib/books.ts` 只读取生成输入，按 ID 与版次日期排序，
编译介绍并派生路由和最新显示版次；分组与展示继续由 public 实现。
空选择生成空数组，撤回记录后整份输入重写清理；缺少生成输入时失败，不提供旧路径 fallback。
书籍记录选择不改变 works 正文范围，不读取或复制正文、PDF、EPUB、扫描件或封面资产。
