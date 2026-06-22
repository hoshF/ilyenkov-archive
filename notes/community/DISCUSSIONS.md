---
title: "Discussions 分类规划与项目欢迎帖"
created: "2026-06-12"
updated: "2026-06-22"
type: "note"
tags: ["community", "discussions", "recruitment"]
language: "en-zh"
collection: "research-notes"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Discussions 分类规划与欢迎帖文案

公开仓库 `Ilyenkov-cn` 的 Discussions 已开启。GitHub 不支持通过 API 创建分类，需要在
`https://github.com/hoshF/Ilyenkov-cn/discussions/categories` 手工建立以下分类。

## 分类设计

| 分类名 | 格式 | 用途 |
|---|---|---|
| Announcements / 公告 | Announcement | 项目状态、发布说明和流程修订 |
| Texts and Editions / 文本与版本 | Open-ended discussion | 原文来源、版本、异文、缺页和书目信息 |
| Digitization and Review / 数字化与校验 | Open-ended discussion | 转录结构、人工校验、页码映射和质量问题 |
| Philosophy and Concepts / 哲学与概念 | Open-ended discussion | 哲学讨论、术语比较和思想史关系 |
| AI and Digital Humanities / AI 与数字人文 | Open-ended discussion | 检索、结构化语料、LLM Wiki 和计算研究 |
| Multilingual Study / 多语言学习 | Open-ended discussion | 翻译、术语对照和跨语言精读 |
| Questions / 问答 | Q&A | 参与方式、文件位置和工作流问题 |

## Welcome Post

标题：

`Welcome to the Ilyenkov Philosophy Text Archive`

> This project is building a source-traceable philosophy text archive centered on Evald Ilyenkov and the thinkers, debates, and traditions connected with his work.
>
> Our primary task is the long-term collection, verification, structuring, and digitization of original-language philosophical texts. The archive combines:
>
> - original-language Markdown with provenance metadata;
> - bibliographic records and edition histories;
> - unprocessed source scans kept separate from verified text;
> - related collections on Spinoza and Soviet philosophers;
> - reproducible infrastructure for search, comparison, digital humanities, and LLM-assisted research.
>
> The goal is an **AI-ready source-text digitization and research platform**: auditable texts and metadata that can support retrieval, close reading, multilingual study, and future computational work. This does not mean that AI output is treated as scholarly authority, or that every file is licensed for model training.
>
> Alongside this global platform, the project maintains a long-term Chinese translation and
> close-reading program focused on Ilyenkov. Related Soviet philosophers are translated selectively
> where they clarify his work; source figures such as Spinoza are primarily developed as
> original-language collections.
>
> Collaboration is global. We welcome philosophers, historians, librarians, bibliographers, language specialists, textual scholars, digitization reviewers, software developers, and researchers working with AI or digital humanities.
>
> **How to begin**
>
> - Project overview: [README](https://github.com/hoshF/Ilyenkov-cn#readme)
> - Contribution guide: [CONTRIBUTING.md](https://github.com/hoshF/Ilyenkov-cn/blob/main/CONTRIBUTING.md)
> - Collection status: [COLLECTION_STATUS.md](https://github.com/hoshF/Ilyenkov-cn/blob/main/COLLECTION_STATUS.md)
> - Governance and decisions: [GOVERNANCE.md](https://github.com/hoshF/Ilyenkov-cn/blob/main/GOVERNANCE.md)
> - Rights and licensing: [RIGHTS.md](https://github.com/hoshF/Ilyenkov-cn/blob/main/RIGHTS.md)
>
> Project infrastructure, original documentation, and auditable factual metadata are open by
> default. Complete texts, translations, scans, media, and content-bearing derivatives are released
> file by file only after an evidence-based rights review tied to the exact checksum.
>
> The public archive already includes a first reviewed group of Spinoza source materials from Latin
> and Dutch Wikisource and DBNL. Their public availability records a redistribution decision, not a
> claim that the texts are critically edited or fully collated.
>
> Introduce yourself by telling us which philosophers, languages, archives, or technical methods you work with, and what kind of contribution interests you.

### 中文说明

> 本项目面向全球研究者和学习者，以伊里因科夫哲学为中心，整理相关哲学家的原语言文本、
> 扫描版本、书目和版本元数据。目标是建立可审计、可重建、适合长期研究及 AI/LLM
> 辅助使用的原典数字化与研究平台。同时，项目长期推进伊里因科夫中文翻译、术语研究和
> 精读；其他人物按研究需要选择性翻译。
>
> 项目基础设施、原创文档和事实性元数据默认开放；第三方全文和扫描件按具体文件逐项审核。
> 公开仓库已经收录首批通过权利审核的斯宾诺莎拉丁文、荷兰文材料，但公开不等于完成校勘，
> 也不自动授予模型训练许可。

## Good First Issue 草稿

### 1. 核对一条作品书目

> 从 `COLLECTION_STATUS.md` 选择一个人物，核对一部作品的原题、出版年份、出版社和责任形式。
> 提交可靠目录或馆藏来源，不需要下载全文。

### 2. 抽查来源链接

> 从某个作者的 metadata manifest 中选择 10 条来源 URL，记录可访问状态、重定向和可验证的
> 替代入口。不要绕过受控借阅或下载限制。

### 3. 多语言术语比较

> 选择一个具体段落，比较同一哲学术语在两种或更多语言中的处理方式。必须标明原文位置和
> 使用的译本版本，不要求提出唯一标准译法。伊里因科夫的中文术语研究是优先方向。

### 4. 数字化质量规则

> 阅读 `notes/SCAN_DIGITIZATION_WORKFLOW.md`，针对页码映射、脚注、公式或多语言引文提出一个
> 可自动检测的质量问题及测试样例。本任务不运行 OCR。

### 5. 核验一项公开权利依据

> 从 `metadata/rights_registry.json` 选择一项已公开材料，检查来源页面、许可证或公共领域
> 声明是否仍可访问，并确认登记的归属信息清楚。不要自行把未审核全文改为公开。
