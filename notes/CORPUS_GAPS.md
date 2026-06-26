---
title: "Corpus Gaps Registry"
created: "2026-06-11"
updated: "2026-06-22"
type: "analysis"
tags: ["corpus", "gaps", "sources", "audit"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Corpus Gaps Registry

This table records important works that do not yet have acceptable corpus text. Preserved scans are
not verified digital text; `scan_only_unprocessed` items do not enter GBrain and do not trigger OCR.

Most recent external source review: 2026-06-11.

Local manifest status review: 2026-06-22. This review checked repository files and manifest status
only; it did not repeat web searches for missing sources.

## Kedrov

| Work | Importance | Current available format | Gap reason | Source |
|---|---|---|---|---|
| `Ленин и научные революции` | Important Kedrov monograph on Lenin, scientific revolutions, and method | IA PDF preserved; OCR EPUB not accepted | `scan_only_unprocessed` | [Internet Archive](https://archive.org/details/B-001-038-009-ALL) |
| `Фридрих Энгельс. Развитие его взглядов на диалектику естествознания` | Monograph on the development of Engels's views on the dialectics of natural science | IA PDF preserved | `scan_only_unprocessed` | [Internet Archive](https://archive.org/details/ao-114-friedrich-engels-developing-his-views-on-the-dialectic-of-natural-science-kedrov-1970) |
| `Единство диалектики, логики и теории познания` | Core work on the unity of dialectics, logic, and theory of knowledge | 2006 second-edition PDF preserved | `scan_only_unprocessed` | [Public Library](https://publ.lib.ru/ARCHIVES/K/KEDROV_Bonifatiy_Mihaylovich/_Kedrov_B.M..html) |
| `О методе изложения диалектики. Три великих замысла` | Study of Marx, Engels, and Lenin on systematic presentations of dialectics | 1983 PDF preserved | `scan_only_unprocessed` | [Klex](https://www.klex.ru/1of5) |
| `Диалектика и логика. Законы мышления` | Kedrov-edited collection on dialectical logic and laws of thought | 1962 DjVu preserved | `scan_only_unprocessed` | [Klex](https://www.klex.ru/g2i) |
| `Диалектика и логика. Формы мышления` | Companion volume to the laws-of-thought collection | 1962 PDF preserved | `scan_only_unprocessed` | [Klex](https://www.klex.ru/g2j) |
| `Проблемы логики и методологии науки: избранные труды` | Later selected works on logic and methodology of science | Google Books snippet only; no freely accessible complete HTML, native EPUB, PDF, or DjVu found | `no_acceptable_source` | [Google Books](https://books.google.com/books?id=e924AAAAIAAJ) |
| `Dialectique, logique, gnoseologie : leur unite` | French translation useful for terminology and reception history | IA controlled lending, `printdisabled` | `controlled_lending` | [Internet Archive](https://archive.org/details/dialectiquelogiq0000kedr) |

The six preserved files are recorded with page counts, byte counts, source URLs, and SHA-256 values
in `kedrov_markdown/metadata/source_scans_manifest.json`. All are
`redistribution_approved: "false"`.

## Spinoza

| Work or range | Importance | Current available format | Gap reason | Source |
|---|---|---|---|---|
| `Compendium Grammatices Linguae Hebraeae` | Spinoza's Hebrew grammar | Bruder 1846 volume III PDF and chapter-level scan structure preserved/located; no acceptable continuous web transcription | `scan_only_unprocessed` | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Benedicti_de_Spinoza_-_Opera_quae_supersunt_omnia_-_Carolus_Hermannus_Bruder_Vol_III_Tractatus_theologico-politicus._Compendium_grammatices_linguae_hebraeae,_1846.pdf) |
| `Epistolae` 38, 42, 43, 49, 69, 84 | Six gaps in the preferred Latin correspondence layer | Edition metadata and some page images exist, but no unified, verifiable continuous transcription | `no_acceptable_source` | [Spinoza Web](https://spinozaweb.org/) |
| Bruder `Opera quae supersunt omnia`, three volumes | Nineteenth-century edition useful for page and source checks | Three PDFs preserved in the compatibility path `spinoza_markdown/source_pdfs/` | `scan_only_unprocessed` | [Source notes](../spinoza_markdown/metadata/source_notes.md) |

## Maintenance Rules

- Add a row whenever an important work cannot enter the corpus, and record the latest review date.
- Do not download or bypass `controlled_lending`, encrypted, or access-controlled files.
- When a free scan is obtained, use `scan_only_unprocessed`; do not remove the gap until source text
  passes a separate approved verification workflow.
- Mark a gap resolved only after acceptable HTML/native EPUB has been converted and checked.
