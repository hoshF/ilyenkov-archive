---
title: "translation_workspace"
created: "2026-06-11"
updated: "2026-07-27"
type: "project"
tags: ["translation", "workspace"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# translation_workspace

这里是中文翻译与精读计划的工作区。所有译文建立在可追溯原文之上：伊里因科夫优先，
其他人物按研究需要选择性翻译，译文不替代作者原语言文本。

新会话接手翻译工作前，先读 [HANDOFF.md](HANDOFF.md)：分工、术语表权限、Codex 交互
与当前进度都在那里。

翻译采用“结构忠实初译 + 中文学术定稿 + 疑难问题表”的轻量流程。原文是最高依据，
作者本人的其他作品是主要辅助语料；其他作者仅在明确引用、思想史关联或同作者语料无法
解决歧义时参考。

## 子目录

- `planned/<author_id>/<work_id>/`：待翻译项目登记、优先级和来源说明。
- `drafts/<author_id>/<work_id>/`：初译草稿。
- `reviewed/<author_id>/<work_id>/`：人工读过并初步校订的中文稿。
- `latex_templates/`：从中文稿生成 LaTeX/PDF 时使用的模板和说明。
- `templates/`：项目元数据、结构初译、中文定稿和问题记录模板。

## 项目结构

长篇以章节为单元，文章使用 `full` 单元：

```text
<stage>/<author_id>/<work_id>/
  translation.json
  units/
    ch001/
      literal.md
      final.md
      issues.md
```

`translation.json` 通过仓库相对路径、版本、SHA-256 和内容块范围绑定中央语料，不得在
翻译目录复制原文。翻译源必须是 GBrain 实际读取的可见正文 Markdown；禁止引用
`.fulltext/`、`source/`、snapshot、扫描件或数字化隔离目录。长篇切分文件还必须通过同目录
`work_manifest.json` 的章节和哈希检查。

“内容块”是去除 front matter 和纯分隔线后，由空行分隔的 Markdown 块；标题、正文段落、
引用、列表、表格和脚注都各自参与编号。每个单元的 `source_segments` 按原文顺序登记一个
或多个源片段；每个片段保存 `source_path`、`source_block_start`、`source_block_end`、版本
与哈希，单元的 `paragraph_count` 等于所有片段内容块数之和。译稿使用本单元内连续的二级
标题作为锚点，例如 `## ch001-p0001`；一个锚点内可以包含多个中文句子或自然段，但不能
省略锚点。
译文内部需要保留的原文标题使用三级或更低级标题，不能占用二级锚点层级。
`p0001` 对应第一个源片段的起始内容块，此后按 `source_segments` 顺序连续递增，因此任何
问题记录都能反推出具体源文件和绝对内容块编号。

技术切分文件不一定等于语义章节。一个语义翻译单元可以引用同一 `work_manifest.json` 下
多个有序切分文件的片段；同一文件也可以由多个翻译单元引用不同且不重叠的内容块范围。
这样译文按真实章节组织，正式来源仍保持在 GBrain 的可审计切分层。

## 切分正文与整本文件的分工

这里的正式来源是“GBrain 所索引的中央语料 Markdown”，不是 GBrain 数据库、检索摘要或
模型回答。三层材料的职责固定如下：

1. 可见切分 Markdown 是翻译绑定层：保存路径、哈希、内容块范围和逐段对应。
2. `work_manifest.json` 是作品顺序层：连接同一作品的切分文件，供语义单元跨片段和读取
   前后文使用。
3. 隐藏整本 Markdown、`.fulltext/` 或 snapshot 是切分生成与一致性核验材料，不作为译稿
   的直接来源、引文证据或审校绑定对象。

实际翻译时应读取当前语义单元覆盖的全部可见片段，并按需要读取清单中的前后相邻片段；
不能只把单个检索命中的小块交给译者。这样保留整本上下文，又不让隐藏技术母本成为第二套
来源记录。

## 初始化项目

先查看源文件的稳定内容块编号：

```bash
python3 scripts/check_translations.py \
  --inspect-source ilyenkov_markdown/ilyenkov_md/path/to/work-ch001.md
```

再由中央管理命令生成哈希、内容块数量和 `translation.json`：

```bash
python3 scripts/manage_collections.py init-translation \
  --author-id ilyenkov \
  --work-id source-work-id \
  --source-version "已核验的版本说明" \
  --source-unit ch001 ilyenkov_markdown/ilyenkov_md/path/to/work-ch001.md 1-15
```

长篇重复使用 `--source-unit <unit_id> <source_path> <all|START-END>`。同一语义章节跨越
多个技术切分文件时，按 `work_manifest.json` 顺序重复使用相同 `unit_id`，命令会把它们
合并为一个翻译单元的有序 `source_segments`。`work_id` 必须匹配源 Markdown front matter
的 `work_id`；没有该字段时依次使用源文件的 `id` 或文件名。命令只建立 `planned/` 登记，
不复制原文或生成未经确认的译文。

当前使用 `metadata/schemas/translation_project.schema.json` 的 schema v3：状态和两次审校
记录保存在每个翻译单元上，项目文件不再有全局状态。这使长篇可以逐单元推进——追加或
翻译后续单元不会作废已完成单元的审校记录。v3 取代项目级状态与审校的 v2，升级时唯一
试点项目已就地迁移。历史 LaTeX/PDF 工程仍按后文的迁移规则处理，不能伪造为已审校项目。

## 状态与流程

状态按翻译单元记录，依次为：

```text
planned → drafting → accuracy_review → language_review → reviewed
```

项目目录位置由单元状态与完成声明共同决定：全部单元 `planned` 时在 `planned/`；其余情况
在 `drafts/`。长篇按章增量登记，**“已登记单元全部 reviewed”并不等于全书完成**，因此项目
默认留在 `drafts/`；只有在 `translation.json` 中显式声明 `work_complete: true` 后才移入
`reviewed/`，而 `reviewed/` 也反过来要求该字段为真。各单元进度由 `translation.json`
逐单元记录。

1. 在 `planned/<author_id>/<work_id>/` 用 `init-translation` 登记首批单元。
2. 后续单元直接在 `translation.json` 的 `source_units` 中追加（`status=planned`、两次
   审校 `pending`），追加后运行校验；新增单元不影响已完成单元的审校记录。
3. 开始翻译某单元时，把该单元 `status` 改为 `drafting`，并复制三个 Markdown 模板；
   项目随之移入 `drafts/`。
4. 在 `literal.md` 中形成语法成立、保留原文概念和论证关系的结构忠实初译；疑难写入
   `issues.md`。**初译是起草阶段的快照，不保证正确**——审计只改定稿，下游一律引用
   `final.md`；两稿有差异不等于定稿改错（见 `notes/STYLE_GUIDE.md` 第二·六节）。
5. 单元进入 `accuracy_review` 后，该单元初译和定稿必须覆盖其全部登记段落并完全对应；
   准确性审校逐段检查遗漏、增译、否定、限定和引文归属。
   **逐段读之前先跑 `python3 scripts/audit_unit.py chNNN`**：它算齐锚点、逐块斜体、
   脚注、括号、两稿逐字相同块与定稿相对初译的缩水率（并把缩水率放回全书分布对比），
   同时打印错误清单里只写给审计方的条目。它不替代逐块通读，只保证该算的都算过了。
6. 在 `final.md` 中同时对照原文、初译、术语表和问题记录，形成自然的中文学术表达。
7. 单元准确性审校通过后进入 `language_review`；语言审校通过后该单元改为 `reviewed`。
8. 全部单元 `reviewed` 后项目移入 `reviewed/`；需要出 PDF 时，从 `final.md` 生成独立
   LaTeX 工程，不在排版文件中修改译文。

准确性审校和语言审校可以由同一人完成，但必须分两次记录。AI 可以辅助检索、句法分析
和起草，不能填写最终人工审校结论。

用户提供原文路径、中文译文和术语建议表的博客文章审校也按“先准确性、后中文语言、再术语”
的顺序执行，但它不会仅因完成审校而获得正式翻译项目的 `translation.json`、审校哈希或
`reviewed` 状态。只有按本工作区结构登记的项目使用五阶段状态。此类任务直接使用
[文章审校快速流程](ARTICLE_REVIEW_WORKFLOW.md)，不要重复读取本文件的长篇项目细节。

**定稿不合格时退回重做，只重写 `final.md`**，`literal.md` 与已通过的形式项保持不动
（ch014 定稿大面积照抄初译、ch025 定稿系统性漏词，两次都如此处理）。重做 prompt 写进
`tmp/codex/chNNN-redo-final.prompt.md`，并在该单元 `issues.md` 记明退回理由。

**防照抄的检查（正文块逐字相同数 >3 且占比 >1/3）在两稿一在就执行，不看单元状态。**
它原先只在 `accuracy_review` 及以后才跑，而单元要到审计之后才会推进到那个状态——
等于安排在了它想防的损失发生之后，因此自加入起从未触发过。

审校记录必须绑定当前文件快照。完成审校前运行：

```bash
python3 scripts/check_translations.py \
  --review-hashes translation_workspace/drafts/<author_id>/<work_id>
```

命令按单元输出准确性和语言两个哈希。准确性哈希覆盖该单元的原文映射、`literal.md`、
`final.md` 和 `issues.md`，语言哈希只覆盖该单元的 `final.md`。通过后，该单元原文范围或
受覆盖文件发生变化都会使检查失败；修改时先把该单元相应审校记录重置为 `pending`，完成
修改后重新审校。语言阶段若修改了 `final.md`，必须重新通过准确性审校，再进行语言审校。

## 参考顺序

1. 当前原文及其上下文。
2. 同一作者的其他作品。
3. 作者术语表及已有翻译决定。
4. 字典或已出版译本。
5. 其他作者文本，仅用于明确引用、思想史关联或尚未解决的歧义。

同作者语料证据只记录仓库路径和段落位置，不复制大段原文。偏离术语表首选译法时，
必须在 `issues.md` 登记术语条目、最终决定和理由。

## 术语确认与回写

作者术语表是随翻译积累的资产，翻译过程同时承担术语审定。条目状态为 `needs_review`
或 `provisional` 的概念在翻译中首次实际处理时，应在 `issues.md` 登记术语问题，并在
准确性审校时给出结论，回写到 `<author>_markdown/metadata/glossary.json` 的源记录：

- 确认首选译法：条目 `evidence` 增加本次翻译的原文 `corpus_path` 和判断说明，
  状态按审定结果改为 `approved`。
- 修改首选译法：更新 `zh_preferred`，原译法降入 `zh_alternatives`，在 `notes`
  记录决定理由和来源段落。
- 上下文变体：保留首选译法，`zh_alternatives` 增补变体，采用理由保留在
  `issues.md` 的问题记录中。

术语建议表只是候选输入。审核者必须统计候选词全部已知词形在当前原文中的出现次数和位置，
并在已登记作者语料中做定向复现统计；随后阅读本篇全部语境和足够的代表性语料，核对邻近
概念、同义词与可能混同的词族。收录判据固定如下：

- 有真实译法选择，或已经被语料证明会复现；
- 标准固定术语、一次性修辞和无约束价值的低频词不收；
- 低频但理论关键的概念不能只因次数少而删除；
- 重复条目、错误拆分或被语料否定的条目可以删除，删除 required entry 时须同步清理引用；
- `approved` 表示证据充分且译法稳定，`provisional` 表示当前可用但仍依赖后续语境，
  `needs_review` 表示值得跟踪但证据不足。

每批新增、修改、删除、状态调整和拒绝收录都写入 `terminology_reviews/*.json`，由脚本
生成 [`TERMINOLOGY_CHANGELOG.md`](TERMINOLOGY_CHANGELOG.md) 索引。批次记录包含原文与
译文位置、文章及作者语料频次、修改前后值和理由，但它不是第二份术语表；正式译名只以
glossary JSON 为准。
只有会影响未来任务 prompt 的跨篇裁定才另行加入 [`DECISIONS.md`](DECISIONS.md)。

若作者没有正式 glossary，读取 collection、works master、source manifest、source survey
和必要语料完成普通审核，在日志明确“无正式术语表”，不得临时创建整套 glossary。

回写后运行：

```bash
python3 scripts/render_glossaries.py --write
python3 scripts/check_glossaries.py --check
python3 scripts/render_glossaries.py --check
python3 scripts/render_prompt_template.py --check
python3 scripts/check_translations.py --check
python3 scripts/check_project_docs.py
```

术语表更新不自动使已通过的审校失效；但已审校项目引用的条目发生首选译法变化时，
应在受影响项目的 `issues.md` 登记复查问题并重新审校相关段落。

术语批次只暂存 glossary 源记录、生成视图、变更日志及确有必要的翻译流程文件，以英文
祈使句独立提交，并在博客发布前推送。若当前分支的推送会夹带本批次开始前已经存在的未推送
提交，停止在推送前报告，不继续博客或知乎阶段；既有无关修改和未跟踪文件不得纳入提交。

## 自动检查

```bash
python3 scripts/check_translations.py --check
```

检查覆盖元数据、可见正文准入、`work_manifest.json`、原文哈希与内容块范围、目录与
状态、段落编号、非空译文、两稿对应、问题记录、审校顺序和审校快照哈希。语义准确性、
未声明的术语漂移和中文通顺性仍须人工判断。原文哈希变化时不得直接更新登记值，应先在
问题表记录受影响单元并重新审校。
