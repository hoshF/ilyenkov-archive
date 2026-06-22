---
title: "Ilyenkov / Maidansky Markdown Archive"
created: "2026-06-11"
type: "project"
tags: ["project", "documentation"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Ilyenkov / Maidansky Markdown Archive

This directory was merged from the Codex workspace:

`/Users/hoshf/Documents/Codex/2026-06-07/http-caute-ru-ilyenkov-texts-dla`

## Contents

- `ilyenkov_md/` — converted E.V. Ilyenkov Markdown texts, including newspaper Markdown and source images.
- `maidansky_md/` — converted A.D. Maidansky Markdown texts.
- `scripts/` — conversion and audit scripts used to build the archive.
- `metadata/` — manifests, state files, and comparison reports.

## Current Citation Root

This archive was originally harvested from `caute.ru`; the path name is retained for audit stability. A.D. Maidansky confirmed on 2026-06-17 that he no longer owns `caute.ru`. Current citations to texts from his website should use `http://filorus.ru/ilyenkov` and add `(at the website by Andrey Maidansky)` after the URL. See `../notes/MAIDANSKY_SOURCE_ATTRIBUTION.md`.

## Current Counts

- Ilyenkov Markdown files: 130
- Newspaper source images: 13
- Maidansky Markdown files: 57

The source conversion state and manifests are preserved in `metadata/` so the archive can be audited or resumed later.

The 13 newspaper Markdown files are a legacy OCR exception. The project owner confirmed on 2026-06-11 that each text was collated against its repository image. They use `author_original`, enter the core corpus, and retain `ocr_initial_then_manual_collation_against_source_images` provenance. File hashes and verification scope are recorded in `metadata/ilyenkov_newspaper_human_verification_manifest.json`. This exception does not authorize new OCR runs.
