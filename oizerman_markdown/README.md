---
title: "T. I. Oizerman Philosophy Text Archive"
created: "2026-06-16"
type: "project"
tags: ["oizerman", "philosophy", "russian", "source-archive"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 奥伊泽尔曼哲学文本资料库

本目录保存特奥多尔·伊里奇·奥伊泽尔曼（Теодор Ильич Ойзерман，Т. И. Ойзерман，1914—2017）的著作书目、来源元数据，以及（在权利审查通过后）转换正文与未处理源扫描件。

收集与处理遵循仓库统一的[哲学文本来源、OCR 准入与发布政策](../notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)，来源调查见 [`notes/OIZERMAN_SOURCE_SURVEY.md`](../notes/OIZERMAN_SOURCE_SURVEY.md)。

## 目录结构

```text
oizerman_markdown/
├── README.md
├── bibliography/                         # 俄罗斯科学院哲学研究所官方书目（PDF + 提取文本）
│   ├── iphras_official_bibliography.pdf
│   └── iphras_official_bibliography.txt
├── metadata/
│   ├── works_master.json                 # 主要著作主表（俄文题名、年份、版次、责任形式、来源线索）
│   └── source_scans_manifest.json        # 未处理源扫描件登记表
├── source_scans/                         # 自由下载的 PDF/DjVu 原样保存；不提取文本、不进 GBrain
└── oizerman_md/                          # （暂未创建）真实 HTML/原生 EPUB 转换正文
```

## 当前状态（2026-06-21）

- 已下载并登记 35 份未处理源扫描件（20 份 DjVu、15 份 PDF），总计 265,146,055 字节。
- 已收录列克托尔斯基与奥伊泽尔曼共同主编的四卷本《Теория познания》：第 1、2 卷（1991）、第 3 卷（1993）、第 4 卷（1995），仅保存原始 PDF，不提取正文。
- 奥伊泽尔曼 2017 年去世，著作仍受版权保护；所有来源默认 `source_license: "not_stated"`、`rights_review_status: "unreviewed"`、`redistribution_approved: "false"`。
- 2014 年《Избранные труды: в 5 томах》（莫斯科：Наука）为五卷本选集，由此前代表作改编重排，**不应**与早期单行本视为同一数字文件。

## 权利与处理纪律

- 官方书目（`bibliography/`）是事实性书目工具，可保存与提取文本用于建表，**不等于**奥伊泽尔曼著作全文。
- 自由直接下载的 PDF/DjVu 只按 `source_scan_unprocessed` 原样保存到 `source_scans/<provider>/`，登记完整 manifest，不提取文本层、不 OCR、不进入 GBrain 或公开导出。
- 受控借阅、加密、`printdisabled` 等材料只登记书目，不下载、不绕过。
- 外文（英、德、中等）译本不混入俄文原著主表，另行处理。
- 合著与主编著作必须明确记录奥伊泽尔曼的责任形式，不一律标为个人专著。
