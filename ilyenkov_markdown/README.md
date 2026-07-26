---
title: "Evald Ilyenkov Text Archive"
created: "2026-06-11"
updated: "2026-07-03"
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
- `ilyenkov_biography_md/`: memoirs, biography, and secondary research about Ilyenkov. These files
  are registered separately as research texts and do not enter the author-original core corpus.
- `source_scans/`: private unprocessed PDF/DjVu acquisitions for Ilyenkov biography and research
  references. These files are not searchable text, do not enter GBrain, and are not public-release
  approvals.
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

## Network Discovery Round, 2026-07-03

The cross-person discovery pass records Ilyenkov network leads in
[`soviet_philosophy_source_discovery.json`](../metadata/soviet_philosophy_source_discovery.json).
These leads are for relationship mapping and de-duplication, not immediate corpus admission:

- MIA's `Evald Ilyenkov Archive` is useful as an English translation and relationship map. It
  links Ilyenkov to Vygotsky, Feliks Mikhailov, Alexander Meshcheryakov, Geoff Pilling, Lenin,
  Hegel/Marx, and activity-theory contexts. Each item must be compared against existing Russian
  Markdown and reviewed for rights before any text-witness use.
- `caute.ru/ilyenkov/eng/texts.htm` remains a historical Reading Ilyenkov page with foreign-language
  files, MIA links, and secondary commentary links. For repository citations to the historical
  Maidansky source lineage, prefer `http://filorus.ru/ilyenkov` where an equivalent exists.
- `ilyenkovfriends.org` is a contemporary research, webinar, symposium, presenter, and secondary
  bibliography node. It is registered as an organization and project entry under the biography
  layer, not as an author-original corpus source.

No PDF/DjVu text layer was read, no OCR was run, and no scanned source was promoted to searchable
text in this round.

## Biography And Memoirs Layer

The `ilyenkov-biography` collection records memoirs, biographical writing, archival commentary, and
secondary research centered on Ilyenkov as a person. These files use `text_role: "research"`,
`core_corpus_eligible: "false"`, and `llm_wiki_eligible: "true"` unless a later policy says
otherwise.

The first converted set is *Эвальд Васильевич Ильенков в воспоминаниях* (М.: РГГУ, 2004), edited
and compiled by G. V. Lobastov. The source HTML is the `filorus.ru/ilyenkov/biog/rem/` edition, and
the local manifest is `metadata/ilyenkov_biography_manifest.json`. See
[`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](../notes/ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md) and the
ongoing [`ILYENKOV_BIOGRAPHY_PROJECT_PLAN.md`](../notes/ILYENKOV_BIOGRAPHY_PROJECT_PLAN.md).

The biography layer also records the International Friends of Ilyenkov organization page and the
A World to Win HTML article "A philosopher under suspicion" by Sergei Mareyev. Owner-provided
PDF/DjVu research acquisitions are preserved only as unprocessed scans in
`metadata/source_scans_manifest.json`; their original machine-local acquisition paths are not
recorded in project metadata.

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
