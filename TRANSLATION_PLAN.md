---
title: "学习型翻译计划"
created: "2026-06-11"
updated: "2026-07-27"
type: "project"
tags: ["project", "documentation"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# 学习型翻译计划

中文翻译、术语研究和精读是文本库的长期重点，建立在原典数字化与研究平台之上，不替代
作者原语言语料。伊里因科夫是持续翻译的优先对象；其他苏联哲学家按与其研究的关系
选择性翻译；斯宾诺莎等思想来源主要建设原语言语料，不承诺全面中文化。

所有翻译项目使用 `translation_workspace/<stage>/<author_id>/<work_id>/`，并通过
`translation.json` 绑定中央注册表中的原文路径、版本和 SHA-256。

## 翻译与精读原则

- 原文已进入正文层且来源、版本和文本角色明确后，才建立翻译项目。
- 原文是最高依据，作者本人的其他作品是主要辅助语料；其他作者只在明确引用、思想史关联
  或同作者语料不能解决歧义时参考。
- 每个翻译单元保存结构忠实初译、中文学术定稿和疑难问题表。
- 准确性审校与中文通顺性审校分开进行，可以由同一人在不同阶段完成。
- 翻译过程同时承担术语审定：待审术语在实际翻译中确认或修订，结论回写作者术语表，
  使术语系统随翻译积累而不是独立维护。
- 用户提供原文路径、中文译文和术语建议表的文章审校同样属于翻译工作：先完成逐段准确性
  与中文语言审校，再审核术语建议、回写作者术语表并记录术语变更日志。
- AI 可以辅助理解和起草，但不能替代人工校订，也不能冒充权威译本。
- 译文修改必须能够回溯到具体原文文件或章节。

## 标准流程

翻译项目依次经过：

```text
planned → drafting → accuracy_review → language_review → reviewed
```

1. 在 `translation.json` 中登记原文单元的仓库路径、版本、SHA-256、内容块范围和段落数。
2. 长篇绑定 GBrain 实际读取的切分 Markdown，由 `work_manifest.json` 核验；不得读取或
   绑定 `.fulltext/`、snapshot、扫描件和其他隐藏完整副本。
3. 以语义章节为长篇工作单位、以全文为单篇文章单位，建立连续的段落编号。技术分片与
   语义章节不一致时，一个翻译单元可以按 `work_manifest.json` 顺序登记多个切分文件片段；
   同一源范围不得被不同单元重复使用。
4. 在 `literal.md` 中形成结构忠实、语法成立的学术初译；疑难处登记到 `issues.md`。
   **`literal.md` 是起草阶段的快照，不保证正确**：审计只改 `final.md`，下游一律引用定稿
   （见 [`notes/STYLE_GUIDE.md`](notes/STYLE_GUIDE.md) 第二·六节）。
5. 逐段进行准确性审校，优先用作者其他作品和作者术语表核对概念及固定表达。
6. 在 `final.md` 中同时对照原文、初译、术语表和问题记录，形成自然的中文学术表达。
7. 准确性审校通过后进行独立的语言审校；审校记录按翻译单元绑定当前文件范围 SHA-256，
   之后发生修改时必须重置该单元记录并重新审校。
8. 状态与审校记录按单元保存，长篇逐单元推进；单元两次审校均通过后标记为 `reviewed`，
   全书单元均登记且完成、并在 `translation.json` 声明 `work_complete: true` 后，项目才
   移入 `reviewed/`。LaTeX 和 PDF 只从 `final.md` 生成，不在排版
   工程中直接修改译文。
9. **进入一个新的文件类型之前，先主动看一遍它的块布局**（附录、目录、另一部作品）。
   本项目的规则绝大多数来自“上次被什么咬了”，因而只覆盖已发生过的错法；
   ch037—ch041 五篇附录各自的布局、ch039／ch040 的“编号正文冒充节标题”、
   ch000 的目录顺序依赖，都是靠**提前去看**而不是靠被咬发现的
   （见 STYLE_GUIDE 第二节“正文各章之外的三种块布局”）。
10. **每完成一个单元的审计，必须把结论回写到流程本身**：视需要新增或修订体例规则、注记
   规则和术语表条目，并把新出现的错误类型补进 [`notes/STYLE_GUIDE.md`](notes/STYLE_GUIDE.md)
   第七节清单与 [`translation_workspace/templates/codex_prompt.md`](translation_workspace/templates/codex_prompt.md)。
   翻译流程是动态的：只修好当前一处而让同类错误在下一章重演，视为审计未完成。
   术语建议的新增、修改、删除、状态调整和拒绝收录统一记入结构化批次记录；生成的
   [`translation_workspace/TERMINOLOGY_CHANGELOG.md`](translation_workspace/TERMINOLOGY_CHANGELOG.md)
   只提供索引。日志只是审计轨迹，正式译名仍以作者 glossary JSON 为准。

这里绑定的是 GBrain 所索引的中央语料文件，不是 GBrain 数据库或模型回答。隐藏整本文件
只负责生成、核验切分；翻译时通过 `work_manifest.json` 按顺序读取当前语义单元覆盖的全部
可见片段，并按需要补充前后相邻片段，以兼顾完整上下文和逐段可追溯性。

详细目录、问题记录和检查规则见
[`translation_workspace/README.md`](translation_workspace/README.md)。运行：

```bash
python3 scripts/check_translations.py --check
```

项目初始化和源内容块检查使用：

```bash
python3 scripts/check_translations.py --inspect-source <corpus-markdown>
python3 scripts/manage_collections.py init-translation <arguments>
```

按单元推进时用这三个脚本，**它们承担的是原先靠人记住的部分**：

```bash
python3 scripts/new_prompt.py chNNN            # 生成起草 prompt 骨架（数字与路径全部自动填入）
python3 scripts/new_prompt.py chNNN --verify   # 核对要点里引用的块号（写完要点必跑）
python3 scripts/audit_unit.py chNNN            # 审计前算齐结构事实，并打印审计方专属清单
python3 scripts/render_prompt_template.py --check   # 校验模板的【常见错误】与【术语约定】是否最新
```

`render_prompt_template.py` 把 STYLE_GUIDE 第七节的错误清单与 `glossary.json` 的术语
**生成**进模板，并设分类关卡：新增一条错误或一个术语条目而未分类即报错。
手抄时代曾出现清单 31 条而模板只带 17 条、术语表 33 条只进 17 条的脱节。

## 体例与注记

译文的标点、强调和注记体例见 [`notes/STYLE_GUIDE.md`](notes/STYLE_GUIDE.md)，适用于本仓库
全部翻译项目。要点：注记按**作者原注／原书编者补足／原书编者注／译注**四类分别标记，
另设〔底本来源：…〕标记数字化附加的出处行；正文一律用中文弯引号，强调在成书时排为
着重号，引者所加的强调必须声明。成书时正文前须有译者引言、译例、底本说明、仓库索引
和权利说明。

## 分工与术语权限

- 起草可交由外部编码智能体（Codex）完成：它读一份任务 prompt，写出某单元的
  `literal.md` 和 `final.md`，并把报告写回文本文件。正式翻译项目由当次指定的审计者负责
  结构校验、逐块语义审计、术语审定与审校记录；人工负责审计全部产物并给出最终认可。
- 用户提供原文路径、中文译文和术语建议表时，Codex 负责先做原文—译文准确性审校和中文
  语言审校，再作为本批次术语维护者审核建议、修改对应作者 glossary JSON、生成视图并写
  结构化术语审核批次。项目所有者保留最终复核与推翻决定的权力，但常规维护不需要事前确认。
- 各方都可读取术语表以对齐译名；同一批次只由指定术语维护者写入，避免并发产生两个
  权威版本。若作者没有正式 glossary，不临时创建整套术语表，而在日志中记录候选、语料
  依据和“无正式术语表”结论。
- Codex 交互文件放在 `tmp/codex/`（git 忽略）；不进版本库。审计留痕时先单独提交 Codex
  原始输出，再提交审计者的注册、修正与术语改动。
- **起草方与审计方各有一套防范条目，且传递方式不同**：起草方的由
  `render_prompt_template.py` 生成进 prompt；审计方专属的那几条（prompt 怎么写、
  提交怎么做、术语表怎么改）prompt 不带，由 `audit_unit.py` 在每次审计前打印。
- 定稿质量不合格时**退回重做，只重写 `final.md`**，`literal.md` 与已通过的形式项不动
  （ch014、ch025 两次先例）。

查看每个单元的实时进度：

```bash
python3 scripts/check_translations.py --status
```

新会话接手翻译工作，先读交接手册
[`translation_workspace/HANDOFF.md`](translation_workspace/HANDOFF.md)。

博客文章审校可以向术语系统贡献证据，但不会因此建立虚假的 `translation.json`、审校哈希
或 `reviewed` 状态。只有按本计划登记并完成五阶段流程的正式翻译项目才使用这些状态。
常规文章批次直接按
[`translation_workspace/ARTICLE_REVIEW_WORKFLOW.md`](translation_workspace/ARTICLE_REVIEW_WORKFLOW.md)
执行，不重复读取本计划的长篇项目细节。

## 伊里因科夫优先专题

当前试点：《科学理论思维中的抽象与具体的辩证法》（1997 年完整版，42 章）。它同时承担
三项任务：产出正式译文、在真实文本上检验五阶段流程、审定 `abstract`、`concrete` 等
待审核心术语。项目登记在
`translation_workspace/planned/ilyenkov/knigi-dialektika-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-myshlenii/`，
单元随翻译进度增量登记，首个单元为 ch001 作者序。1960 年《资本论》版及其两种已有
中文 PDF（`existing_translations/published_pdfs/`）作为参考顺序第四层的对照材料；
1997 版新增内容以本项目译文为准。流程在试点中暴露的问题记录到阅读笔记后统一改进。

## 已有或已开始的中文翻译

| 作品 | 当前状态 | 位置 | 备注 |
|---|---|---|---|
| 《辩证逻辑：历史与理论论文集》1974 年第一版 | 已整理为 LaTeX 工程 | `dialectical_logic/` | 优先阅读和校订 |
| 《论偶像与理想》 | 已整理为 LaTeX 工程 | `idols_ideals/` | 优先阅读和校订 |
| 《资本论中抽象与具体的辩证法》 | 已有中文 PDF | `existing_translations/published_pdfs/` | 有两个 PDF 版本，待后续比较 |
| 《列宁主义辩证法和经验主义形而上学》 | 已有中文 PDF | `existing_translations/published_pdfs/` | 孔令恺、罗托译 |
| 《辩证逻辑：历史与理论述评》 | 已有中文 PDF | `existing_translations/published_pdfs/` | 外部已有中译本，待后续核查版本 |
| 《辩证逻辑：历史与理论论文集》 | 已有外部 PDF 和本项目编译 PDF | `existing_translations/` | 本项目以 1974 年第一版为主 |

上述 LaTeX/PDF 是流程建立前形成的历史成果，不因文件存在而自动获得 `reviewed` 状态。
迁移时必须重新绑定中央切分 Markdown、建立段落映射并完成两次人工审校。历史工程中的原文
抓取副本只作旧工程材料保留，不能作为新翻译项目的来源记录。

## 已知暂不优先项目

| 作品 | 状态 | 原因 |
|---|---|---|
| 《辩证逻辑》1984 年第二版/增订版 | 未翻译，不优先 | 迈丹斯基指出第二版存在严重编辑删改问题；当前项目优先采用 1974 年第一版 |

## 候选来源分层

### A 级：核心概念和正式著作

优先选择能够帮助理解伊里因科夫思想体系的文本：

- 书籍：`ilyenkov_markdown/ilyenkov_md/knigi/`
- 正式期刊文章：`ilyenkov_markdown/ilyenkov_md/stati-v-zhurnalah/`
- 书中章节和论文：`ilyenkov_markdown/ilyenkov_md/glavy-i-stati-v-knigah/`

优先主题：

- 辩证逻辑
- 理想性 / идеальное
- 思维 / мышление
- 活动 / деятельность
- 抽象与具体
- 《资本论》的逻辑
- 个性、教育、文化与人的发展

### B 级：辅助理解材料

- 百科条目：`ilyenkov_markdown/ilyenkov_md/stati-v-entsiklopediyah/`
- 访谈：`ilyenkov_markdown/ilyenkov_md/dialogi-i-intervyu/`
- 书信：`ilyenkov_markdown/ilyenkov_md/pisma/`
- 评论和书评：`ilyenkov_markdown/ilyenkov_md/retsenzii/`

这些材料适合在读完核心著作后补充人物背景、概念脉络和时代语境。

### C 级：资料库和专题研究材料

- 手稿和发言记录：`ilyenkov_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/`
- 报纸文章：`ilyenkov_markdown/ilyenkov_md/newspaper/`
- 译文和转译材料：`ilyenkov_markdown/ilyenkov_md/perevody/`
- 迈丹斯基研究：`maidansky_markdown/maidansky_md/`

这些材料先作为资料保存，不急于系统翻译。

## 推荐节奏

1. 先读完 `dialectical_logic/` 和 `idols_ideals/`。
2. 阅读时在 `notes/READING_NOTES.md` 记录问题、术语和可能需要补充翻译的文本。
3. 读完后，从 A 级候选中选 3-5 篇最重要文章做小规模试译。
4. 每篇试译先在 `translation_workspace/planned/` 登记，再进入 `drafts/`，不要直接变成
   正式作品。
5. 只有准确性审校和语言审校均由人工确认后，才进入 `reviewed/` 或生成 LaTeX/PDF。

## 选题说明模板

机器可检查的来源和状态只登记在 `translation.json`，不要另写一份容易过期的来源清单。
需要讨论选题时，可在阅读笔记中使用以下简表：

```text
## work-slug

- 原题：
- 中文暂名：
- 作者：Э.В. Ильенков
- 类型：book / article / interview / letter / manuscript / newspaper
- 优先级：A / B / C
- 选择理由：
- 术语风险：
- 备注：
```
