---
title: "P. V. Kopnin Text Source Survey"
created: "2026-06-16"
type: "analysis"
tags: ["kopnin", "source-metadata", "dialectical-logic", "epistemology"]
language: "zh"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 科普宁哲学文本来源调查

## 人物确认

帕维尔·瓦西里耶维奇·科普宁（Павел Васильевич Копнин，1922—1971；P. V. Kopnin）。苏联哲学家，研究辩证逻辑、马克思主义认识论、科学逻辑与方法论；曾任基辅、后任莫斯科哲学研究所所长。俄文检索优先用 `П. В. Копнин`、`Копнин П. В.`、具体书名。

## 结论

- 资源图首选的 **platona.net 整站被 Cloudflare 拦截**（连根域对脚本/curl 都返回 403），无法自动下载；需真实浏览器才能访问。
- 改用本项目已打通的 **Klex→phantastike** 管道（与 Kedrov/Oizerman 同），Klex 作者页 `kopnin_p_v` 列出 5 部核心俄文著作，且正好覆盖原资源图中被 Cloudflare 拦、twirpx 收费、koob 需登录、marxistphilosophy 已 404 的那些。
- 已下载 4 部为未处理源扫描件；第 5 部 1973 专著只有 .doc 文本，未入库。
- 英文合著译本可达但属次要，未下载。

处理遵循[哲学文本来源与格式政策](PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。作品主表见 [`kopnin_markdown/metadata/works_master.json`](../kopnin_markdown/metadata/works_master.json)。

## 一、已下载（Klex→phantastike，未处理源扫描件）

| Klex | 著作 | 年 | 格式 | 页 |
|---|---|---|---|---:|
| 26xy | Диалектика, логика, наука（文选第二卷，29 篇） | 1973 | pdf | 464 |
| 26y1 | Философские идеи В.И. Ленина и логика | 1969 | djvu | 485 |
| 26xz | Гносеологические и логические основы науки（含 1966《导论》+1968《逻辑基础》） | 1974 | pdf | 566 |
| 26xw | Гипотеза и ее роль в познании | 1958 | djvu | 42 |

## 二、未找到扫描件（缺口）

- **Диалектика как логика и теория познания（1973 专著，Klex 26xx）**：Klex/phantastike 仅 `.doc`/`.zip` 文本；twirpx（file/1942998）扫描需积分；marxistphilosophy.org 的俄文 HTML 镜像已 404。这是科普宁代表作之一，建议后续从 twirpx 积分或图书馆扫描补全。
- 基辅时期单行本：`Диалектика как логика`（1961）、`Гипотеза и познание действительности`（1962）、`Идея как форма мышления`（1963）、`Теория познания и кибернетика`（1964，乌克兰文）——均未定位到免费全文。
- `Роль В.И. Ленина в развитии философии`（1970）、`Ф. Энгельс и современные проблемы философии марксизма`（1971）、`В.И. Ленин и материалистическая диалектика`（1969）——未定位。
- 合著/主编：`Логика научного исследования`（1965，合著）、`Проблемы мышления в современной науке`（1964，主编）——未定位。
- `Проблемы диалектики как логики и теории познания`（Избранные философские работы, 1982，遗作选）；两卷本《Избранные философские труды》第一卷——未定位免费全文。
- 注：1966《Введение в марксистскую гносеологию》与 1968《Логические основы науки》已含于已入库的 1974 合订本。

## 三、被拦/受限来源（仅记录，未绕过）

- **platona.net**（Cloudflare 403）：`kopnin-dialektika-logika-nauka`、`kopnin_filosofskie_idei_lenina_logika`——这两本已通过 Klex 获得，无需绕过。
- **twirpx.com**：`file/1942998`（1973 专著 DJVU）、`file/466037`（1974 合订）——需注册+积分，不绕过。
- **koob.ru / search.rsl.ru（РГБ）**：需登录/账号，不绕过。

## 四、英文合著译本（次要，未下载）

| 著作 | 网址 | 说明 |
|---|---|---|
| Themes in Soviet Marxist Philosophy (1975)，"Dialectical Logic"（科普宁等合著） | https://www.bannedthought.net/MLM-Theory/Diamat/SovietPhilosophy/ThemesInSovietMarxistPhilosophy-EncyclopediaArticles-1975-OCR.pdf | 百科条目英译，可达 |
| The Fundamentals of Marxist-Leninist Philosophy (Progress, 1982) | https://archive.org/details/tfomlp | 教科书，科普宁为合著者之一，可达（djvu/pdf/epub） |

英文译本非俄文原著，按政策另列，不混入俄文主表；如需可单独建译本目录保存。

## 五、权利处理原则

科普宁 1971 年去世，著作受版权保护，找到的来源均无明确开放许可。自由下载的 PDF/DjVu 只按 `source_scan_unprocessed` 原样保存到 `kopnin_markdown/source_scans/<provider>/`，登记完整 manifest，不提取文本、不 OCR、不进 GBrain 或公开导出。受控借阅/积分/登录来源只记录，不绕过。后续逐篇论文检索可从已入库的 1973《Диалектика, логика, наука》或 1973 专著书末《Библиография научных трудов П.В. Копнина》全目录展开。
