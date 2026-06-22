---
title: "A. D. Maidansky Academia.edu Source Scan Archive"
created: "2026-06-17"
type: "project"
tags: ["maidansky", "philosophy", "source-archive", "academia"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 迈丹斯基 Academia.edu 源文件资料库

本目录保存安德烈·德米特里耶维奇·迈丹斯基（Андрей Дмитриевич Майданский）在 Academia.edu 页面公开列出的上传文件元数据与未处理源文件。

来源页面：<https://белгу.academia.edu/AndreyMaidansky>

## 目录结构

```text
maidansky_markdown/
├── README.md
├── metadata/
│   ├── academia_manifest.json           # Academia 页面作品与下载状态
│   ├── academia_manual_queue.json       # 自动下载失败或需人工补齐项
│   └── source_scans_manifest.json       # 未处理源文件登记表
├── scripts/
│   └── academia_download.py             # Academia 下载器
└── source_scans/academia/               # PDF/附件原样保存，不处理
```

## 处理原则

- 只保存 Academia.edu 提供的原始 PDF/附件文件。
- 不执行 OCR，不读取 PDF 文本层，不生成 Markdown 正文。
- 所有源文件默认 `source_license: "not_stated"`、`rights_review_status: "unreviewed"`、`redistribution_approved: "false"`。
- 源文件不进入核心语料，也不进入 GBrain 检索层：`core_corpus_eligible: "false"`、`llm_wiki_eligible: "false"`。

## 当前状态（2026-06-17）

- 已从 profile 页和分页 API 建立 57 项 Academia 上传记录。
- 已保存并登记 56 项源文件；其中 2 个 Academia work URL 指向同一个本地文件 `spinoza-in-cultural-historical-psychology.pdf`，所以实际文件数为 55。
- `metadata/academia_manual_queue.json` 中保留 1 项缺口：`Культурно историческая психология Истоки и новая реальность`；用户于 2026-06-17 确认互联网上未找到可用资源。

## 重新运行

```bash
ACADEMIA_COOKIE_FILE=/Users/hoshf/Project/Ilyenkov/academia_cookie.txt \
python3 maidansky_markdown/scripts/academia_download.py --dry-run

ACADEMIA_COOKIE_FILE=/Users/hoshf/Project/Ilyenkov/academia_cookie.txt \
python3 maidansky_markdown/scripts/academia_download.py
```

`academia_cookie.txt` 是临时本地凭证，不属于仓库内容，下载完成后应删除。
