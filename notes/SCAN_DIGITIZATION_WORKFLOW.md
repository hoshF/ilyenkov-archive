---
title: "Scan Digitization Workflow"
created: "2026-06-21"
updated: "2026-06-22"
type: "project"
status: "approved-design-not-activated"
tags: ["source-scan", "ocr", "human-collation", "workflow"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Scan Digitization Workflow

This document defines conversion of PDF/DjVu scans into authorial-language Markdown. It implements,
but does not replace, the [Source And OCR Policy](PHILOSOPHY_SOURCE_FORMAT_POLICY.md).

**Status: approved design, not activated.** Do not run OCR or use PDF text layers, DjVuTXT, DjVu
XML, ABBYY XML, or hOCR until the owner explicitly activates a specific work.

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
text_status: "ocr_draft_human_collated"
provenance: "ocr_initial_then_manual_collation_against_source_images"
core_corpus_eligible: "true"
llm_wiki_eligible: "true"
```

Preserve the OCR origin, source SHA-256, reviewer, date, scope, and final Markdown SHA-256. Do not
represent OCR-derived text as HTML or native EPUB.

Schemas and stage validation exist, but processing still requires explicit approval. Initialize
with `scripts/manage_collections.py init-digitization`.

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

### 3.6 Automated Quality Report

Generate `quality_report.json` covering:

- missing, duplicate, or discontinuous file and printed pages;
- table-of-contents and body-heading correspondence;
- anomalous Cyrillic/Latin homoglyph mixing;
- note, table, formula, chemical notation, and special-symbol counts;
- structured volume/page citations;
- blank, short, duplicate, or apparently missing pages.

Multilingual quotations require language-aware checks or explicit allowlists.

### 3.7 Content And Structure Validation

Preserve raw engine output, human corrections, and clean text. Automated cleanup must produce a
reviewable diff. Compare page-level hashes or normalized diffs as well as structural counts.
Unexplained differences block chapter splitting.

### 3.8 Reversible Chapter Splitting

Split at real heading boundaries, never fixed byte or page counts. Chapters inherit source, role,
and rights fields and add `work_id`, three-digit `chapter_index`, `chapter_title`, and traceable page
boundaries. Each chapter stays under 500,000 UTF-8 bytes.

`work_manifest.json` records order, body boundaries, and SHA-256. Reversibility applies to the
defined body payload; generated front matter and wrappers are removed during reconstruction.

### 3.9 Isolated Storage

Passing automated checks does not imply complete human verification. Until every page is reviewed,
keep `ocr_unverified` output outside GBrain with both eligibility fields set to `false`.

### 3.10 Promotion

Human review covers every scan page, not only risk and sample pages. The owner reviews the
verification manifest; machine checks must match source scan, final Markdown, page map, coverage,
and hashes before promotion to `author_original`.

Any later body change invalidates the final hash and requires renewed verification. A partial edit
cannot silently retain whole-book verification.

## 4. Required Records

The implemented schemas cover:

- source scan manifest;
- `page_map.json`;
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
- Verified authorial-language OCR may enter the core only with permanent provenance.
- Cleanup cannot silently add, remove, summarize, translate, or modernize text.
- Chapter splitting must reconstruct the defined body payload.
- GBrain eligibility and redistribution permission remain independent.
