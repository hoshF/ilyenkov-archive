---
title: "Discussions 分类规划与欢迎帖文案"
created: "2026-06-12"
type: "note"
tags: ["research-note", "community"]
language: "zh"
collection: "research-notes"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Discussions 分类规划与欢迎帖文案

公开仓库 `Ilyenkov-cn` 的 Discussions 已开启。GitHub 不支持通过 API 创建分类，需要在
`https://github.com/hoshF/Ilyenkov-cn/discussions/categories`（仓库 Settings 或 Discussions 页右侧铅笔图标）手工建立以下分类。

## 分类设计

| 分类名 | 格式 | 用途 |
| --- | --- | --- |
| 公告 | Announcement（仅维护者可发） | 月报、发布说明、章程修订 |
| 术语讨论 | Open-ended discussion | 译法提案与讨论；定版后回流 `notes/TERMS.md` |
| 文本与版本考证 | Open-ended discussion | 出版信息、版次差异、缺页删改、来源线索 |
| 翻译认领与进度 | Open-ended discussion | 认领章节、汇报进度、协调分工 |
| 问答 | Q&A | 怎么参与、文件在哪、流程疑问 |
| 自由讨论 | Open-ended discussion | 阅读感悟、相关文献、不属于以上分类的一切 |

默认分类中的 Polls、Show and tell 可以删除或保留，不影响使用。

## 欢迎帖文案（建在「公告」分类，置顶）

标题：`欢迎来到伊里因科夫中文资料库 · 从这里开始`

> 这里是「伊里因科夫中文学习与翻译资料库」的讨论区。项目为中文读者整理埃瓦尔德·伊里因科夫（Э. В. Ильенков）的俄文原文、已有中文译本线索、术语表和翻译工作框架。
>
> **从哪里开始：**
> - 项目介绍和现有内容：见仓库 [README](https://github.com/hoshF/Ilyenkov-cn#readme)
> - 参与方式和提交规范：[CONTRIBUTING.md](https://github.com/hoshF/Ilyenkov-cn/blob/main/CONTRIBUTING.md)
> - 协作规则和决策方式：[GOVERNANCE.md](https://github.com/hoshF/Ilyenkov-cn/blob/main/GOVERNANCE.md)
> - 想直接动手：看带 `good first issue` 标签的 issue
>
> **讨论区怎么用：**
> - 讨论某个词怎么译 → 「术语讨论」
> - 提供版本、出版信息、来源线索 → 「文本与版本考证」
> - 想认领一段校对或翻译 → 「翻译认领与进度」
> - 不知道发哪里 → 「自由讨论」或「问答」
>
> **两条约定：**
> 1. 有结论的讨论会回流到仓库文件（如 `notes/TERMS.md`），讨论帖是过程，仓库是记忆。
> 2. 本仓库只包含通过版权审核的内容。请不要在讨论区张贴受版权保护的扫描件或大段未授权文本，版权相关请求请直接开 issue。
>
> 欢迎自我介绍：你怎么知道伊里因科夫的，读过什么，想做什么。

## Good first issue 草稿

以下三条可直接在公开仓库建 issue，加 `good first issue` 标签。命令：

```sh
gh issue create -R hoshF/Ilyenkov-cn --label "good first issue" -t "标题" -b "正文"
```

### 1. 术语讨论：идеальное 的译法

> `идеальное` 是伊里因科夫哲学的核心概念，中文文献里译作"观念的""理想的""理念性的"等。
>
> 任务：挑选一处具体段落（`notes/TERMS.md` 和已有译本中可找到语境），比较至少两种译法在该语境下的得失，把意见发到 Discussions「术语讨论」或直接对 `notes/TERMS.md` 提 PR。
>
> 不需要俄语基础也可以参与：可以从中文译本内部的一致性入手。

### 2. 版本考证：《辩证逻辑》中译本出版信息补全

> `existing_translations/README.md` 中《辩证逻辑：历史与理论论文集》中译本的版次、印次、译者、出版社信息尚不完整。
>
> 任务：依据实体书、图书馆目录（如 CALIS、读秀）或可靠书目数据，补全出版信息，注明信息来源，以 issue 回复或 PR 提交。

### 3. 来源核对：caute.ru 链接抽查

> `caute_ru_markdown/metadata/` 的清单记录了俄文文本的来源 URL。
>
> 任务：抽查其中 10 条链接是否仍可访问，记录失效链接和（若有）网页存档替代地址，以 issue 回复提交。不需要俄语阅读能力。
