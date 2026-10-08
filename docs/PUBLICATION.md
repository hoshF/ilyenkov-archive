# 发布与访问范围

## 基本原则

文件可读取不等于允许发布；允许网页阅读不等于允许进入 Git；不提供下载按钮也不构成访问控制。
每项内容按精确版本和具体渠道决定公开范围。

## private 公开接口

private 根目录的 `web/publication.json` 是译文、结构化研究与网站书籍记录的唯一发布选择入口：

| 字段 | 内容 |
| --- | --- |
| `publication_scopes` | 公开范围：`website_public`、`internal_public` |
| `works` | 译文的 `work_id`、`publication_scope` 与 `work_json_path` |
| `records` | 研究记录的公开身份、范围、类型、定位、公开显示文字、来源与成稿选择 |
| `books` | 网站书籍记录的 book_id、publication_scope 与 editorial_path |
| `timeline` | 必选的年表记录类型与成稿选择：`record_kinds`、`editorial_path` |
| `works_catalog` | 必选的作品目录成稿选择：`editorial_path` |
| `life` | 必选的生平成稿选择：`editorial_path` |
| `circle` | 必选的交往与活动成稿选择：`editorial_path` |

同步器只消费 `works`、`records`、`books` 中 `publication_scope = website_public` 的条目；
`internal_public` 不进入公共网站生成输入或 `dist/`。页面根选择不扩展这些条目的公开范围。
`work_json_path`、`record_path`、`source_path` 相对 private 仓库根目录解析；
canonical 事实、原文、译文、来源与权利证据保持各自的维护位置，接口不另存其副本。IFI、Readings、
年表、作品目录、生平与交往页面的公开文字由 `web/editorial/` 维护，经对应选择中的
`editorial_path` 选择。研究条目与页面选择按下文的字段契约校验。

## 三种网站状态

| 状态 | 公开页面 | 正文进入 public 静态构建 | 用途 |
| --- | --- | --- | --- |
| 全文公开 | 完整文本与来源说明 | 是 | private 清单中标记为 `website_public` 的译文 |
| 公开目录 | 作品、版本和外部来源 | 否 | 可以公开事实，但不能提供正文 |
| 小组研读 | 只公开目录状态 | 否 | 因版权或协作阶段仅供内部学习 |

`website_public` 允许内容进入 public 网站构建；译文可以生成网页全文，生成的 articles 仍不提交到
本仓库。`group_study` 是未来的受限研读渠道，不属于 public 网站构建；受限正文不得先进入公共
`dist/` 再依靠界面隐藏，而应部署到独立的受保护环境（见[部署说明](DEPLOYMENT.md)）。

全文公开译文中的配图同样受发布清单控制：只有 `website_public` 正文以 Markdown 明确引用、且与
正文同目录的图片才会进入构建。同步器不会扫描或整目录复制附件；图片的公开授权由 private 仓库
在把对应译文列为 `website_public` 前确认。

## 受控输出

生平、服役、黑格尔大会、作品目录、伊里因科夫讨论会、IFI 网络、IFI 研讨会、研究者、外部资料
站点的结构化记录由 research 同步通道生成，统一遵守以下规则。这里的字段限制约束同步生成的研究
记录；通过 `editorial_path` 选定的成稿及 public 维护的其他导引文字见[公开编辑文字](#公开编辑文字)，
仍受来源与公开范围约束。

- 每一条都由 private 的 `web/publication.json` 中 `records` **逐项**标记选择。未被选中的条目，不因文件
  存在而视为可以公开，也不建立占位数据。
- 上述类型必须同时有获准条目。任何一类为空，同步器直接失败，不生成半份 `research-records.json`。
  Readings series 是另行选择的可选类型，不因 private 存在 series record 就自动输出，也不属于必备集合。
- 同步器只输出该条目获准的最小公开字段：稳定 ID、中文与原文题名、摘要或简短定位、历史日期或
  日期范围、地点或状态、明确选定的外部来源链接，以及类型契约允许的选定成稿。每项事实都必须由所选来源支持。
- 以下一律不经研究同步通道进入生成输入与 `dist/`：原始正文、自传原文、扫描件、附件、照片、视频、
  统计、成员名单与联系方式、机构与履历、内部置信度、冲突分析、研究备注、来源 ID、日志、问题记录、本地路径。
- 来源之间存在冲突时，公开数据只保留能够共同支持的最小事实，不在网站上代替研究系统作出裁决。
- 研究记录中的日期是历史事实，不是网站的发布或更新时间。
- 外部链接只用于资料定位，不表示本站拥有转载或下载授权。

选中的 canonical 记录身份、作品身份及来源身份须恰好匹配一项；缺失或重复匹配使同步失败。
source ID、选中的来源 URL、站点页面 URL 与文件路径作为引用键时均须唯一解析；不要求未选中的
canonical 来源 URL 全局唯一，也不取首个匹配或覆盖重复项。

字段级的准确定义以 `scripts/sync-research-records.mjs` 的输出和 `src/lib/research-records.ts` 的
schema 为准；两者不一致时以 schema 为准，并修正同步器。

### 年表与作品目录

publication 根对象 `timeline` 必须且只含 `record_kinds` 与 `editorial_path`。`record_kinds` 只允许
`biography_event`、`military_service`、`hegel_congress`，可选任意子集或空数组，未知或重复类型均
拒绝。它从 `records` 已选择的 `website_public` 条目中确定年表范围，不读取或公开其他 canonical
记录；空选择只生成空年表，不改变其他页面的记录集合。生成 `timeline.recordIds` 必须唯一解析
到已生成的生平、服役或大会记录；只引用公开 ID，不复制记录事实。public getter 解析引用后按
历史日期排序，分类标签与日期、来源格式由 public 维护。

publication 根对象 `works_catalog` 必须且只含 `editorial_path`，不另选或复制作品。生成的
`works` 集合仍来自获准 `works_catalog` 记录条目；页面按已有中文 `type` 分组。各作品类型归属
来自 publication 的 `work_type_zh`，分组顺序和排序由 public 维护。

| 生成字段 | 所选成稿字段 |
| --- | --- |
| `timeline.editorial.description` | 年表的非空单行 `description` |
| `worksCatalog.editorial.description` | 作品目录的非空单行 `description` |
| `worksCatalog.editorial.lead`、`worksCatalog.editorial.note` | 作品目录的非空单行导语与范围说明 |
| `worksCatalog.editorial.typeNotes` | 以已公开作品的中文 `type` 为键、非空单行说明为值的对象 |

年表成稿只接受 `description`；作品目录成稿只接受 `description`、`lead`、`note`、`typeNotes`。
`typeNotes` 必须存在，可以为空对象；键必须匹配已公开作品的中文 `type`。撤下某类型的全部作品
时须同时撤下该类型说明。类型注记只承载内容说明，不承载布局、分组或排序配置，不新增类型身份。
两项根选择和成稿均必需；缺失、文件不存在、额外字段或无效字段使同步或 schema 校验失败，
不提供 public 默认文字或兼容
路径。成稿路径遵守[公开编辑文字](#公开编辑文字)的限制。

### 生平与交往

publication 根对象 `life`、`circle` 必须且只含 `editorial_path`。生平成稿只接受非空单行
`description`、`lead`、`note` 与 `stages` 数组；交往成稿只接受非空单行 `description` 与
`sections` 数组。数组可以为空；根选择和成稿必需，缺失、额外字段或无效字段使同步或 schema
校验失败，不提供 public 默认内容或兼容路径。

生平每个 stage 接受 `title`、`links`，以及恰好一个 `record_ids` 或 `record_kind`，可选
`summary`。题名、链接标签与明确填写的摘要均为非空单行文字；`links` 可以为空，`target` 只允许
`timeline`、`circle`、`works`，实际路由由 public 映射。`record_kind` 只允许 `biography_event`、
`military_service`、`hegel_congress`、`works_catalog`，表示引用该类型已获准的记录。

`record_ids` 使用已有 publication 的 `public_id`，不得按 private 原始记录 ID 查找。引用数组
可以为空，重复、未知、未公开或缺失引用均失败；活动与作品不得混合在同一 stage。活动阶段未写
`summary` 时，getter 按引用顺序连接共享活动摘要；作品阶段必须明确填写摘要，不从作品事实补造
叙述。成稿不另存日期、地点、作品年份、题名、来源等事实副本。

交往每个 section 必须含 `title`、`lead`、`record_kind`，可选 `record_ids`。题名与导语均为非空
单行文字；类型只允许 `military_service` 或 `hegel_congress`，同一类型不重复分区。没有
`record_ids` 时采用该类型全部获准记录；存在时只引用其中明确选择的子集，空数组合法。
未知、重复、未公开、缺失或不属于指定类型的引用均失败，不自动扩大 publication 范围。

生成 `life.stages` 只包含题名、公开引用 `recordIds`、明确填写的摘要、链接及从引用派生的
`period` 或 `years`；空引用不生成期间或年份。生成 `circle.sections` 只包含类型、题名、导语与
`recordIds`。共享活动与作品事实仍只在已有集合中维护。public getter 解析生平缺省摘要与交往
记录，交往条目按历史日期与题名排序；阶段及分区顺序保持成稿顺序。布局、日期格式、链接路由和
HTML 标识由 public 维护。

### 研究者身份与公开字段

人物事实的 canonical identity 由 private `people/persons.json` 维护。`researcher_profile`
publication 只选择哪个 person 成为公开研究者，并提供中文姓名、短摘要、资源选择及可选的成稿路径；不维护作品列表。
条目必须以 `record_path: people/persons.json`、`record_id = person_id` 唯一定位人物，要求非空
`name_original`、`title_zh` 和 `summary_zh`。不读取 works master、internet source index 或 researcher 精选作品。

publication 严格只接受 `public_id`、`publication_scope`、`kind`、`record_path`、`record_id`、
`title_zh`、`summary_zh`、`resource_kinds` 与可选 `editorial_path`。`source_path`、`author_zh`、`author_original`、`works`
及 `include_roles`、`include_research_fields`、`include_latin_name` 等额外字段均拒绝，不提供兼容路径。

| 公开字段 | 来源与范围 |
| --- | --- |
| `id`、`name`、`summary` | publication 的 `public_id`、`title_zh`、`summary_zh` |
| `personId` | 唯一解析的 canonical `person_id`，与 publication 的 `record_id` 相等 |
| `originalName` | person 的非空 `name_original` |
| 可选 `editorial.introduction`、`editorial.workDescription` | `editorial_path` 选定的 Markdown 段落数组与非空单行研究工作说明 |
| 可选 `latinName` | person 的 `name_latin` |
| 可选 `roles`、`researchFields` | person 的 `roles`、`research_fields`；属于固定允许字段，不由 `include_*` 开关选择 |
| `resources[].kind`、`resources[].url` | publication 的 `resource_kinds` 明选，URL 只来自 person 的对应资源 |

资源种类只允许 `personal`、`orcid`、`institution`，选择不得重复；未知种类、所选资源缺失或无效
`http(s)` URL 均使同步失败。未选择的资源不输出，中文显示标签仅由页面层提供，不把资源统一称为官网。

generated researcher 不含 `works`、aliases、`positioning_ru`、affiliation、local IDs、event relations、
private locator 或其他未列入上述允许契约的人物字段。private 新字段默认不公开；不把完整 person
记录直接复制到 generated data。`personId` 是明确允许的 canonical 身份引用，不是 private 路径。

Archive 文章的 `ReadableDocument.authorIds` 与 researcher 的 `personId` 是独立发布通道之间的身份
联系。研究者页只从已公开 Archive 集合筛选 `document.authorIds.includes(researcher.personId)`，
按 Archive 规范顺序展示，并保留合著的完整署名；不另存一份作品事实或 private work ID 列表。
删除 researcher publication 不影响文章，新增 researcher profile 不公开新文章；没有 public 译文的
researcher 仍是有效记录，schema 不要求作品存在。人物、译文与 researcher 的发布选择不得相互替代。

### Readings 活动定位

`ilyenkov_readings` publication 必须通过非空 `record_directory` 定位 private event，并唯一匹配
其 `local_directory`。目标必须是正式 Readings edition，所选来源文件须属于同一活动目录；
独立纪念会不能作为 Readings edition 发布。event publication 不接受 `record_id`，也不按年份定位。
其他 publication kind 的 `record_id` 契约不受影响。
公开题名直接读取 canonical event 的非空 `title_zh`；publication 不接受该字段，不提供 override 或 fallback。

directory 只在同步阶段用于定位，不进入 generated data；活动的公开身份始终来自 `public_id`。
定位与来源校验见[内容管线](CONTENT_PIPELINE.md)的“Readings 活动定位与系列同步”。

### Readings series 的公开字段

`ilyenkov_readings_series` 使用 research publication 通道，采用显式允许契约。条目以
`record_path: research/readings/series.json` 和 `record_id = series_id` 选择唯一 series record。
publication 只允许 `public_id`、`publication_scope`、`kind`、`record_path`、`record_id`、`title_zh`、
`summary_zh`、`resource_kinds` 与可选的 `editorial_path`，不得通过 `url`、`resources`、`source_url`
等字段覆盖 private 资源 URL。

| 公开字段 | 来源与范围 |
| --- | --- |
| `id`、`title`、`summary` | publication 的 `public_id`、`title_zh`、`summary_zh`；正式中文显示名为“伊里因科夫学术报告会” |
| `name`、`type` | series 的非空 `name_ru`，以及固定类型 `academic_conference_series` |
| `history.earliestArchivedEventId` | 将 `earliest_archived_event_directory` 解析为唯一正式 Readings edition，再映射为该活动唯一获准条目的 `public_id` |
| `history.firstInternationalEventId` | 将 `first_international_event_directory` 解析为 `edition_roman === "I"` 的 Readings，再映射为该活动唯一获准条目的 `public_id` |
| `resources[].kind`、`resources[].url` | publication 的 `resource_kinds` 选择种类；URL 只来自 series 的对应资源 |
| 可选 `editorial.introduction` | `editorial_path` 选定成稿的非空 Markdown 段落数组 |

资源种类只允许 `archive`、`society`、`historical_archive`，选择不得重复；所选资源必须存在并提供
合法非空 `http(s)` URL。输出仅含 `{ kind, url }`，没有标签、图标、描述、权重或统一的“官方”标记；
未选择的资源不输出。中文题名与摘要来自 publication，完整介绍来自选定成稿，不自动翻译或透传俄文事实摘要。

private 的目录、`positioning_ru`、`memorial_background_ru`、`continuity_summary_ru`、全部活动标识、
组织者名单、报告、出版物、媒体、转录、内部备注与问题记录不通过 series 同步进入 generated data。
private 新增字段默认不公开，只有本契约允许、同步器显式序列化且 public schema 显式接受的字段
才可进入 generated data。

历史关系必须经过“private directory → 唯一 Readings edition → 唯一 `website_public`
`ilyenkov_readings` publication → public ID”。缺失、错误活动类型、未公开或重复发布匹配都使同步失败；
public schema 还要求两条关系各自在 `readings` 中恰好解析到一条记录。series 不嵌入活动列表或复制
活动日期、题名与地点；directory 只用于 private publication 定位，不是 public identity。

未启用 series publication 时，生成输入不包含 `readingsSeries`，getter 返回空数组；启用时该数组必须
非空。集合规模由 publication 选择决定，不是固定 schema 要求。

### IFI 网络的公开字段

IFI organization 采用显式允许契约：private 以后新增字段默认属于 private-only，只有发布契约允许、
同步器显式序列化、且 public schema 显式接受的字段才能进入 `.website-input/research-records.json`。

IFI network publication 只接受 `public_id`、`publication_scope`、`kind`、`record_path`、`record_id`、
`title_zh`、`summary_zh`、`resource_kinds` 与可选的 `editorial_path`；出现 `source_url`、`url`、`resources`
等额外字段会使同步失败，不会静默忽略。

公开字段以集合为准，不以当前字段数量为准：

| 公开字段 | 来源与范围 |
| --- | --- |
| `id`、`title`、`summary` | publication 的 `public_id`、`title_zh`、`summary_zh`；中文介绍不从 `positioning_en` 翻译或透传 |
| `name`、`abbreviation` | organization 的 `name_en`、`abbr` |
| `url` | 只读取 organization 的非空合法 `http(s)` 官网 URL；publication 不另提供 URL，不设 fallback |
| `formation.symposiumId` | 将 organization 的 `formation_event_id` 解析并映射为获准公开的 symposium ID；不输出 private event ID |
| `activityModes` | 严格枚举 `symposium`、`webinar`、`collective_reading`、`discussion`，保持 private 顺序 |
| `resources[].kind`、`resources[].url` | publication 的 `resource_kinds` 选择资源种类，URL 只来自 organization 的对应资源 |
| 可选 `editorial.introduction`、`editorial.symposiumsLead` | `editorial_path` 选定成稿的 Markdown 段落数组与历史列表导语 |

资源种类只允许 `about`、`history`、`texts`、`symposiums`、`youtube`、`facebook`。选择列表不得重复，
所选资源必须存在且提供合法非空 `http(s)` URL；未知活动方式、未知资源种类、缺失资源或无效 URL 都
使同步或 schema 校验失败。未选择的资源不得自动输出，public 资源对象不增加标签、图标、描述或排序权重。

`positioning_en`、成员名单、联系方式、内部备注、History / Who we are 全文、附件、视频、统计、未选择的
资源及 private event ID 一律不进入 generated data 与 `dist/`。公开官方资源链接不构成对相应正文或
媒体的复制授权。

不读取或输出 `founded`，也不生成兼容年份。形成关系只引用独立的公开 symposium，
不复制该活动的日期、地点、题名，不把 symposium 数组嵌入 network。页面需要形成年份时，从被引用
symposium 的 `period.start` 读取。映射与引用校验见[内容管线](CONTENT_PIPELINE.md)的“IFI 网络同步”。
Webinar series 的 `official_page` 属于其独立 private 记录，本契约不建立 webinar public 类型。

## 公开编辑文字

研究者成稿只接受 `introduction` Markdown 段落数组与非空单行 `workDescription`。中文短摘要仍由 publication 的 `summary_zh` 唯一维护，首页和详情描述复用；研究入口显示 `workDescription`，详情正文显示 `introduction`。成稿不保存人物事实、文章清单或布局字段。

IFI 与 Readings 的公开中文成稿分别维护在 private `web/editorial/ifi.json` 与
`web/editorial/readings.json`。成稿包含非空 `introduction` Markdown 段落数组；IFI 成稿另含
非空 `symposiumsLead` 历史列表导语。只接受各类型的这些成稿字段，额外字段使同步失败。

`ifi_network`、`ilyenkov_readings_series` 与 `researcher_profile` 条目可用 `editorial_path` 明确选择成稿文件，路径相对
private 仓库根目录解析。路径必须为 `web/editorial/<slug>.json`，slug 使用小写字母、数字与连字符；
绝对路径、目录穿越、其他目录以及实际解析后离开 `web/editorial/` 的符号链接均拒绝。
只有获准条目选择的成稿才进入生成 network、series 或 researcher 的可选 `editorial`；路径本身不输出。没有
选择时，即使成稿文件存在也不输出，public 页面省略简介及 IFI 导语，不使用本地文字副本、默认
文字或自动发现的成稿。选定文件缺失或字段无效时同步失败。

年表与作品目录文字分别维护在 private `web/editorial/timeline.json` 与 `web/editorial/works.json`，
由 publication 根对象 `timeline`、`works_catalog` 的 `editorial_path` 选择，并适用同样的路径限制。
它们是必选输入，字段与引用契约见[年表与作品目录](#年表与作品目录)。

生平与交往成稿分别维护在 private `web/editorial/life.json` 与 `web/editorial/circle.json`，由
publication 根对象 `life`、`circle` 选择，并适用同样的路径限制；字段与引用契约见
[生平与交往](#生平与交往)。

其他 public 编辑文字仍在 public `editorial/` 或对应页面中
维护。这些文字依据来源组织和解释已获准公开的内容；canonical 研究事实、来源证据与发布决定仍由
private 维护，不由公开编辑文字替代。

公开编辑文字只使用已经公开或已明确选择公开的内容，不读取未公开的 private 数据，也不通过改写、
摘述或嵌入把受限正文、原始材料、内部备注与未获准来源送入公共构建。编辑叙述不扩大授权范围，
也不替代具体版本和渠道的发布决定。

## 小组联系信息

正式小组邮箱由 public 仓库的 `editorial/site.json` 中 `contact.email` 唯一维护；联系页从同一配置
生成可点击的邮箱和 `mailto:` 链接，不在页面或文档中另写一份。它是小组公开联系方式，不读取或替代
private 中的个人联系方式，也不改变研究资料的公开字段边界。

`/contact/` 是获取更新、联系与参与方式的事实入口；`/group` 继续说明小组身份、工作与长期公共成果，
只链接联系页。网站保持静态，不通过表单、服务端或客户端脚本收集来信。

## 译文的公开字段

译文走"显式允许"而不是"默认继承"：private `translation/**/work.json` 的字段**默认不进入
public**，private 侧以后新增字段也默认属于 private-only，除非明确修改本节。一个字段要出现在
生成的 `.website-input/articles/<work_id>.md` 里，必须同时满足三条：

1. 本节的发布契约明确允许；
2. `scripts/sync-translations.mjs` 显式序列化它；
3. `src/lib/site-data.ts` 的 `GeneratedArticleSchema` 显式接受它。

这三类字段以**集合**为准，不以字段数量为准——private 字段会继续增长，public 侧还有生成字段，
数目不是稳定契约：

| 类别 | 字段 | 说明 |
| --- | --- | --- |
| 允许公开的来源字段 | `title` `title_zh` `year` `source_edition` `source_url` `doi`；`authors[].person_id`、`authors[].name_zh` | 从 private `work.json` 读取；作者对象经身份校验后只生成下面两项数组，`source_url`、`doi` 缺省时不写 |
| public 生成字段 | `author` `author_ids` `title_notes` `type` `generated_from` `generated_rev` | `author`、`author_ids` 从同一 `authors[]` 按输入顺序生成；`title_notes` 从正文开头一级标题的脚注引用生成，`generated_from`、`generated_rev` 是构建溯源，`type` 是固定字面量 |
| private-only 字段 | `work_id` `source_path` `rights_status` `source_text_status` `orcid` `udc` `copyright` `translator` | 一律不进 public 与 `dist/`：内部标识与路径、权利证据、校勘与置信状态、学术表单信息、英译者 |

`rights_status`、`source_text_status`、`source_path` 等必须在**同步阶段**就被挡住，不允许先进
generated files 再靠页面隐藏。

### `year` 与作者的语义

- **`year`** 是**原文文献的发表年份，或它所在出版物的年份**；不是中文译文的年份，不是网站发布
  日期，不是同步日期，也不是 `generated_rev` 的日期。会议发表后又进入期刊这类复杂情况，由
  metadata 层先确定口径，页面层不自行猜测。
- **`author`** 是**原文作者的显示署名**，用中文姓名数组表示（至少一项、不重复）。
  它与下列角色**不是**一回事：translation 的 contributor 与目录 owner（那是翻译工作的组织方式，
  同一条记录的目录归属可能与原文作者不同）、中文译者（站点层面的事实，不建字段）、source
  translator（英译者，属于 private-only）。因此**不能**用 `translation/<contributor>/` 目录名在
  runtime 推断作者；作者必须显式写在 `work.json` 的 `authors[]` 里。
- **`author_ids`** 是相同作者的 canonical identity reference，不是姓名、文章所涉及人物的分类，
  也不是 public researcher profile 的选择结果。它与 `author` 等长、逐项对应，身份不得重复。

### 译文作者输入与身份边界

被 `website_public` 选择的 work 必须提供非空 `authors[]`。每项严格只有两个非空字符串字段：
`person_id` 与 `name_zh`；同一作品的 `person_id` 不得重复。`author[]`、单独的 `author_ids[]`
和只有姓名的对象不属于输入契约，不提供 fallback 或双写兼容。

canonical identity 来自 private `people/persons.json`。同步器校验 registry 的 `records` 结构与
`person_id` 唯一性，并要求每个公开 work 的作者 ID 在其中唯一解析；未知 ID 使同步失败。
中文显示名仍来自该 work 的 `name_zh`，不从人物别名、目录名或 Archive taxonomy 推断。

```text
private work.authors[]             public generated article
  ├── person_id  ────────────────▶ author_ids[]
  └── name_zh    ────────────────▶ author[]
```

两数组由同一对象数组按原顺序生成，不分别维护。`GeneratedArticleSchema` 校验非空数组、非空
字符串、身份唯一与长度一致；`ReadableDocument` 以 `authorIds` 暴露身份引用，现有 `author` 与
`authorLabel` 的显示语义不变。身份引用本身不生成作者链接或人物页面。

person registry 只用于验证作者身份，不把人物的 aliases、roles、positioning、research fields、
resources 或其他完整事实纳入 article。人物是否已有 researcher publication 不影响其作为译文
作者；registry 中存在一个人物也不使其作品自动公开。internal work 仍受 translation publication
selection 控制；未公开且缺少 `authors[]` 的 work 不阻塞同步，若被选择公开则必须满足同一作者契约。

`topics` 与 `persons` **不属于**这份 allowlist：它们是 public 仓库自行维护的 Archive 编辑分类
（`editorial/archive-taxonomy.json`），不是 translation 的发布元数据，因此不写进 `work.json`，
也不由同步器输出。`persons` 表示文章研究或涉及的人物，不能派生作者，也不接收 `author_ids`。
所有权与完整性规则见[架构说明](ARCHITECTURE.md)的“文件所有权”，分类集合由 public schema 校验。

## 书籍与正式成果

书籍记录必须有发布选择指定的稳定 book_id、非空书名与作者、至少一条包含非空版本号和日期的版次记录，
以及非空译者引言。原文出处、文件校验值、公开与下载的权利说明、勘误和修订说明是可选字段，
应在材料已经确认且可公开时补充。字段可选不免除具体版本和渠道的权利判断。

private 中存在 LaTeX 或 PDF 不构成发行。正式记录只在对应版本获准后建立；大文件可以作为项目
Release 或外部对象存储中的版本化附件，但其公开选择和维护记录由 private 网站接口承载。

### 记录位置与格式

每本书的成稿在 private `web/editorial/books/<book_id>.md`，由 `web/publication.json` 的 `books`
显式选择。条目只接受 `book_id`、`publication_scope`、`editorial_path`；只读取 website_public，
获准 ID 不得重复，路径须对应上述文件名且实际文件不得越出成稿目录。books 数组可以为空。
同步器校验所选 front matter 和非空介绍，输出 `.website-input/books.json`；public 的
`src/lib/books.ts` 只消费生成输入，生成
`/books/<book_id>` 页面。frontmatter 保存出版元数据，正文是**译者引言**——由小组撰写、用于介绍这本
书的文字，不是书籍正文。

```yaml
title: 中文书名
original_title: 原文书名          # 可选
author: 作者
cover: /covers/<book_id>.png      # 可选；jpg / png / webp，放在 public/covers/
original_source: 原文出处          # 可选；缺省则页面不显示这一行
original_year: '1997'             # 可选，四位年份字符串；原著年份
work_type: 专著                    # 可选，自由格式；缺省时列表页退回 category 的标签
category: translation             # 可选，缺省是 translation；另一个值是 digitization
collection: 文集或丛书名           # 可选；写同一个名字的书在列表页聚成一组
volume_label: 第一卷              # 可选，只在写了 collection 时才显示，自由格式
rights: 公开、下载与印刷的权利依据 # 可选；未写则“获取与权利”只显示是否提供下载
download:                         # 可选；缺省即页面声明不提供下载
  label: 链接文字
  href: 链接地址
editions:
  - version: v1.0                 # 可以是版本号，也可以是内部修订标识（如 private 仓库的短哈希）
    date: 2026-01-01
    checksum: 文件校验值          # 可选
    note: 版次说明                # 可选
errata: [勘误条目]                # 可选
```

没有 `translators` 字段：本站的书统一由中文伊里因科夫小组制作，这是站点层面的事实。

`category` 决定 `/books` 的书籍分组：`translation` 是不显示标题的默认书架，`digitization` 等其他
类别显示标题，空分类不显示。同一 `collection` 的书聚成一组，组内按 book_id 的
字典序排列——要固定成卷次顺序就按顺序命名文件（如 `wenji-01-xxx.md`、`wenji-02-xxx.md`）。

版次记录维护同一网站书籍 ID 下的版本、日期与修订说明；页面展示原则见[架构说明](ARCHITECTURE.md)。

封面之外不放置书籍文件；未获许可的正文不进入 `public/`，也不进入 `dist/`。

### 小组工作

只归档中文伊里因科夫小组以自身名义公开的研究、活动和阶段性成果，按**期**记录，每期一个文件：
`editorial/group/<issue>.md`，由 `src/lib/group.ts` 读取并校验，生成 `/group` 列表与 `/group/<issue>`
详情页。期号就是这一期的稳定公共身份，不把标题放进 URL。这是经过编辑选择的长期公共记录，不是 changelog。

这是 public 仓库自行维护的正式公开内容，与译文和研究资料两条通道彼此独立：

- 不经过 private translation pipeline，不进入 `sync-translations.mjs`，也不适用
  `GeneratedArticleSchema`；
- 不写入 `.website-input/`，该目录只由同步器生成，禁止手工放置小组内容；
- 正文只保存一份，就在这一期的 Markdown 里，页面不复制正文。

```yaml
issue: 0                    # 必填；非负整数，且必须与文件名一致
title: 本期标题              # 必填
kind: 小组说明               # 必填；简短类型标签，如“研究”“讨论记录”“资料整理”
published: 2026-10-01       # 必填；ISO 日期
summary: 列表页用的简短摘要    # 必填
```

`published` **表示这一期在网站公开的日期**，不是文本所记历史事件的发生日期。历史日期属于研究记录，
见 `src/lib/research-records.ts` 的 `period`；两类日期不得混用，也不要拿本期日期顶替史料年份。

字段级的准确定义以 `src/lib/group.ts` 的 schema 为准；schema 与本文不一致时以 schema 为准，并修正
本文。一期未来若包含多个彼此独立的成果，先在同一篇 Markdown 里用二级标题分节，不提前建立独立的
works 目录；只有当某项成果需要自己的稳定 URL、需要被其他栏目单独引用，或需要独立的作者、引用信息
与版本生命周期时，再拆分。

### 近期动态

整个网站、翻译、资料整理、研究与小组工作中值得公开说明的近期变化记录在 `editorial/updates.json`，由 public 仓库
自行维护。它是首页、`/updates/` 与 RSS 的单一事实源，其他消费者也应复用。
它承担高频、简短、按时间顺序的变化记录，不记录普通重构、CSS 调整、测试、部署或 metadata housekeeping 等
开发日志。动态不是文章，没有正文页面，也不复制既有内容的正文或元数据。

文件为严格 JSON 数组，每项只接受以下字段：

| 字段 | 必填 | 约定 |
| --- | --- | --- |
| `date` | 是 | 真实有效的 ISO `YYYY-MM-DD` 日期字符串，表示公开工作变化的发生日期 |
| `summary` | 是 | 简短的纯文本说明，不使用 Markdown 或 HTML |
| `link` | 否 | 对应内容的站内绝对路径（以单个 `/` 开始）或 `http(s)` 地址 |
| `link_label` | 否 | 链接文字；仅在存在 `link` 时可填写，缺省为“查看相关内容” |

结构示例（实际维护时应填写已确认的公开变化）：

```json
[
  {
    "date": "2026-10-05",
    "summary": "公开一组研究会议资料，便于查阅相关讨论。",
    "link": "/research/",
    "link_label": "查看研究资料"
  }
]
```

只记录已经确认且可公开的变化，不把计划、待确认的研究结论或内部协作状态写成公开成果。不能自动从
Git 提交日期、构建日期或内部修订日期推断公开日期；记录工作完成也不表示已经生产部署。动态记录本身
不代替 private 的发布决定。受限正文、内部备注
与未获准公开的资料仍不得进入此文件或公共构建。

列表按日期倒序展示，同一天保留数组中的编辑顺序。不另设类型、ID、月份分组或重复的首页数据；需要
更丰富的工作记录时，链接已有的小组按期内容或其他公开页面。

### RSS 的公开边界

RSS 只复用已有小组公开记录与动态的日期、摘要和链接，不输出正文，也不扩展公开授权。未记录本站首次
公开日期的译文不作为内容条目纳入；原文年份、研究历史日期和内部版次日期不能代替 `pubDate`。将来接入
译文须由 private 发布清单明确记录 `website_published`，并显式更新公开字段契约、同步器与 schema，
不得在 public 侧补造日期。排序、重复处理与动态身份规则见[内容管线](CONTENT_PIPELINE.md)的“RSS 订阅”。


## Ilyenkov 总页发布

`records` 中的 `ilyenkov_profile` 只接受 `public_id`、`publication_scope`、`kind`、
`record_path`、`record_id`、`title_zh`、`birth_record_id`、`editorial_path`。
`record_path` 必须为 `people/persons.json`；`record_id` 必须唯一解析为 person_id。
`birth_record_id` 必须唯一解析为已获准生成的 biography 记录，不能指向其他类型或未公开记录。
人物原名取 canonical `name_original`；生年取所选出生记录日期，死亡年份取 canonical `death_year`。
只允许一个获准的总页 profile。成稿路径沿用 `web/editorial/<slug>.json` 及实际文件边界。

成稿只接受非空短摘要 `summary`、非空单行 `description`、非空段落数组 `introduction` 与
有序 `entrances` 数组。入口只接受 `target`、`label`、`summary`；target 为 life、timeline、
works、circle，不得重复。入口数组可以为空，不保存路由、事件或作品清单。
介绍中的 `{{identity}}`、`{{originalName}}`、`{{lifespan}}` 只引用当前获准身份投影；未知引用失败。
成稿不另存姓名、生卒年或 canonical 记录副本，不扩大发布范围。
未选择或非 website_public 条目不读取成稿；撤回后清除生成 profile，不保留 fallback。


网站书籍选择与 `works` 的正文公开选择相互独立：选择书籍成稿不将 internal_public 正文提升为
website_public，不读取作品正文、PDF、EPUB或扫描件，也不推导下载许可。封面仅保留既有 public
图片路径选择。同步输出不含 private locator 或 publication_scope；撤回后删除生成记录，
全部撤回时生成空数组，不扫描未选择成稿，不保留 public editorial 或旧加载 fallback。
