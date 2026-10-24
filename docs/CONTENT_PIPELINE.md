# 公开内容同步与静态构建

本文件说明数据从选定来源到生成输入、再到页面的处理过程。权限、字段及输入失败条件以
[发布说明](PUBLICATION.md)为准；栏目和内容所有权见[架构](ARCHITECTURE.md)，环境与上线见[部署](DEPLOYMENT.md)。
私有研究仓库下称 private，本站公共仓库下称 public。

## 统一 private 入口与生成通道

同步器从 private `web/publication.json` 读取选定来源，写入 `.website-input/`；
页面从生成输入读取数据。各通道如下：

| 选择 | 同步入口（`scripts/`） | 生成输入（`.website-input/`） | 读取端（`src/lib/`） |
| --- | --- | --- | --- |
| `works` | `sync-translations.mjs` | `articles/`、`article-assets/` | `site-data.ts`、`markdown.ts` |
| `records` 及研究页面根选择 | `sync-research-records.mjs` | `research-records.json`、`portraits/` | `research-records.ts` |
| `books` | `sync-books.mjs` | `books.json` | `books.ts` |
| `archive_taxonomy` | `sync-archive-taxonomy.mjs` | `archive-taxonomy.json` | `archive-taxonomy.ts` |
| `glossary` | `sync-glossary.mjs` | `glossary.json` | `glossary.ts` |

研究规划与来源解析由 `scripts/lib/research-sync/` 负责，共享路径、校验及写入逻辑位于
`scripts/lib/`。同步更新变化文件并清理撤回内容；不要手工修改生成输入。
选择范围、路径基准和必选性见[private 公开接口](PUBLICATION.md#private-公开接口)。

研究公开输出的共享 Schema 位于 `src/lib/research-record.mjs`，只依赖 Zod，校验字段结构与
公开记录之间的引用关系。规划器完成记录及页面引用后，在返回结果前执行完整校验；校验失败
时尚未写入 JSON、复制照片或清理撤回照片。同步器按原规划对象序列化，保留字段顺序。
网站读取端 `src/lib/research-records.ts` 在读取生成 JSON 时使用同一 Schema 再次校验，随后
执行缓存、排序和页面数据派生。私有来源、发布选择与授权检查仍属于同步阶段。

## 命令顺序

`publication:sync` 依次运行译文、研究、书籍、Archive 分类与术语同步器，
`publication:prepare` 复用该命令。`check`、`test`、`build` 均先同步；`verify` 顺序为：

```text
publication sync → astro check → astro build → search:index → vitest run
```

`publication:check` 只比较生成输入，不改写；退出码 1 表示输入过期，2 表示同步失败。
修改 private 来源或发布选择后，执行 `npm run publication:sync`，再用 `npm run verify` 验证。

## 译文转换

同步去掉整行内部 `block-id` 注释，保留代码示例中的注释。正文开头的一级标题由页面题名替代；
该标题的脚注引用进入 frontmatter `title_notes`，与正文共同编号并保留回链。

正文以 Markdown 引用同目录图片时，同步器只复制实际引用的 `jpg`、`jpeg`、`png`、`webp`、`gif`
或 `avif`，不允许 `../` 跨目录引用，不扫描或整目录复制附件。站点根路径与 `http(s)` 图片地址
保留原样。图片公开权限由 private 发布决定控制，替代文字应描述图片内容。构建时从生成的图片文件
读出固有宽高写入 `<img>` 的 `width`、`height`，图片下载前即按比例占位；文件缺失或无法读出尺寸时
构建失败。同一步按宽高标记横图或竖图，外部图片不分规格；图片布局见[架构](ARCHITECTURE.md#布局原则)。

图注由 private 译文在图注段落前写 `<!-- figure-caption -->` 显式标出（写法见 private
`translation/TRANSLATION_STYLE.md`）。同步器在去掉 block-id 前确认标记介于图片段落与图注段落之间；
渲染时图片与图注合成 `<figure>`，图注为 `<figcaption>`，布局见[架构](ARCHITECTURE.md#布局原则)。
整段加粗或斜体的图注去掉这层外包装，文字不改；没有标记的段落一律按正文处理，标记位置不对时构建失败。

单篇译文的注释按原刊注码显示：注释定义全部使用不带前导零的纯数字技术 ID 时，注释号与注释列表的 `<li value>`
显示该 ID；定义前一行的 `<!-- note-label: N -->` 改为显示 `N`，可以重复、缺号或不从 1 起。`N` 也可以是原刊
星号注的 `*`、`**`、`***`：这类条目带 `data-note-label`，不占列表号，标号作为条目开头的文字写出。
HTML 锚点仍由技术 ID 生成。注释区按定义顺序列出全部注释，正文未引用的注文也列出，但没有返回链接。
同步时标记必须紧接注释定义（block-id 只能写在标记之前）；渲染时标记格式错误、取值不在上述范围、
与技术 ID 相同、出现在非纯数字 ID 的文档中，注释重复定义、正文引用缺少定义，以及未引用的注文里含注释号，
都会使构建失败。凡含 `note-label` 字样的 HTML 注释都按标记校验；正文中写出的 `[^N]` 字样（包括转义写法）
会被当作缺少定义的引用。含非数字技术 ID 的文档和其他 Markdown 内容沿用默认脚注编号。

“原文信息”按生成 frontmatter 中实际存在的 `source_edition`、`source_url`、`doi` 呈现，不写死在
Markdown 正文里。完整字段见发布说明的[译文的公开字段](PUBLICATION.md#译文的公开字段)。

### 作者身份

同步器在 `people/persons.json` 中解析选定 work 的 `authors[].person_id`，按原顺序从同一数组
生成 `author_ids[]` 与 `author[]`。读取端以 `ReadableDocument.authorIds` 关联身份，以 `author`
和 `authorLabel` 显示署名；输入与身份限制见[译文作者输入与身份边界](PUBLICATION.md#译文作者输入与身份边界)。

## 研究者同步与本站译文

同步器按发布条目的定位读取 person，将中文姓名、摘要与选定人物字段组合成研究者记录。
选定照片复制到 `portraits/`，经 `/research/researchers/<slug>/portrait.<ext>` 输出。
允许字段见[研究者身份与公开字段](PUBLICATION.md#研究者身份与公开字段)。

研究者页对 `getSiteData()` 的公开文章集合执行 `authorIds.includes(personId)`，保留档案规范
顺序及完整合著署名。列表在读取时派生，不另存 `works[]` 或读取 private 作品目录。

## Readings 活动定位与系列同步

活动以 `record_directory` 匹配 event 的 `local_directory`，公开题名取所选 event 的 `title_zh`，
公开身份取 publication 的 `public_id`。定位与日期条件见[Readings 活动定位](PUBLICATION.md#readings-活动定位)。

系列从 `research/readings/series.json` 读取，并分别解析两条历史关系：

1. 在 `research/readings/events.json` 中按 `earliest_archived_event_directory` 和
   `first_international_event_directory` 各自定位唯一 edition。
2. 最早归档关系采用 series 的选择，不限定固定年份或编号状态；第一届国际会议要求 `edition_roman === "I"`。
3. 找到该活动唯一获准的 `ilyenkov_readings` 发布条目，将其 `public_id` 写入
   `history.earliestArchivedEventId` 或 `history.firstInternationalEventId`。
4. 共享输出 Schema 确认两条关系各自在公开 `readings` 集合中唯一解析。

引用校验按唯一匹配执行；完整契约见
[Readings series 的公开字段](PUBLICATION.md#readings-series-的公开字段)。

来源 URL 按结构读取：`source.urls` 为数组时取首项；否则依次从 `source.urls.current`、
`source.urls.original`、`source.urls.archive`、`source.url` 取首个非空值，再校验为合法 `http(s)` 地址。
选中值无效时失败，不跳过无效值。输出仅保留公开来源字段。
单个 event 表示一届会议，不另建 session 集合；日期投影保留来源精度，不补月日。

### Readings 页面依赖

研究入口、Readings 详情页与共享研究导航通过 `src/lib/readings-page.ts`，从公开系列集合中
按稳定公开 ID `ilyenkov-readings-series` 选择当前栏目。选择不依赖集合长度或顺序；目标缺失时
按页面依赖错误终止构建。首页同样按该公开 ID 读取目标。

系列集合继续采用[可选集合契约](PUBLICATION.md#readings-series-的公开字段)，不为当前栏目限制总数。
Readings 详情页仍通过 `getPublicReadings()` 读取全部获准活动，没有按系列隔离活动；
此身份选择仅确定当前页面的题名、摘要、成稿与资源，不改变活动归属或历史关系的唯一性校验。

## IFI 网络同步

同步器读取 `research/friends/organization.json`，组合 publication 的中文题名、摘要与所选资源。
形成关系按以下顺序映射：

1. 用 `formation_event_id` 在 `research/friends/events.json` 中定位唯一活动。
2. 校验其属于 `org-ifi`，类型为 `symposium`，状态为 `confirmed`。
3. 按活动定位找到唯一获准的 `ifi_symposium` 发布条目。
4. 将其 `public_id` 写入 `formation.symposiumId`；共享输出 Schema 确认公开引用及状态。

`activity_modes` 按原顺序映射为
`activityModes`；形成活动与独立研讨会继续保存在共享集合。字段和引用限制见
[IFI 网络的公开字段](PUBLICATION.md#ifi-网络的公开字段)。

## 年表与作品目录

研究同步器先生成获准记录，再按 `timeline.record_kinds` 写入 `timeline.recordIds`。
`getPublicTimelineRecords()` 解析引用、按日期排序并添加分类标签。

年表与作品目录的成稿分别写入 `timeline.editorial`、`worksCatalog.editorial`，由
`getPublicTimelineEditorial()`、`getPublicWorksEditorial()` 返回。作品由 `getPublicWorks()`
从共享 `works` 集合读取，public 按类型分组、排序和格式化。成稿输入及空集合规则见
[年表与作品目录](PUBLICATION.md#年表与作品目录)。

## 生平与交往

研究同步器读取选定成稿，按作者顺序生成阶段和主题分区，并从共享公开记录解析引用。
生平阶段输出 `recordIds` 及期间或去重年份，空引用不生成期间或年份；明确摘要直接保存，
缺省活动摘要由 `getPublicLife()` 按引用顺序连接，不保存副本。

交往分区输出类型、题名、导语与 `recordIds`。`getPublicCircle()` 读取共享集合、按期间与题名
排序，并将地点、状态统一为真实值或空值；解析后的 `records` 不写回生成分区。
页面映射 HTML 标识、专题路由并格式化日期，不推断分期。
输入类型、引用、空数组及摘要要求见[生平与交往](PUBLICATION.md#生平与交往)。

## 公开成稿同步

研究同步器读取选定的 IFI、Readings 和研究者成稿，写入对应记录的可选 `editorial`。
页面仅渲染生成字段，`introduction` 通过 `renderPublicMarkdown()` 编译。
各类型字段、路径和未选择行为见[公开编辑文字](PUBLICATION.md#公开编辑文字)。

## Ilyenkov 人物总页

同步器组合选定人物、已公开出生记录与人物成稿，将三个显式占位引用替换为获准人物事实，
输出 `ilyenkov`。输入、占位引用和撤回规则见[Ilyenkov 总页发布](PUBLICATION.md#ilyenkov-总页发布)。
首页使用短摘要与入口名称，总页使用完整介绍与入口导语，子页使用原有共享集合；
入口 target 在 public 映射为路由。选定照片经 `/ilyenkov/portrait.<ext>` 输出。
需要该资料的页面缺少生成输入时构建失败。

## 网站书籍成稿

`scripts/sync-books.mjs` 使用 `src/lib/book-record.mjs` 校验所选成稿的 front matter，
保留 Markdown 译者引言，写入 `books.json`。`src/lib/books.ts` 编译引言，派生路由与最新版次，
书籍按 ID 字典序、版次按日期升序排列，最后一条为最新显示版次；文集内保留书籍顺序。
输入字段、选择范围及撤回规则见[记录位置与格式](PUBLICATION.md#记录位置与格式)。

## Archive 分类投影

分类同步器在译文同步后校验文章指派，写入词表标签与分类 ID。
`src/lib/archive-taxonomy.ts` 派生词条、命中数和筛选路由；文章事实仍读取 articles 输入。
分类人物与作者身份互不推导，选择及失败规则见[Archive 分类](PUBLICATION.md#archive-分类)。

## 术语库同步与查询

`web/publication.json` 的可选 `glossary` 根对象选择 `website_public` 的术语表。
`scripts/sync-glossary.mjs` 只投影所选表中的 `approved` 条目，输出
`.website-input/glossary.json`；同步器与读取端共用 `src/lib/glossary-record.mjs` 校验公开字段。
路径、字段与撤回规则见[术语库的公开字段](PUBLICATION.md#术语库的公开字段)。

```text
private glossary 源表 + web/publication.json 的 glossary 选择
  │  publication:sync → sync-glossary.mjs
  ▼
.website-input/glossary.json
  │  glossary-record.mjs 校验 → glossary.ts 读取 → glossary-query.ts 派生
  ▼
/glossary/ 列表与浏览器查询 + /glossary/<collection>/<id>/ 静态详情
```

`getGlossary()` 只读取生成输入，按中文主译、原词、表标识、词条 ID 保持稳定次序。
`collection = glossary` 派生为专名与体制词，`terms` 为通用学科术语，其他表为作者理论概念。
分类与作者标签、名称类型标签、详情路由和筛选项由 public 派生，不保存到 private 词条或生成输入。

浏览器按类别、作者与名称类型筛选；搜索先匹配 `zh_preferred` 与 `canonical`，再匹配
`zh_alternatives` 与 `forms`。同一层内按完整匹配、前缀匹配、包含匹配排列，同等级沿用规范次序。
`notes` 不参与搜索，其原文不纳入列表页的浏览器查询数据，只在详情页按普通文字渲染，
不自动解析参见或建立词条关系。查询与筛选保存在列表 URL 中；从列表打开详情后，返回链接保留查询条件。

空选择、撤回及失败清理规则见[术语库的公开字段](PUBLICATION.md#术语库的公开字段)。
维护时修改 private 原表与发布选择，再执行本文的同步及验证命令。

## public 编辑输入与缓存

站点配置、小组通讯与动态直接读取 public `editorial/`，不经过 private 同步。
`src/lib/editorial.ts` 校验站点配置，在模块加载时解析 JSON；外部 JSON 更改可能需要重启开发服务器。

使用 `buildCache` 的 getter 在生产构建中只加载一次，在开发中每次调用重新读取。
开发服务器自动处理源码与样式更新；private 更改须先同步，搜索索引刷新见[文章搜索](#文章搜索)。

## 文章集合与首页派生

`getSiteData()` 提供统一顺序：

```text
year DESC → title_zh ASC（zh-Hans-CN）→ id ASC
```

`id` 保证同年同题名的稳定次序。档案列表、上一篇／下一篇、研究者译文和首页文本均保留此顺序。
首页各区直接派生已有集合：

| 区块 | 来源与顺序 |
| --- | --- |
| 文本 | Archive 规范顺序，展示完整作者署名 |
| 研究 | 已公开研究记录的摘要与详情入口 |
| 最近小组通讯 | `published` 倒序，同日按期号倒序 |
| 近期动态 | updates 规范顺序；完整列表由 `/updates/` 展示 |

首页截取数量由页面实现维护。日期含义见[发布说明](PUBLICATION.md#rss-的公开边界)。

## 公开动态

`getUpdates()` 校验 `editorial/updates.json`，按日期倒序，同一天保留编辑顺序。
首页和完整动态流复用同一组件；字段及收录规则见[近期动态](PUBLICATION.md#近期动态)。

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
权限与日期约束见[RSS 的公开边界](PUBLICATION.md#rss-的公开边界)。

## 文章搜索

`npm run build`、`test`、`verify` 在 Astro 静态构建后执行 `search:index`。Pagefind 只读取
`dist/archive/*/index.html` 中标记的文章题名、作者、原题名和正文区域，分类过滤复用现有
文章分类；搜索元数据直接使用公开文章题名。导航、其他栏目和 private 文件不进入索引。

索引输出到 `dist/pagefind/`，每次生成前清空这一生成目录，撤回的文章不会保留旧片段。
索引随静态产物部署，不独立维护文章清单或搜索正文。浏览器仅在搜索时加载索引，分类页
搜索限定当前分类；清空关键词恢复普通列表，加载失败时保留分类与文章列表。

`npm run dev` 先构建搜索索引，开发服务器从 `dist/pagefind/` 提供搜索资源。修改公开正文
或分类后，执行 `npm run build` 并刷新浏览器，以更新开发搜索索引。
