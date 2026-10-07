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

## 译文作者同步

作者事实来自被选为 `website_public` 的 private work 的 `authors[]`。每个对象严格包含非空
`person_id`、`name_zh`，数组非空、身份不重复，并保留原始署名顺序。同步器不接受旧 `author[]`、
单独的 `author_ids[]` 或仅有姓名的输入，不提供 legacy fallback。

`people/persons.json` 是 private canonical person registry。同步器校验 `records` 结构与
`person_id` 唯一性，再逐项确认公开 work 的作者 ID 在 registry 中唯一解析。未知作者 ID 报错时
指出对应 work 与 ID；不要求该人物已有 public researcher publication。

同一 `authors[]` 按顺序生成两项 frontmatter 数组：`name_zh` → `author[]`，
`person_id` → `author_ids[]`。两者等长、逐项对应，不分别维护或重新排序。前者继续用于页面的
中文署名，后者只作为稳定身份引用；`GeneratedArticleSchema` 校验身份非空、不重复及数组长度一致，
`ReadableDocument.authorIds` 暴露该引用，`author` 与 `authorLabel` 保持现有显示契约。

同步器不复制 registry 的 aliases、roles、positioning、research fields、resources 等人物事实，
也不从 `editorial/archive-taxonomy.json` 的 `persons` 推导作者或把作者身份写入该分类。
作者 identity 不生成 researcher profile，不改变研究者发布契约，也不扩大作品公开范围。
只有 translation publication 明确选择的 work 才生成 article；internal work 与未公开、缺作者的
work 不输出，后者若被选择为 `website_public` 则必须补齐作者契约。

## 研究者同步与本站译文

`researcher_profile` 走现有 research publication 通道，以 `record_path: people/persons.json` 和
`record_id = person_id` 在 canonical person registry 中唯一解析人物。目标的 `person_id` 必须与
locator 相等，`name_original`、publication 的 `title_zh`、`summary_zh` 均须非空。不读取旧
works master、internet source index 或 researcher selected works，不提供旧 locator fallback。

publication 只决定人物是否公开、中文编辑姓名与简介，以及 `resource_kinds`。条目严格只接受
`public_id`、`publication_scope`、`kind`、`record_path`、`record_id`、`title_zh`、`summary_zh`、
`resource_kinds`；旧 `source_path`、`author_zh`、`author_original`、`works` 与 `include_*` 均拒绝。

adapter 显式生成 `id`、`personId`、`name`、`originalName`、`summary`、`resources`，以及 person 中
存在的 `latinName`、`roles`、`researchFields`。后三者分别读取 `name_latin`、`roles`、`research_fields`，
是固定公开形状，不依赖 publication 开关。资源只允许 `personal`、`orcid`、`institution`；按明确选择
读取 person 的对应 URL，重复、未知、缺失或非法 `http(s)` URL 均失败。未选择资源与 aliases、
`positioning_ru`、affiliation、local IDs、event relations、private locator 等事实不进入 generated data。
完整字段契约见[发布说明](PUBLICATION.md)的“研究者身份与公开字段”。

研究者页通过公开身份单向派生本站译文：

```text
private person.person_id
  ├─ researcher publication ─▶ researcher.personId
  └─ work.authors[] + translation publication ─▶ document.authorIds
                                                  │
公开 Archive documents ── 按 personId 筛选 ─────────┘
                         ▼
                  研究者页的本站译文列表
```

列表只消费 `getSiteData()` 的公开 documents，使用 `authorIds.includes(personId)` 筛选并保留
Archive 规范顺序与完整作者署名；不读取 private translation 目录、works master、source index 或
publication work IDs，也不生成 researcher `works[]` 副本。当前 Maidansky 匹配 24 篇，包括三篇合著；
该数量属于当前公开选择，不是 schema 条件。internal 与未选择的作品始终不进入列表。

Archive article 不需要 researcher public ID 或路由，person registry 与 translation 也不反向依赖
profile。没有 researcher publication 的作者仍可公开文章；新增或撤下 profile 不改变 translation
公开选择。researcher schema 允许零篇本站译文，页面保留相应空状态。

## Readings 活动定位与系列同步

`ilyenkov_readings` publication 必须通过 `record_directory` 定位 private event，对应其
`local_directory`。该字段必须是非空字符串，并在所选 Readings events 中唯一匹配。目标须为正式
Readings edition，且所选 `source_path` 属于同一个活动目录。
独立纪念会不是有效目标：2011 年 3 月纪念会不能因与正式会议同年而被选中。目录不输出到 generated
data；公开身份始终来自 publication 的 `public_id`，不虚构 private event ID。
event publication 不接受 `record_id`，即使同时提供正确 directory 也会失败；不提供年份查找或双
locator 兼容。其他 kind 的 `record_id` 不受影响，series publication 仍须以 `record_id = series_id`
选择记录。

`ilyenkov_readings_series` 为可选的新 publication kind，仍读取现有 research 清单，不新增数据通道。
adapter 只从 `research/readings/series.json` 的 records 中按 `record_id = series_id` 选择唯一记录，
校验非空 `name_ru`、固定 `academic_conference_series` 类型、两条非空 event directory relation 与
resources 结构。中文题名和摘要分别来自 publication 的 `title_zh`、`summary_zh`；正式题名为
“伊里因科夫学术报告会”，不从三段 private 俄文事实摘要生成文案。

两条历史关系在同步阶段独立完成映射：

1. 用 `earliest_archived_event_directory`、`first_international_event_directory` 在
   `research/readings/events.json` 中各自定位唯一 Readings edition；
2. 前者必须是 1991 年未编号活动，后者必须具有 `edition_roman === "I"`；
3. 对同一 private event 找到唯一的 `website_public`、`ilyenkov_readings` publication；
4. 分别输出其 `public_id` 为 `history.earliestArchivedEventId` 与 `history.firstInternationalEventId`。

未公开、匹配重复或活动身份不符都会失败，不因 series 已被选择就越过 event publication 边界。
public schema 还检查每条关系在公开 `readings` 集合中唯一解析。当前真实清单已选择 series 与 1999 年
第一届国际会议，生成 `readingsSeries` 的历史关系指向 `readings-1991-first` 与
`readings-1999-i-first-international`。启用 series 而未公开必要历史活动时仍会失败；负向测试在 fixture
中明确移除相应 publication，不修改真实 private 清单。

series publication 严格限定为 `public_id`、`publication_scope`、`kind`、`record_path`、`record_id`、
`title_zh`、`summary_zh`、`resource_kinds`。`resource_kinds` 只允许 `archive`、`society`、
`historical_archive`，不得重复；逐项读取 private series 的资源 URL，缺失或无效 `http(s)` URL 都失败。
输出仅为 `{ kind, url }`，未选择资源与 private-only 研究事实不进入 generated data，也不由 publication
重定义 URL。完整边界见[发布说明](PUBLICATION.md)的“Readings series 的公开字段”。

Readings source URL 按 `current → original → archive → 既有 flat url` 选择第一个非空公开 URL，再校验为合法
`http(s)` 地址；不因优先 URL 无效而回退掩盖错误。已有 current URL 的输出保持不变，不输出抓取时间、
归档状态或其他 archive metadata；数组形式仍保持原有的第一项选择行为。

当前公开选择包含十个 Readings 活动与一个系列。原九个活动的 public ID 保持不变，1991 年 edition
显示为“早期会议（未编号）”，新增 1999 年“第一届国际会议”；页面结构保持不变。2018 年 XX 届仍是
一届，现有 public event schema 不能完整表达同届双场，这是未来展示与契约问题；尚未建立 session
model 或 `/research/readings/`。

## IFI 网络同步

IFI network 仍走现有 research publication 通道，不另建事实源。官网只读取所选
`research/friends/organization.json` 记录的 `url`，校验为非空合法 `http(s)` URL；不读取 publication
的 `source_url`，也不提供兼容 fallback。中文题名与介绍继续来自 publication 的 `title_zh`、`summary_zh`。
IFI network publication 严格限定为 `public_id`、`publication_scope`、`kind`、`record_path`、`record_id`、
`title_zh`、`summary_zh`、`resource_kinds`，任何额外字段（包括 `source_url`、`url`、`resources`）都会使同步失败。

形成关系在同步阶段完成 private → public 映射：

1. 读取 organization 的 `formation_event_id`，在 `research/friends/events.json` 中找到唯一对应活动；
2. 确认活动属于 `org-ifi`，类型为当前支持的 `symposium`，且已确认为 `confirmed`；
3. 在 `research/publication.json` 中按该活动的 `record_path` 与 `record_id` 找到唯一的
   `website_public`、`ifi_symposium` 条目；
4. 只输出该发布条目的 `public_id` 为 `formation.symposiumId`，不透传 private event ID。

不存在、归属或类型不符、未公开、多个发布匹配都使同步失败。当前 private event ID 与 public ID 即使
字面相同，也必须经过上述映射；public ID 将来可独立调整。public schema 还要求形成关系在公开
`ifiSymposiums` 集合中恰好解析到一条记录。

`activity_modes` 映射为 `activityModes`，仅允许 `symposium`、`webinar`、`collective_reading`、
`discussion`，保持 private 顺序。publication 的 `resource_kinds` 是资源输出的唯一选择列表：只允许
`about`、`history`、`texts`、`symposiums`、`youtube`、`facebook`，不得重复；逐项从 organization 的
`resources` 读取 URL，缺失或无效的 `http(s)` URL 都失败。输出仅为 `{ kind, url }`，未选择的资源
不会进入生成数据，publication 不重新提供或覆盖 URL。

network 不输出 `founded`、`positioning_en`，也不复制形成活动的日期、地点或题名。现有 IFI symposium
保持独立集合与原有发布、来源契约；`/research/` 的形成年份通过 `formation.symposiumId` 解析
symposium 的 `period.start`，不维护第二份年份事实。活动方式与资源本轮只进入严格 schema，不新增
页面展示或 IFI 详情页；webinar series 的 `official_page` 不改动，也不从 organization 资源推导。
完整允许字段与 private-only 边界见[发布说明](PUBLICATION.md)的“IFI 网络的公开字段”。

## 文章集合的规范顺序

译文集合只有**一个**规范顺序，由 `src/lib/site-data.ts` 的 `getSiteData()` 给出：

```text
year DESC  →  title_zh ASC（zh-Hans-CN）  →  id ASC
```

第三级 `id` 让结果完全确定，不依赖文件系统的读取顺序。`year` 是原文文献的发表年份（语义见
[发布说明](PUBLICATION.md)），因此这个顺序是"原文发表年份由新到旧"。

文章集合的消费者读的都是这一份顺序，都不自行排序：

| 消费者 | 用它做什么 |
| --- | --- |
| `/archive/` | 文库列表 |
| `/archive/[id]` | 上一篇 / 下一篇 |
| 研究者详情页 | 筛选同一作者的本站译文，保留集合顺序 |

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
