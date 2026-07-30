---
title: "文章翻译审校与发布快速流程"
created: "2026-07-27"
updated: "2026-07-27"
type: "project"
tags: ["translation", "review", "terminology", "publishing"]
language: "zh"
collection: "translation-workspace"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 文章翻译审校与发布快速流程

本页是“原文—中文译文—术语建议表—博客—知乎”任务的唯一常规入口。正式五阶段翻译项目
仍按 [README.md](README.md) 执行；本文流程不会创建 `translation.json`、审校哈希或
`reviewed` 状态。

## 一、预检与工作包

```bash
python3 scripts/prepare_article_review.py \
  --source <registered-source.md> \
  --translation <chinese-translation.md> \
  --suggestions <suggestions.md> \
  --slug <article-slug> \
  --work-id <work-id>
```

工具一次完成输入哈希、Git 基线、作者与 collection 解析、glossary 发现、内容块编号、
结构差异提示、机械风险检查、术语位置与作者语料统计，并把完整工作包写入忽略目录
`tmp/translation_reviews/<slug>/`。若分支已有会被夹带推送的提交，工具在昂贵扫描前停止；
只审校、不发布时可显式加 `--review-only`。

在生成内容块或扫描语料以前，工具先按作者与作品 ID、稳定原文路径、原文哈希、DOI、来源
URL 和博客 slug 检查既有成果。结果分为：

- `new`：没有既有成果，正常准备；
- `already_reviewed`（退出码 20）：三项输入与既有批次完全一致，直接复用；
- `revision_required`（退出码 21）：同一作品已有成果但输入不同，停止并等待项目所有者确认；
- `identity_conflict`（退出码 22）：强身份字段指向不同文章或修订目标不匹配，停止处理。

标题只作提示，不能单独认定同一作品。重复预检停止时不会创建或覆盖工作包。项目所有者确认
修订后，必须使用预检列出的准确目标重新运行：

```bash
python3 scripts/prepare_article_review.py \
  --source <registered-source.md> \
  --translation <revised-translation.md> \
  --suggestions <suggestions.md> \
  --slug <article-slug> \
  --work-id <work-id> \
  --revision-of <batch-id-or-blog:slug>
```

已有结构化批次时只能修订最新匹配批次；`blog:<slug>` 仅用于博客已存在但没有批次记录的
情况，避免形成彼此分叉的审核历史。

修订工作包使用带 `-rNN` 的独立目录和批次 ID，不覆盖旧批次。即使只变更了译文或建议表，
确认修订后仍须重新完成下述三遍全文审校。

## 二、确认俄语词形

首次运行后检查 `tmp/translation_reviews/<slug>/form_review.json`：

1. 真实词形加入 `confirmed_forms`；
2. 误命中加入 `rejected_heuristic_forms`；
3. 清空 `pending_heuristic_forms`，把 `status` 改为 `confirmed`；
4. 重新运行准备命令。

未经人工确认的启发式词形不进入正式频次。作者语料在一次遍历中批量统计，缓存位于
`tmp/translation_review_cache/`；缓存键包含语料 Git 状态和确认词形，任一变化都会失效。

## 三、两遍完整审校

1. **准确性审校**：逐块检查错译、漏译、增译、否定、情态、限定、引文归属、专名、书名、
   数字、脚注和结构。工具警告不能代替通读。
2. **中文语言审校**：在准确性成立后完整通读中文，修正欧化句、搭配、指代、语序和学术表达。
3. **回查与一致性**：语言修改涉及的原文块重新核对，再全文检查术语、专名、数字和脚注。

结构对应只按章节顺序和块序号提供候选关系。块数不同或语义跨块时由审校者记录真实位置，
不得把自动配对视为已经语义对齐。

任何原文、译文或建议表哈希变化都使本批全文审校失效。只有三项输入哈希完全相同才可复用
既有完整审校。

## 四、术语裁定与结构化日志

每项建议必须有 `add`、`modify`、`delete`、`status`、`reject` 或
`no_formal_glossary` 决定。工具只提供证据，不自动决定译法或收录。

完成 `tmp/translation_reviews/<slug>/batch_draft.json` 后，将其保存为：

```text
translation_workspace/terminology_reviews/YYYY-MM-DD-<slug>.json
```

修订批次保存为 `YYYY-MM-DD-<slug>-rNN.json`，并保留所取代批次或博客文章、上一版译文
哈希、变化输入及身份匹配依据。不得把修订写回旧批次文件。

记录必须包含两遍全文审校覆盖、最终译文哈希、全部建议决定、文章与作者语料证据、修改前后
值、理由、状态、译文位置和零阻塞项。`audit_only: true` 表示它只是审计记录。

详细批次 JSON 和生成索引都不是术语表。正式译名只以作者 glossary JSON 为准。常规任务
定向查询相关历史，不读取全部批次：

```bash
python3 scripts/query_terminology_reviews.py --author <author-id> --term <term>
python3 scripts/query_terminology_reviews.py --work-id <work-id>
python3 scripts/query_terminology_reviews.py --source-path <stable-source-path>
python3 scripts/query_terminology_reviews.py --doi <doi>
python3 scripts/render_terminology_reviews.py --write
```

没有正式 glossary 的作者仍做语料审核并记录 `no_formal_glossary`，但不临时创建术语系统。

## 五、统一验证与确认

```bash
python3 scripts/check_article_review.py \
  --batch translation_workspace/terminology_reviews/YYYY-MM-DD-<slug>.json \
  --work-package tmp/translation_reviews/<slug> \
  --write-generated
```

命令生成术语视图和批次索引，并统一检查输入哈希、建议覆盖、词形确认、全文审校声明、阻塞
项、glossary、生成视图、prompt 模板、正式翻译项目和项目文档。

验证通过后向项目所有者报告主要译文修改、逐项术语决定、实际 diff、无关工作区隔离和检查
结果，此时不提交。项目所有者回复“审核通过”后，将 `owner_review` 改为 `approved` 并快速
复验，然后依次提交推送 Ilyenkov、运行博客发布检查并提交推送、使用 Zen 保存知乎草稿。

## 六、固定报告节奏

整个任务只报告五个里程碑：预检、审校完成、Ilyenkov 推送、博客推送、知乎草稿。报告引用
稳定位置和批次决定，不粘贴全文、整份语料或完整浏览器可访问性树。
