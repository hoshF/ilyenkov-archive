---
title: "哲学家集合架构与扩展规范"
created: "2026-06-21"
type: "project"
tags: ["collections", "architecture", "corpus", "maintenance"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 哲学家集合架构与扩展规范

`metadata/collections.json` 是人物、资料集合、正文路径、扫描件 manifest 和 GBrain
跟踪根目录的共同事实来源。人物与集合分开登记：同一人物可以拥有作者正文、研究文本、
来源档案等多个集合。

## 标准人物目录

新人物统一使用：

```text
<author_id>_markdown/
├── README.md
├── <author_id>_md/
├── bibliography/
├── metadata/
│   ├── works_master.json
│   └── source_scans_manifest.json
├── source_scans/
└── scripts/
```

使用以下命令创建，不要手工复制现有历史目录：

```bash
python3 scripts/manage_collections.py add-person \
  --id <author_id> \
  --name-zh <中文名> \
  --name-original <原文名> \
  --name-latin <拉丁转写> \
  --relation <与项目的关系>
```

命令会创建目录和空 manifest、登记注册表，并同步 `gbrain.yml` 与
`COLLECTION_STATUS.md`。

## 历史布局

- `caute_ru_markdown/` 同时保存伊里因科夫正文和迈丹斯基研究正文，路径不得改名。
- `maidansky_markdown/` 是 Academia 来源档案，不是上述研究正文的重复副本。
- `spinoza_markdown/source_pdfs/` 是历史兼容扫描目录。
- `spinoza_markdown/cache/` 是采集脚本的可复现响应缓存，不计入正文统计，不进入公开导出。

历史集合在注册表中标记为 `layout: "legacy"`。统一工具适配这些路径，但不迁移文件。

## 状态与校验

```bash
python3 scripts/manage_collections.py sync
python3 scripts/manage_collections.py check
```

`sync` 生成状态页并同步 GBrain 路径；`check` 验证注册表、路径、数字化项目和翻译项目。
新增单个扫描件超过 75 MiB 时，manifest 必须增加 `large_file_review`，记录人工复核、
收录理由和存储决定。现有 Git 历史不迁移到 Git LFS。

## 数字化与翻译

数字化项目位于 `<author_root>/digitization/<work_id>/`，只能通过
`manage_collections.py init-digitization` 初始化。该命令只登记项目，不执行 OCR。
数字化目录在 GBrain 包装脚本运行期间被隐藏，也不进入公开导出。

中文翻译与精读计划使用：

```text
translation_workspace/<stage>/<author_id>/<work_id>/
```

每个项目保存 `translation.json`，绑定原文路径、版本和 SHA-256。Schema 与模板分别位于
`metadata/schemas/translation_project.schema.json` 和
`translation_workspace/templates/translation.json`。
