---
title: "Ilyenkov Research LLM Wiki"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["ilyenkov", "spinoza", "llm-wiki", "gbrain"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
llm_wiki_engine: "gbrain"
gbrain_version_tested: "0.42.37.0"
---

# LLM Wiki

本项目使用 **GBrain** 作为当前 LLM wiki 的索引、检索和文本处理实例，命令行程序为 `gbrain`。Git 与 Markdown 文件是可审计的文本源，GBrain 数据库、分块和向量嵌入属于可重建的派生数据，不替代原始文件。

## 语料结构

人物与集合路径统一登记在 `metadata/collections.json`，当前状态见
[`COLLECTION_STATUS.md`](COLLECTION_STATUS.md)。`gbrain.yml` 中的集合根目录由
`scripts/manage_collections.py sync` 生成。

- `caute_ru_markdown/ilyenkov_md/`：伊里因科夫俄文文本，正文主要角色为 `author_original`。
- `caute_ru_markdown/maidansky_md/`：迈丹斯基及相关研究文本，主要类型为 `analysis`。
- `spinoza_markdown/spinoza_md/`：斯宾诺莎作者语言文本、历史译本和存世文本见证，具体角色以 front matter 与来源策略为准。
- `kedrov_markdown/kedrov_md/`：凯德洛夫俄文哲学文本；源扫描件单独保存在 `kedrov_markdown/source_scans/`，不进入索引。
- `notes/`：研究笔记、术语和方法说明，类型为 `note`。
- `translation_workspace/`：翻译计划、草稿与复核工作，类型为 `writing` 或 `project`。

GBrain 直接使用现有目录和相对路径生成页面 slug，不另建重复的 Markdown 镜像。15 部超过 500 KB 的长篇著作已按真实标题边界可逆切为章节，原整文保存在 `.md.snapshot`，不进入索引；章节由 GBrain 继续分块。

## 基本命令

```bash
gbrain doctor --fast
scripts/run_gbrain_without_dist.sh gbrain lint .
scripts/run_gbrain_without_dist.sh gbrain sync --repo /Users/hoshf/Project/Ilyenkov --full --dry-run --no-pull
scripts/run_gbrain_without_dist.sh gbrain sync --repo /Users/hoshf/Project/Ilyenkov --full --no-pull --yes
gbrain search "Spinoza"
gbrain query "伊里因科夫如何理解斯宾诺莎的思维概念？"
```

如果嵌入服务暂时不可用，可先导入文本和分块：

```bash
scripts/run_gbrain_without_dist.sh gbrain sync --repo /Users/hoshf/Project/Ilyenkov --full --no-embed --no-extract --no-pull --yes
```

恢复嵌入服务后补齐待处理分块：

```bash
scripts/run_gbrain_without_dist.sh gbrain embed --stale
scripts/run_gbrain_without_dist.sh gbrain extract --stale --catch-up
```

同步前可运行：

```bash
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
```

## 使用原则

- 原文、历史译本、现代译文、研究文本和 AI 生成内容必须保持角色区分。
- 哲学正文优先从真实 HTML 或原生 EPUB 转换。项目当前不执行新的 OCR；未经人工校勘的 OCR 不进入核心层。13 份逐篇对图校勘并具备 manifest 的历史报纸文本属于作者原文核心层，同时保留 OCR provenance。PDF/DjVu 源扫描件不进入 GBrain。
- 跨语言解释优先从作者语言全文出发；历史译本可作为文本见证，但不冒充作者原文。
- GBrain 的检索结果和模型回答是研究入口，不是学术校勘结论。
- AI-ready 表示文本与元数据适合可审计的检索和计算研究，不表示获得模型训练许可。
- 修改文本后重新同步；不要直接把 GBrain 数据库当作唯一保存位置。
- 不要直接运行裸 `gbrain sync .`。包装脚本会隐藏 `dist/` 和各人物的 `digitization/`
  隔离目录，防止未校验 OCR 中间材料进入索引。
- 语料入口与路径选择见 [RESOLVER.md](RESOLVER.md)。
- 引用迈丹斯基网站文本时使用 `http://filorus.ru/ilyenkov/... (at the website by Andrey Maidansky)`；`caute_ru_markdown/` 是历史采集目录名，不代表当前推荐引用入口。
- 来源格式规则见 [notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。
- 默认关系抽取的实际能力和 0 结果原因见 [notes/EXTRACTION_DIAGNOSIS.md](notes/EXTRACTION_DIAGNOSIS.md)。
