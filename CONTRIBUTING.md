---
title: "参与方式"
created: "2026-06-11"
type: "project"
tags: ["project", "documentation"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# 参与方式

感谢你愿意帮助建设以伊里因科夫哲学为中心的多人物文本库。项目最需要的是可靠来源、
细致校对、可验证元数据和可以追溯的小步改进。

协作规则、决策方式、术语定版流程和署名约定见 [GOVERNANCE.md](GOVERNANCE.md)。哲学、
版本、数字化、AI/数字人文和多语言学习讨论请使用仓库
[Discussions](https://github.com/hoshF/Ilyenkov-cn/discussions)，具体问题报告请用 issue。

## 可以贡献什么

- 补充不同语言的作者原文、出版信息、馆藏和版本说明。
- 指出来源、HTML/EPUB 转换、文件命名、目录分类或结构化元数据中的错误。
- 提交书目、校勘、页码映射、数字化质量验证和可复现工具改进。
- 补充与伊里因科夫思想来源、论争语境相关的哲学家文本和书目。
- 改进检索、结构化语料、LLM Wiki 和数字人文工作流。
- 参与伊里因科夫中文翻译、术语研究和精读；其他人物按研究需要选择性翻译。
- 提交已经人工检查过、可回溯到具体原文版本的小范围译文修订。

## 新增哲学家

不要直接复制现有历史目录。先阅读
[集合架构与扩展规范](notes/COLLECTION_ARCHITECTURE.md)，使用：

```bash
python3 scripts/manage_collections.py add-person \
  --id <author_id> \
  --name-zh <中文名> \
  --name-original <原文名> \
  --name-latin <拉丁转写> \
  --relation <与项目的关系>
```

新增人物后补充作品主表、来源调查和扫描件 manifest，再运行
`python3 scripts/manage_collections.py check`。

## 暂不鼓励什么

- 不建议一次性提交大量未经人工检查的机器翻译。
- 不建议把 AI 初译直接作为正式译本加入 `reviewed/` 或独立 LaTeX 工程。
- 不建议在没有来源说明的情况下替换已有 PDF、Markdown 或翻译文本。
- 项目当前不接受未经准入校验的 OCR、DjVuTXT、ABBYY、hOCR 或 PDF 文本提取结果。真实 HTML/原生 EPUB 可转换为 Markdown；其他自由下载的 PDF/DjVu 只作为未处理源扫描件保存。不要自行启动 OCR 流程。

中文翻译与精读是项目的长期重点之一。如果需要使用 AI 辅助翻译，请使用
`translation_workspace/<stage>/<author_id>/<work_id>/`，保存 `translation.json` 并保留
原文路径、来源 URL、版本、源文件 SHA-256、生成方式和人工校订状态。

提交哲学原文前请先阅读 [哲学文本来源与格式政策](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。

## Issue 建议

提交 issue 时，尽量包含：

- 相关文件路径。
- 原文标题或来源 URL。
- 问题类型：来源补充、文本错误、术语讨论、译文校订、版权或授权问题。
- 可以复核的依据，例如页码、截图、书目信息或对照文本。

## Pull request 建议

提交 PR 时，尽量保持改动小而清楚：

- 一次 PR 处理一个主题。
- 不混合格式整理、译文修改和大规模文件移动。
- 修改译文时说明依据，最好附俄文原文位置。
- 修改 PDF 或图片时说明来源、用途和是否替换旧文件。

## 贡献许可

- 提交项目代码、脚本、测试、Schema 或 Git hooks，即表示同意按 MIT 许可贡献。
- 提交原创文档、研究笔记或原创注释，即表示同意按 CC BY-SA 4.0 许可贡献。
- 提交项目整理的事实性书目、来源、校验和或状态元数据，即表示同意按 CC0 1.0 提供。
- 第三方原典、译文、扫描件、图片和转录文本必须注明来源与权利依据，不受上述项目许可
  自动覆盖。
- 本项目不要求签署 CLA，也不采用 DCO；贡献归属以 Git 历史和文件说明为准。

详细边界见 [LICENSE](LICENSE) 和 [RIGHTS.md](RIGHTS.md)。

## 术语讨论

术语建议先记录到 `notes/TERMS.md`，暂不急于统一所有译法。重要术语可以保留多种候选译法，并注明出现语境和选择理由。

## 版权与移除请求

项目基础设施、原创文档和事实性元数据默认公开；第三方全文、译文、扫描件和媒体必须逐项
登记权利依据并通过哈希校验。不要仅凭“可以下载”或“用于研究”将材料标记为可再分发。

若你是相关材料的权利人、整理者或译者，并认为某些内容不宜公开，请通过 issue 联系，
维护者会优先核查并在必要时停止公开导出。
