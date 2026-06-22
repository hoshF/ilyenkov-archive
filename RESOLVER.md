---
title: "Corpus Resolver"
created: "2026-06-11"
type: "project"
tags: ["corpus", "resolver", "gbrain"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
---

# Corpus Resolver

本文件为 GBrain 和其他 LLM 工具提供语料导航规则。回答问题时，应先确定文本角色，再选择目录。
人物与集合路径的机器事实来源是 `metadata/collections.json`；下表解释现有历史布局。

## 路由规则

| 需求 | 首选目录 | 文本角色 |
|---|---|---|
| 伊里因科夫本人作品 | `caute_ru_markdown/ilyenkov_md/` | 俄文来源文本 |
| 迈丹斯基的研究与版本说明 | `caute_ru_markdown/maidansky_md/` | 二级研究文本 |
| 斯宾诺莎作品 | `spinoza_markdown/spinoza_md/` | 作者语言文本或明确标记的历史见证 |
| 凯德洛夫作品 | `kedrov_markdown/kedrov_md/` | 由 HTML/EPUB 转换的俄文来源文本 |
| 奥伊泽尔曼、科普宁 | 各自 `metadata/` 与 `source_scans/` | 当前以书目和未处理扫描件为主 |
| 未处理源扫描件 | `<author>_markdown/source_scans/` | PDF/DjVu 版本资料，不进入正文检索 |
| 来源、许可与覆盖情况 | `caute_ru_markdown/metadata/`、`spinoza_markdown/metadata/`、`kedrov_markdown/metadata/` | 元数据与审计 |
| 项目研究笔记 | `notes/` | 笔记和方法说明 |
| 中文翻译工作 | `translation_workspace/`、`existing_translations/` | 翻译与辅助阅读层 |
| 数字化隔离区 | `<author_root>/digitization/<work_id>/` | 不进入 GBrain 或公开导出 |

## 冲突处理

1. 作者语言文本优先于现代译文。
2. 同一作品存在多个来源时，先检查来源、版本、许可和 `text_status`。
3. 斯宾诺莎语料以 `spinoza_markdown/metadata/preferred_sources.json` 的选择为准。
4. 哲学正文优先从真实 HTML 或原生结构化 EPUB转为 Markdown。当前不得自行用 OCR、DjVuTXT、ABBYY、hOCR、PDF 文本层或图片识别生成新正文。
5. 没有合适 HTML/EPUB 时，可保存自由直接下载的 PDF/DjVu 源扫描件，但不得纳入 GBrain；受控借阅只登记书目。
6. `ocr_unverified` 只用于未经人工校勘的隔离文本。13 份逐篇对图校勘、由项目所有者确认并具备 manifest 的历史报纸文本使用 `author_original`，进入核心层并保留 OCR provenance。
7. 未经核验的网页转录或 AI 输出不得被描述为校勘定本。
8. 不复制文本建立第二套目录；使用现有路径、front matter 和来源链接保持可追溯性。
9. `caute_ru_markdown/` 是历史采集目录名。引用迈丹斯基网站上的伊里因科夫文本时，当前推荐入口为 `http://filorus.ru/ilyenkov/... (at the website by Andrey Maidansky)`；机器可读 `source_url` 字段只保存 URL。
10. 新增人物和语料路径必须登记到 `metadata/collections.json`，并运行 `manage_collections.py sync`。

完整格式规则见 [notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。
