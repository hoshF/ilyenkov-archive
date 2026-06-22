---
title: "B. M. Kedrov Text Source Survey"
created: "2026-06-11"
updated: "2026-06-22"
type: "analysis"
tags: ["kedrov", "source-metadata", "dialectics", "philosophy-of-science"]
language: "zh"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# 凯德洛夫哲学文本来源调查

## 人物确认

目标人物是博尼法季·米哈伊洛维奇·凯德洛夫（Бонифатий Михайлович Кедров，1903-1985；英文常写作 Bonifaty/Bonifatii Mikhailovich Kedrov 或 B. M. Kedrov）。他受过化学训练，同时从事哲学、逻辑、科学史和科学方法论研究。俄文检索时应优先使用 `Б. М. Кедров`、`Бонифатий Михайлович Кедров` 和具体书名。

## 结论

- 最适合直接转换为 Markdown 的现成文本有三部：RoyalLib 的 `Беседы о диалектике`、`О «Диалектике природы» Энгельса`、`О творчестве в науке и технике` 三部 HTML。Internet Archive 的 `Ленин и научные революции` EPUB 经检查是自动 OCR 派生物，不能作为 Markdown 来源。
- 项目当前不执行未经作品级批准的新 OCR。Internet Archive 的 DjVuTXT、DjVu XML、
  ABBYY、hOCR 等派生文本不能直接作为正文来源；只有全书逐页人工校验、保留 provenance
  并通过 manifest 验证的作者原语言文本，才可升级为核心语料。
- `publ.lib.ru`、Koob 和 Klex 的覆盖最广，适合建立书目清单并寻找 PDF。没有 HTML/EPUB 的著作，有 PDF 时只保存 PDF，不转换为 Markdown。
- 当前找到的下载站和 Internet Archive 项目没有给出足以支持本仓库公开再分发全文的明确开放许可证。文件可访问不等于可以重新发布；在完成权利审查前，建议只提交来源清单、哈希、转换脚本和本地忽略的派生文本。

以上处理遵循仓库的[哲学文本来源与格式政策](PHILOSOPHY_SOURCE_FORMAT_POLICY.md)。

## 第一优先级：HTML 转 Markdown

状态：已于 2026-06-11 完成。生成文本位于 [`kedrov_markdown/kedrov_md/russian_web/royallib/`](../kedrov_markdown/kedrov_md/russian_web/royallib/)，转换脚本和源文件哈希分别位于 [`scripts/kedrov_royallib_convert.py`](../kedrov_markdown/scripts/kedrov_royallib_convert.py) 与 [`metadata/royallib_manifest.json`](../kedrov_markdown/metadata/royallib_manifest.json)。

| 著作 | 年代 | 来源与格式 | 转换评价 | 权利备注 |
|---|---:|---|---|---|
| `Беседы о диалектике`（《辩证法谈话》） | 初版 1983；网页采用 2007 版 | [RoyalLib 书目页](https://royallib.com/book/kedrov_bonifatiy/besedi_o_dialektike.html)，[HTML ZIP](https://royallib.com/get/html/kedrov_bonifatiy/besedi_o_dialektike.zip) | 最佳候选。单个 Windows-1251 HTML，约 430 KB；有 `h1/h2`、目录锚点和 18 个“谈话”标题。转 UTF-8 后结构化为 Markdown | 页面没有开放许可证；只提供权利人投诉机制 |
| `О «Диалектике природы» Энгельса`（《论恩格斯〈自然辩证法〉》） | 1973 | [RoyalLib 书目页](https://royallib.com/book/kedrov_bonifatiy/o_dialektike_prirodi_engelsa.html)，[HTML ZIP](https://royallib.com/get/html/kedrov_bonifatiy/o_dialektike_prirodi_engelsa.zip) | 使用 HTML 转 Markdown；PDF 只作版本参考，不提取其文本层 | 无明确开放许可证 |
| `О творчестве в науке и технике`（《论科学与技术中的创造》） | 1987 | [RoyalLib 书目页](https://royallib.com/book/kedrov_bonifatiy/o_tvorchestve_v_nauke_i_tehnike.html)，[HTML ZIP](https://royallib.com/get/html/kedrov_bonifatiy/o_tvorchestve_v_nauke_i_tehnike.zip)；[Phantastike HTML 备份](https://www.phantastike.com/superlearning/o_tvorch_v_nauke/html/) | 使用单文件 HTML 转 Markdown；Phantastike 仅作网页备份来源 | 无明确开放许可证 |

RoyalLib HTML 实测并非扫描图片包装：正文、目录、标题均为真实文本。主要技术问题只有 Windows-1251 编码、`<br>` 密集段落和少量版式标签。

## 第二优先级：EPUB 转 Markdown 或保存 PDF

状态：来源和文件结构已核验。下表中列为已保存的六份扫描件现已原样存入
`kedrov_markdown/source_scans/`，并登记在 `metadata/source_scans_manifest.json`；
未找到可替代它们的真实 HTML 或原生结构化 EPUB。

| 著作 | IA 项目 | 核验结果 | 项目处理 |
|---|---|---|---|
| `О «Диалектике природы» Энгельса` | [B-001-025-924-ALL](https://archive.org/details/B-001-025-924-ALL)；[另一扫描](https://archive.org/details/o_dialektike_prirody_engelsa) | 第二个 PDF 为 186 个扫描页，约 8.3 MB，SHA-256 `5659b082b86c38ccc31e8b0c4704949e44fed9b72c9216e6d0c77a63c40c7f17`；含 ABBYY 文本层 | 正文已经使用 RoyalLib HTML 转换；PDF 仅是可选版本参考，不提取文本层，目前无需重复收集 |
| `Фридрих Энгельс. Развитие его взглядов на диалектику естествознания` | [IA 项目页](https://archive.org/details/ao-114-friedrich-engels-developing-his-views-on-the-dialectic-of-natural-science-kedrov-1970) | 1970 年俄文版，160 个扫描页，约 5.5 MB；题名页、导言和第一章可核验，SHA-256 `6cf450f112e1768d6afb432ea32911f2ea0d8f69844e33229683598aeef832fa` | PDF 已保存并登记；不生成 Markdown，忽略 DjVuTXT、XML 和 hOCR |
| `Ленин и научные революции` | [B-001-038-009-ALL](https://archive.org/details/B-001-038-009-ALL) | EPUB 的 OPF 与说明页明确写明由自动字符识别和 `hocr-to-epub` 生成，并存在明显错字及低准确率页面；PDF 为 477 个扫描页，约 64.9 MB，SHA-256 `3a519f5ef7808e4964356fd4e92422cc9e7234209f994496aea1f6e5ca1995e5` | PDF 已保存并登记；拒绝 OCR EPUB，不生成 Markdown |
| `Dialectique, logique, gnoseologie : leur unite`（法译本） | [IA 项目页](https://archive.org/details/dialectiquelogiq0000kedr) | 普通 EPUB/PDF 不开放下载，仅提供受控借阅的加密文件 | 只记录书目，不纳入当前收集，也不替代俄文原著 |

这些 IA 项目没有显示明确开放许可证。已保存文件保持
`source_scan_unprocessed`，本项目不直接采用其中的 OCR 派生文本。

## 第三优先级：扫描目录与扩展书目

### Public Library

[凯德洛夫作者页](https://publ.lib.ru/ARCHIVES/K/KEDROV_Bonifatiy_Mihaylovich/_Kedrov_B.M..html)集中列出并提供 PDF/DjVu，包括：

- `Беседы о диалектике`
- `Единство диалектики, логики и теории познания`：2006 年第 2 版 PDF 已保存为未处理源扫描件。
- `Классификация наук` 第 1-3 册
- `О повторяемости в процессе развития`
- `О «Диалектике природы» Энгельса`
- `Энгельс и диалектика естествознания`
- `Как изучать книгу В. И. Ленина «Материализм и эмпириокритицизм»`

“Новое в жизни, науке, технике: Философия”系列页另有 `К. Маркс о науке и техническом прогрессе` 的 PDF/DjVu。

### Koob 与 Klex

- [Koob 作者页](https://www.koob.ru/kedrov_b/)列出约 30 项，是目前找到的最完整在线目录之一。
- [Klex 作者页](https://www.klex.ru/author/kedrov_b/)与 Koob 高度重合，适合做备用下载入口。

除上述核心书目外，两站还列出：

- `Анализ развивающегося понятия`（与 А. С. Арсеньев、В. С. Библер 合著）
- `Диалектика и логика. Законы мышления`：1962 年版 DjVu 已保存为未处理源扫描件。
- `Диалектика и логика. Формы мышления`：1962 年版 PDF 已保存为未处理源扫描件。
- `О методе изложения диалектики. Три великих замысла`：1983 年版 PDF 已保存为未处理源扫描件。
- `Периодический закон Д. И. Менделеева и его философское значение`
- `Развитие понятия элемента от Менделеева до наших дней`
- `Три аспекта атомистики` 第 1-3 卷
- `Мировая наука и Менделеев`
- `О великих переворотах в науке`
- `Проблемы логики и методологии науки`

这些来源主要是扫描 PDF/DjVu。存在 PDF 时保存 PDF；只有 DjVu 而没有 PDF 时先记录书目并继续寻找 PDF，不从 DjVu 生成文本。

## 可用的短篇或局部文本

- [《列宁与黑格尔辩证法》PDF](https://hegel.rhga.ru/upload/iblock/7eb/%D0%9A%D0%B5%D0%B4%D1%80%D0%BE%D0%B2.pdf)：文件只有 21 页，包含原书若干页段，不是完整 64 页版本。可按 `partial_excerpt` 保存 PDF，但不提取为 Markdown。
- 期刊论文的重要题目包括：`О диалектике научных открытий`（1966）、`О природе научного понятия`（1969）、`История науки и принципы ее исследования`（1971）、`О методе изложения диалектики от абстрактного к конкретному`（1978）、`О современной классификации наук`（1980）。目前未找到权利状态清楚的完整 HTML 原文，应继续查《Вопросы философии》期刊档案和图书馆数据库。

## 当前处理结果与后续顺序

1. `Беседы о диалектике`：HTML 已转 Markdown。
2. `О «Диалектике природы» Энгельса`：HTML 已转 Markdown；IA PDF 只作版本参考。
3. `О творчестве в науке и технике`：HTML 已转 Markdown。
4. `Ленин и научные революции`：OCR 派生 EPUB 不准入；IA PDF 已保存，不生成 Markdown。
5. `Единство диалектики, логики и теории познания`：PDF 已保存，不生成 Markdown。
6. `О методе изложения диалектики. Три великих замысла`：PDF 已保存，不生成 Markdown。
7. `Фридрих Энгельс. Развитие его взглядов на диалектику естествознания`：PDF 已保存，不生成 Markdown。

## 转换与元数据规则

凯德洛夫已使用独立的 `kedrov_markdown/` 集合。新增正文至少记录：

- `author: "Бонифатий Михайлович Кедров"`
- `title`
- `language: "ru"`
- `work_year` 与 `edition_year`
- `source_url`、`source_site`、`source_format`
- `source_license: "not_stated"`
- `text_status: "html_conversion_unverified"` 或其他受控状态
- `text_role: "author_original"`（仅作者原语言正文）
- `llm_wiki_eligible` 与单独的 `redistribution_approved`

HTML 转换建议：先将 Windows-1251 转为 UTF-8，再解析 DOM；将 `h1/h2` 映射为 Markdown 标题，将连续 `<br>` 规范化为段落，并删除站点广告、下载链接和导航。EPUB 应按目录和章节结构解析。PDF 原样保存，不提取文本、不 OCR，也不使用 DjVu XML、ABBYY XML、hOCR 或 DjVuTXT。

## 身份与书目核对来源

- [俄罗斯科学院哲学研究所人物页](https://iphras.ru/page22950653.htm)
- [莫斯科大学人物资料](https://letopis.msu.ru/peoples/7673)
- [较完整的著作目录与人物简介](https://shchedrovitskiy.com/bonifatiy-mikhajlovich-kedrov/)

## 权利处理原则

凯德洛夫 1985 年去世，而且本次找到的全文来源均未标示 Creative Commons、公共领域或其他明确开放许可。RoyalLib 的权利页只说明接受权利人投诉，并不构成对下游再分发的许可。因此：

- 可以在仓库中保存这份来源调查和可复现的转换脚本。
- 在权利状态未确认前，不建议把完整正文提交到公开 Git 仓库。
- 若仅作本地研究，可将下载缓存和生成 Markdown 放入 `.gitignore`，同时保存 URL、抓取日期、文件哈希和版次信息。
- 若将来取得授权或确认某一版本可公开再分发，再把相应文本标记为 `redistribution_approved: true`。
