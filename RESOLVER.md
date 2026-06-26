---
title: "Corpus Resolver"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["corpus", "resolver", "gbrain"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Corpus Resolver

This file routes GBrain, other LLM tools, and researchers to the correct corpus layer. Determine the
text role before choosing a directory. `metadata/collections.json` is the machine-readable source
of truth for people and paths.

## Routing

| Need | Preferred location | Text role |
|---|---|---|
| Ilyenkov's works | `caute_ru_markdown/ilyenkov_md/` | Russian authorial text |
| Maidansky research and edition notes | `caute_ru_markdown/maidansky_md/` | Secondary research |
| Spinoza works | `spinoza_markdown/spinoza_md/` | Authorial-language text or marked historical witness |
| Kedrov works | `kedrov_markdown/kedrov_md/` | Russian text converted from HTML |
| Oizerman and Kopnin | Their `metadata/` and `source_scans/` | Bibliography and unprocessed scans |
| Unprocessed scans | `<author>_markdown/source_scans/` | Edition evidence, not searchable text |
| Source, rights, and coverage records | Collection `metadata/` directories | Metadata and audit |
| Project research notes | `notes/` | Notes and methods |
| Chinese translation work | `translation_workspace/`, `existing_translations/` | Translation layer |
| Digitization workspace | `<author_root>/digitization/<work_id>/` | Excluded from GBrain and public export |

## Conflict Rules

1. Prefer authorial-language text over modern translation.
2. When multiple sources exist, inspect edition, provenance, license, and `text_status`.
3. Use `spinoza_markdown/metadata/preferred_sources.json` for Spinoza source selection.
4. Prefer genuine HTML or native structured EPUB. Do not generate text from OCR, DjVuTXT, ABBYY,
   hOCR, PDF text layers, or image recognition unless the digitization workflow is activated.
5. Freely downloadable PDF/DjVu may be stored as scans; controlled loans are bibliography only.
6. `ocr_unverified` remains isolated. The thirteen historical newspaper texts are a documented,
   human-collated exception with retained OCR provenance.
7. Do not describe unverified web transcription or AI output as a critical edition.
8. Do not duplicate the corpus into a second wiki or translation-source tree.
9. `caute_ru_markdown/` is a historical path. Current Maidansky-site citations use
   `http://filorus.ru/ilyenkov/... (at the website by Andrey Maidansky)`.
10. Register all new people and corpus paths in `metadata/collections.json`, then run
    `manage_collections.py sync`.

See [Source Policy](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md).
