---
title: "B. M. Kedrov Text Source Survey"
created: "2026-06-11"
updated: "2026-07-03"
type: "analysis"
tags: ["kedrov", "source-metadata", "dialectics", "philosophy-of-science"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# B. M. Kedrov Text Source Survey

This document translates the existing survey and now records the first cross-person network
discovery pass for Soviet philosophy source leads.

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

## Network Discovery Round, 2026-07-03

The cross-person discovery pass created
[`soviet_philosophy_source_discovery.json`](../metadata/soviet_philosophy_source_discovery.json).
For Kedrov, the next useful work is not immediate conversion but gap comparison:

- `https://publ.lib.ru/ARCHIVES/K/KEDROV_Bonifatiy_Mihaylovich/_Kedrov_B.M..html` returned HTTP
  200 and remains a broad catalogue/file lead for works not yet represented in Markdown.
- Public Library explicitly lists ZIP-file leads and display sizes for `Беседы о диалектике`,
  `Единство диалектики, логики и теории познания`, `Классификация наук` books 1-3, and
  `О повторяемости в процессе развития`.
- `https://www.klex.ru/author/kedrov_b/` returned HTTP 200 and remains a backup author-page lead
  for missing scans and edition comparison.
- Klex confirms work-page slugs for `Три аспекта атомистики` volumes 1-3, `Классификация наук`
  books 1-3, `Единство диалектики, логики и теории познания`, and
  `О повторяемости в процессе развития`.
- The Russian Wikipedia bibliography is useful as a secondary title checklist for `Классификация
  наук`, `Проблемы логики и методологии науки`, `Три аспекта атомистики`, and other unprocessed
  or unlocated works, but it is not a body-text source.

This pass also introduced a Kedrov bibliographic inventory at
[`works_master.json`](../kedrov_markdown/metadata/works_master.json). It separates work-level
records from RoyalLib conversion records and maps the high-value web leads as follows:

| Work id | Title | Public Library status | Klex status | Local status |
|---|---|---|---|---|
| `edinstvo-dialektiki-logiki-i-teorii-poznaniya-2006` | `Единство диалектики, логики и теории познания` | 2006 DjV/PDF ZIP listed; PDF already registered | `/g2d` work page checked; ZIP/DjVu/view links listed | scan downloaded |
| `klassifikaciya-nauk-kniga-1-1961` | `Классификация наук. Книга 1. Энгельс и его предшественники` | 1961 DjV ZIP listed | `/g2e` work page checked; ZIP/DjVu/view links listed | candidate, not downloaded |
| `klassifikaciya-nauk-kniga-2-1965` | `Классификация наук. Книга 2. От Ленина до наших дней` | 1965 DjV ZIP listed | `/g2f` work page checked; ZIP/DjVu/view links listed | candidate, not downloaded |
| `klassifikaciya-nauk-kniga-3-1985` | `Классификация наук. Книга 3. Прогноз К. Маркса о науке будущего` | 1985 DjV ZIP listed | `/g2g` work page checked; ZIP/DjVu/view links listed | candidate, not downloaded |
| `o-povtoryaemosti-v-protsesse-razvitiya-2006` | `О повторяемости в процессе развития` | 2006 DjV/PDF ZIP listed | `/d8o` work page checked; ZIP/PDF links listed | candidate, not downloaded |
| `tri-aspekta-atomistiki-tom-1` | `Три аспекта атомистики. Том 1`; part title `Парадокс Гиббса. Логический аспект` | not listed on checked Public Library page | `/21og` work page checked; ZIP/PDF links listed | candidate, not downloaded; 1969, Moscow: Nauka from secondary bibliography |
| `tri-aspekta-atomistiki-tom-2` | `Три аспекта атомистики. Том 2`; part title `Учение Дальтона. Исторический аспект` | not listed on checked Public Library page | `/21oh` work page checked; ZIP/PDF links listed | candidate, not downloaded; 1969, Moscow: Nauka from secondary bibliography |
| `tri-aspekta-atomistiki-tom-3` | `Три аспекта атомистики. Том 3`; part title `Закон Менделеева. Логико-исторический аспект` | not listed on checked Public Library page | `/21oi` work page checked; ZIP/PDF links listed | candidate, not downloaded; 1969, Moscow: Nauka from secondary bibliography |

Secondary bibliography checks on the Shchedrovitskiy Kedrov page and Russian Wikipedia support
`Три аспекта атомистики` as a 1969 work, and a philosophy-of-chemistry bibliography gives
`М.: Наука, 1969`. These are not body-text sources and still need a library-catalog record before
scan acquisition or edition-level promotion.

## Future Scan Acquisition Queue

This queue is a planning aid only. It does not authorize downloads, OCR, PDF/DjVu text-layer use,
or Markdown conversion.

| Priority | Work id | Reason | Next action |
|---|---|---|---|
| `registered_scan` | `edinstvo-dialektiki-logiki-i-teorii-poznaniya-2006` | Public Library PDF scan already registered in `source_scans_manifest.json`. | No new acquisition; use only as scan evidence unless a separate text-source review is opened. |
| `priority_1` | `klassifikaciya-nauk-kniga-1-1961` | Core classification trilogy; Public Library and Klex/Phantastike expose matching DjVu leads. | If owner requests scan acquisition, verify exact file identity and rights basis before download. |
| `priority_1` | `klassifikaciya-nauk-kniga-2-1965` | Core classification trilogy; Public Library and Klex/Phantastike expose matching DjVu leads. | If owner requests scan acquisition, verify exact file identity and rights basis before download. |
| `priority_1` | `klassifikaciya-nauk-kniga-3-1985` | Core classification trilogy; Public Library and Klex/Phantastike expose matching DjVu leads. | If owner requests scan acquisition, verify exact file identity and rights basis before download. |
| `priority_1` | `o-povtoryaemosti-v-protsesse-razvitiya-2006` | High-value dialectics work; Public Library and Klex/Phantastike expose PDF/archive leads. | If owner requests scan acquisition, verify exact file identity and rights basis before download. |
| `priority_2_library_catalog_first` | `tri-aspekta-atomistiki-tom-1` | Klex/Phantastike expose a PDF lead, but checked bibliographic support is still secondary. | Confirm a library-catalog record before any scan acquisition. |
| `priority_2_library_catalog_first` | `tri-aspekta-atomistiki-tom-2` | Klex/Phantastike expose a PDF lead, but checked bibliographic support is still secondary. | Confirm a library-catalog record before any scan acquisition. |
| `priority_2_library_catalog_first` | `tri-aspekta-atomistiki-tom-3` | Klex/Phantastike expose a PDF lead, but checked bibliographic support is still secondary. | Confirm a library-catalog record before any scan acquisition. |

No files were downloaded, no PDF/DjVu text layer was read, no OCR was run, and no Markdown body text
was created in this round.

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
