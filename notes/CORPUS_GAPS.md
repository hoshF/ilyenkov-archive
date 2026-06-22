---
title: "全仓语料缺口登记"
created: "2026-06-11"
updated: "2026-06-22"
type: "analysis"
tags: ["corpus", "gaps", "sources", "audit"]
language: "zh"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 全仓语料缺口登记

本表记录重要但当前没有合格正文语料的作品。保存扫描件不等于文本已经进入语料；`scan_only_unprocessed` 项目不进入 GBrain，也不执行 OCR。

最近外部来源统一核查日期：2026-06-11。

本地 manifest 状态复核日期：2026-06-22。本次只核对仓库已有文件与登记状态，没有重新
联网搜索缺口来源，因此不改变下表中的外部来源判断。

## 凯德洛夫

| 作品 | 重要性 | 当前可得格式 | 缺席原因 | 来源 |
|---|---|---|---|---|
| `Ленин и научные революции` | 凯德洛夫讨论列宁、科学革命与方法论的重要专著 | IA PDF 已保存；OCR EPUB 不采用 | `scan_only_unprocessed` | [Internet Archive](https://archive.org/details/B-001-038-009-ALL) |
| `Фридрих Энгельс. Развитие его взглядов на диалектику естествознания` | 研究恩格斯自然辩证法思想发展的专著 | IA PDF 已保存 | `scan_only_unprocessed` | [Internet Archive](https://archive.org/details/ao-114-friedrich-engels-developing-his-views-on-the-dialectic-of-natural-science-kedrov-1970) |
| `Единство диалектики, логики и теории познания` | 凯德洛夫关于三者统一关系的核心著作 | 2006 年第 2 版 PDF 已保存 | `scan_only_unprocessed` | [Public Library](https://publ.lib.ru/ARCHIVES/K/KEDROV_Bonifatiy_Mihaylovich/_Kedrov_B.M..html) |
| `О методе изложения диалектики. Три великих замысла` | 分析马克思、恩格斯和列宁如何设想辩证法的体系化表达 | 1983 年版 PDF 已保存 | `scan_only_unprocessed` | [Klex](https://www.klex.ru/1of5) |
| `Диалектика и логика. Законы мышления` | 凯德洛夫主编的辩证逻辑专题文集 | 1962 年版 DjVu 已保存 | `scan_only_unprocessed` | [Klex](https://www.klex.ru/g2i) |
| `Диалектика и логика. Формы мышления` | 与“思维规律”卷配套的辩证逻辑专题文集 | 1962 年版 PDF 已保存 | `scan_only_unprocessed` | [Klex](https://www.klex.ru/g2j) |
| `Проблемы логики и методологии науки: избранные труды` | 汇集凯德洛夫逻辑与科学方法论研究的晚期选集 | Google Books 仅片段预览；未找到自由完整 HTML、原生 EPUB、PDF 或 DjVu | `no_acceptable_source` | [Google Books](https://books.google.com/books?id=e924AAAAIAAJ) |
| `Dialectique, logique, gnoseologie : leur unite` | 《统一》的法译本，可用于术语和译介史对照 | IA 受控借阅，`printdisabled` | `controlled_lending` | [Internet Archive](https://archive.org/details/dialectiquelogiq0000kedr) |

六个已保存文件的页数、字节数、下载地址和 SHA-256 见 `kedrov_markdown/metadata/source_scans_manifest.json`。全部为 `redistribution_approved: "false"`。

## 斯宾诺莎

| 作品或范围 | 重要性 | 当前可得格式 | 缺席原因 | 来源 |
|---|---|---|---|---|
| `Compendium Grammatices Linguae Hebraeae` | 斯宾诺莎希伯来语语法著作 | Bruder 1846 卷 III PDF 与章节级扫描结构已保存/定位，没有合格连续网页转录 | `scan_only_unprocessed` | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Benedicti_de_Spinoza_-_Opera_quae_supersunt_omnia_-_Carolus_Hermannus_Bruder_Vol_III_Tractatus_theologico-politicus._Compendium_grammatices_linguae_hebraeae,_1846.pdf) |
| `Epistolae` 38、42、43、49、69、84 | 当前首选拉丁文书信层的六项缺口 | 版本元数据和部分页图存在，缺少统一可核验的连续转录 | `no_acceptable_source` | [Spinoza Web](https://spinozaweb.org/) |
| Bruder `Opera quae supersunt omnia` 三卷 | 19 世纪版本对页与出处核查资料 | 三卷 PDF 已保存在历史兼容目录 `spinoza_markdown/source_pdfs/` | `scan_only_unprocessed` | [来源说明](../spinoza_markdown/metadata/source_notes.md) |

## 维护规则

- 每次新增重要但无法进入正文的作品时追加一行，并写明最近核查日期。
- `controlled_lending`、加密和受访问控制的文件不得下载或绕过限制。
- 取得自由扫描件后改为 `scan_only_unprocessed`，但在正文通过另行批准的校验流程前不得从本表移除。
- 取得合格 HTML/原生 EPUB 并转换、校验后，才可将缺口标记为已解决。
