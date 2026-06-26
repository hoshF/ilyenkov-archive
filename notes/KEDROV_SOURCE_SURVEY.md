---
title: "B. M. Kedrov Text Source Survey"
created: "2026-06-11"
updated: "2026-06-22"
type: "analysis"
tags: ["kedrov", "source-metadata", "dialectics", "philosophy-of-science"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# B. M. Kedrov Text Source Survey

This document translates the existing survey; it does not record a new external source search.

## Identity

Bonifaty Mikhailovich Kedrov (Бонифатий Михайлович Кедров, 1903-1985; also Bonifaty/Bonifatii
Mikhailovich Kedrov or B. M. Kedrov) worked in chemistry, philosophy, logic, history of science,
and scientific methodology. Russian searches should use `Б. М. Кедров`,
`Бонифатий Михайлович Кедров`, and exact titles.

## Findings

- Three RoyalLib works provide genuine HTML suitable for Markdown: `Беседы о диалектике`,
  `О «Диалектике природы» Энгельса`, and `О творчестве в науке и технике`.
- The Internet Archive EPUB of `Ленин и научные революции` is OCR-derived and is not an accepted
  Markdown source.
- DjVuTXT, DjVu XML, ABBYY, hOCR, and similar derivatives do not enter the corpus directly.
- `publ.lib.ru`, Koob, and Klex provide broad bibliographic and scan coverage.
- The located sites state no clear open license for full-text redistribution.

Treatment follows the [Source Policy](PHILOSOPHY_SOURCE_FORMAT_POLICY.md).

## Priority 1: HTML Converted To Markdown

Completed June 11, 2026. Output is under
[`kedrov_markdown/kedrov_md/russian_web/royallib/`](../kedrov_markdown/kedrov_md/russian_web/royallib/);
the converter and manifest are
[`kedrov_royallib_convert.py`](../kedrov_markdown/scripts/kedrov_royallib_convert.py) and
[`royallib_manifest.json`](../kedrov_markdown/metadata/royallib_manifest.json).

| Work | Date | Source and format | Assessment | Rights |
|---|---:|---|---|---|
| `Беседы о диалектике` | first edition 1983; web edition 2007 | [RoyalLib page](https://royallib.com/book/kedrov_bonifatiy/besedi_o_dialektike.html), [HTML ZIP](https://royallib.com/get/html/kedrov_bonifatiy/besedi_o_dialektike.zip) | Windows-1251 HTML, about 430 KB, with `h1/h2`, contents anchors, and 18 conversation headings | no open license; complaints process only |
| `О «Диалектике природы» Энгельса` | 1973 | [RoyalLib page](https://royallib.com/book/kedrov_bonifatiy/o_dialektike_prirodi_engelsa.html), [HTML ZIP](https://royallib.com/get/html/kedrov_bonifatiy/o_dialektike_prirodi_engelsa.zip) | HTML converted; PDF retained only as edition evidence | no clear open license |
| `О творчестве в науке и технике` | 1987 | [RoyalLib page](https://royallib.com/book/kedrov_bonifatiy/o_tvorchestve_v_nauke_i_tehnike.html), [HTML ZIP](https://royallib.com/get/html/kedrov_bonifatiy/o_tvorchestve_v_nauke_i_tehnike.zip), [Phantastike backup](https://www.phantastike.com/superlearning/o_tvorch_v_nauke/html/) | single-file HTML; Phantastike is a backup source | no clear open license |

The RoyalLib files are genuine text, not image wrappers. Conversion handles Windows-1251,
`<br>`-heavy paragraphs, headings, and site furniture.

## Priority 2: EPUB Assessment And Preserved Scans

Six scans are preserved under `kedrov_markdown/source_scans/` and registered in
`metadata/source_scans_manifest.json`. No superior genuine HTML or native structured EPUB was
found for them.

| Work | Source | Verified facts | Treatment |
|---|---|---|---|
| `О «Диалектике природы» Энгельса` | [B-001-025-924-ALL](https://archive.org/details/B-001-025-924-ALL), [alternate scan](https://archive.org/details/o_dialektike_prirody_engelsa) | second PDF: 186 scan pages, about 8.3 MB; SHA-256 `5659b082b86c38ccc31e8b0c4704949e44fed9b72c9216e6d0c77a63c40c7f17`; contains ABBYY layer | HTML is the body source; scan is edition evidence and was not duplicated |
| `Фридрих Энгельс. Развитие его взглядов на диалектику естествознания` | [Internet Archive](https://archive.org/details/ao-114-friedrich-engels-developing-his-views-on-the-dialectic-of-natural-science-kedrov-1970) | 1970 Russian edition, 160 scan pages, about 5.5 MB; SHA-256 `6cf450f112e1768d6afb432ea32911f2ea0d8f69844e33229683598aeef832fa` | PDF preserved; DjVuTXT, XML, and hOCR ignored |
| `Ленин и научные революции` | [B-001-038-009-ALL](https://archive.org/details/B-001-038-009-ALL) | EPUB metadata states automatic OCR and `hocr-to-epub`; PDF has 477 scan pages, about 64.9 MB; SHA-256 `3a519f5ef7808e4964356fd4e92422cc9e7234209f994496aea1f6e5ca1995e5` | PDF preserved; OCR EPUB rejected |
| `Dialectique, logique, gnoseologie : leur unite` | [Internet Archive](https://archive.org/details/dialectiquelogiq0000kedr) | normal EPUB/PDF unavailable; encrypted controlled loan only | bibliography only |

These files remain `source_scan_unprocessed`.

## Priority 3: Scan Catalogues And Extended Bibliography

[Public Library](https://publ.lib.ru/ARCHIVES/K/KEDROV_Bonifatiy_Mihaylovich/_Kedrov_B.M..html)
lists `Беседы о диалектике`, `Единство диалектики, логики и теории познания`,
`Классификация наук` volumes 1-3, `О повторяемости в процессе развития`,
`О «Диалектике природы» Энгельса`, `Энгельс и диалектика естествознания`, and
`Как изучать книгу В. И. Ленина «Материализм и эмпириокритицизм»`.

The site also lists `К. Маркс о науке и техническом прогрессе`.

[Koob](https://www.koob.ru/kedrov_b/) lists about thirty items.
[Klex](https://www.klex.ru/author/kedrov_b/) substantially overlaps and serves as a backup route.
Additional records include:

- `Анализ развивающегося понятия`, with А. С. Арсеньев and В. С. Библер;
- `Диалектика и логика. Законы мышления`, 1962 DjVu, preserved;
- `Диалектика и логика. Формы мышления`, 1962 PDF, preserved;
- `О методе изложения диалектики. Три великих замысла`, 1983 PDF, preserved;
- `Периодический закон Д. И. Менделеева и его философское значение`;
- `Развитие понятия элемента от Менделеева до наших дней`;
- `Три аспекта атомистики`, volumes 1-3;
- `Мировая наука и Менделеев`;
- `О великих переворотах в науке`;
- `Проблемы логики и методологии науки`.

## Partial And Short Texts

- [Ленин и диалектика Гегеля](https://hegel.rhga.ru/upload/iblock/7eb/%D0%9A%D0%B5%D0%B4%D1%80%D0%BE%D0%B2.pdf)
  is a 21-page excerpt, not the complete 64-page work.
- Periodical targets include `О диалектике научных открытий` (1966),
  `О природе научного понятия` (1969), `История науки и принципы ее исследования` (1971),
  `О методе изложения диалектики от абстрактного к конкретному` (1978), and
  `О современной классификации наук` (1980). No rights-clear complete HTML was located.

## Current Processing Order

1. `Беседы о диалектике`: HTML converted.
2. `О «Диалектике природы» Энгельса`: HTML converted; scan is reference only.
3. `О творчестве в науке и технике`: HTML converted.
4. `Ленин и научные революции`: OCR EPUB rejected; PDF preserved.
5. `Единство диалектики, логики и теории познания`: PDF preserved.
6. `О методе изложения диалектики. Три великих замысла`: PDF preserved.
7. `Фридрих Энгельс. Развитие его взглядов на диалектику естествознания`: PDF preserved.

## Metadata And Rights

New body text records author, title, language, work and edition years, source URL/site/format,
license, status, role, GBrain eligibility, and separate redistribution approval.

Identity and bibliography references:

- [Institute of Philosophy RAS](https://iphras.ru/page22950653.htm)
- [Moscow State University](https://letopis.msu.ru/peoples/7673)
- [Biographical bibliography](https://shchedrovitskiy.com/bonifatiy-mikhajlovich-kedrov/)

Kedrov died in 1985, and no located source states an open license. A complaints process does not
grant downstream redistribution. Full text remains excluded from public export until a rights
review approves the exact file.
