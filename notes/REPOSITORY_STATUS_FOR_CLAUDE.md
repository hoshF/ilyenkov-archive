---
title: "Ilyenkov 仓库整体状态：Claude 交接文档"
created: "2026-06-11"
updated: "2026-06-11"
type: "handoff"
tags: ["repository", "handoff", "corpus", "gbrain", "copyright", "source-audit"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Ilyenkov 仓库整体状态：Claude 交接文档

## 1. 文档范围

本文记录截至 **2026-06-11** 的全仓实际状态，覆盖伊里因科夫、迈丹斯基、斯宾诺莎、凯德洛夫、中文翻译工程、来源扫描件、OCR 特例、版权发布、可逆切章和 GBrain。凯德洛夫逐部来源细节另见 [`KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md`](KEDROV_COLLECTION_STATUS_FOR_CLAUDE.md)。

仓库路径：`/Users/hoshf/Project/Ilyenkov`

当前父仓库 remote：

```text
origin  git@github.com:hoshF/Ilyenkov-cn-private.git
```

父 `origin` 已通过 GitHub 验证为私有仓库。旧公开仓库 `hoshF/ilyenkov-cn` 已于 2026-06-11 由所有者删除并重建为同名空 PUBLIC 仓库（GitHub 显示名 `Ilyenkov-cn`）；首次版权闸门发布已完成，公开 `main` HEAD 为 `f17c1e1c233e7b89b67b802474ecacb633a966bf`。删除与重建细节见 [`PUBLISH_EXPOSURE_AUDIT.md`](PUBLISH_EXPOSURE_AUDIT.md)。

## 2. 最重要结论

1. 项目当前不执行新的 OCR，也不从 PDF 文本层、DjVuTXT、ABBYY、hOCR 或图片识别生成新正文。
2. 13 份历史报纸文本已由所有者确认逐篇对照原图人工校勘，现为 `author_original` 核心语料，同时保留 OCR provenance；图片和正文均不得公开再分发。
3. 15 部超过 500 KB 的长文本已按真实标题边界切为 337 个章节文件，全部可由 manifest 与快照逐字重建。
4. 凯德洛夫三部 RoyalLib HTML 著作已切为 54 章；6 个 PDF/DjVu 源扫描件只保存、不处理、不进入 GBrain。
5. 公开导出当前包含 79 个代码、说明和审计文件，排除 757 个受控文件；当前没有任何正文获准再分发。首次公开发布已于 2026-06-11 完成并通过远端树校验。
6. GBrain 当前有 652 个活动页面、337 个切章页面、13 个报纸页面；embedding 100%，stale 为 0，未出现 `embed_skip: oversized`。
7. 默认关系抽取不是哲学语义推断；本轮处理 373 个正文页面后仍为 0 条链接、0 条时间线，详见 [`EXTRACTION_DIAGNOSIS.md`](EXTRACTION_DIAGNOSIS.md)。
8. 相关受限内容曾经公开，删除旧仓库不能保证第三方缓存或副本消失。完整事实见 [`PUBLISH_EXPOSURE_AUDIT.md`](PUBLISH_EXPOSURE_AUDIT.md)。

## 3. 目录结构

```text
Ilyenkov/
├── README.md / CONTRIBUTING.md / RESOLVER.md / LLM_WIKI.md
├── gbrain.yml
├── metadata/
│   └── longform_split_registry.json       # 15 部可逆切章注册表
├── caute_ru_markdown/
│   ├── ilyenkov_md/                       # 伊里因科夫俄文正文与13份报纸文本
│   ├── maidansky_md/                      # 迈丹斯基研究层
│   ├── metadata/                          # catalog/state/OCR人工校验 manifest
│   └── scripts/
├── spinoza_markdown/
│   ├── spinoza_md/                        # 拉丁文、荷兰文与文本见证
│   ├── source_pdfs/                       # 历史兼容扫描目录，不进入 GBrain
│   ├── metadata/
│   └── scripts/
├── kedrov_markdown/
│   ├── kedrov_md/                         # 三部 HTML 转换著作，现为章节目录
│   ├── source_scans/                      # 6 个未处理 PDF/DjVu
│   ├── metadata/
│   └── scripts/
├── dialectical_logic/                     # 《辩证逻辑》中文 LaTeX 工程
├── idols_ideals/                          # 《论偶像与理想》中文 LaTeX 工程
├── existing_translations/                 # 外部中文 PDF 与项目编译副本
├── translation_workspace/                 # planned/drafts/reviewed，目前无新稿
├── notes/                                 # 政策、调查、审计和交接文档
├── scripts/
│   ├── prepare_gbrain_markdown.py         # 正文 Schema
│   ├── verify_corpus_manifests.py         # OCR/扫描件 manifest 校验
│   ├── split_longform_markdown.py         # 共享可逆切章实现
│   ├── export_public.py                   # 版权闸门公开导出
│   ├── publish_public.sh                  # 固定发布流水线
│   └── run_gbrain_without_dist.sh         # GBrain 0.42.37 dist 排除包装
├── tests/
└── dist/                                  # 全部忽略跟踪
    ├── .public.git/                       # 独立公开仓库 Git 元数据
    └── public/                            # 公开工作树；.git 为指针文件
```

## 4. 统一语料政策

权威政策：[`PHILOSOPHY_SOURCE_FORMAT_POLICY.md`](PHILOSOPHY_SOURCE_FORMAT_POLICY.md)

正文 Markdown 强制字段：

```text
text_role
core_corpus_eligible
llm_wiki_eligible
source_format
source_license
redistribution_approved
rights_review_status
text_status
source_url
```

核心规则：

- 只有 `author_original` 可设置 `core_corpus_eligible: "true"`。
- 现代译文、历史译本、研究、AI 材料、未校验 OCR 和源扫描件不能进入核心层。
- `llm_wiki_eligible` 与 `redistribution_approved` 相互独立。
- 未知许可统一使用 `source_license: "not_stated"`、`rights_review_status: "unreviewed"`、`redistribution_approved: "false"`。
- HTML 与原生结构化 EPUB 可转换为 Markdown；自由 PDF/DjVu 只保存为未处理扫描件。
- 加密、`inlibrary`、`printdisabled` 和受控借阅只登记，不绕过限制。

政策中已记录三份处理指令 SHA-256：

```text
bb2ba9f362cd2541db4edb880378e951c4211cb313850127a8bd00aa90959e1c
71802c71bb8cf020cd0f482b79e310577ae8ac378b4cd01e6e0f17080521bad4
0b669a0096597fba9a9910a1c986099a209b6087c3f4ad6089e4577aefa86b5c
```

## 5. 13 份历史人工校勘 OCR

路径：`caute_ru_markdown/ilyenkov_md/newspaper/`

统一元数据：

```yaml
text_role: "author_original"
core_corpus_eligible: "true"
llm_wiki_eligible: "true"
source_format: "image_scan"
text_status: "ocr_draft_human_collated"
provenance: "ocr_initial_then_manual_collation_against_source_images"
redistribution_approved: "false"
```

manifest：`caute_ru_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json`

manifest 记录 13 组 Markdown/原图路径、SHA-256、校勘者、日期和范围。Schema 只在路径、状态、provenance 和哈希全部匹配时允许 `author_original + image_scan` 进入核心层。`ocr_unverified` 仍禁止进入核心层，当前实例数为 0。

这是历史特例，不构成以后运行 OCR 或直接采用 OCR 输出的先例。

## 6. 各子项目状态

### 6.1 伊里因科夫

- 逻辑作品数仍按 130 部/篇理解；切章后物理正文 Markdown 为 275 个。
- 9 部超大作品已切章，包括旧版《辩证逻辑》、抽象与具体研究、两篇学位文本和五部书籍。
- 9 个 `work_manifest.json`、9 个原始 `.md.snapshot` 和稳定三位章节文件已生成。
- catalog/state 已补充 `work_manifest`、`chapter_count` 和 `chapter_files`。
- 13 份报纸文本已进入核心层并保留 OCR 来历。

### 6.2 迈丹斯基

- 逻辑作品数 57；切章后物理正文 Markdown 为 66 个。
- 《斯宾诺莎的逻辑方法》已切为 10 章，可逐字重建。
- 全部属于研究层 `text_role: research`，不能替代作者原文。

### 6.3 斯宾诺莎

- 切章后物理正文 Markdown 为 211 个。
- `Tractatus theologico-politicus` 已按 H2 切为 22 章。
- DBNL `Nagelate schriften` 已按 H3 顶层作品边界切为 97 章。
- 首选来源索引不再指向不存在的单体文件，而是记录 `preferred_work_manifest` 与章节清单。
- 自动来源审计当前 `issues=0`。
- Bruder 三卷仍在历史兼容目录 `source_pdfs/`，只作校勘参考，不进入正文或 GBrain。

### 6.4 凯德洛夫

RoyalLib 三部真实 HTML 著作：

| 作品 | 章节数 | 状态 |
|---|---:|---|
| `Беседы о диалектике` | 20 | H3 谈话边界，可逆重建 |
| `О «Диалектике природы» Энгельса` | 14 | H2 章节边界，可逆重建 |
| `О творчестве в науке и технике` | 20 | H3 章节边界，可逆重建 |

三部合计 54 个正文章节，来源许可均未声明，`redistribution_approved: "false"`。随书 28 张 PNG 也不得公开导出。

源扫描件共 6 个：5 PDF、1 DjVu，合计 140,305,962 字节。全部为 `source_scan_unprocessed`，core/LLM/redistribution 均为 false。《列宁与科学革命》的 IA OCR EPUB、DjVuTXT、ABBYY、hOCR 和 PDF 文本层均不使用。法译本 `Dialectique, logique, gnoseologie : leur unite` 仍为受控借阅，只记录网址和书目。

### 6.5 中文工程与外部 PDF

- `dialectical_logic/`：现有《辩证逻辑》中文 LaTeX 工程和编译 PDF。
- `idols_ideals/`：现有《论偶像与理想》中文 LaTeX 工程和编译 PDF。
- `existing_translations/`：外部中文 PDF 与编译副本，来源、译者、版次和版权仍需逐项核查。
- `translation_workspace/`：结构已建立，当前没有新的 planned/draft/reviewed 正文。

## 7. 15 部长文本可逆切章

注册表：`metadata/longform_split_registry.json`

范围：伊里因科夫 9 部、凯德洛夫 3 部、斯宾诺莎 2 部、迈丹斯基 1 部。

每部作品目录包含：

```text
README.md
<work-id>-ch000.md ...
source/<work-id>.md.snapshot
work_manifest.json
```

manifest 记录原文件字节数和 SHA-256、原 front matter、标题层级、UTF-8 字节偏移、每章 payload/file SHA-256。重建以原 front matter 加各章正文 payload 拼接，必须与快照逐字相同。当前结果：

```text
longform_split=0 longform_verified=15 registered=15
oversized_markdown=0
chapter_pages=337
```

每个完整章节文件小于 500,000 字节，没有按字节硬切。转换器的生成、resume 和 check 已改为识别 manifest 与章节集合，不会重新生成旧超大单体文件。

## 8. 公开发布与版权边界

### 8.1 历史暴露

旧公开 HEAD：`3cc661b0baae7b9c279a9792a1bc4ad88f6ebe8c`

- 283 个文件；Git tree 约 58 MB。
- 257 个文件位于受限目录。
- 审计时 0 fork、0 watcher、0 star。
- 删除 GitHub 仓库不能保证删除第三方缓存、下载、副本或存档。

### 8.2 私有父仓库

- 私有仓库：`hoshF/Ilyenkov-cn-private`（2026-06-12 由 `ilyenkov-cn-private` 改名，旧 URL 由 GitHub 重定向）。
- 父 `origin` 只指向该私有仓库。
- 第一轮和第二轮提交均已普通推送，并通过远端 `main` HEAD 核对完成私有异地备份。
- 不得把父工作树 remote 改回旧公开仓库。

### 8.3 独立公开工作树

- Git 元数据：`dist/.public.git/`
- 工作树：`dist/public/`
- `dist/public/.git` 是 separate-git-dir 指针文件。
- 父仓库忽略整个 `dist/`。
- nested `origin` 已配置为 `git@github.com:hoshF/Ilyenkov-cn.git`，指向 2026-06-11 重建的公开仓库；首次公开提交 `f17c1e1c233e7b89b67b802474ecacb633a966bf` 已普通推送并通过远端树校验。

`scripts/export_public.py` 使用临时构建目录更新公开工作树并保留 `.git` 指针。正文只有 `redistribution_approved: "true"` 才可导出；扫描件按 source scan manifest 判定，字段缺失默认拒绝。语料目录 README、图片、快照、PDF/DjVu 和未批准章节不能绕过闸门。

当前导出结果（首次公开发布时）：

```text
included=79
excluded=757
source_scans_in_export=0
snapshots_in_export=0
approved_corpus_markdown=0
```

发布脚本 `scripts/publish_public.sh "<commit message>"` 固定执行 Schema、OCR/扫描件/切章 manifest、全套 unittest、重新导出、父私有/嵌套公开远端验证、普通 commit/push 和远端树一致性检查。没有 force、历史重写或绕过测试参数。

## 9. GBrain 当前状态

### 9.1 配置和版本

| 项目 | 值 |
|---|---|
| 版本 | `0.42.37.0` |
| schema pack | `gbrain-base-v2` |
| source | `default` |
| source 路径 | `/Users/hoshf/Project/Ilyenkov` |
| 活动页面 | 652 |
| embedding provider | `zeroentropyai:zembed-1` |
| embedding coverage | 100%，0 missing |
| stale chunks | 0 |
| extraction stale | 0 |

`gbrain.yml` 已覆盖 caute、Spinoza、Kedrov、notes、translation workspace、中文工程和外部译本目录。

### 9.2 本轮命令和结果

```text
metadata: changed=0 markdown_total=652 errors=0
manifest: legacy_ocr_verified=13 source_scans_verified=6
longform: longform_verified=15
lint: 652 pages scanned; 209 issues in 197 pages; exit 0
initial full sync: 373 imported, 278 unchanged/skipped, 0 errors, 3709 chunks
final document refresh: 7 imported, 645 unchanged/skipped, 0 errors, 66 chunks
embedding: initial 3616 chunks; final refresh 46 chunks; stale=0
embed stale dry-run: 0 chunks
extract stale: 373 pages, 0 links, 0 timeline, stale_remaining=0
```

lint 的 209 项主要是 50 KB 以上 `huge-page` 警告和少量空章节提示，不是 Schema 错误。500 KB 验收阈值已全部满足。

### 9.3 数据库验收

```text
live_pages=652
chapter_pages=337
newspaper_pages=13
dist_pages=0
scan_pages=0
snapshot_pages=0
old_monoliths=0
oversized_skips=0
```

### 9.4 dist workaround

GBrain 0.42.37.0 的 full-sync 与 lint 实测仍扫描 `dist/public`，即使该目录有 `.git` 指针。诊断时未包装 dry-run 为 680 页，隐藏 `dist/` 后为 651 页，差值为当时公开导出的 29 个 Markdown。仓库新增 `scripts/run_gbrain_without_dist.sh`，通过 `trap` 临时隐藏并恢复 `dist/`；所有全仓 GBrain 命令应通过该包装执行。

### 9.5 标准命令

```bash
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/verify_corpus_manifests.py
python3 scripts/split_longform_markdown.py --check
scripts/run_gbrain_without_dist.sh gbrain lint .
scripts/run_gbrain_without_dist.sh gbrain sync --full --dry-run --no-pull --no-embed --no-extract
scripts/run_gbrain_without_dist.sh gbrain sync --full --no-pull --no-embed --no-extract --yes
scripts/run_gbrain_without_dist.sh gbrain embed --stale
scripts/run_gbrain_without_dist.sh gbrain extract --stale --catch-up --json
```

## 10. 测试与验收

```text
python3 -m unittest discover -s tests
18 tests passed
```

覆盖：正文必填字段、受控角色、OCR 人工校勘 manifest、章节字段、切章无损重建、超限拒绝、公开导出正反版权闸门、`.git` 指针保留和批准正文不得漏导出。

Spinoza 来源审计：`issues=0`。

## 11. 当前 Git 状态

- 分支：`main`
- 本文更新前已验证的私有远端 HEAD：`14d9230`
- 父 remote：私有 `hoshF/Ilyenkov-cn-private`
- 第二轮提交已按发布、OCR、切章和子项目拆分，并已普通推送到私有远端。
- `dist/` 为忽略目录；公开工作树 nested `origin` 指向重建的公开仓库，公开 `main` HEAD 为 `f17c1e1c233e7b89b67b802474ecacb633a966bf`。

关键第二轮提交：

```text
5938ada corpus: promote human-collated newspaper texts
340521b corpus: add reversible longform splitting
3bff0c6 corpus: split Ilyenkov longforms
26f0d98 corpus: split Kedrov longforms
b07b636 corpus: split Spinoza and Maidansky longforms
0b94fea publish: record exposure and isolate remotes
14d9230 gbrain: diagnose extraction and refresh status
```

## 12. 公开发布闭环完成记录

2026-06-11，所有者删除旧 `hoshF/ilyenkov-cn` 并重建同名空 PUBLIC 仓库后，以下步骤已全部完成：

1. `dist/public` nested `origin` 已配置为新建公开仓库。
2. `scripts/publish_public.sh "publish: initialize rights-gated public repository"` 已执行，全部校验和 18 项测试通过。
3. 首次 push 为普通 push；远端提交总数 1，旧暴露 HEAD `3cc661b0…` 在新仓库不可达。
4. 远端 `main` 与本地公开 HEAD 同为 `f17c1e1c233e7b89b67b802474ecacb633a966bf`，远端 blob 计数 79 与本地导出一致。
5. `PUBLISH_EXPOSURE_AUDIT.md` 已回填删除日期、新建日期、首次公开提交和远端树验证结果。
6. 最终审计文档已普通提交并推送私有仓库。

后续公开发布一律通过 `scripts/publish_public.sh` 执行，不直接操作公开仓库。

## 13. 禁止事项

- 不绕过 `scripts/publish_public.sh` 向公开仓库推送。
- 不 force push、不重写公开历史、不绕过测试。
- 不执行新的 OCR 或模型图片转录。
- 不从扫描 PDF/DjVu 的文本层生成正文。
- 不下载或绕过受控借阅、加密、`printdisabled` 内容。
- 不把现代译文、研究、AI 内容或未校验 OCR 标成作者核心原文。
- 不把 `llm_wiki_eligible` 当作公开再分发许可。
- 不直接发布完整父工作仓库；GitHub 公开发布只能来自 `dist/public/`。

## 14. 给 Claude 的最短摘要

这是一个私有研究工作仓库。13 份历史报纸 OCR 已人工对图校勘并归入作者核心层；15 部超大作品已无损切为 337 章；GBrain 有 652 页、embedding 与 extraction stale 均为 0；扫描件、快照和公开导出副本均未进入索引。公开导出目前只有 79 个代码/说明/审计文件，没有获准正文。旧公开仓库曾暴露受限内容，已于 2026-06-11 删除并重建为同名空公开仓库；首次版权闸门发布（提交 `f17c1e1c…`，79 个文件、无正文）已完成并通过远端树校验。后续公开发布只通过 `scripts/publish_public.sh`。
