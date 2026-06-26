---
title: "Bonifaty Kedrov Philosophy Text Archive"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["kedrov", "philosophy", "russian", "source-archive"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Bonifaty Kedrov Philosophy Text Archive

This collection preserves philosophical texts and provenance metadata for Bonifaty Mikhailovich
Kedrov (Бонифатий Михайлович Кедров).

## Contents

- `kedrov_md/russian_web/royallib/`: Russian Markdown converted from genuine RoyalLib HTML.
- `kedrov_md/russian_web/royallib/assets/`: body images from the HTML packages.
- `source_scans/`: unprocessed, directly downloadable PDF/DjVu files.
- `metadata/royallib_manifest.json`: source URLs, hashes, outputs, and conversion status.
- `metadata/source_scans_manifest.json`: scan editions, URLs, hashes, and rights status.
- `scripts/kedrov_royallib_convert.py`: reproducible HTML acquisition and conversion.

The initial Markdown group contains:

- `Беседы о диалектике`
- `О «Диалектике природы» Энгельса`
- `О творчестве в науке и технике`

## Source And Rights Policy

The collection follows the repository
[Source Policy](../notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md):

- prefer genuine HTML or native structured EPUB;
- do not generate text through new OCR, DjVuTXT, ABBYY, hOCR, or PDF text layers;
- retain directly downloadable PDF/DjVu as unprocessed scans;
- record controlled loans as bibliography only.

RoyalLib states no clear open license. Generated files retain `source_license: "not_stated"` and
`redistribution_approved: "false"`. They may support private research, search, and source
assessment, but are not presented as a critical edition or approved public text.

## Reproduction

```bash
python3 kedrov_markdown/scripts/kedrov_royallib_convert.py
python3 kedrov_markdown/scripts/kedrov_royallib_convert.py --check
```
