---
title: "扫描本数字化流程"
created: "2026-06-21"
updated: "2026-06-21"
type: "project"
status: "approved-design-not-activated"
tags: ["source-scan", "ocr", "human-collation", "workflow"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 扫描本数字化流程

本文规定 PDF/DjVu 扫描本转换为作者原语言 Markdown 的标准流程。它是
[哲学文本来源、OCR 准入与发布政策](PHILOSOPHY_SOURCE_FORMAT_POLICY.md)的实施设计，
不取代该政策。

**当前状态：流程已批准，但尚未激活。** 项目所有者明确指定某一部作品并启动文本处理
前，不得运行新的 OCR，也不得读取 PDF 文本层、DjVuTXT、DjVu XML、ABBYY XML 或 hOCR
生成正文。

本文终点是经过校验的作者原语言 Markdown。翻译属于独立工作，见
[`TRANSLATION_PLAN.md`](../TRANSLATION_PLAN.md) 和
[`translation_workspace/`](../translation_workspace/)。

## 1. 准入状态

### 1.1 未经完整人工校验

OCR 原始结果、自动清理结果和部分复核结果均属于隔离材料：

```yaml
text_role: "ocr_unverified"
core_corpus_eligible: "false"
llm_wiki_eligible: "false"
redistribution_approved: "false"
```

它们不得放入作者正文目录，不得进入 GBrain，不得描述为校勘定本。OCR 引擎表现、
双引擎一致率或模型仲裁均不能替代人工校验。

### 1.2 完整人工校验后

作者原语言文本只有在逐页对照原始扫描图、完成全书校验，并登记可验证的人工校验
manifest 后，才可升级为：

```yaml
text_role: "author_original"
text_status: "ocr_draft_human_collated"
provenance: "ocr_initial_then_manual_collation_against_source_images"
core_corpus_eligible: "true"
llm_wiki_eligible: "true"
```

升级后可以进入核心语料层和 GBrain。OCR 来源、源扫描件 SHA-256、校验者、校验日期、
校验范围及最终 Markdown SHA-256 必须永久保留。不得把该文本伪装成 HTML、原生 EPUB
或其他非 OCR 来源。

通用数字化记录 Schema 与阶段验证器已经实现，但流程仍未激活。首次启动新的整书 OCR
前，必须使用 `scripts/manage_collections.py init-digitization` 建立项目，并由项目所有者
明确批准该作品进入处理阶段。

## 2. 触发条件

每部作品必须单独触发。启动记录至少确认：

- 作品、版本、作者语言和处理范围；
- 源文件已登记为 `source_scan_unprocessed`，文件哈希与 manifest 一致；
- 来源可合法访问，不属于受控借阅、加密或 `printdisabled` 内容；
- 没有质量更高的真实 HTML 或原生结构化 EPUB；
- OCR 中间文件的存储位置、预计体积和人工校验责任人；
- 所用引擎、费用与数据传输方式符合当时的隐私和服务条款要求。

未满足任一条件时保持源扫描件状态，不进入后续步骤。

## 3. 标准流程

### 3.1 建立处理目录与不可变基线

源 PDF/DjVu 保持原路径和原文件不变。为本次处理建立独立工作目录，记录源文件
SHA-256、工具版本、执行日期和配置。DJVU 应直接导出高质量页图，不为 OCR 额外转成
PDF；原生 PDF 可由选定引擎直接分页读取，必要时再渲染页图。

中间页图和模型原始响应是否进入 Git，须在启动记录中根据体积决定；无论存储位置
如何，manifest 必须能定位并验证它们。

### 3.2 建立页码映射

在 OCR 前创建 `page_map.json`，区分文件页索引、扫描页序号和印刷页码。映射不得只用
单一线性偏移，必须能表示：

- 封面、版权页、空白页和无页码页；
- 罗马数字与阿拉伯数字页码段；
- 插页、缺页、重复页码和误装订页；
- 同一文件中的多段偏移及人工修正。

后续 OCR、复核、页标记和引文定位统一引用该映射。

### 3.3 分页双引擎 OCR

按页或保留明确页边界的小批次分别运行两个相互独立的 OCR/视觉识别引擎。具体型号
在每次启动时根据语言、版面、可复现性、成本和数据政策选择，不在本流程中固化。

两套原始结果不得覆盖或预先合并。每份结果记录：

- 引擎和精确版本；
- prompt 或配置内容及 SHA-256；
- 输入页范围和输入图像 SHA-256；
- 原始输出、执行时间和失败记录。

术语、专名和常见引文格式可作为识别提示，但不得要求模型补写模糊或缺失内容。

### 3.4 差异检测与抽检

程序按页对齐两套输出，计算文本、段落、标题、脚注、引文和特殊符号差异，并生成
高风险页队列。至少包括：

- 一方缺页、缺段或输出异常短；
- 标题、脚注、表格、公式或引文结构不一致；
- 字符差异率超过该作品预先记录的阈值；
- 疑似模型补写、概括或改写。

双引擎一致不等于正确。除全部高风险页外，还必须从低风险页中随机抽检；抽检比例和
随机种子写入质量报告。抽检发现系统性错误时，应扩大抽检或整批退回重做。

### 3.5 人工复核

复核者同时查看原始扫描页和两套原始输出，不以任一模型为默认权威。每项修订记录
页标识、原始差异、最终文本、判断依据、复核者和日期。无法辨认的内容明确标记，
不得猜补。

模型可以辅助提出候选读法，但不能代替人工最终判断。

### 3.6 自动质量检查

合并为整书文本前生成 `quality_report.json`，至少检查：

- 文件页和印刷页序列的缺失、重复与异常跳转；
- 目录标题与正文标题的对应关系；
- 西里尔字母与拉丁同形字在单词内部的异常混用；
- 脚注、表格、公式、化学式和特殊符号数量异常；
- 马克思、恩格斯、列宁著作集等结构化引文的卷页格式；
- 空页、异常短页、重复页和疑似整段缺失。

多语言引文属于合法内容，字符检查必须结合语言区域或人工白名单，不能自动改写。

### 3.7 内容与结构校验

保留双引擎 raw、人工修订记录和 clean 三层结果。任何自动清理都要产生可审查 diff。
除段落、标题、脚注、引文和公式数量外，还应比较页级文本哈希或规范化 diff，防止在
数量不变时发生静默替换。

结构不一致必须解释并记录；无法解释的差异阻止进入切章阶段。

### 3.8 按标题可逆切章

质量检查通过后，按真实标题层级切章，不按固定页数或字节硬切。章节继承全部来源、
角色和权利字段，并包含 `work_id`、三位 `chapter_index`、`chapter_title` 及可回溯的
页边界标记。单章必须小于 500,000 UTF-8 字节；超限时继续按下一级真实标题拆分。

`work_manifest.json` 记录章节顺序、正文边界和 SHA-256。可逆校验针对规范化前约定的
**正文 payload**；生成的 front matter、章节包装和页边界标记不计入原文哈希。重建规则
必须明确哪些生成内容在拼接时剥离，确保不会以“加入元数据”为由掩盖正文丢失。

### 3.9 隔离入库

切章和自动质检通过不等于人工校验完成。未经全书逐页人工校验的结果继续使用
`ocr_unverified`，保存在不被 GBrain 扫描的隔离位置，并保持
`core_corpus_eligible: "false"`、`llm_wiki_eligible: "false"`。

### 3.10 人工校验升级

人工校验必须覆盖全书全部扫描页，而不只是高风险页和抽检页。完成后由项目所有者
审核人工校验 manifest；机器验证须确认源扫描件、最终 Markdown、页码映射、校验范围
和哈希全部匹配，才允许升级为 `author_original` 并进入 GBrain。

任何后续正文修改都会改变 Markdown 哈希，必须重新校验 manifest。局部修订不得静默
继承旧的“全书已校验”状态。

## 4. 必须保留的记录

通用流程已经为以下记录提供 Schema：

- 源扫描件 manifest；
- `page_map.json`；
- 两套逐页原始 OCR 输出及执行元数据；
- 页级 diff 和风险分类；
- `ocr_review_log.json`；
- `quality_report.json`；
- `work_manifest.json` 和正文 payload 重建校验；
- 全书人工校验 manifest。

Schema 位于 `metadata/schemas/`。阶段完整性由
`scripts/manage_collections.py check` 验证；正文角色与人工确认哈希仍由
`scripts/prepare_gbrain_markdown.py` 和 manifest 校验共同把关。不得用临时字段绕过。

## 5. 不变量

- 没有作品级明确触发，不运行 OCR。
- 受控借阅、加密或需要绕过访问控制的来源不进入本流程。
- 未经全书逐页人工校验的 OCR 不进入作者正文目录、核心语料层或 GBrain。
- 人工校验后的作者原语言文本可以进入核心语料层和 GBrain，但必须保留 OCR provenance
  和完整可验证记录。
- 自动清理不得静默增删、概括、翻译或现代化原文。
- 切章必须通过正文 payload 的可逆重建校验。
- `llm_wiki_eligible` 与公开再分发许可相互独立；进入 GBrain 不代表允许公开发布。
