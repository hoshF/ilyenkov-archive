---
title: "学习型翻译计划"
created: "2026-06-11"
updated: "2026-06-22"
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
- 草稿、人工复核稿和正式排版工程分层保存。
- AI 可以辅助理解和起草，但不能替代人工校订，也不能冒充权威译本。
- 译文修改必须能够回溯到具体原文文件或章节。

## 伊里因科夫优先专题

## 已有或已开始的中文翻译

| 作品 | 当前状态 | 位置 | 备注 |
|---|---|---|---|
| 《辩证逻辑：历史与理论论文集》1974 年第一版 | 已整理为 LaTeX 工程 | `dialectical_logic/` | 优先阅读和校订 |
| 《论偶像与理想》 | 已整理为 LaTeX 工程 | `idols_ideals/` | 优先阅读和校订 |
| 《资本论中抽象与具体的辩证法》 | 已有中文 PDF | `existing_translations/published_pdfs/` | 有两个 PDF 版本，待后续比较 |
| 《列宁主义辩证法和经验主义形而上学》 | 已有中文 PDF | `existing_translations/published_pdfs/` | 孔令恺、罗托译 |
| 《辩证逻辑：历史与理论述评》 | 已有中文 PDF | `existing_translations/published_pdfs/` | 外部已有中译本，待后续核查版本 |
| 《辩证逻辑：历史与理论论文集》 | 已有外部 PDF 和本项目编译 PDF | `existing_translations/` | 本项目以 1974 年第一版为主 |

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
4. 每篇试译都先进入 `translation_workspace/drafts/`，不要直接变成正式作品。
5. 只有在人工校订后，才考虑进入 `reviewed/` 或生成 LaTeX/PDF。

## 单篇翻译登记模板

```text
## work-slug

- 原题：
- 中文暂名：
- 作者：Э.В. Ильенков
- 来源文件：
- 来源 URL：
- 类型：book / article / interview / letter / manuscript / newspaper
- 优先级：A / B / C
- 状态：planned / draft / reviewed / latex / final
- 选择理由：
- 术语风险：
- 备注：
```
