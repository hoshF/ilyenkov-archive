---
title: "P. V. Kopnin Philosophy Text Archive"
created: "2026-06-16"
type: "project"
tags: ["kopnin", "philosophy", "russian", "source-archive"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 科普宁哲学文本资料库

本目录保存帕维尔·瓦西里耶维奇·科普宁（Павел Васильевич Копнин，1922—1971）的著作书目、来源元数据，以及未处理源扫描件。科普宁是苏联辩证逻辑、认识论和科学逻辑方向的重要哲学家。

收集与处理遵循仓库统一的[哲学文本来源、OCR 准入与发布政策](../notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)，来源调查见 [`notes/KOPNIN_SOURCE_SURVEY.md`](../notes/KOPNIN_SOURCE_SURVEY.md)。

## 目录结构

```text
kopnin_markdown/
├── README.md
├── metadata/
│   ├── works_master.json                 # 主要著作主表 + 收集状态
│   └── source_scans_manifest.json        # 未处理源扫描件登记表
├── scripts/
│   └── klex_download.py                  # Klex->phantastike 下载器（与 oizerman 同款，含重试/resume）
└── source_scans/klex/                    # 自由下载的 PDF/DjVu，原样保存，不处理
```

## 当前状态（2026-06-16）

- 已下载 **4 部核心俄文著作**（DjVu/PDF，未处理源扫描件）：
  - 《Диалектика, логика, наука》(1973，文选第二卷，29 篇)
  - 《Философские идеи В.И. Ленина и логика》(1969)
  - 《Гносеологические и логические основы науки》(1974，含 1966《导论》与 1968《逻辑基础》)
  - 《Гипотеза и ее роль в познании》(1958)
- 重要专著《Диалектика как логика и теория познания》(1973) **未找到扫描件**：Klex 仅有 .doc 文本、twirpx 扫描需积分、英文 HTML 镜像已 404。标记为缺口。
- 科普宁 1971 年去世，著作仍受版权保护；所有来源默认 `redistribution_approved: "false"`、不公开、不进入 GBrain。

## 来源说明

- 资源图首选的 platona.net 整站被 Cloudflare 拦截（脚本/curl 无法访问）；改用可走通的 **Klex→phantastike** 管道，反而覆盖了原图中被 Cloudflare 拦、twirpx 收费、koob 需登录、HTML 404 的全部核心俄文著作。
- 英文合著译本（*Themes in Soviet Marxist Philosophy* 1975；*The Fundamentals of Marxist-Leninist Philosophy* 1982）属次要、合著、非俄文原著，仅在主表中登记网址，未下载。
