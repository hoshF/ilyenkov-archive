---
title: "Collection Architecture And Extension Guide"
created: "2026-06-21"
updated: "2026-06-22"
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

## Historical Layouts

- `caute_ru_markdown/` contains both Ilyenkov source text and Maidansky research text. Do not rename
  it.
- `maidansky_markdown/` is an Academia.edu source archive, not a duplicate of the research corpus.
- `spinoza_markdown/source_pdfs/` is a historical scan path retained for compatibility.
- `spinoza_markdown/cache/` is a reproducible acquisition cache. It is excluded from corpus
  statistics and public export.

Historical collections use `layout: "legacy"` in the registry. Shared tools support these paths
without moving them.

## Synchronization And Validation

```bash
python3 scripts/manage_collections.py sync
python3 scripts/manage_collections.py check
```

`sync` regenerates the collection status page and managed GBrain roots. `check` validates the
registry, paths, digitization projects, and translation projects.

A newly added scan larger than 75 MiB requires `large_file_review` in its manifest, including
manual review, a reason for inclusion, and a storage decision. Existing Git history is not migrated
to Git LFS.

## Digitization And Translation

Digitization projects live under `<author_root>/digitization/<work_id>/` and are initialized only
through `manage_collections.py init-digitization`. Initialization records a project but does not run
OCR. Digitization workspaces are hidden from GBrain and excluded from public export.

Chinese translation and close reading use:

```text
translation_workspace/<stage>/<author_id>/<work_id>/
```

Each project keeps `translation.json` with the source path, version, and SHA-256. The schema and
template are `metadata/schemas/translation_project.schema.json` and
`translation_workspace/templates/translation.json`.
