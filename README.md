---
title: "伊里因科夫中文学习与翻译资料库"
created: "2026-06-11"
type: "project"
tags: ["project", "documentation"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# 伊里因科夫中文学习与翻译资料库

![伊里因科夫肖像](assets/images/ilyenkov-portrait.jpg)

本项目尝试为中文读者整理埃瓦尔德·瓦西里耶维奇·伊里因科夫（Э.В. Ильенков）相关资料，包括俄文原文 Markdown、已有中文译本 PDF、阅读笔记、术语表和后续翻译工作框架。

项目仍处于初级阶段，主要用于个人学习、文本校对、资料保存和公开交流。这里的内容不代表正式完整译本，也不保证已经完成充分校订；如果这些材料能帮助后来者进入伊里因科夫的思想、比较版本、修正错误或继续翻译，那这个仓库就已经有了意义。

GitHub 仓库：<https://github.com/hoshF/Ilyenkov-cn>

## 可以如何参与

欢迎通过 issue 或 pull request 参与：

- 补充俄文原文、出版信息、译本来源和版本线索。
- 指出来源、HTML/EPUB 转换、文件命名或目录归类中的错误。
- 比较已有中文译本与俄文原文，记录缺页、误译、删改和版本差异。
- 讨论术语译法，例如 `идеальное`、`деятельность`、`мышление`、`всеобщее`。
- 提交小范围、可追溯、已经人工检查过的译文修订。

更详细的参与方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。协作规则、决策方式和成员结构见 [GOVERNANCE.md](GOVERNANCE.md)。半正式讨论（术语、版本考证、翻译认领）在仓库的 [Discussions](https://github.com/hoshF/Ilyenkov-cn/discussions) 进行。

## 当前内容

- `dialectical_logic/`：已整理的《辩证逻辑：历史与理论论文集》1974 年第一版中文 LaTeX 工程。
- `idols_ideals/`：已整理的《论偶像与理想》中文 LaTeX 工程。
- `caute_ru_markdown/`：从 caute.ru 整理出的俄文 Markdown 资料库，含伊里因科夫文本、报纸材料和迈丹斯基相关研究资料。
- `spinoza_markdown/`：斯宾诺莎原文与文本见证资料库；拉丁作者语言文本作为核心语料，荷兰文历史译本和存世见证单独标记。
- `kedrov_markdown/`：凯德洛夫哲学文本资料库；当前收录三部由真实 HTML 转换的俄文 Markdown，并保留来源清单和转换脚本。
- `existing_translations/`：已有中文译本 PDF、扫描本和本项目编译 PDF 的集中目录。
- `translation_workspace/`：以后翻译新作品时使用的工作区。
- `notes/`：术语表、翻译风格、阅读笔记和项目说明。
- `assets/`：README 图片等展示资源。
- `TRANSLATION_PLAN.md`：后续翻译优先级和候选文本索引。

## 已有中文资料

- 《辩证逻辑：历史与理论论文集》：见 `dialectical_logic/`。
- 《论偶像与理想》：见 `idols_ideals/`。
- 《资本论中抽象与具体的辩证法》相关中文 PDF：见 `existing_translations/`。
- 《列宁主义辩证法和经验主义形而上学》相关中文 PDF：见 `existing_translations/`。
- 其他已有中文 PDF：见 `existing_translations/README.md`。

这些 PDF 会作为项目资料进入 Git，便于在 GitHub 上直接阅读和下载。它们的文本质量、版本来源和校订状态不完全一致，请阅读时结合原文和说明谨慎使用。

## 俄文原文资料

俄文 Markdown 原文统一保存在：

- `caute_ru_markdown/ilyenkov_md/`
- `caute_ru_markdown/maidansky_md/`

其中 `ilyenkov_md/` 是伊里因科夫作品原文，`maidansky_md/` 是迈丹斯基研究和相关论文，主要作为版本学、阐释和背景资料使用。

## 来源与致谢

本项目的俄文原文和大量整理资料主要来自 [caute.ru](http://caute.ru/)。如果没有该站长期保存和整理伊里因科夫相关文本，本项目很难展开。

特别感谢安德烈·德米特里耶维奇·迈丹斯基（А.Д. Майданский）。他在整理、出版和研究伊里因科夫作品方面做出了重要贡献，也在辩证逻辑、斯宾诺莎哲学和马克思主义哲学研究中持续推进了相关讨论。本项目使用和整理的许多资料都受益于他的工作。

本项目仍处于初级阶段，目前尚未与迈丹斯基本人联系。如本项目在引用、整理、翻译、说明或呈现方式上有不周之处，在此谨致歉意，并欢迎指正。

## 后续翻译流程

1. 从 `caute_ru_markdown/ilyenkov_md/` 选择一篇俄文 Markdown。
2. 在 `translation_workspace/planned/` 登记选题、来源和优先级。
3. 在 `translation_workspace/drafts/<work_slug>/` 建立翻译草稿目录。
4. 生成中文 Markdown 初稿，但保持与俄文来源可追溯。
5. 人工阅读、校订和术语统一后，移动到 `translation_workspace/reviewed/`。
6. 确认值得成书或成册时，再使用 `translation_workspace/latex_templates/` 建立独立 LaTeX 工程并编译 PDF。

## 当前原则

- 原文优先：核心 Markdown 语料尽可能采用作者写作时所使用的语言，而不是用译文替代原文。
- 新收集文本优先使用真实 HTML 或原生结构化 EPUB；自由可下载的 PDF/DjVu 只保存为未处理源扫描件。项目当前不执行新的 OCR。未经人工校勘的 OCR 只能隔离；13 份逐篇对图校勘并具备 manifest 的历史报纸文本作为作者原文进入核心层，同时保留 OCR 来历。
- 译文属于解释和辅助阅读层，必须与原文、存世文本见证和 AI 生成内容分开标记。
- AI 用于在完整语料、术语关系和具体上下文之间进行动态翻译与解释，但模型输出不能冒充原文或未经核验的权威译本。
- 暂不启动新的 AI 批量翻译。
- 先阅读、理解和校订已有两本已整理作品。
- 新翻译必须保留来源 URL、原题、版本说明和翻译状态。
- 未经人工检查的大批量机器翻译不作为正式译本收录。
- 核心概念优先统一术语，不追求一次性翻完所有文本。
- 报纸、访谈、书信、手稿可以先作为资料库保存，晚于核心著作和正式论文处理。

关于这种原文语料与 AI 跨语言阅读方法的完整说明，见 [notes/ORIGINAL_LANGUAGE_AI_READING.md](notes/ORIGINAL_LANGUAGE_AI_READING.md)。

哲学文本的来源优先级、OCR 准入和源扫描件规则见 [notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。

## LLM Wiki

本项目使用 [GBrain](LLM_WIKI.md) 作为当前 LLM wiki 实例，对仓库内的 Markdown 语料建立可重建的检索、分块和向量索引。Markdown 与 Git 是文本事实来源；GBrain 数据库是派生索引。

语料路径和文本角色的选择规则见 [RESOLVER.md](RESOLVER.md)。项目不复制文件建立另一套 wiki 目录，而是通过现有目录、front matter 和来源元数据组织文本。

15 部超过 500 KB 的长篇已按真实标题边界可逆切章，原整文快照不进入 GBrain 或公开导出。当前全量索引有 652 个活动页面，embedding 无欠账。

## 版权与说明

完整工作仓库用于私有学习、研究和资料整理。不同文本、图片和 PDF 的版权、授权和流传来源情况并不完全相同；公开发布只能使用 `scripts/export_public.py` 生成的 `dist/public/`，不得直接发布完整工作仓库。如有权利人或整理者认为某些材料不宜公开，请提出意见，我会及时处理。
