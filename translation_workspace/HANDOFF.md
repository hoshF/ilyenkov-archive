---
title: "翻译工作交接手册"
created: "2026-07-21"
updated: "2026-07-30"
type: "project"
tags: ["translation", "workflow", "handoff"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# 翻译工作交接手册

本文件让新会话的 AI 能接手中文翻译工作：知道当前进度、能做什么、下一步做什么，以及
如何把进度保持下去。规则细节以 [TRANSLATION_PLAN.md](../TRANSLATION_PLAN.md) 和
[README.md](README.md) 为权威，本文件只做导航与状态交接。

## 〇、按需读取（先看这里，别一次全读）

本仓库的流程文件加起来上万字，**新会话不需要全读**。按你要做的事取：

| 你要做的事 | 需要读 | 不必读 |
|---|---|---|
| 了解现状、决定下一步 | **本文件**＋`--status` 的输出 | 其余全部 |
| 写某章的任务 prompt | 先跑 `scripts/new_prompt.py chNNN` 生成骨架，再读本文件第五节＋[`DECISIONS.md`](DECISIONS.md) | 模板全文与 STYLE_GUIDE 全文——**骨架已机器生成地带上全部起草方条目与术语约定**（见下） |
| 审计某章译稿 | 先跑 `scripts/audit_unit.py chNNN`（结构事实＋审计方专属清单），再读俄文源文件＋两份译稿＋Codex 报告 | 其他章的 `issues.md`（除非要查先例，那就 grep 它） |
| 查某个先例／某章当初怎么判的 | `grep` 相应的 `units/chNNN/issues.md` | 通读任何文件 |

**少读不等于少带**——这是本节能成立的前提，且是机器保证的，不靠记性：

- 起草方那一侧，[`templates/codex_prompt.md`](templates/codex_prompt.md) 的【常见错误】与
  【术语约定】都由 `scripts/render_prompt_template.py` 从 STYLE_GUIDE 第七节与
  `glossary.json` **生成**，错误编号与清单一致。清单新增一条错误、或术语表新增一个
  concept 条目而未分类，`--check` 即报错。所以写 prompt 时不读那两份全文，
  防范条目与术语规则一条也不会少。**手抄时代错误清单少过 4 条、术语约定漏过 16／33 条**，
  这就是改成生成的原因。
- 审计方那一侧由 `scripts/audit_unit.py` 承担：它算齐结构事实（锚点、逐块斜体、脚注、括号、
  **引文起首**、两稿逐字相同、缩水率对比全书分布），并打印错误清单里**只写给审计方的**那几条。
  该名单不在这里列举、也不在 `audit_unit.py` 里手抄，而是引用
  `render_prompt_template.py` 的 `AUDITOR_ONLY`——手抄的那份曾停在第 33 条，
  害得新增的第 35 条从没到过审计方手里。

**逐章的历史不在本文件里**，在各章的 `issues.md`：想找先例就 `grep`（理由见第九节）。

## 一、分工（谁做什么）

- **Codex（gpt-5.6-sol）** 负责起草：读任务 prompt，写 `literal.md`（结构忠实初译）和
  `final.md`（中文定稿），并写术语/难点报告。用户另行提供原文路径、中文译文和术语建议表时，
  Codex 先做准确性与中文语言审校，再负责本批次的
  **术语审定、术语表回写和变更日志**。
- 正式翻译项目由指定审计者写 prompt、做结构与逐块语义审计并记入 `translation.json`；同一术语批次只由一名指定维护者写 glossary。
- **项目所有者** 负责：审计以上全部产物（审计者做了什么、给 Codex 的反馈、Codex 的原译）。
  **签字的效力来自所有者的审阅，而不是填写动作本身**：指定审计者可代填 `reviewer: hoshF`，
  但必须在回复中明说“这是我单方面填的，等你审阅”；所有者认可后即生效（可事后追认），
  不认可则退回 `pending` 重审。账本上的 `passed` 因此始终意味着“所有者已认可或将追认”，
  不得理解为“Claude 自己通过了”。
- **全书 42 单元已由所有者逐批审阅并全部认可**（2026-07-23／24），**`passed` 全部生效，
  本项目不再有待审阅的签字**。将来若因校订纸本重取哈希而须重签，规则同上：代填后逐单元声明。

## 二、术语表权限（硬规则）

术语表源文件是 [`ilyenkov_markdown/metadata/glossary.json`](../ilyenkov_markdown/metadata/glossary.json)，
生成视图是 [`notes/terminology/ilyenkov.md`](../notes/terminology/ilyenkov.md)。

- 各方都读术语表；执行准确性审校的指定维护者负责本批次审核与回写，所有者保留最终复核权，常规维护不需事前确认。
- 文章审校批次直接按 [`ARTICLE_REVIEW_WORKFLOW.md`](ARTICLE_REVIEW_WORKFLOW.md) 执行；详细决定写结构化批次，`TERMINOLOGY_CHANGELOG.md` 只作生成索引。
- 改表后运行 `render_glossaries.py --write` 和 `check_glossaries.py --check`；保持紧凑单行数组风格，不整体重排。
- JSON 是唯一术语源记录，生成视图与日志不得覆盖它；无正式 glossary 的作者只记录候选和
  替代语料依据，不临时创建整套术语表。

## 二·五、体例与注记（硬规则）

译文体例见 [`notes/STYLE_GUIDE.md`](../notes/STYLE_GUIDE.md)，通用于全部翻译项目。**五类注记**：

- **作者原注** → 脚注 `[^…]`，不署名；
- **原书编者补足**（补词入正文）→ 只用〔词〕，**不加署名后缀**；
- **原书编者注**（说明或参考）→ 〔……——俄文版编者〕；
- **译注** → 〔……——译注〕，长注用脚注 `[^zh-N]` 并缀「——译注」；
- **作者在其所引文字内所加的说明或声明**（ch016 新增第五类）→ 照录底本形式，
  保留原文括号与署名，署名不展开为中文姓名：（即“一般的图形”——*Э.И.*）。

另有〔底本来源：…〕标记数字化附加的出处行（非原书内容）。正文一律中文弯引号，禁用
ASCII 直引号；强调范围严格对齐原文，只以 `*…*` 编码、排法由成书模板定；引者所加强调必须声明。

**底本换行会影响标题**，两种情形处理相反（见 STYLE_GUIDE 第二节末）：标题占**两个块**时两块
各自成锚点、不得合并；标题在**一个块内含硬换行**时仍是一个锚点、中文写成一行（ch005、ch019 块 4）。

## 三、Codex 交互（临时文件工作流）

临时文件都在 `tmp/codex/`（已被 git 忽略，不进版本库）：

1. 指定审计者把任务 prompt 写到 `tmp/codex/chNNN.prompt.md`。
2. 所有者在 Codex App 里说：“读 `tmp/codex/chNNN.prompt.md` 并按它执行”。
3. Codex 写出 `units/chNNN/literal.md`、`units/chNNN/final.md`，并把报告写到
   `tmp/codex/chNNN.report.md`。
4. 指定审计者读报告与两份译稿，做审计。

进版本库的只有译稿、`issues.md`、`translation.json` 和术语表；prompt 与 report 不提交。
审计留痕方式：先把 Codex 原始输出单独提交一版，再提交审计者的注册+修正+术语，
让 git 历史清楚分开“Codex 译的”与“审计者改的”。

## 四、文件位置

| 用途 | 路径 |
|---|---|
| 俄文原文（只读，永不复制） | `ilyenkov_markdown/ilyenkov_md/knigi/<work>/…-chNNN.md` |
| 译稿单元 | `translation_workspace/<阶段>/ilyenkov/<work>/units/chNNN/…`（本项目已在 `reviewed/`） |
| 项目账本 | 上述 `<work>/translation.json` |
| 术语表 | `ilyenkov_markdown/metadata/glossary.json`（源）、`notes/terminology/ilyenkov.md`（视图） |
| Codex 临时文件 | `tmp/codex/`（git 忽略） |
| 底本疑点汇总（成书前核纸本） | `translation_workspace/SOURCE_CRUXES.md` |

## 五、按单元推进（细则不在本文件）

五阶段状态机、单元注册、审校哈希、`work_complete` 的规则**正本在
[`../TRANSLATION_PLAN.md`](../TRANSLATION_PLAN.md) 的「标准流程」与
[`README.md`](README.md) 的「状态与流程」**，此处不复述（那张状态图曾在三处各存一份）。
本节只留这两条在别处没有的：

5. **审计后回写（不可省略）**：每审完一个单元，依次自问——是否需要新增体例规则？是否出现
   现有五类注记覆盖不了的情形？是否有术语要登记或调整？这个错误会不会重演？——并分别改
   [`notes/STYLE_GUIDE.md`](../notes/STYLE_GUIDE.md)（含第七节错误清单）、`glossary.json`、
   [`templates/codex_prompt.md`](templates/codex_prompt.md)。
   **流程是自我完善的**：教训必须沉淀进文件，不能只留在某次会话里。
   **但沉淀的去处不是本文件**：审计经过写该章 `issues.md`，跨章裁定加 `DECISIONS.md` 一行，
   可复发的错误加错误清单一条，术语改 `glossary.json` 并记结构化审核批次，**底本疑点补
   [`SOURCE_CRUXES.md`](SOURCE_CRUXES.md) 一行**；本文件只改“下一步”。

**写新一章的 prompt 不要从模板手抄，跑脚手架**：

```bash
python3 scripts/new_prompt.py ch0NN     # 生成 tmp/codex/ch0NN.prompt.md 骨架
```

它把块数、SHA-256、源路径、来源 URL、上一单元、日期、锚点范围全部填好，并把
`--inspect-source` 的 features 明细嵌进【本单元要点】，**该章特有的难点留成待填项**。
这样一来，写 prompt 的人只做判断，不做抄写——错误清单第 14、26、28、31 条**全部**是
“审计方写 prompt 时抄错”（漏变格、凭印象引原文、按行数错块数、交叉引用记错位置）。

生成骨架后仍须人做三件事，脚本代替不了：

1. **逐行扫 [`DECISIONS.md`](DECISIONS.md)**，把标“须进 prompt”的条目确认已写进去。
   决定“有记录”不等于“到得了起草方手里”：「的大写『逻辑』」早已写进术语表 `logic` 条目，
   仍在 ch002、ch003 回潮 5 处，正因为写 prompt 时无处一次扫完。
2. 把【本单元要点】的待填项写实：标题布局、脚注对应表、斜体起止、大小写 `Логика`、
   作者括号、本章特有的典故与易混词。
3. **写完要点必跑** `python3 scripts/new_prompt.py chNNN --verify`：它把要点里引用到的
   每个块号连同源文件对应块的开头一并打印，供逐条核对。**块号是脚手架上线后错误唯一
   还在发生的地方**——ch023 有两个块号写错（一个误读了自己脚本的输出，一个凭估计填），
   跑一次就会现形（错误清单第 31 条）。凡写“某章某块是先例”，同样现场 `grep` 确认。

## 六、查看当前进度（权威、不会过期）

```bash
python3 scripts/check_translations.py --status
```

按项目、按单元列出 status、**块数**与两次审校结果。**这是进度的唯一权威来源**（读自
`translation.json`）。本文件不再手写任何进度快照——凡是这条命令能答的，都不要抄进文档。

## 七、当前状态与下一步

> **本节长度固定，不随章数增长**，只写两样：**项目是什么**、**下一步做哪一章**。逐章记录的
> 正本是 `issues.md`，跨章裁定是 [`DECISIONS.md`](DECISIONS.md)，教训是 STYLE_GUIDE 第七节。

试点项目：`knigi-dialektika-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-myshlenii`
（《科学理论思维中抽象与具体的辩证法》，1997 完整版）。全书技术切分 42 个文件：
ch000 扉页目录；ch001–002 两序；ch003–023 第一部分；ch024–036 第二部分；ch037–041 五篇附录短文。

**全书 42 个单元已全部译完并 `reviewed`（2026-07-24）**，`work_complete=true`，
项目已移入 `translation_workspace/reviewed/ilyenkov/`。进度仍以第六节那条 `--status` 为准。

**某章审计经过**读该章 `issues.md`；**跨章裁定**扫 [`DECISIONS.md`](DECISIONS.md)。

### 下一步：内容校阅，不再有翻译单元

**成书已完成**（2026-07-30）：`scripts/build_book.py` 按 [`book/template/`](../book/template/README.md)
的模板出 439 页 PDF，版式各项已与参考页实测对齐，缺字形 0。版式的唯一权威是那个模板目录，
**不要在 `book/build/` 里改**；会踩的坑见 [`TYPESETTING.md`](../book/template/TYPESETTING.md)。

1. **内容校阅**：所有者在 PDF 上划线注记，`scripts/read_pdf_notes.py` 读出；依注记回到原文与
   中间文本（初译、`issues.md`、术语表）重新思考再答。采纳的修改回 `final.md` 重走审校，
   然后重生成合并本与 PDF——**页码会变，旧批注按页码对不上，须换新版重批**。
2. **核 1997 纸本**（疑点条数与分布跑 `python3 scripts/check_all.py --status`，不在此手写——
   曾写「12 处」而实为 13；迁移方案见 [`SOURCE_CRUXES.md`](SOURCE_CRUXES.md) 第五节：
   只涉及 8 个单元；源文校订若不改中文只需重取 accuracy。
   **切勿批量改 42 个源文件的 `text_status`**——那会让全书 accuracy 一起失效）。
3. `идеальное`→观念的东西 若需译者说明，**引 ch041**（该篇即这条裁定的理论根据）。
4. 定版与出版是治理决定，见 [`GOVERNANCE.md`](../GOVERNANCE.md)「Published Editions」：
   只能以项目名义出版，且须先与原文相关机构沟通。

## 八、每次改动后要跑的检查

```bash
python3 scripts/check_all.py
```

一条命令跑完全部十四项（译文、术语表与视图、项目文档、语料 front matter、长篇切分、
语料清单、术语批次与变更日志、合并本、AGENTS 机器块、公开导出干跑、单元测试，
加一项只给线索的全书通查），每项一行，失败才打印细节。
**这里不再罗列各项的单独命令**——照抄九条是九次往返，而且抄漏一条不会有人发现。
要看单项细节加 `--verbose`。

进度与待办跑 `python3 scripts/check_all.py --status`。

## 九、保持交接有效（含长度纪律）

完成一个单元后，本文件**只改一处**：第七节的“下一步”换成下一章，并同步 `updated` 日期。
审计经过、术语裁定、新错误类型、底本疑点各有正本（见第五节第 5 步），**不在这里复述**。

**硬规则：本文件不得随章数增长**，`check_project_docs.py` 强制：全文 ≤220 行、第七节 ≤60 行。
若发现本节又开始逐章记事，说明有人在拿交接手册当日志用——把那些内容移回 `issues.md`。
理由是可量化的：本节曾累积到 305 行（占全文三分之二），而这些内容对“下一步做什么”
毫无帮助，却要在每个新会话开头付一次读取代价。
