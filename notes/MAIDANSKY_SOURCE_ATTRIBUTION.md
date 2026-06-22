---
title: "Maidansky Website Source Attribution"
created: "2026-06-17"
type: "project"
tags: ["source-attribution", "maidansky", "ilyenkov", "filorus"]
language: "zh"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 迈丹斯基网站来源归属

2026-06-17，安德烈·德米特里耶维奇·迈丹斯基（А.Д. Майданский）来信说明：

- 他已不再拥有 `caute.ru` 网站。
- 引用他的网站文本时，应使用当前入口 `http://filorus.ru/ilyenkov`。
- 在 URL 后加括号说明：`(at the website by Andrey Maidansky)`。

因此，本项目后续引用伊里因科夫相关在线文本时采用如下格式：

```text
http://filorus.ru/ilyenkov/... (at the website by Andrey Maidansky)
```

机器可读字段如 `source_url` 只保存 URL；Markdown 正文中的 `Источник:`、项目说明和引用说明应追加上述括号说明。

若某个已采集文本在当前 `filorus.ru` 上核验不到正文页，则保留实际可访问的历史来源 URL，并在 Markdown 可见来源行标明这是历史例外。

`caute_ru_markdown/` 是历史采集目录名，保留不改名，以免破坏路径、slug、manifest 与既有引用。目录名只表示本项目最初采集来源和转换批次，不再表示当前推荐引用入口。
