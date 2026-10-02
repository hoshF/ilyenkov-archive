# 发布与访问范围

## 基本原则

文件可读取不等于允许发布；允许网页阅读不等于允许进入 Git；不提供下载按钮也不构成访问控制。
每项内容按精确版本和具体渠道决定公开范围。

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
站点——这九类结构化研究资料走同一条规则，不因栏目不同而另立标准：

- 每一条都由 private 的 `research/publication.json` **逐项**标记选择。未被选中的条目，不因文件
  存在而视为可以公开，也不建立占位数据。
- 九类记录必须同时有获准条目。任何一类为空，同步器直接失败，不生成半份 `research-records.json`。
- public 只输出该条目获准的最小公开字段：稳定 ID、中文与原文题名、摘要或简短定位、历史日期或
  日期范围、地点或状态、以及明确选定的外部来源链接。每项事实都必须由所选来源支持。
- 以下一律不进入 public 与 `dist/`：正文、自传原文、扫描件、附件、照片、视频、统计、成员名单与
  联系方式、机构与履历、内部置信度、冲突分析、研究备注、来源 ID、日志、问题记录、本地路径。
- 来源之间存在冲突时，公开数据只保留能够共同支持的最小事实，不在网站上代替研究系统作出裁决。
- 页面上的日期是历史事实，不是网站的发布或更新时间。
- 外部链接只用于资料定位，不表示本站拥有转载或下载授权。

字段级的准确定义以 `scripts/sync-research-records.mjs` 的输出和 `src/lib/research-records.ts` 的
schema 为准；两者不一致时以 schema 为准，并修正同步器。

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
| 允许公开的来源字段 | `title` `title_zh` `author` `year` `source_edition` `source_url` `doi` | 直接从 private `work.json` 读取；`source_url`、`doi` 缺省时不写 |
| public 生成字段 | `title_notes` `type` `generated_from` `generated_rev` | 不属于 `work.json` 的透传：`title_notes` 从正文开头一级标题的脚注引用生成，`generated_from`、`generated_rev` 是构建溯源，`type` 是固定字面量 |
| private-only 字段 | `work_id` `source_path` `rights_status` `source_text_status` `orcid` `udc` `copyright` `translator` | 一律不进 public 与 `dist/`：内部标识与路径、权利证据、校勘与置信状态、学术表单信息、英译者 |

`rights_status`、`source_text_status`、`source_path` 等必须在**同步阶段**就被挡住，不允许先进
generated files 再靠页面隐藏。

### `year` 与 `author` 的语义

- **`year`** 是**原文文献的发表年份，或它所在出版物的年份**；不是中文译文的年份，不是网站发布
  日期，不是同步日期，也不是 `generated_rev` 的日期。会议发表后又进入期刊这类复杂情况，由
  metadata 层先确定口径，页面层不自行猜测。
- **`author`** 是**原文作者**，用数组表示（至少一项、不重复），public 使用统一的中文显示名。
  它与下列角色**不是**一回事：translation 的 contributor 与目录 owner（那是翻译工作的组织方式，
  同一条记录的目录归属可能与原文作者不同）、中文译者（站点层面的事实，不建字段）、source
  translator（英译者，属于 private-only）。因此**不能**用 `translation/<contributor>/` 目录名在
  runtime 推断作者；作者必须显式写在 `work.json` 里。

`topics` 与 `persons` **不属于**这份 allowlist：它们是 public 仓库自行维护的 Archive 编辑分类
（`editorial/archive-taxonomy.json`），不是 translation 的发布元数据，因此不写进 `work.json`，
也不由同步器输出。所有权与完整性规则见[架构说明](ARCHITECTURE.md)的"内容归属"。

## 书籍与正式成果

以中文伊里因科夫名义发行的每项成果至少记录：

- 稳定出版 ID、书名和作者；
- 原文出处，即这段文字原本出自哪本书或文集；
- 版本号、发布日期和文件校验值；
- 公开、下载和印刷的权利依据；
- 勘误、修订和后续版本关系。

private 中存在 LaTeX 或 PDF 不构成发行。正式记录只在对应版本获准后建立；大文件可以作为项目
Release 或外部对象存储中的版本化附件，但其公开身份和维护记录仍由本仓库承载。

### 记录位置与格式

每本书是 `editorial/books/<book_id>.md` 中的一个文件，由 `src/lib/books.ts` 读取并校验，生成
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
类别显示标题，空分类不显示。同一 `collection` 的书聚成一组，组内按 `editorial/books/` 里文件名的
字典序排列——要固定成卷次顺序就按顺序命名文件（如 `wenji-01-xxx.md`、`wenji-02-xxx.md`）。

书籍详情页的版次历史使用原生 `<details>` 浮层，不需要 JavaScript。

封面之外不放置书籍文件；未获许可的正文不进入 `public/`，也不进入 `dist/`。

### 小组工作

小组以自身名义公开的研究、讨论、资料整理与阶段性成果，按**期**记录，每期一个文件：
`editorial/group/<issue>.md`，由 `src/lib/group.ts` 读取并校验，生成 `/group` 列表与 `/group/<issue>`
详情页。期号就是这一期的稳定公共身份，不把标题放进 URL。

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
