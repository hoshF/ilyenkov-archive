# 伊里因科夫哲学文本库

![伊里因科夫肖像](assets/images/ilyenkov-portrait.jpg)

## English Summary

The Ilyenkov Philosophy Text Archive is a global, source-traceable project for collecting,
verifying, structuring, and digitizing original-language philosophical texts centered on Evald
Ilyenkov and his intellectual context. It is an auditable, reproducible, AI-ready source-text
digitization and research platform for preservation, search, digital humanities, multilingual study,
and carefully bounded LLM-assisted research.

One of its central long-term programs is the Chinese translation, terminology study, and close
reading of Ilyenkov. Related philosophers are translated selectively when needed for that research.
Public access is rights-gated; availability in the archive does not imply redistribution or
model-training permission. Global collaborators are welcome through
[Discussions](https://github.com/hoshF/Ilyenkov-cn/discussions).

本项目是一个以埃瓦尔德·瓦西里耶维奇·伊里因科夫（Э. В. Ильенков）哲学为中心的文本库。项目由伊里因科夫原文整理与中文阅读起步，现已扩展到与其思想来源、理论论争和苏联哲学语境密切相关的作者与文献。

项目包含两项相互支撑的长期工作：

1. **原典数字化与研究平台**：建设可审计、可重建、适合 AI/LLM 与数字人文使用的哲学文本基础设施。
2. **中文翻译与精读计划**：持续推进以伊里因科夫为优先对象的中文翻译、术语研究和精读。

原典数字化工作的主要内容包括：

- 保存和整理作者原语言文本。
- 收集可核验的扫描版本、出版信息和来源记录。
- 支持全文检索、版本比较、文本校勘和哲学研究。
- 为不同语言背景的全球研究者和学习者提供可复用的哲学文献基础。

Markdown 与 Git 是文本和元数据的事实来源；扫描件、译文、研究资料和派生索引按各自角色分层保存。仓库名称和 GitHub 地址沿用项目历史：
<https://github.com/hoshF/Ilyenkov-cn>

## 收录范围

| 作者或专题 | 当前材料 | 在项目中的位置 |
|---|---|---|
| 伊里因科夫 | 俄文原著、文章、书信、访谈、手稿及经确认的历史报纸文本，以 Markdown 为核心 | 项目的中心语料 |
| 迈丹斯基 | 伊里因科夫、斯宾诺莎、辩证法及相关问题的研究文章与来源档案 | 研究与阐释层 |
| 凯德洛夫 | 由真实 HTML 整理的俄文 Markdown，以及未处理 PDF/DjVu 扫描件 | 苏联辩证法与科学哲学语境 |
| 奥伊泽尔曼 | 官方书目、作品主表和未处理扫描件，包括与列克托尔斯基共同主编的四卷本《认识论》 | 苏联哲学史与认识论语境 |
| 科普宁 | 作品主表、来源调查和未处理扫描件 | 辩证逻辑、认识论与科学方法论语境 |
| 斯宾诺莎 | 拉丁文原文、历史译本和文本见证 | 伊里因科夫哲学的重要思想来源 |

主要研究入口：

- [全库收藏状态](COLLECTION_STATUS.md)
- [伊里因科夫与迈丹斯基语料](caute_ru_markdown/README.md)
- [迈丹斯基来源档案](maidansky_markdown/README.md)
- [斯宾诺莎文本库](spinoza_markdown/README.md)
- [凯德洛夫文本库](kedrov_markdown/README.md)
- [奥伊泽尔曼文本库](oizerman_markdown/README.md)
- [科普宁文本库](kopnin_markdown/README.md)

## 如何使用文本库

本仓库中的文件承担不同功能，不能仅凭扩展名判断其可靠性或文本身份：

- **可检索正文 Markdown**：进入相应作者的 `*_md/` 目录。长篇作品应先查看作品目录中的 `README.md` 和 `work_manifest.json`，再按章节阅读。
- **未处理扫描件**：保存在各作者的 `source_scans/` 或历史兼容扫描目录中，只作为版本与校勘依据，不等同于已整理正文。
- **书目和来源元数据**：保存在各作者的 `metadata/`、`bibliography/` 以及 `notes/` 中，用于确认题名、版本、责任形式、来源和收集状态。
- **中文译本与翻译工程**：集中在 `existing_translations/`、`dialectical_logic/`、`idols_ideals/` 和 `translation_workspace/`。
- **LLM 检索索引**：项目使用 [GBrain](LLM_WIKI.md) 对合格 Markdown 建立可重建索引。数据库是派生工具，不替代 Markdown、manifest 和 Git 历史。

阅读或引用前，应检查文件 front matter、来源 URL、版本说明、`text_role`、`text_status` 和权利字段。具体文本应放在哪一层，见 [RESOLVER.md](RESOLVER.md)。

新增哲学家或资料集合必须通过中央注册表和管理命令完成，见[集合架构与扩展规范](notes/COLLECTION_ARCHITECTURE.md)。

## 文本层级与来源原则

- 作者原文、历史译本、现代译文、研究文章、文本见证、AI 参考和未处理扫描件必须分开标记。
- 核心语料优先采用作者写作时使用的语言，不以译文替代原文。
- 真实 HTML 和原生结构化 EPUB 可在保留来源记录后整理为 Markdown。
- 自由直接下载的 PDF/DjVu 先作为未处理扫描件保存；扫描件不自动进入正文或检索层。
- 项目当前不执行新的 OCR，也不从 PDF/DjVu 的派生文本层直接生成正文。只有完成规定校验的文本才能升级其状态。
- 来源可访问不等于获得公开再分发许可；本地检索资格与公开发布许可相互独立。

权威规则见[哲学文本来源、OCR 准入与发布政策](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。扫描本数字化的触发条件、人工校验和准入流程见[扫描本数字化流程](notes/SCAN_DIGITIZATION_WORKFLOW.md)。

## 中文翻译与精读计划

中文翻译、术语研究和精读是本项目建立在原文数字化基础上的长期重点。伊里因科夫是持续
翻译的优先对象；其他苏联哲学家按与其研究的关系选择性翻译；斯宾诺莎等思想来源主要建设
原语言语料，不承诺全面中文化。译文不能替代作者原语言文本。

- `dialectical_logic/`：已整理的《辩证逻辑：历史与理论论文集》1974 年第一版中文 LaTeX 工程。
- `idols_ideals/`：已整理的《论偶像与理想》中文 LaTeX 工程。
- [`existing_translations/`](existing_translations/README.md)：已有中文 PDF、扫描本及本项目编译文件；来源、版本和校订状态不完全一致。
- [`translation_workspace/`](translation_workspace/README.md)：小规模翻译、校订和术语讨论的工作区。
- [TRANSLATION_PLAN.md](TRANSLATION_PLAN.md)：中文翻译与精读计划的原则、候选文本和优先级记录。

任何新增译文都应保留原题、原文路径、来源 URL、版本信息和校订状态。未经人工检查的批量机器翻译不作为正式译本收录。

## 参与方式

欢迎通过 issue 或 pull request 参与：

- 补充原文、扫描版本、出版信息、书目和来源线索。
- 指出文本转换、文件命名、目录归类、版本判断或元数据中的错误。
- 比较不同版本，记录缺页、删改、异文和校勘问题。
- 完善作者关系、概念索引、术语对照和研究导航。
- 提交范围明确、来源可追溯并经过人工检查的文本修订或译文。

详细规范见 [CONTRIBUTING.md](CONTRIBUTING.md)，协作与决策规则见 [GOVERNANCE.md](GOVERNANCE.md)。专题讨论可使用仓库的 [Discussions](https://github.com/hoshF/Ilyenkov-cn/discussions)，即时交流可加入 [Telegram 群](https://t.me/+Bmk9X1lnUY45ZjJl)。

## 来源与致谢

伊里因科夫原文和相关整理资料历史上有相当部分来自 `caute.ru` 镜像。迈丹斯基本人于 2026-06-17 来信说明，他已不再拥有 `caute.ru`；引用其网站文本时，应使用当前入口 [filorus.ru/ilyenkov](http://filorus.ru/ilyenkov/) 并在 URL 后注明 `(at the website by Andrey Maidansky)`。`caute_ru_markdown/` 目录名作为历史采集路径保留，不代表当前推荐引用入口。

特别感谢安德烈·德米特里耶维奇·迈丹斯基（А. Д. Майданский）。本项目对伊里因科夫作品、斯宾诺莎哲学及相关研究材料的整理，受益于他的长期收集、出版和研究工作。详细归属规则见[迈丹斯基来源归属说明](notes/MAIDANSKY_SOURCE_ATTRIBUTION.md)。

各子项目还保留其独立的来源 URL、manifest、书目和调查记录。引用具体文本时，应以对应文件中的来源信息为准，而不是只引用本 README。

## 版权与公开发布

项目采用“元数据和基础设施默认开放，全文按权利状态逐项开放”的发布原则。代码与工具
使用 MIT，项目原创文档使用 CC BY-SA 4.0，事实性元数据使用 CC0 1.0。第三方原典、
译文、扫描件和图片不自动适用项目许可证，仍按各自权利状态处理。完整说明见
[LICENSE](LICENSE) 和 [RIGHTS.md](RIGHTS.md)。

全文、译文、扫描件、媒体和含正文的派生数据只有在中央权利注册表记录具体路径、SHA-256、
权利依据和审核信息后才能公开。公开发布只能通过 `scripts/publish_public.sh` 和版权闸门
生成的 `dist/public/` 进行，不得直接发布完整工作仓库。`llm_wiki_eligible` 只表示本地
检索资格，不代表公开发布许可。

如权利人、作者、译者或整理者认为某项材料的保存、说明或呈现方式存在问题，请通过仓库 issue 联系维护者核查处理。
