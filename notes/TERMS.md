---
title: "术语表总入口"
created: "2026-06-11"
updated: "2026-07-27"
type: "note"
tags: ["terminology", "glossary", "research-note"]
language: "zh"
collection: "research-notes"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# 术语表总入口

本项目现在使用按哲学家组织的正式术语/专名系统。JSON 是源记录，Markdown 是生成视图。

## 入口

- [术语表系统](terminology/README.md)
- [术语审核批次索引](../translation_workspace/TERMINOLOGY_CHANGELOG.md)
- [文章审校快速流程](../translation_workspace/ARTICLE_REVIEW_WORKFLOW.md)
- [伊里因科夫术语表](terminology/ilyenkov.md)
- [迈丹斯基术语表](terminology/maidansky.md)
- [斯宾诺莎术语表](terminology/spinoza.md)
- [凯德洛夫术语表](terminology/kedrov.md)
- [维果茨基术语表](terminology/vygotsky.md)

## 源记录

- `ilyenkov_markdown/metadata/glossary.json`
- `maidansky_markdown/metadata/glossary.json`
- `spinoza_markdown/metadata/glossary.json`
- `kedrov_markdown/metadata/glossary.json`
- `vygotsky_markdown/metadata/glossary.json`

原先记录在本文件中的伊里因科夫核心术语已经迁入
`ilyenkov_markdown/metadata/glossary.json`，并保留为 `needs_review` 或 `provisional` 状态。

## 维护命令

```bash
python3 scripts/render_glossaries.py --write
python3 scripts/render_glossaries.py --check
python3 scripts/check_glossaries.py --check
```

不要手工修改 `notes/terminology/*.md` 的生成表格；需要改术语时编辑对应的
`metadata/glossary.json`，然后重新生成并检查。

每次审核的候选、频次、上下文、决定和位置保存在
`translation_workspace/terminology_reviews/*.json`。生成的
`translation_workspace/TERMINOLOGY_CHANGELOG.md` 只是索引；二者都不得作为第二份术语表
覆盖 glossary JSON。若作者没有正式 glossary，只记录候选与替代语料依据，不临时创建整套
术语表。
