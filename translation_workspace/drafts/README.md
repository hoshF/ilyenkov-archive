---
title: "drafts"
created: "2026-06-11"
updated: "2026-07-20"
type: "writing"
tags: ["translation", "workspace"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# drafts

翻译和审校中的工作目录。状态按翻译单元记录；只要项目既非全部单元 `planned`、也非
全部单元 `reviewed`，项目就位于本目录。已完成单元保持 `reviewed` 状态和审校记录，
不受新增或在译单元影响。

每篇或每本作品按作者和作品分层，例如：

```text
drafts/author-id/work-id/
  translation.json
  units/
    full/
      literal.md
      final.md
      issues.md
```

`translation.json` 必须绑定原文路径、版本和 SHA-256；不要复制来源正文。

- `literal.md` 保存结构忠实初译，不以生硬代替准确。
- `final.md` 保存同时对照原文和初译形成的中文学术定稿。
- `issues.md` 只记录真实疑难、翻译决定和同作者语料证据。

单元处于 `drafting` 时可以保存未完成的两稿；单元进入 `accuracy_review` 后，其两稿必须
覆盖该单元登记的全部段落，且段落编号完全一致。单元准确性审校通过后才能进入
`language_review`。

完成任一审校时，用 `scripts/check_translations.py --review-hashes <project_dir>` 按单元
计算当前文件范围哈希并写入该单元的审校记录。受审文件后来发生变化时，旧审校自动失效；
必须把该单元相应记录重置为 `pending` 并重新审校。
