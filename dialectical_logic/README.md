---
title: "伊里因科夫《辩证逻辑》整理说明"
created: "2026-06-11"
updated: "2026-07-18"
type: "project"
tags: ["project", "documentation"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# 伊里因科夫《辩证逻辑》整理说明

这里保留的是最终采用的 1974 年第一版整理工程。

## 目录

- `dla/`：LaTeX 排版工程，主文件为 `dla/main.tex`。
- `ilyenkov_chapters/`：从原文抓取/整理出的俄文章节文本。
- `fetch_ilyenkov.py`：抓取脚本。
- `dla_project.tar.gz`：原工程压缩包备份。

## 版本说明

此前的 `second/` 是 1984 年第二版/增订版工程，并附有迈丹斯基对第二版真实性的评价。因为第二版存在编辑删改问题，最终版本保留 1974 年第一版。

此前的 `better/`、`old/`、`second/` 和 `one/` 已清理删除，`one/` 中的最终内容已上移到当前目录。

## 与标准翻译流程的关系

本目录形成于 `translation_workspace` 标准流程之前，现有 LaTeX/PDF 不自动视为已经完成
准确性审校和语言审校。`ilyenkov_chapters/` 中的历史抓取文本只作旧工程材料保留，不是
新的来源记录，也不得继续扩充。

后续迁移必须以 GBrain 读取的
`ilyenkov_markdown/ilyenkov_md/already-done/dialectical_logic_ilyenkov_ru/` 切分 Markdown
为原文，通过 `work_manifest.json`、文件哈希和内容块范围建立对应，再生成 `literal.md`、
`final.md` 和 `issues.md`。迁移前不要删除或覆盖本历史工程。
