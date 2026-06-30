---
title: "Philosophical Text Source, OCR Admission, And Publication Policy"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["source-policy", "markdown", "source-scan", "ocr-gate", "copyright"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
directive_sha256: "bb2ba9f362cd2541db4edb880378e951c4211cb313850127a8bd00aa90959e1c"
directive_2_sha256: "71802c71bb8cf020cd0f482b79e310577ae8ac378b4cd01e6e0f17080521bad4"
directive_2_supplement_sha256: "0b669a0096597fba9a9910a1c986099a209b6087c3f4ad6089e4577aefa86b5c"
---

# Philosophical Text Source, OCR Admission, And Publication Policy

This policy applies to philosophical source texts, translations, textual witnesses, research,
source scans, and AI reference material. It replaces the former absolute OCR prohibition while
retaining the three directive hashes above as an audit record.

## Invariants

The core corpus admits only authorial text whose authority has been confirmed through human review.
Unreviewed OCR, scans, historical or modern translations, research, and AI output cannot use
`core_corpus_eligible: "true"`. OCR provenance must remain visible, but OCR origin alone is not a
permanent reason for rejection.

## Source Priority

| Priority | Source format | Treatment |
|---|---|---|
| 1 | Genuine HTML body text | Clean structure and convert to Markdown |
| 2 | Native structured EPUB | Convert by chapter |
| 3 | Freely and directly downloadable PDF | Preserve under `source_scans/`; do not extract body text |
| 4 | Freely and directly downloadable DjVu | Preserve under `source_scans/`; ignore derived text layers |
| Controlled | `inlibrary`, `printdisabled`, encrypted, or restricted sources | Bibliography only; do not bypass access controls |

An extension does not prove source quality. EPUB or HTML generated through hOCR, ABBYY, or another
recognition pipeline remains OCR-derived.

## OCR Admission Gate

1. OCR origin does not permanently disqualify a text; quality and verification records control
   admission.
2. Do not run OCR or use PDF text layers, DjVuTXT, DjVu XML, ABBYY XML, or hOCR until the project
   owner explicitly activates processing for a specific work.
3. Unverified OCR stays outside corpus directories and GBrain as `source_scan_unprocessed`.
4. Isolated OCR uses `text_role: "ocr_unverified"` with both eligibility fields set to `false`.
5. Authorial-language OCR may become `author_original` only after complete page-by-page human
   comparison, owner confirmation, and a valid manifest. OCR provenance remains permanent.
6. Follow [Scan Digitization Workflow](SCAN_DIGITIZATION_WORKFLOW.md). The workflow is active as a
   controlled work-level process; each work still requires explicit project activation before OCR.

### Verified OCR Admission

OCR-derived text may enter the archive only through a registered digitization project or a recorded
historical verification manifest. The early Ilyenkov newspaper batch is one verified batch, not the
limit of OCR activity in the project.

Verified authorial-language OCR that enters the core corpus uses:

```yaml
text_role: "author_original"
text_status: "ocr_human_verified"
provenance: "ocr_initial_then_manual_collation_against_source_images"
core_corpus_eligible: "true"
llm_wiki_eligible: "true"
```

Existing historical records may retain `text_status: "ocr_draft_human_collated"` when their
manifest preserves that status. Research texts digitized from PDF or image scans remain
`text_role: "research"` and cannot use `core_corpus_eligible: "true"`, even after human
verification. All verified OCR must preserve source hashes, reviewer, date, scope, final Markdown
SHA-256, and OCR provenance.

## Source Scans

Important PDF/DjVu files that are freely accessible without bypassing restrictions may be preserved:

- use `<author>_markdown/source_scans/<provider>/`, never a `*_md/` corpus directory;
- record title, author, publication year, edition, URL, download date, pages, bytes, SHA-256,
  format, and rights status in `metadata/source_scans_manifest.json`;
- use `text_status: "source_scan_unprocessed"`;
- set `core_corpus_eligible`, `llm_wiki_eligible`, and default `redistribution_approved` to `false`;
- do not read or publish embedded OCR derivatives.

Controlled loans and restricted files belong in `notes/CORPUS_GAPS.md`. A translated edition also
requires separate review of translator and edition rights.

## Corpus Front Matter

Corpus Markdown requires:

- `text_role`
- `core_corpus_eligible`
- `llm_wiki_eligible`
- `source_format`
- `source_license`
- `redistribution_approved`
- `rights_review_status`
- `text_status`
- `source_url`

Controlled `text_role` values are `author_original`, `historical_translation`, `text_witness`,
`modern_translation`, `research`, `ai_reference`, `source_scan_unprocessed`, and `ocr_unverified`.
Only `author_original` may enter the core corpus. Run
`python3 scripts/prepare_gbrain_markdown.py --check`.

Body text over 500,000 bytes is split at real heading boundaries with
`scripts/split_longform_markdown.py`. Chapters inherit all source, role, and rights fields and add
`work_id`, a three-digit `chapter_index`, and `chapter_title`. `work_manifest.json` records UTF-8
offsets and SHA-256 values; `.md.snapshot` and `.fulltext/` copies are excluded from GBrain and
public export. Byte-based hard splitting is prohibited.

## Rights And Public Release

Physical paths express authorship and text role, not copyright. Rights are controlled by
`source_license`, `rights_review_status`, `redistribution_approved`, and the export gate.

- Infrastructure, project-authored documentation, and factual metadata are public by default.
- Content-bearing JSON or similar derivatives are controlled content, not ordinary metadata.
- Availability online, a complaints process, or “research use” does not grant redistribution.
- Unknown rights use `not_stated`, `unreviewed`, and `redistribution_approved: "false"`.
- Controlled files require an exact path, SHA-256, basis, evidence, reviewer, and review date in
  `metadata/rights_registry.json`.
- A scan also requires matching approval in its source manifest.
- `llm_wiki_eligible: "true"` does not grant redistribution or model-training permission.
- GitHub publication uses only the `dist/public/` tree generated by `scripts/export_public.py`.
- `dist/public` has separate Git metadata under `dist/.public.git/`; publication verifies both
  remotes and uses a normal push.

## Gaps And Audit

Important works available only as scans, controlled loans, or inadequate sources are recorded in
`notes/CORPUS_GAPS.md` with importance, format, reason for absence, last check date, and source URL.
