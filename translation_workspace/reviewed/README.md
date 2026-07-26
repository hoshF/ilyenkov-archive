---
title: "reviewed"
created: "2026-06-11"
updated: "2026-07-20"
type: "writing"
tags: ["translation", "workspace"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# reviewed

完成人工准确性审校和语言审校的中文稿目录。

只有全部单元的两次审校均记录为 `passed`、两稿段落完整对应且没有未解决阻断问题的
项目才进入这里。目录固定为 `reviewed/<author_id>/<work_id>/`，每个单元的 `status` 均为
`reviewed`。各单元审校记录的 `scope_sha256` 必须与当前译稿文件完全一致。

本目录中的 `final.md` 是排版和导出的唯一正文来源。后续发现问题时，先在 `issues.md`
登记并将项目退回 `drafts/` 的相应状态，不能直接在 LaTeX 或 PDF 工程中修改译文。
