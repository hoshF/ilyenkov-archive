---
title: "Ilyenkov / Maidansky Markdown Archive"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["project", "documentation"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Ilyenkov / Maidansky Markdown Archive

This historical collection contains the central Ilyenkov corpus and a related Maidansky research
collection. It was merged from the earlier Codex workspace at
`/Users/hoshf/Documents/Codex/2026-06-07/http-caute-ru-ilyenkov-texts-dla`.

## Contents

- `ilyenkov_md/`: E. V. Ilyenkov Markdown texts, including verified historical newspaper texts.
- `maidansky_md/`: A. D. Maidansky research and related philosophical texts.
- `scripts/`: conversion and audit tools used to build the collection.
- `metadata/`: manifests, source state, verification records, and comparison reports.

The central registry records 275 corpus Markdown files for the Ilyenkov collection and 66 for the
Maidansky research collection. These totals include chapter files and other registered corpus
documents; they are not equivalent to counts of distinct published works.

## Historical Path And Citation Root

The directory name records the archive's original `caute.ru` acquisition path and must not be
renamed. A. D. Maidansky confirmed on June 17, 2026 that he no longer owns `caute.ru`. Current
citations to texts from his website should use `http://filorus.ru/ilyenkov` and add
`(at the website by Andrey Maidansky)` after the URL.

See [Maidansky Source Attribution](../notes/MAIDANSKY_SOURCE_ATTRIBUTION.md).

## Newspaper Verification Exception

Thirteen historical newspaper Markdown files originated through OCR and were subsequently collated
against the repository source images. The project owner confirmed that review on June 11, 2026.
They retain `ocr_initial_then_manual_collation_against_source_images` provenance and are admitted as
`author_original`.

Hashes and verification scope are recorded in
`metadata/ilyenkov_newspaper_human_verification_manifest.json`. This documented exception does not
authorize new OCR runs.

## Rights

Corpus eligibility and redistribution permission are separate. Files enter the public export only
when their exact path and SHA-256 have an approved record in the central rights registry.
