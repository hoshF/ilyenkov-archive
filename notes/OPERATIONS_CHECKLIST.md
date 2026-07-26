---
title: "Operations Checklist"
created: "2026-06-26"
updated: "2026-07-27"
type: "project"
tags: ["operations", "checklist", "maintenance"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Operations Checklist

This checklist compresses common maintenance tasks into executable steps. The source of truth remains
[AGENTS.md](../AGENTS.md), [RESOLVER.md](../RESOLVER.md), [RIGHTS.md](../RIGHTS.md),
[PHILOSOPHY_SOURCE_FORMAT_POLICY.md](PHILOSOPHY_SOURCE_FORMAT_POLICY.md), and the relevant manifests.

## 1. Adding Corpus Markdown

Confirm first:

- The text belongs to a registered person and collection; add new people with
  `scripts/manage_collections.py add-person`.
- The text role is known; do not infer `text_role` from the directory name.
- Source format, source URL, edition/version statement, rights status, and `redistribution_approved`
  have evidence.
- Long works have been checked for heading-boundary splitting and `work_manifest.json` maintenance.

Allowed:

- Convert genuine HTML body text or native structured EPUB to Markdown while preserving provenance.
- Store source-confirmed, role-confirmed text in registered corpus paths.
- Promote OCR-derived Markdown only after the relevant digitization project or historical
  verification manifest has passed human-review and hash checks.
- Split works larger than 500,000 bytes with `scripts/split_longform_markdown.py`.

Forbidden:

- Mark modern translations, research, AI content, or unverified OCR as `author_original`.
- Generate corpus text from PDF text layers, DjVuTXT, ABBYY, hOCR, or image recognition output
  outside the activated digitization workflow.
- Duplicate corpus text into a second wiki, translation source, or temporary corpus tree.

Required checks:

```bash
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/split_longform_markdown.py --check
python3 scripts/manage_collections.py check
```

## 2. Adding Source Scans

Confirm first:

- The scan source is freely and directly downloadable without bypassing login, lending, encryption,
  or access controls.
- The target path is a registered `source_scans/` path or documented historical scan path.
- The manifest can record title, author, publication year, source URL, download date, pages, bytes,
  SHA-256, format, and rights status.
- Files above the project threshold include `large_file_review` with inclusion reason and storage
  decision.

Allowed:

- Preserve freely downloadable PDF/DjVu files as edition evidence.
- Register scans in `metadata/source_scans_manifest.json` with
  `text_status: "source_scan_unprocessed"`.
- Initialize a later digitization project record; OCR begins only after explicit work-level
  activation.

Forbidden:

- Put scans inside `*_md/` corpus directories.
- Read or ingest PDF/DjVu derived text layers.
- Run OCR without explicit work-level activation by the project owner.
- Treat local scan storage as digitization, human verification, or public redistribution approval.

Required checks:

```bash
python3 scripts/verify_corpus_manifests.py
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
```

## 3. Digitizing A Registered Source

Confirm first:

- The source and work-level digitization project are registered and explicitly activated.
- A better genuine HTML or native structured EPUB source is not available.
- New projects use `project.json` schema v2 with
  `output_profile: "agent_canonical_markdown"`.
- Human review responsibility, OCR or conversion tools, storage, costs, privacy, and data transfer
  have been approved.

Required sequence:

1. Preserve the source and establish `page_map.json`.
2. Produce two independent OCR streams, or retain the structured-source conversion evidence.
3. Normalize semantic Markdown and set
   `transcription_mode: "agent_canonical_markdown"`.
4. Add stable block IDs and complete `canonical_text_map.json`.
5. Review every source page and resolve or record textual questions.
6. Pass the automated quality report and collection, manifest, and GBrain checks.
7. Copy the source PDF, review Markdown, canonical map, and review note to a new recorded folder
   under `~/Downloads/`.
8. Reconcile the owner's reviewed files, promote, validate, and commit the scoped change.
9. Only after a successful commit and the owner's review-complete confirmation, move the exact
   recorded review folder to Trash.

Canonical Markdown preserves complete text and semantic structure, including headings, quotations,
meaningful emphasis, notes, tables, formulas, and references. It removes line-wrap and
page-hyphenation artifacts, running heads and footers, decorative layout, and OCR noise. It uses
unique Markdown footnote IDs. Evident source typos may be corrected only with a sidecar textual
note; ambiguous readings remain unchanged and are recorded. Page-boundary comments must not appear
inside words, sentences, or semantic blocks.

Required checks:

```bash
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/verify_corpus_manifests.py
```

## 4. Public Release

Confirm first:

- Whether each file is third-party source text, translation, scan, media, or content-bearing metadata.
- Controlled files have exact path and SHA-256 approval in `metadata/rights_registry.json`.
- Scans also have redistribution approval in their source manifest.
- The parent remote points to the private repository, and `dist/public/` is a separate Git worktree.

Allowed:

- Publish project-authored code, scripts, tests, schemas, original documentation, and factual
  metadata.
- Publish controlled files only after item-level rights registry approval.
- Preview inclusion and exclusion counts with `scripts/export_public.py --check`.

Forbidden:

- Publish the full working repository.
- Push the public repository by hand instead of using `scripts/publish_public.sh`.
- Treat `llm_wiki_eligible: "true"` as redistribution or model-training permission.
- Use the root `LICENSE` instead of item-level rights review for third-party material.

Required checks:

```bash
python3 scripts/manage_collections.py check
python3 scripts/check_project_docs.py
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/verify_corpus_manifests.py
python3 scripts/split_longform_markdown.py --check
python3 scripts/update_agents_guide.py --check
python3 scripts/check_glossaries.py --check
python3 scripts/render_glossaries.py --check
python3 -m unittest discover -s tests
python3 scripts/export_public.py --check
```

Publish only with:

```bash
scripts/publish_public.sh "publish: <message>"
```

## 5. Terminology And Proper Names

Confirm first:

- The entry belongs to a registered philosopher glossary under `<author_id>_markdown/metadata/`.
- The category is one of `person`, `work`, `concept`, `institution`, or `journal`.
- The status honestly reflects review state: `approved`, `provisional`, or `needs_review`.

Allowed:

- Add high-frequency proper names, works, journals, institutions, and philosophical concepts.
- Keep unsettled Chinese terms in the formal table when they are marked `needs_review`.
- Regenerate Markdown views from JSON source records.

Forbidden:

- Treat generated `notes/terminology/*.md` tables as the source of record.
- Mark a term `approved` when only automated extraction has identified it.

Required checks:

```bash
python3 scripts/render_glossaries.py --write
python3 scripts/render_glossaries.py --check
python3 scripts/check_glossaries.py --check
```

## 6. Chinese Translation Projects

Confirm first:

- The source is visible author-original corpus Markdown read by GBrain, not `.fulltext/`, a source
  snapshot, scan, or digitization isolation file.
- The binding targets corpus files indexed by GBrain, never a GBrain database record or model answer.
- Split chapter files and hashes agree with their `work_manifest.json`.
- The edition/version statement and semantic chapter boundaries have been checked by a human.
- The author glossary exists; same-author corpus evidence remains the primary comparison material.

Allowed:

- Inspect deterministic Markdown block numbers with `scripts/check_translations.py --inspect-source`.
- Initialize records with `scripts/manage_collections.py init-translation`.
- Bind one semantic unit to multiple ordered source segments when it crosses technical source splits.
- Select non-overlapping block ranges when semantic chapters do not match technical source splits.
- Keep partial work under `drafting`; bind completed human reviews to artifact scope hashes.

Forbidden:

- Copy the source corpus into the translation workspace.
- Treat a historical LaTeX/PDF project, an AI draft, or fluent Chinese as proof of review.
- Mark a project `reviewed` while blocking issues remain or review hashes are stale.
- Edit a derived LaTeX/PDF instead of returning the change to `final.md` and the review workflow.

Required checks:

```bash
python3 scripts/check_translations.py --check
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/check_glossaries.py --check
```
