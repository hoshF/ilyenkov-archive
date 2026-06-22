---
title: "哲学文本来源、OCR 准入与发布政策"
created: "2026-06-11"
updated: "2026-06-21"
type: "project"
tags: ["source-policy", "markdown", "source-scan", "ocr-gate", "copyright"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
directive_sha256: "bb2ba9f362cd2541db4edb880378e951c4211cb313850127a8bd00aa90959e1c"
directive_2_sha256: "71802c71bb8cf020cd0f482b79e310577ae8ac378b4cd01e6e0f17080521bad4"
directive_2_supplement_sha256: "0b669a0096597fba9a9910a1c986099a209b6087c3f4ad6089e4577aefa86b5c"
---

# 哲学文本来源、OCR 准入与发布政策

本政策于 2026-06-11 根据项目所有者的三份修订指令重写，并取代旧版“绝对禁止 OCR”规则。上方三个 SHA-256 字段保存原始指令校验值；修订内容已完整并入本文，不另存临时下载文件。

本政策适用于全仓哲学原著、译文、文本见证、研究文本、源扫描件和 AI 参考材料。

## 不变量

核心语料层只允许经人工确认权威的作者文本。未经人工校勘的 OCR、源扫描件、历史或现代译文、研究文章和 AI 输出不得设置 `core_corpus_eligible: "true"`。OCR 来历必须诚实保留，但不单独构成永久拒绝理由。

## 来源优先级

| 顺序 | 来源格式 | 项目处理 |
|---|---|---|
| 1 | 真实 HTML 正文 | 清理结构后转换为 Markdown |
| 2 | 原生结构化 EPUB | 按章节转换为 Markdown |
| 3 | 自由直接下载的 PDF | 原样保存到作者的 `source_scans/`，不提取正文 |
| 4 | 自由直接下载的 DjVu | 原样保存到 `source_scans/`，不使用其文本派生层 |
| 受控 | `inlibrary`、`printdisabled`、加密或受限来源 | 只登记书目，不下载、不绕过 |

文件扩展名不能证明来源质量。由 hOCR、ABBYY 或其他识别流程生成的 EPUB/HTML 仍属于 OCR 派生文本。

## OCR 准入闸门

1. OCR 来源本身不再构成永久拒绝理由，文本质量和校验记录决定能否准入。
2. 项目所有者明确启动文本处理前，不对任何源扫描件执行 OCR，也不使用 PDF 文本层、DjVuTXT、DjVu XML、ABBYY XML 或 hOCR 生成正文。
3. 未通过项目校验流程的 OCR 文本不得进入正文目录或 GBrain 检索层；只保存源扫描件并标记 `source_scan_unprocessed`。
4. `ocr_unverified` 只用于未经完整人工校勘确认的隔离文本，`core_corpus_eligible` 与 `llm_wiki_eligible` 均须为 `false`，不得进入核心层或 GBrain。
5. 作者原语言 OCR 文本在逐页对照全部来源图、由项目所有者确认并具有完整可验证 manifest 后，可以使用 `author_original` 进入核心层和 GBrain，同时必须保留 OCR provenance。
6. 正式处理设计见 [扫描本数字化流程](SCAN_DIGITIZATION_WORKFLOW.md)。该流程已批准但尚未激活；首次处理新的整书 OCR 前，还必须实现通用人工校验 manifest、Schema 和机器验证。

### 历史人工校验例外

`caute_ru_markdown/ilyenkov_md/newspaper/` 中 13 份报纸 Markdown 在本政策制定前产生。项目所有者于 2026-06-11 确认它们已经逐篇对照仓库原图人工校验，因此：

- 文件保留原路径，不重新 OCR；
- `text_role: "author_original"`；
- `text_status: "ocr_draft_human_collated"`；
- `provenance: "ocr_initial_then_manual_collation_against_source_images"`；
- `core_corpus_eligible: "true"`；
- `llm_wiki_eligible: "true"`；
- 校验范围和文件哈希见 `caute_ru_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json`。

可靠性来自人工逐篇校勘和项目所有者确认，而不是 OCR 初稿本身。这是当前机器验证支持的历史实例，不授权继续运行旧 OCR 脚本。新的整书 OCR 必须先按正式数字化流程建立通用验证能力。

## 源扫描件

自由、匿名、无需绕过限制即可下载的重要 PDF/DjVu 可以预先保存：

- 路径为 `<author>_markdown/source_scans/<provider>/`，不得放进任何 `*_md/` 正文目录；
- 作者目录下的 `metadata/source_scans_manifest.json` 必须记录题名、作者、出版年、版次、URL、下载日期、页数、字节数、SHA-256、格式和权利状态；
- `text_status` 固定为 `source_scan_unprocessed`；
- `core_corpus_eligible`、`llm_wiki_eligible` 和默认 `redistribution_approved` 均为 `false`；
- 不读取或发布扫描件内置的 OCR 派生文本。

受控借阅、加密、`printdisabled` 文件及需要绕过访问控制的材料只进入 `notes/CORPUS_GAPS.md`。独立译本还须单独核查译者和版本权利。

## 正文 Front Matter

正文语料 Markdown 必须包含：

- `text_role`
- `core_corpus_eligible`
- `llm_wiki_eligible`
- `source_format`
- `source_license`
- `redistribution_approved`
- `rights_review_status`
- `text_status`
- `source_url`

`text_role` 受控值为 `author_original`、`historical_translation`、`text_witness`、`modern_translation`、`research`、`ai_reference`、`source_scan_unprocessed` 和 `ocr_unverified`。只有 `author_original` 可以进入核心层。详细机器校验由 `python3 scripts/prepare_gbrain_markdown.py --check` 执行。

超过 500,000 字节的正文使用 `scripts/split_longform_markdown.py` 按真实标题边界切章。章节必须继承全部来源、角色和版权字段，并增加 `work_id`、三位 `chapter_index`、`chapter_title`。原整文保存为 `.md.snapshot`，由 `work_manifest.json` 记录 UTF-8 字节偏移和 SHA-256；快照不进入 GBrain 或公开导出。禁止为了满足大小限制按字节硬切。

## 版权与公开发布

物理目录只表达作者和文本角色，不表达版权。不得因版权顾虑移动、改名、隐藏或拆分正文与源文件。

版权和发布由 `source_license`、`rights_review_status`、`redistribution_approved` 及公开导出闸门共同决定：

- 可下载、可阅读、网站投诉机制或“研究用途”都不等于获得再分发许可；
- 没有明确证据时使用 `not_stated`、`unreviewed` 和 `redistribution_approved: "false"`；
- `llm_wiki_eligible: "true"` 只代表本地检索许可，不代表可以公开发布；
- 公开 GitHub 发布必须从 `scripts/export_public.py` 生成的 `dist/public/` 导出树进行，不直接发布完整工作仓库。
- `dist/public` 使用独立 Git 元数据 `dist/.public.git/`；发布前必须验证父 remote 为私有仓库、嵌套 remote 为重建后的公开仓库，并只允许普通 push。

## 缺口与审计

重要但只有未处理扫描本、受控借阅或尚无合格来源的作品统一记录在 `notes/CORPUS_GAPS.md`。每项必须注明重要性、可得格式、缺席原因、最近核查日期和来源 URL。
