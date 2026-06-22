---
title: "Spinoza Original-Language Markdown Archive"
created: "2026-06-11"
type: "project"
tags: ["project", "documentation"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Spinoza Original-Language Markdown Archive

This directory is a reproducible source archive for original-language Spinoza texts, modeled after the `caute_ru_markdown/` workflow used for Ilyenkov.

## Contents

- `spinoza_md/latin_web/spinozaetnous/` - preferred Latin web transcriptions from Spinoza et Nous.
- `spinoza_md/latin_web/spinozaetnous/epistolae/` - individual letter Markdown files.
- `spinoza_md/latin/` - independent Latin Wikisource backup layer.
- `spinoza_md/dutch/` - Dutch Markdown text fetched from DBNL.
- `spinoza_md/dutch_web/nlwikisource/` - surviving Dutch web texts, including the `Korte Verhandeling`.
- `source_pdfs/` - all three volumes of Bruder's 1843-1846 edition, retained only for reference and collation.
- `metadata/` - source manifests, conversion state, preferred-source mapping, structured Ethics data, and audits.
- `scripts/` - web fetch, conversion, structure, and audit scripts.
- `cache/` - cached source responses used by the scripts.

## Source Strategy

### Public Redistribution

Project infrastructure and factual metadata are public by default. Selected source texts are
released only after exact-file rights review. The first approved group consists of five Latin
Wikisource Markdown files, the Dutch Wikisource `Korte Verhandeling`, DBNL's 97 chapter files for
the 1677 `Nagelate schriften`, and the content-bearing `metadata/ethica_elements.json`.

Wikisource transcriptions retain CC BY-SA 4.0 attribution and share-alike requirements. DBNL labels
the 1677 source `Auteursrechtvrij`; DBNL remains credited as the digital source. Redistribution
approval records a rights decision, not a claim of complete collation or critical-edition status.
Spinoza et Nous files remain outside the public export because their source terms include a
non-commercial restriction.

### Corpus Principle

The strict core corpus identifies texts in the language in which Spinoza composed them. The broader LLM wiki also includes auditable contemporary or early translations, manuscripts, and historical textual witnesses. These sources are historically relevant and usable for research, but they are never relabeled as authorial-language originals. Modern Chinese, English, and other later translations are outside the default source corpus.

For LLM wiki use, the source hierarchy is:

1. Authorial-language text with an auditable edition or transcription.
2. Contemporary or early manuscript, translation, or textual witness, clearly marked as such and included in the LLM wiki.
3. Modern translations, kept outside the default LLM wiki source corpus.
4. AI translations and explanations, generated from and linked back to the source text.
5. PDF scans, retained as unprocessed reference files outside the Markdown corpus and excluded from GBrain.

AI is used to compare the whole corpus, trace terminology, and generate contextual translations. It does not change a translation into an original text, and its output must remain traceable to source passages and versions. The repository-wide rationale is documented in `notes/ORIGINAL_LANGUAGE_AI_READING.md`.

### Acquisition Strategy

The archive uses auditable HTML/XML/TEI web transcriptions. No new OCR processing is currently authorized:

- Preferred Latin source text: Spinoza et Nous via the MediaWiki API.
- Independent Latin backup: Latin Wikisource via the MediaWiki API.
- Dutch textual witnesses: DBNL `Nagelate schriften` TEI XML and the surviving Dutch `Korte Verhandeling`, both explicitly classified by their relation to the lost or Latin authorial text.
- Scan reference: the three Bruder volumes, Gebhardt 1925 `Spinoza Opera`, and 1677 `Opera posthuma` / `Nagelate Schriften`.
- Structure references: EthicaDB, Spinoza's Ethics 2.0, and Spinoza Web.

Spinoza et Nous requires attribution and permits non-commercial use only. This repository's generated web layer is intended for public, non-commercial research and LLM wiki use. It is not a scholarly critical edition.

The Bruder PDFs remain available only for manual page-level comparison and provenance. The historical `source_pdfs/` path is retained for compatibility; new scan collections use `source_scans/`. These PDFs are not OCRed or otherwise converted into Markdown.

## Commands

```bash
python3 spinoza_markdown/scripts/spinoza_wikisource_convert.py --dry-run
python3 spinoza_markdown/scripts/spinoza_wikisource_convert.py --rebuild-manifest --resume
python3 spinoza_markdown/scripts/spinoza_dbnl_convert.py --resume
python3 spinoza_markdown/scripts/spinoza_nl_wikisource_convert.py --dry-run
python3 spinoza_markdown/scripts/spinoza_nl_wikisource_convert.py --resume
python3 spinoza_markdown/scripts/spinoza_spinozaetnous_convert.py --dry-run
python3 spinoza_markdown/scripts/spinoza_spinozaetnous_convert.py --rebuild-manifest --resume
python3 spinoza_markdown/scripts/spinoza_spinozaetnous_convert.py --resume
python3 spinoza_markdown/scripts/spinoza_ethica_structure.py
python3 spinoza_markdown/scripts/audit_spinoza_sources.py
```

## Metadata

Each Markdown file starts with YAML-style front matter:

- `id`
- `author`
- `title`
- `language`
- `source_url`
- `source_site`
- `source_revision_id` or `source_file_id`
- `source_license`
- `work_year`
- `conversion_date`
- `text_status`

When relevant, files also record `text_role`, `original_language_status`, `core_corpus_eligible`, and `llm_wiki_eligible`. The first eligibility field is strict; the second includes historically attested early translations and textual witnesses.

`web_transcription_*_unverified` means the web transcription has not been fully checked against a scan or critical edition. `partial_web_transcription` means that the source itself does not provide complete coverage.

## Current Scope

The first-stage target texts are:

- `Ethica`
- `Tractatus theologico-politicus`
- `Tractatus Politicus`
- `Tractatus de intellectus emendatione`
- `Epistolae`
- `Renati Descartes principia philosophiae`
- `Cogitata metaphysica`
- `Compendium Grammatices Linguae Hebraeae`
- `Korte Verhandeling van God, de mensch en deszelvs welstand`
- DBNL `Nagelate schriften`

The Spinoza et Nous web layer currently supplies the first seven Latin groups above. Its `Epistolae` contains 78 regular numbers plus `12 bis` and `67 bis`; source numbers 38, 42, 43, 49, 69, and 84 are absent, so the collection is explicitly marked partial.

The surviving Dutch `Korte Verhandeling` is generated from the complete Dutch Wikisource transcription linked to manuscript KB 75 G 15. It is generally considered a Dutch translation of a lost Latin original, so the archive does not label Dutch as a securely established authorial language for this work.

No complete non-OCR web transcription has been accepted for `Compendium Grammatices Linguae Hebraeae`. The Bruder volume III PDF and the Herzog August Bibliothek's chapter-level TEI scan structure are retained, but no Markdown body is generated.

`metadata/spinoza_gap_manifest.json` records unresolved source gaps. `Ultimi barbarorum` is classified as a reported, lost placard phrase rather than a surviving independent work.
