---
title: "Collection Architecture And Extension Guide"
created: "2026-06-21"
updated: "2026-07-01"
type: "project"
tags: ["collections", "architecture", "corpus", "maintenance"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Collection Architecture And Extension Guide

`metadata/collections.json` is the shared source of truth for people, collections, corpus paths,
scan manifests, and GBrain tracking roots. People and collections are separate records: one person
may have authorial texts, research texts, and source archives in different collections.

## Standard Person Layout

New people use:

```text
<author_id>_markdown/
├── README.md
├── <author_id>_md/
├── bibliography/
├── metadata/
│   ├── works_master.json
│   ├── glossary.json
│   └── source_scans_manifest.json
├── source_scans/
└── scripts/
```

Create the collection through the management command rather than copying a historical directory:

```bash
python3 scripts/manage_collections.py add-person \
  --id <author_id> \
  --name-zh <Chinese name> \
  --name-original <original-language name> \
  --name-latin <Latin-script name> \
  --relation <relationship to the project>
```

The command creates the layout and empty manifests, registers the person and collection, and
synchronizes `gbrain.yml` and `COLLECTION_STATUS.md`.

## Existing Layouts

- `ilyenkov_markdown/` contains the central Ilyenkov corpus, metadata, conversion scripts, and
  historical newspaper verification records.
- `maidansky_markdown/` contains both the Maidansky research corpus and the Academia.edu source
  archive. These are separate registered collections under one philosopher root.
- `spinoza_markdown/source_pdfs/` is a historical scan path retained for compatibility.
- `spinoza_markdown/cache/` is a reproducible acquisition cache. It is excluded from corpus
  statistics and public export.

Current philosopher roots use `layout: "standard"` in the registry. Historical acquisition facts,
including the earlier `caute.ru` source context, belong in attribution and source-survey records
rather than in mixed corpus directory names.

## Synchronization And Validation

```bash
python3 scripts/manage_collections.py sync
python3 scripts/manage_collections.py check
```

`sync` regenerates the collection status page and managed GBrain roots. `check` validates the
registry, paths, digitization projects, and translation projects.

Terminology and proper-name records live in each philosopher root at `metadata/glossary.json`.
Rendered Chinese views live under `notes/terminology/` and are regenerated with
`scripts/render_glossaries.py`; validate them with `scripts/check_glossaries.py --check`.

A newly added scan larger than 75 MiB requires `large_file_review` in its manifest, including
manual review, a reason for inclusion, and a storage decision. Existing Git history is not migrated
to Git LFS.

## Digitization And Translation

Digitization projects live under `<author_root>/digitization/<work_id>/` and are initialized only
through `manage_collections.py init-digitization`. Initialization records a project but does not run
OCR. Digitization workspaces are hidden from GBrain and excluded from public export.

`scripts/digitize_pdf_work.py` is an experimental helper for digitizable PDFs with existing
AI/Markdown conversions. It can prepare a review draft and, after explicit human verification,
generate the promotion records for research texts. The helper is unstable, not a general scanned-PDF
OCR system, and does not replace the owner’s page-level verification decision.

Chinese translation and close reading use:

```text
translation_workspace/<stage>/<author_id>/<work_id>/
```

Each project keeps `translation.json` with the source path, version, and SHA-256. The schema and
template are `metadata/schemas/translation_project.schema.json` and
`translation_workspace/templates/translation.json`.
