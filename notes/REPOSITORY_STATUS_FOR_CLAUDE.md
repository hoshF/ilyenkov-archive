---
title: "Ilyenkov 仓库架构与交接说明"
created: "2026-06-11"
updated: "2026-06-21"
type: "handoff"
tags: ["repository", "handoff", "corpus", "workflow"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Ilyenkov 仓库架构与交接说明

本文说明稳定架构、事实来源和维护工作流，不保存容易过期的文件数、Git 状态或 GBrain
数据库指标。AI 应先读根目录的 [AGENTS.md](../AGENTS.md)；当前人物和收录进度查看
[COLLECTION_STATUS.md](../COLLECTION_STATUS.md)。

## 项目目标

项目以伊里因科夫哲学为中心，持续收集相关哲学家的作者原语言文本、扫描版本、书目和
来源元数据。原典数字化与研究平台面向全球，为 LLM Wiki、数字人文和跨语言研究提供合格
正文；中文翻译与精读计划优先处理伊里因科夫，并按研究需要选择其他人物。

## 事实来源

- `metadata/collections.json`：人物、集合、正文路径、扫描件和 GBrain 根目录。
- 各作者 `metadata/`：作品主表、扫描件 manifest、来源状态。
- 正文 Markdown 和 `work_manifest.json`：文本、章节和可逆重建事实。
- Git：全部变更历史。
- GBrain：可重建派生索引，不是文本事实来源。

## 目录模型

新人物使用标准结构：

```text
<author_id>_markdown/
├── README.md
├── <author_id>_md/
├── bibliography/
├── metadata/
├── source_scans/
└── scripts/
```

现有 `caute_ru_markdown/`、迈丹斯基双目录、斯宾诺莎 `source_pdfs/` 等属于注册表声明的
历史布局，不迁移、不改名。详细规则见
[COLLECTION_ARCHITECTURE.md](COLLECTION_ARCHITECTURE.md)。

## 文本处理层级

1. 真实 HTML 或原生结构化 EPUB 可在记录来源后整理为 Markdown。
2. 自由直链 PDF/DjVu 只作为 `source_scan_unprocessed` 保存并登记 manifest。
3. 数字化中间材料位于人物目录的 `digitization/<work_id>/`，不进入 GBrain 或公开导出。
4. 未经全书逐页人工校验的 OCR 不进入作者正文层。
5. 现代译文、研究和 AI 内容必须与作者原文分开标记。

权威政策见 [PHILOSOPHY_SOURCE_FORMAT_POLICY.md](PHILOSOPHY_SOURCE_FORMAT_POLICY.md) 和
[SCAN_DIGITIZATION_WORKFLOW.md](SCAN_DIGITIZATION_WORKFLOW.md)。

## LLM Wiki 工作流

同步前运行：

```bash
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/verify_corpus_manifests.py
python3 scripts/check_project_docs.py
```

GBrain 只能通过 `scripts/run_gbrain_without_dist.sh` 运行。需要实时页面、embedding 或
stale 状态时现场执行 GBrain 命令，不把结果抄入本交接文档。

## 翻译工作流

翻译项目使用 `translation_workspace/<stage>/<author_id>/<work_id>/`，并用
`translation.json` 绑定原文路径、版本和 SHA-256。伊里因科夫是中文翻译优先对象，
其他人物按研究需要选择；已有两部 LaTeX 工程保持原路径。
完整原则见 [TRANSLATION_PLAN.md](../TRANSLATION_PLAN.md)。

## 公开发布

完整仓库不是公开发布树。所有公开内容由 `scripts/publish_public.sh` 调用版权闸门生成，
不允许直接推送完整工作仓库。历史暴露与处理记录见
[PUBLISH_EXPOSURE_AUDIT.md](PUBLISH_EXPOSURE_AUDIT.md)。

## 当前维护重点

- 继续完善各人物作品主表、来源调查和文本缺口。
- 对已有中文 PDF 核查来源、译者、版次和版权。
- 只有在作品级明确启动后才进行数字化，不默认批量 OCR。
- 新增人物必须通过中央注册表和脚手架命令完成。

## 交接检查

```bash
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/verify_corpus_manifests.py
python3 scripts/split_longform_markdown.py --check
python3 scripts/check_project_docs.py
python3 -m unittest discover -s tests
```

禁止事项和任务导航以 [AGENTS.md](../AGENTS.md) 为准。
