---
title: "Scan Digitization Workflow"
created: "2026-06-21"
updated: "2026-07-27"
type: "project"
status: "approved-workflow-work-activated"
tags: ["source-scan", "ocr", "human-collation", "workflow"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Scan Digitization Workflow

This document defines conversion of PDF/DjVu scans into authorial-language Markdown. It implements,
but does not replace, the [Source And OCR Policy](PHILOSOPHY_SOURCE_FORMAT_POLICY.md).

**Status: approved workflow, activated per work.** Do not run OCR or use PDF text layers, DjVuTXT,
DjVu XML, ABBYY XML, or hOCR for a work until the owner explicitly activates that work.

Translation is separate; see [`TRANSLATION_PLAN.md`](../TRANSLATION_PLAN.md) and
[`translation_workspace/`](../translation_workspace/).

## 1. Admission States

### Unverified

Raw OCR, automated cleanup, and partially reviewed output remain isolated:

```yaml
text_role: "ocr_unverified"
core_corpus_eligible: "false"
llm_wiki_eligible: "false"
redistribution_approved: "false"
```

They do not enter author corpus directories or GBrain and must not be described as a verified
edition. Agreement between engines or model arbitration does not replace human verification.

### Human Verified

Authorial-language text may be promoted only after every source page has been compared and a
complete verification manifest has passed:

```yaml
text_role: "author_original"
text_status: "ocr_human_verified"
provenance: "ocr_initial_then_manual_collation_against_source_images"
core_corpus_eligible: "true"
llm_wiki_eligible: "true"
```

The earlier `ocr_draft_human_collated` status remains valid for recorded historical batches. New
digitization projects use `ocr_human_verified` after complete page-level human review.

Preserve the OCR origin, source SHA-256, reviewer, date, scope, and final Markdown SHA-256. Do not
represent OCR-derived text as HTML or native EPUB.

Schemas and stage validation exist, and processing requires work-level activation. Initialize with
`scripts/manage_collections.py init-digitization`.

## 2. Activation Requirements

Each work is activated separately. Its project record must establish:

- work, edition, authorial language, and processing scope;
- a `source_scan_unprocessed` file whose hash matches its manifest;
- lawful access without controlled lending, encryption, or `printdisabled` restrictions;
- absence of a better genuine HTML or native structured EPUB source;
- storage and expected volume of intermediate files;
- human review responsibility;
- engines, costs, privacy terms, and data-transfer conditions.

If any requirement is unmet, keep the file as an unprocessed scan.

## 3. Standard Workflow

Newly activated projects use `project.json` schema v2 and
`output_profile: "agent_canonical_markdown"`. Existing schema v1 projects continue under their
recorded legacy rules. The v2 workflow is:

source registration and activation → dual OCR or structured conversion → semantic normalization →
stable block IDs → source mapping and textual notes → page-by-page human review → automated quality
checks → owner handoff → promotion, commit, and recoverable cleanup.

### 3.1 Immutable Baseline

Keep the source file unchanged. Record its SHA-256, tool versions, date, and configuration in an
isolated work directory. Export DjVu pages directly at suitable quality; do not convert DjVu to PDF
merely for OCR. The project record must locate and verify intermediate pages and raw responses even
when they are stored outside Git.

### 3.2 Page Map

Create `page_map.json` before OCR. Distinguish file index, scan sequence, and printed page number.
Represent covers, blanks, unnumbered pages, Roman and Arabic sequences, inserts, omissions,
duplicates, binding errors, multiple offsets, and manual corrections. All later records use this
map.

### 3.3 Two Independent OCR Engines

Run two independent engines by page or by small batches with explicit page boundaries. Select
engines per work according to language, layout, reproducibility, cost, and data policy.

Keep outputs separate and record engine and version, prompt/configuration and SHA-256, input page
range and image hashes, raw output, execution time, and failures. Prompts may identify terminology
but must not invite reconstruction of unreadable content.

### 3.4 Difference Detection And Sampling

Align outputs by page and compare text, paragraphs, headings, notes, quotations, and symbols. Flag:

- missing or abnormally short pages or paragraphs;
- structural disagreement;
- character difference above the work-specific recorded threshold;
- suspected completion, summary, or rewriting.

Review every high-risk page and a reproducible random sample of low-risk pages. Record sample rate
and seed. A systematic error expands review or rejects the batch.

### 3.5 Human Review

The reviewer sees the scan and both raw outputs. Each correction records page ID, disagreement,
final text, reasoning, reviewer, and date. Mark unreadable content; do not guess. Models may suggest
readings but cannot make the final decision.

The reviewed body follows the agent-canonical profile: preserve all words, semantic paragraphs,
heading hierarchy, quotations, meaningful emphasis, note relationships, tables, formulas, and
references. Remove line-wrap artifacts, page-break hyphenation, running heads and footers,
non-semantic decoration, and OCR noise. Markdown footnote IDs are unique across the work and do not
imitate display numbers that restart on each page.

Correct an evident source typo in the canonical body only when the reading is unambiguous, and
record the source and canonical readings in `canonical_text_map.json`. Preserve an ambiguous
reading and record it as `uncertain_reading`; do not guess.

### 3.6 Canonical Blocks And Source Map

Place a stable marker such as `<!-- block-id: b0001 -->` immediately before every heading,
paragraph, quotation, list item, footnote, table, and formula. IDs are unique within the work and
must not be reused after later editorial changes.

Create `canonical_text_map.json` and map every block to one or more source locations. Scan
locators use page IDs present in `page_map.json`; structured-source locators use an HTML fragment or
EPUB location. The map binds the final Markdown path and SHA-256 and records only material textual
decisions:

- `source_typo`
- `source_anomaly`
- `uncertain_reading`
- `editorial_expansion`

Each textual note records its block ID, source reading, canonical reading, source location, and
rationale. Do not log ordinary whitespace, line-wrap, hyphenation, or layout cleanup item by item.
Page information belongs in the sidecar map: do not insert page-boundary comments inside a word,
sentence, or semantic block.

### 3.7 Automated Quality Report

Generate `quality_report.json` covering:

- missing, duplicate, or discontinuous file and printed pages;
- table-of-contents and body-heading correspondence;
- anomalous Cyrillic/Latin homoglyph mixing;
- note, table, formula, chemical notation, and special-symbol counts;
- structured volume/page citations;
- blank, short, duplicate, or apparently missing pages.

Multilingual quotations require language-aware checks or explicit allowlists.

### 3.8 Content And Structure Validation

Preserve raw engine output, human corrections, and clean text. Automated cleanup must produce a
reviewable diff. Compare page-level hashes or normalized diffs as well as structural counts.
Unexplained differences block chapter splitting.

### 3.9 Reversible Chapter Splitting

Split at real heading boundaries, never fixed byte or page counts. Chapters inherit source, role,
and rights fields and add `work_id`, three-digit `chapter_index`, `chapter_title`, and traceable page
boundaries. Each chapter stays under 500,000 UTF-8 bytes.

`work_manifest.json` records order, body boundaries, and SHA-256. Reversibility applies to the
defined body payload; generated front matter and wrappers are removed during reconstruction.

### 3.10 Isolated Storage

Passing automated checks does not imply complete human verification. Until every page is reviewed,
keep `ocr_unverified` output outside GBrain with both eligibility fields set to `false`.

### 3.11 Owner Review Handoff Copy

After the review draft and quality report are ready, create a new work-specific folder under the
project owner's `~/Downloads/` directory. Copy all of the following files into it:

- the registered source PDF, unchanged;
- the isolated Markdown file awaiting human review.
- `canonical_text_map.json`;
- a concise review note describing the agent-canonical rules, open textual questions, and the files
  that must be returned.

Use a stable folder name based on the author and work ID, preserve descriptive filenames, and
verify that each copy has the same SHA-256 as its repository source. Do not overwrite an existing
review folder without owner instruction.

The Downloads folder is a convenience packet for side-by-side review, not a source of record.
Corrections made to the copied Markdown do not change the repository draft until they are
explicitly reconciled. Creating the packet does not alter text status, eligibility, rights review,
or redistribution approval.

### 3.12 Promotion

Human review covers every scan page, not only risk and sample pages. The owner reviews the
verification manifest; machine checks must match source scan, final Markdown, page map, coverage,
canonical block map, quality report, and hashes before promotion. Every mapped scan page must be
included in the completed human verification scope. Only authorial-language texts may be promoted
to `author_original`; digitized research remains `text_role: "research"` and outside the core
corpus.

Any later body change invalidates the final hash and requires renewed verification. A partial edit
cannot silently retain whole-book verification.

### 3.13 Post-Commit Review Folder Cleanup

After the owner confirms that human review is complete:

1. compare the Markdown in the Downloads review folder with the repository draft and reconcile all
   owner edits before promotion;
2. complete the required verification records and repository checks;
3. commit the reviewed work as a logically scoped Git change;
4. only after the commit succeeds, confirm that the cleanup target exactly matches the
   work-specific folder recorded in `project.json`;
5. move that Downloads review folder to the system Trash and report both the commit and cleanup.

Never clean up the folder before the reviewed Markdown has been reconciled and the commit has
succeeded. If reconciliation, validation, or commit fails, retain the folder unchanged. Moving to
Trash is the default recoverable deletion method; permanent deletion requires a separate explicit
owner instruction.

### 3.14 Experimental Digitizable PDF Helper

`scripts/digitize_pdf_work.py` is an experimental, unstable helper for a narrow case: registered
PDFs that already have usable AI/Markdown conversions and can be checked against rendered page
images. It is part of the digitizable-PDF engineering workflow, not a stable replacement for the
scan OCR workflow above.

Use it only after the owner activates the specific work. The helper can prepare an isolated review
draft, preserve raw AI conversions, generate project records, and promote a human-approved draft to
verified research text. It must not be used to decide textual correctness, infer missing text, or
mark a work as verified without explicit human approval.

The helper is not designed for difficult image-only scans, complex page layouts, poor OCR images,
or works needing real OCR engine selection and page-level arbitration. Those remain under the
manual standard workflow until this experimental path is revised and stabilized.

Current commands:

```bash
python3 scripts/digitize_pdf_work.py prepare-review ...
python3 scripts/digitize_pdf_work.py promote-verified ... --human-verified
```

Promotion remains limited to `text_role: "research"` and `core_corpus_eligible: "false"` in this
experimental version. Authorial-original promotion must use the standard workflow unless a later,
reviewed version of the helper explicitly supports it.

## 4. Required Records

The implemented schemas cover:

- source scan manifest;
- `page_map.json`;
- `canonical_text_map.json`;
- two raw OCR streams and execution metadata;
- page-level diff and risk classification;
- `ocr_review_log.json`;
- `quality_report.json`;
- `work_manifest.json` and reversible body-payload verification;
- whole-book human verification manifest.

Schemas live under `metadata/schemas/`. `scripts/manage_collections.py check` validates stage
completeness. `scripts/prepare_gbrain_markdown.py` and manifest checks enforce text role and hashes.

## 5. Invariants

- No OCR without work-level activation.
- No controlled, encrypted, or access-bypassed source.
- No OCR in the corpus or GBrain before complete page-by-page review.
- Every human-review handoff includes matching PDF, Markdown, canonical map, and review note copies
  in a new work-specific `~/Downloads/` folder; those copies are non-authoritative.
- Owner confirmation that human review is complete authorizes reconciliation, validation, commit,
  and post-commit recoverable cleanup of only the exact work-specific review folder.
- Verified authorial-language OCR may enter the core only with permanent provenance.
- Cleanup cannot silently add, remove, summarize, translate, or modernize text.
- Chapter splitting must reconstruct the defined body payload.
- GBrain eligibility and redistribution permission remain independent.
