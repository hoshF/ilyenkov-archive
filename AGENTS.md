---
title: "Ilyenkov 仓库 · AI 操作指南"
created: "2026-06-17"
updated: "2026-06-22"
type: "agent-guide"
tags: ["agents", "entry-point", "navigation", "read-on-demand"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Ilyenkov 仓库 · AI 操作指南

> 本文是 AI/Agent 的唯一权威入口。不要为了“了解全貌”通读仓库、扫描件、
> `.fulltext/` 或大型历史文档；先按任务定位事实来源，再读取必要文件。

## 1. 项目与事实来源

这是一个以伊里因科夫哲学为中心的多哲学家文本库。原典数字化与研究平台面向全球，负责
收集、核验和数字化作者原语言文本，供 LLM Wiki、数字人文和跨语言研究使用；中文翻译
与精读计划持续推进伊里因科夫译介、术语研究和原文精读。

事实来源按优先级排列：

1. 正文 Markdown、作品 `work_manifest.json` 与 Git 历史。
2. `metadata/collections.json`、作者 `works_master`、扫描件 manifest 和来源记录。
3. `COLLECTION_STATUS.md` 等由注册表生成的状态页。
4. GBrain 数据库、模型回答和 AI 参考材料；这些都是派生层，不可反向覆盖原始事实。

## 2. 固定阅读顺序

1. 先读本文。
2. 查看 `COLLECTION_STATUS.md`，或直接进入任务对应的专题文档。
3. 查看该集合的 `README.md`、作品主表或来源 manifest。
4. 长篇作品先看 `work_manifest.json`，确认章节和版本。
5. 只打开任务所需的 `*-chNNN.md`；不要读取 `.fulltext/` 整篇副本。

## 3. 按任务导航

| 任务 | 首选入口 | 注意 |
|---|---|---|
| 当前人物与收录状态 | [COLLECTION_STATUS.md](COLLECTION_STATUS.md) | 机器生成，不手改 |
| 新增哲学家或集合 | [notes/COLLECTION_ARCHITECTURE.md](notes/COLLECTION_ARCHITECTURE.md) | 使用 `manage_collections.py add-person` |
| 判断目录和 `text_role` | [RESOLVER.md](RESOLVER.md) | 不凭目录名猜文本身份 |
| 正文与来源政策 | [notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md) | 正文 front matter 的权威规则 |
| 扫描件数字化 | [notes/SCAN_DIGITIZATION_WORKFLOW.md](notes/SCAN_DIGITIZATION_WORKFLOW.md) | 未明确启动时禁止 OCR |
| GBrain/LLM Wiki | [LLM_WIKI.md](LLM_WIKI.md) | 只通过包装脚本同步 |
| 中文翻译与精读计划 | [TRANSLATION_PLAN.md](TRANSLATION_PLAN.md) | 伊里因科夫优先，其他人物选择性翻译 |
| 公开发布与版权 | [notes/PUBLISH_EXPOSURE_AUDIT.md](notes/PUBLISH_EXPOSURE_AUDIT.md) | 只用 `publish_public.sh` |
| 许可范围与权利审核 | [RIGHTS.md](RIGHTS.md) | 基础设施和元数据默认开放；全文按注册表逐项开放 |
| 来源引用迁移 | [notes/MAIDANSKY_SOURCE_ATTRIBUTION.md](notes/MAIDANSKY_SOURCE_ATTRIBUTION.md) | 不改历史目录名 |
| 凯德洛夫专题 | [notes/KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md](notes/KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md) | 当前事实以 manifest 为准 |
| 全仓架构与工作流 | [notes/REPOSITORY_STATUS_FOR_CLAUDE.md](notes/REPOSITORY_STATUS_FOR_CLAUDE.md) | 稳定交接说明，不含实时快照 |

## 4. 常用操作

```bash
# 注册表、状态页、数字化和翻译项目
python3 scripts/manage_collections.py check

# 正文角色和 GBrain 元数据
python3 scripts/prepare_gbrain_markdown.py --check

# 扫描件与历史人工校验 manifest
python3 scripts/verify_corpus_manifests.py

# AI/项目文档一致性
python3 scripts/check_project_docs.py

# 安全运行 GBrain；会隐藏 dist 和 digitization 隔离目录
scripts/run_gbrain_without_dist.sh gbrain lint .
```

新增人物、同步状态和初始化数字化项目的命令见
[集合架构规范](notes/COLLECTION_ARCHITECTURE.md)。初始化数字化项目只建记录，不运行 OCR。

## 5. 硬规则

- 不运行未经项目所有者明确启动的新 OCR，不读取 PDF 文本层、DjVuTXT、ABBYY 或 hOCR
  生成正文。
- 不把现代译文、研究、AI 内容或未校验 OCR 标记为 `author_original`。
- 扫描件只能进入已登记的扫描目录和 manifest；它不等于已数字化正文。
- `llm_wiki_eligible` 与 `redistribution_approved` 相互独立。
- 不直接发布完整工作仓库，不绕过 `scripts/publish_public.sh`。
- 不把根 `LICENSE` 套用到第三方全文；公开受控文件必须匹配
  `metadata/rights_registry.json` 中的路径、SHA-256 和权利依据。
- 不移动或改名 `caute_ru_markdown/` 等历史兼容路径。
- 不复制正文建立第二套 wiki 或翻译来源；引用原路径和哈希。
- 发现用户或其他进程的未提交改动时与之协作，不擅自还原。

## 6. 机器状态

<!-- AGENTS-AUTO:BEGIN -->
<!-- 由 scripts/update_agents_guide.py 生成；--check 强校验本块。 -->

**仓库规模**（说明为什么不要通读）

| 跟踪文件 | Markdown | 语料 md | 切章文件 | 切章作品 | 分支 |
|---:|---:|---:|---:|---:|:--|
| 1092 | 686 | 630 | 337 | 15 | `main` |

<!-- AGENTS-AUTO:END -->

<!-- AGENTS-LIVE:BEGIN -->
<!-- 由 scripts/update_agents_guide.py 生成；提交时由钩子刷新，--check 不强校验。 -->

**Git 进度（提交时刷新，可能滞后一个提交）**

- 领先 `origin/main` 1 个提交，落后 0 个
- HEAD：0b21143  docs: internationalize source and digitization policies
- 工作区：12 个已改跟踪文件，0 个未跟踪文件未提交

**最近提交**

- `0b21143` docs: internationalize source and digitization policies
- `ada437b` docs: internationalize collection navigation
- `4910fe9` docs: make public project guides English-first
- `92c540e` docs: align metadata and recruitment guidance
- `82b87f4` corpus: approve public-domain Spinoza sources
- `001094e` rights: enforce auditable public release policy

<!-- AGENTS-LIVE:END -->

机器区块由 `.githooks/pre-commit` 和 `scripts/update_agents_guide.py` 维护。实时集合状态由
`scripts/manage_collections.py sync` 生成。叙述部分只在项目政策、导航或工作流改变时更新。
