---
title: "Spinoza Original-Language Markdown Archive"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["project", "documentation"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Spinoza Original-Language Markdown Archive

This reproducible collection preserves original-language Spinoza texts, early textual witnesses,
source metadata, and reference scans relevant to Ilyenkov research.

## Contents

- `spinoza_md/latin_web/spinozaetnous/`: preferred Latin web transcriptions from Spinoza et Nous.
- `spinoza_md/latin/`: independent Latin Wikisource layer.
- `spinoza_md/dutch/`: Dutch text from DBNL's `Nagelate schriften`.
- `spinoza_md/dutch_web/nlwikisource/`: Dutch Wikisource texts, including
  `Korte Verhandeling`.
- `source_pdfs/`: historical scan path retained for compatibility and manual collation.
- `metadata/`: manifests, preferred-source mappings, structured Ethics data, gaps, and audits.
- `scripts/`: acquisition, conversion, structure, and audit tools.
- `cache/`: reproducible acquisition cache, excluded from corpus statistics and public export.

## Source Hierarchy

1. Authorial-language text with an auditable edition or transcription.
2. Contemporary or early translation, manuscript, or textual witness, explicitly classified.
3. Modern translations outside the default source corpus.
4. AI translations or explanations linked back to source passages and versions.
5. Unprocessed scans outside the Markdown corpus and GBrain.

The collection does not turn a translation into an original text. See
[Original-Language AI Reading](../notes/ORIGINAL_LANGUAGE_AI_READING.md).

## Acquisition And Verification

The archive uses auditable HTML, XML, TEI, and MediaWiki sources. No new OCR is authorized.

- Spinoza et Nous supplies seven main Latin groups and a partial `Epistolae`.
- Latin Wikisource provides an independent source layer.
- DBNL provides the 1677 `Nagelate schriften` TEI text.
- Dutch Wikisource provides the surviving `Korte Verhandeling`.
- Bruder, Gebhardt, `Opera posthuma`, and `Nagelate Schriften` scans remain reference material.

`web_transcription_*_unverified` means a web transcription has not been fully collated against a
scan or critical edition. `partial_web_transcription` means the source itself is incomplete.

## Public Redistribution

The currently approved public group contains five Latin Wikisource Markdown files, one Dutch
Wikisource `Korte Verhandeling`, 97 DBNL chapter files, and
`metadata/ethica_elements.json`: 104 controlled files in total.

Wikisource transcriptions retain CC BY-SA 4.0 attribution and share-alike requirements. DBNL labels
the 1677 source `Auteursrechtvrij` and remains credited as the digital source. Spinoza et Nous files
remain excluded because their terms include a non-commercial restriction. Approval does not imply
complete collation or critical-edition status.

## Current Scope

The collection tracks:

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

The Spinoza et Nous `Epistolae` contains 78 regular numbers plus `12 bis` and `67 bis`; source
numbers 38, 42, 43, 49, 69, and 84 are absent. No complete non-OCR web transcription has been
accepted for `Compendium Grammatices Linguae Hebraeae`.

`metadata/spinoza_gap_manifest.json` records unresolved gaps. `Ultimi barbarorum` is treated as a
reported lost placard phrase rather than a surviving independent work.

## Reproduction

Use the scripts under `spinoza_markdown/scripts/` for source-specific rebuilds, then run:

```bash
python3 spinoza_markdown/scripts/audit_spinoza_sources.py
python3 scripts/prepare_gbrain_markdown.py --check
```
