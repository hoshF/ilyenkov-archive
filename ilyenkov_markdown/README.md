---
title: "Evald Ilyenkov Text Archive"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["project", "documentation"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Evald Ilyenkov Text Archive

This collection contains the central Evald Ilyenkov corpus, collection metadata, conversion tools,
and human verification records for historical newspaper texts. The files originated from earlier
web acquisition work and are now stored under the philosopher-specific standard root.

## Contents

- `ilyenkov_md/`: E. V. Ilyenkov Markdown texts, including verified historical newspaper texts.
- `scripts/`: conversion and audit tools used to build the collection.
- `metadata/`: manifests, source state, terminology records, verification records, and comparison
  reports.

The central registry records 275 corpus Markdown files for the Ilyenkov collection. This total
includes chapter files and other registered corpus documents; it is not equivalent to a count of
distinct published works.

## Historical Source And Citation Root

Much of the historical Ilyenkov collection originated from a `caute.ru` mirror. A. D. Maidansky
confirmed on June 17, 2026 that he no longer owns `caute.ru`. Current citations to texts from his
website should use `http://filorus.ru/ilyenkov` and add `(at the website by Andrey Maidansky)` after
the URL.

See [Maidansky Source Attribution](../notes/MAIDANSKY_SOURCE_ATTRIBUTION.md).

## Newspaper Verification Batch

Thirteen historical newspaper Markdown files originated through OCR and were subsequently collated
against the repository source images. The project owner confirmed that review on June 11, 2026.
They retain `ocr_initial_then_manual_collation_against_source_images` provenance and are admitted as
`author_original`.

Hashes and verification scope are recorded in
`metadata/ilyenkov_newspaper_human_verification_manifest.json`. New OCR-derived text must enter
through the active digitization workflow rather than this historical batch.

## Rights

Corpus eligibility and redistribution permission are separate. Files enter the public export only
when their exact path and SHA-256 have an approved record in the central rights registry.
