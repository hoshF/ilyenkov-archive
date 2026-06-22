---
title: "凯德洛夫文本集合交接说明"
created: "2026-06-11"
updated: "2026-06-21"
type: "handoff"
tags: ["kedrov", "handoff", "corpus", "source-audit"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 凯德洛夫文本集合交接说明

本文只提供凯德洛夫子项目的稳定导航，不复制实时数量、GBrain 状态或历史执行日志。
全仓规则先读 [AGENTS.md](../AGENTS.md)，当前集合状态查看
[COLLECTION_STATUS.md](../COLLECTION_STATUS.md)。

## 当前事实来源

- [kedrov_markdown/README.md](../kedrov_markdown/README.md)：目录与重新生成说明。
- [`royallib_manifest.json`](../kedrov_markdown/metadata/royallib_manifest.json)：HTML 转换作品。
- [`source_scans_manifest.json`](../kedrov_markdown/metadata/source_scans_manifest.json)：未处理扫描件、哈希与权利状态。
- [KEDROV_SOURCE_SURVEY.md](KEDROV_SOURCE_SURVEY.md)：来源调查和仍待补充的作品。
- [PHILOSOPHY_SOURCE_FORMAT_POLICY.md](PHILOSOPHY_SOURCE_FORMAT_POLICY.md)：统一文本政策。

## 目录角色

```text
kedrov_markdown/
├── kedrov_md/       # 已整理的俄文 Markdown 正文
├── metadata/        # HTML 作品和扫描件 manifest
├── source_scans/    # 未处理 PDF/DjVu，不进正文或 GBrain
└── scripts/         # 可复现转换脚本
```

长篇作品已按标题边界分章。阅读时先进入作品目录查看 `README.md` 和
`work_manifest.json`，再打开所需章节；不要读取 `.fulltext/` 整篇副本。

## 处理原则

- HTML 转换正文仍需结合版本和 `text_status` 判断，不描述为纸本校勘定本。
- 扫描件只作版本与校勘依据，必须保持 `source_scan_unprocessed`。
- 不使用 PDF 文本层、DjVuTXT、ABBYY、hOCR 或未经人工确认的 OCR 生成正文。
- 法译本、受控借阅和版权未明材料只登记来源，不绕过访问限制。
- 图片与正文的公开分发由统一版权闸门决定。

## 后续工作

1. 根据 `KEDROV_SOURCE_SURVEY.md` 继续核实高优先级作品及版本。
2. 优先寻找真实 HTML 或原生结构化 EPUB；其次保存可自由直链的扫描件。
3. 新扫描件写入 manifest 后运行：

```bash
python3 scripts/verify_corpus_manifests.py
python3 scripts/manage_collections.py sync
python3 scripts/manage_collections.py check
```

4. 需要数字化时，必须单独初始化作品级项目并遵循
   [SCAN_DIGITIZATION_WORKFLOW.md](SCAN_DIGITIZATION_WORKFLOW.md)。

本文件不保存“已下载多少”“索引多少页”等快照；这些信息分别由 manifest、
`COLLECTION_STATUS.md` 和现场 GBrain 查询提供。
