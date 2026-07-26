---
title: "planned"
created: "2026-06-11"
updated: "2026-07-20"
type: "project"
tags: ["translation", "workspace"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# planned

待翻译项目按 `planned/<author_id>/<work_id>/` 登记。

优先使用 `scripts/manage_collections.py init-translation` 创建项目。每个项目的
`translation.json` 记录作者、作品、可见正文单元、有序源片段、版本、哈希、内容块范围、
段落数和目标语言，全部单元的状态必须为 `planned`。

原文必须是中央语料中登记的作者原文；版本未核验、路径不存在或哈希不匹配时，不得移入
`drafts/`。长篇只绑定 GBrain 读取的切分 Markdown，并由 `work_manifest.json` 核验；不得
引用隐藏完整副本或 snapshot。本目录只登记项目，不复制原文，也不要求提前建立译稿文件。
