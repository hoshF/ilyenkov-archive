# 公开内容同步与静态构建

本文件说明输入输出、转换、关系解析和派生数据。可发布的字段、权限与日期含义以
[发布说明](PUBLICATION.md)为准；栏目和编辑文件职责见[架构说明](ARCHITECTURE.md)。

## 两条 private 输入通道

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

两个同步器只处理清单逐项指定的条目，不扫描其他研究目录，也不处理 `internal_public`。
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
不接受 `record_id`，包括同时提供正确 directory 的双 locator 输入，也不按年份查找。目录只用于
同步定位，generated identity 使用 `public_id`。输入契约见[Readings 活动定位](PUBLICATION.md#readings-活动定位)。

可选 `ilyenkov_readings_series` 从 `research/readings/series.json` 按 `record_id = series_id`
选择唯一记录，并校验名称、类型、两条历史关系与所选资源。字段见
[Readings series 的公开字段](PUBLICATION.md#readings-series-的公开字段)。

两条历史关系在同步阶段独立完成映射：

1. 在 `research/readings/events.json` 中用 `earliest_archived_event_directory` 与
   `first_international_event_directory` 各自定位唯一 edition。
2. 前者须为 1991 年未编号活动，后者须有 `edition_roman === "I"`。
3. 对相同 event 找到唯一 `website_public`、`ilyenkov_readings` publication。
4. 输出对应 `public_id` 到 `history.earliestArchivedEventId`、`history.firstInternationalEventId`。

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

## public 编辑输入与缓存

`editorial/` 的站点配置、中文介绍、书籍、小组工作、分类与动态直接由 public 读取，不经过两条
private 同步通道，也不进入 `.website-input/`。中文介绍由 `src/lib/editorial.ts` 校验，Markdown
介绍复用 `renderPublicMarkdown()`。`summary` 与 `introduction` 的使用分工见架构说明；公开编辑
叙述的权限边界见发布说明的[公开编辑文字](PUBLICATION.md#公开编辑文字)。

使用 `buildCache` 的数据 getter 在生产构建中只加载一次，在开发中每次调用重新读取。
`src/lib/editorial.ts` 的站点与介绍 JSON 则在模块加载时解析；外部 JSON 更改可能需要重启开发
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

`publication:sync` 依次执行译文与研究同步器；`publication:prepare` 复用该命令。`check`、`test`
与 `build` 均先同步。`verify` 的实际顺序为：

```text
publication sync → astro check → astro build → vitest run
```

`publication:check` 仅比较生成输入，退出码 1 表示输入过期，2 表示同步失败；不改写文件。
