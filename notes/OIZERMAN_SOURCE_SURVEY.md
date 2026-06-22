---
title: "T. I. Oizerman Text Source Survey / 奥伊泽尔曼哲学文本来源调查"
created: "2026-06-16"
updated: "2026-06-22"
type: "analysis"
tags: ["oizerman", "source-metadata", "marxism", "history-of-philosophy"]
language: "en-zh"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# T. I. Oizerman Text Source Survey

This document translates the existing survey; it does not record a new external source search.

## Identity And Findings

Teodor Ilyich Oizerman (Теодор Ильич Ойзерман, 1914-2017; also Teodor/T. I. Oizerman or Oiserman)
worked on the formation of Marxism, methodology of the history of philosophy, German classical
philosophy, and later met philosophy.

- A works registry and source table exist, and directly downloadable scans are preserved.
- Oizerman's works remain protected; located download sites state no clear open license.
- The Institute of Philosophy RAS bibliography is the authority for titles, dates, editions, and
  responsibility statements. It is a bibliographic tool, not Oizerman's full text.
- Klex, Koob, and Librusec provide mainly PDF/DjVu or uncertain derivative formats.
- No genuine HTML body text or native structured EPUB has been accepted.

See the [Source Policy](PHILOSOPHY_SOURCE_FORMAT_POLICY.md) and
[`works_master.json`](../oizerman_markdown/metadata/works_master.json).

## Official Bibliography

| Field | Value |
|---|---|
| Provider | Institute of Philosophy, Russian Academy of Sciences |
| URL | https://iphras.ru/uplfile/rusph/biblio/oizerman_verst_1-122.pdf |
| Local PDF | `oizerman_markdown/bibliography/iphras_official_bibliography.pdf` |
| Extracted text | `oizerman_markdown/bibliography/iphras_official_bibliography.txt` (4,050 lines, UTF-8 `pdftotext`) |
| SHA-256 | `f0935bece0cac834a3c2b0e6ca42dc06b7dbab2d2b3d421317a0f9bdf666bc4d` |
| Download date | 2026-06-16 |

The bibliography mixes Oizerman's works, reviews about him, prefaces, and periodical articles;
machine parsing must distinguish responsibility types. An additional verification query is
`site:iphras.ru Ойзерман`.

## Main Scan And Text Leads

### Klex

- Author page: https://www.klex.ru/author/ojzerman/
- Known coverage includes selected works volumes 1-3, `Кант и Гегель`,
  `Теория познания Канта`, and `История диалектики. Немецкая классическая философия`.
- Confirmed pages:
  - `Избранные труды. Том 1. Возникновение марксизма`: https://www.klex.ru/ts6
  - `Возникновение марксизма`: https://www.klex.ru/hav

The single-volume work and selected-works volume must be distinguished by publication year,
publisher, pagination, cover, and volume statement.

### Koob

- Author page: https://www.koob.ru/ojzerman/
- Confirmed work pages:
  - https://www.koob.ru/ojzerman/filosofiya_kak_istoriya_filosofii
  - https://www.koob.ru/ojzerman/problemy_istor_filosof_nauki
  - https://www.koob.ru/ojzerman/glavnie_filosofskie_napravleniya
  - https://www.koob.ru/ojzerman/filosofiya_revolyutsiy
  - https://www.koob.ru/ojzerman/kratkiy_ocherk
  - https://www.koob.ru/ojzerman/razvitiye_marksistskoy_teorii

Koob pages may be descriptions or redirects rather than file hosts.

### Librusec

- Author page: https://librusec.pro/a/16395

FB2/EPUB/MOBI/HTML may aid source discovery but requires identity, completeness, and OCR-origin
checks. It does not replace the original scan.

## 2014 Five-Volume Selected Works

`Ойзерман Т. И. Избранные труды: в 5 томах`. Moscow: Наука, 2014.

| Volume | Main work | Status |
|---|---|---|
| 1 | `Возникновение марксизма` | 2014 DjVu preserved and registered |
| 2 | `Марксизм и утопизм` | 2014 DjVu preserved and registered |
| 3 | `Оправдание ревизионизма` | 2014 DjVu preserved and registered |
| 4 | `Кант и Гегель` | 2014 DjVu preserved and registered |
| 5 | `Метафилософия. Амбивалентность философии` | 2014 DjVu preserved and registered |

These rearranged selected-works volumes are not digitally identical to earlier stand-alone
editions. All remain `source_scan_unprocessed`.

## Four-Volume `Теория познания`

The collective work edited by Vladislav Lektorsky and Teodor Oizerman was downloaded on June 21,
2026 from direct PDF links referenced by Klex and registered as unprocessed scans:

| Volume | Subtitle | Year | Pages |
|---|---|---:|---:|
| 1 | `Домарксистская теория познания` | 1991 | 305 |
| 2 | `Социально-культурная природа познания` | 1991 | 481 |
| 3 | `Познание как исторический процесс` | 1993 | 400 |
| 4 | `Познание социальной реальности` | 1995 | 433 |

This is not a four-volume monograph co-authored by the editors. The official bibliography credits
Oizerman with `Введение` and `Принцип познаваемости мира` in volume 1 and
`Истина как гносеологическая проблема` in volume 2. No reliable native Markdown, genuine HTML, or
structured EPUB was found.

## Collection Priorities

1. Official bibliography: completed and used for the works registry.
2. 2014 volumes 1-5: scan collection completed; later work is edition verification or approved
   digitization.
3. History-of-philosophy theory: `Проблемы историко-философской науки`,
   `Главные философские направления`, `Философия как история философии`,
   `Диалектический материализм и история философии`, and
   `Основы теории историко-философского процесса`.
4. German classical philosophy: `Кант и Гегель`, `Теория познания Канта`,
   `Историко-философское учение Гегеля`, and
   `История диалектики. Немецкая классическая философия`.
5. Formation of Marxism: `Возникновение марксизма`, `Формирование философии марксизма`, and
   `Развитие марксистской теории на опыте революции 1848 года`.
6. Later reflection: `Марксизм и утопизм`, `Оправдание ревизионизма`, `Метафилософия`,
   `Амбивалентность философии`, `Размышления. Изречения`, and `Проблемы`.

## Rights

Oizerman died in 2017 and the works remain protected. The survey, official bibliography, factual
metadata, and reproducible tools may be preserved. PDF/DjVu files remain
`source_scan_unprocessed`, are not OCRed or indexed, and do not enter public export. Controlled,
encrypted, and `printdisabled` sources are bibliography only. Translations remain separate, and
edited or co-authored works retain accurate responsibility statements.

Verification sources also include `site:rusneb.ru Ойзерман` and
`site:search.rsl.ru Ойзерман`.

## 中文摘要

调查保存了奥伊泽尔曼官方书目、2014 年五卷本和其他未处理扫描件，并确认列克托尔斯基与
奥伊泽尔曼主编的四卷本《Теория познания》卷次为 1991、1991、1993、1995。扫描件不等于
正文数字化，现有来源也未声明明确开放许可，因此不进行 OCR、不进入 GBrain 或公开导出。
