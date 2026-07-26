---
title: "术语审核批次索引"
created: "2026-07-27"
updated: "2026-07-27"
type: "project"
tags: ["translation", "terminology", "audit-log"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 术语审核批次索引

本页由 `scripts/render_terminology_reviews.py` 生成，只提供批次导航和数量摘要。
详细审计记录位于 `translation_workspace/terminology_reviews/*.json`；这些记录和本页
都不是第二份术语表，正式译名始终以各作者的 glossary JSON 为准。

常规任务使用 `scripts/query_terminology_reviews.py` 定向查询，不读取全部批次记录。

| 日期 | 作者 / 作品 | 文章 | 新增 | 修改 | 删除 | 状态 | 拒绝 | 无正式表 | 所有者复核 |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2026-07-27 | `vygotsky` / `collection-glossary-initialization` | [`vygotsky-glossary`](terminology_reviews/2026-07-27-vygotsky-glossary.json) | 34 | 3 | 0 | 0 | 0 | 0 | approved |
| 2026-07-27 | `maidansky` / `myshlenie-i-yazyk-v-logike-ilenkova` | [`thought-and-language-in-ilyenkov-logic`](terminology_reviews/2026-07-27-thought-and-language-in-ilyenkov-logic.json) | 15 | 1 | 0 | 4 | 47 | 2 | approved |
| 2026-07-27 | `maidansky` / `ontogenez-chelovecheskoi-psihiki-i-yazyka-v-rabotah-e-v-ilenkova` | [`ontogenesis-human-psyche-language-in-ilyenkov`](terminology_reviews/2026-07-27-ontogenesis-human-psyche-language-in-ilyenkov.json) | 35 | 4 | 0 | 0 | 16 | 0 | approved |
| 2026-07-27 | `maidansky` / `e-v-ilyenkov-o-svobode-voli` | [`ilyenkov-on-freedom-of-will`](terminology_reviews/2026-07-27-ilyenkov-on-freedom-of-will.json) | 26 | 4 | 0 | 4 | 18 | 4 | approved |

## 操作说明

- `add`、`modify`、`delete`、`status`：正式 glossary 的历史操作。
- `reject`：已审核但不建立独立词条。
- `no_formal_glossary`：裁定发生时该作者没有正式 glossary，只保留审计证据。
- `owner_review` 是批次提交许可，不是正式翻译项目的 `reviewed` 状态。
