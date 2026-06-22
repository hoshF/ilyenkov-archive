---
title: "哲学家文本收藏状态"
created: "2026-06-21"
type: "project"
tags: ["collections", "status", "corpus"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 哲学家文本收藏状态

本页由 `python3 scripts/manage_collections.py sync` 根据 [`metadata/collections.json`](metadata/collections.json) 和各集合 manifest 生成。
Markdown 与 Git 是事实来源；扫描件数量不代表已有可检索正文。

| 人物 | 集合 | 阶段 | 正文 Markdown | 扫描件 | 扫描体积 | 作品记录 | 最近更新 |
|---|---|---|---:|---:|---:|---:|---|
| 埃瓦尔德·伊里因科夫 | [ilyenkov-texts](caute_ru_markdown/README.md) | `markdown_corpus` | 275 | 0 | - | 204 | 2026-06-09T00:21:32+00:00 |
| 安德烈·迈丹斯基 | [maidansky-research](caute_ru_markdown/README.md) | `markdown_corpus` | 66 | 0 | - | 63 | 2026-06-09T01:53:50+00:00 |
| 安德烈·迈丹斯基 | [maidansky-academia](maidansky_markdown/README.md) | `source_scans` | 0 | 56 | 33.6 MiB | 57 | 2026-06-17T06:45:00+00:00 |
| 巴鲁赫·斯宾诺莎 | [spinoza-texts](spinoza_markdown/README.md) | `markdown_corpus` | 211 | 0 | - | 9 | 2026-06-09T16:39:55+00:00 |
| 博尼法季·凯德洛夫 | [kedrov-texts](kedrov_markdown/README.md) | `markdown_and_scans` | 54 | 6 | 133.8 MiB | 3 | 2026-06-11 |
| 特奥多尔·奥伊泽尔曼 | [oizerman-archive](oizerman_markdown/README.md) | `source_scans` | 0 | 35 | 252.9 MiB | 24 | 2026-06-21 |
| 帕维尔·科普宁 | [kopnin-archive](kopnin_markdown/README.md) | `source_scans` | 0 | 4 | 48.8 MiB | 18 | 2026-06-16 |

## 使用说明

- `markdown_corpus`：已有可检索正文；实际准入以文件 front matter 为准。
- `markdown_and_scans`：同时具有正文与未处理扫描件。
- `source_scans`：当前以书目和扫描件为主，不能视为已数字化正文。
- 历史布局继续保留原路径；新人物使用统一标准目录。
