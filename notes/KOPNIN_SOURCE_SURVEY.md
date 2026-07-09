---
title: "P. V. Kopnin Text Source Survey"
created: "2026-06-16"
updated: "2026-07-03"
type: "analysis"
tags: ["kopnin", "source-metadata", "dialectical-logic", "epistemology"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# P. V. Kopnin Text Source Survey

This document translates the existing survey and now records the first cross-person network
discovery pass for Soviet philosophy source leads.

## Identity And Findings

Pavel Vasilyevich Kopnin (Павел Васильевич Копнин, 1922-1971; P. V. Kopnin) worked on dialectical
logic, Marxist epistemology, logic of science, and methodology. Russian searches use
`П. В. Копнин`, `Копнин П. В.`, and exact titles.

- platona.net returned Cloudflare 403 responses to scripted access.
- The Klex-to-phantastike route lists five core Russian works.
- Four works were downloaded as unprocessed scans.
- The fifth, `Диалектика как логика и теория познания` (1973), was available only as `.doc`/`.zip`
  text and was not acquired.
- Accessible English co-authored translations were recorded but not downloaded.

See the [Source Policy](PHILOSOPHY_SOURCE_FORMAT_POLICY.md) and
[`works_master.json`](../kopnin_markdown/metadata/works_master.json).

## Network Discovery Round, 2026-07-03

The cross-person discovery pass created
[`soviet_philosophy_source_discovery.json`](../metadata/soviet_philosophy_source_discovery.json).
For Kopnin, the highest-value confirmed lead remains the `Диалектика как логика и теория познания`
gap:

- `https://www.klex.ru/26xx` returned HTTP 200 and is recorded as a Klex text/file lead for
  `dialektika-kak-logika-i-teoriya-poznaniya-1973`.
- The Klex page exposes Phantastike file routes for a ZIP
  (`dialekt_kak_logika_i_teoriya_poznaniya.zip`, 731,596 bytes) and DOC
  (`dialekt_kak_logika_i_teoriya_poznaniya.doc`, 2,100,224 bytes), plus the Koob author page
  `https://www.koob.ru/kopnin_p_v/`.
- The lead is not a scan and is not accepted as corpus text. It requires manual version,
  completeness, format-origin, and rights review before any ingestion.
- The Russian Wikipedia bibliography is useful only as a secondary checklist for titles such as
  `Диалектика как логика`, `Проблемы диалектики как логики и теории познания`, and other known gaps.

The lead is now mirrored in
[`works_master.json`](../kopnin_markdown/metadata/works_master.json) with
`source_gap_priority: priority_1_text_lead_review` and
`format_origin_status: non_scan_text_file_lead`.

## Text Lead Review Queue

This queue is a planning aid only. It does not authorize downloads, OCR, PDF/DjVu text-layer use,
or Markdown conversion.

| Priority | Work id | Lead | Reason | Next action |
|---|---|---|---|---|
| `priority_1_text_lead_review` | `dialektika-kak-logika-i-teoriya-poznaniya-1973` | Klex `26xx` -> Phantastike ZIP/DOC | Major missing monograph; available lead is text-file based rather than a source scan. | Manual version, completeness, format-origin, and rights review before any download or ingest. |

No files were downloaded, no PDF/DjVu text layer was read, no OCR was run, and no Markdown body text
was created in this round.

## Preserved Scans

| Klex | Work | Year | Format | Pages |
|---|---|---:|---|---:|
| 26xy | `Диалектика, логика, наука` (second collected volume, 29 articles) | 1973 | PDF | 464 |
| 26y1 | `Философские идеи В.И. Ленина и логика` | 1969 | DjVu | 485 |
| 26xz | `Гносеологические и логические основы науки` | 1974 | PDF | 566 |
| 26xw | `Гипотеза и ее роль в познании` | 1958 | DjVu | 42 |

The 1974 volume includes `Введение в марксистскую гносеологию` (1966) and
`Логические основы науки` (1968).

## Unresolved Gaps

- `Диалектика как логика и теория познания` (1973, Klex 26xx): Klex/phantastike provides only
  `.doc`/`.zip`; Twirpx file 1942998 requires credits; the marxistphilosophy.org Russian HTML mirror
  is unavailable.
- `Диалектика как логика` (1961), `Гипотеза и познание действительности` (1962),
  `Идея как форма мышления` (1963), and `Теория познания и кибернетика` (1964, Ukrainian).
- `Роль В.И. Ленина в развитии философии` (1970),
  `Ф. Энгельс и современные проблемы философии марксизма` (1971), and
  `В.И. Ленин и материалистическая диалектика` (1969).
- `Логика научного исследования` (1965, co-authored) and
  `Проблемы мышления в современной науке` (1964, edited).
- `Проблемы диалектики как логики и теории познания` (1982 posthumous selection) and volume 1 of
  `Избранные философские труды`.

## Restricted Or Blocked Sources

- platona.net: Cloudflare 403; two relevant books were obtained through Klex instead.
- twirpx.com files 1942998 and 466037: account/credit restrictions; not bypassed.
- koob.ru and search.rsl.ru: login/account restrictions; not bypassed.

## English Co-Authored Translations

| Work | URL | Status |
|---|---|---|
| *Themes in Soviet Marxist Philosophy* (1975), “Dialectical Logic” | https://www.bannedthought.net/MLM-Theory/Diamat/SovietPhilosophy/ThemesInSovietMarxistPhilosophy-EncyclopediaArticles-1975-OCR.pdf | accessible encyclopedia translation; not downloaded |
| *The Fundamentals of Marxist-Leninist Philosophy* (Progress, 1982) | https://archive.org/details/tfomlp | co-authored textbook; not downloaded |

These are translations and co-authored works, not Russian authorial originals.

## Rights

Kopnin died in 1971 and the works remain protected. Located sources state no open license.
Freely downloadable PDF/DjVu files remain `source_scan_unprocessed` under
`kopnin_markdown/source_scans/<provider>/`, with manifest records. They are not OCRed, indexed by
GBrain, or publicly exported. Controlled sources are bibliography only.
