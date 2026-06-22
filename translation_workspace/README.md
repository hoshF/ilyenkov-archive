---
title: "translation_workspace"
created: "2026-06-11"
type: "project"
tags: ["translation", "workspace"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# translation_workspace

这里是中文翻译与精读计划的工作区。所有译文建立在可追溯原文之上：伊里因科夫优先，
其他人物按研究需要选择性翻译，译文不替代作者原语言文本。

## 子目录

- `planned/<author_id>/<work_id>/`：待翻译项目登记、优先级和来源说明。
- `drafts/<author_id>/<work_id>/`：初译草稿。
- `reviewed/<author_id>/<work_id>/`：人工读过并初步校订的中文稿。
- `latex_templates/`：从中文稿生成 LaTeX/PDF 时使用的模板和说明。
- `templates/translation.json`：翻译项目元数据模板。

## 推荐流程

1. 在 `planned/<author_id>/<work_id>/` 建立 `translation.json`。
2. 直接引用中央注册表登记的作者原文，不复制出第二份来源正文。
3. 在 `drafts/<author_id>/<work_id>/` 建立中文初稿。
4. 人工校订后放入 `reviewed/<author_id>/<work_id>/`。
5. 需要出 PDF 时，再建立独立 LaTeX 工程。
