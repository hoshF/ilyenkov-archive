---
title: "Ilyenkov Repository AI Operations Guide"
created: "2026-06-17"
updated: "2026-07-27"
type: "agent-guide"
tags: ["agents", "entry-point", "navigation", "read-on-demand"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Ilyenkov Repository AI Operations Guide

> This is the single authoritative entry point for AI and agent work in this repository. Do not
> read the whole repository, source scans, `.fulltext/` copies, or large historical documents just
> to "understand everything"; locate the task-specific source of truth first.

## 1. Project And Sources Of Record

This repository is a multi-philosopher text archive centered on Evald Ilyenkov. It supports a
global source-text digitization and research platform, while the Chinese translation and
close-reading program remains a distinct translation layer.

Sources of record, in priority order:

1. Corpus Markdown, `work_manifest.json`, and Git history.
2. `metadata/collections.json`, author `works_master` files, scan manifests, and provenance records.
3. Generated status pages such as `COLLECTION_STATUS.md`.
4. GBrain databases, model answers, and AI reference material; these are derived layers and must
   not override source records.

## 2. Fixed Reading Order

1. Read this guide first.
2. Check `COLLECTION_STATUS.md`, or go directly to the task-specific guide.
3. Check the collection `README.md`, works master file, or source manifest.
4. For long works, read `work_manifest.json` before opening required `*-chNNN.md` chapter files.
5. Open only the files needed for the task; do not read `.fulltext/` copies.

## 3. Task Navigation

| Task | Primary entry | Note |
|---|---|---|
| Current people, collection, and work status | [COLLECTION_STATUS.md](COLLECTION_STATUS.md), [WORK_STATUS.md](WORK_STATUS.md) | Generated; query `metadata/work_status.json`; do not edit by hand |
| Add a person or collection | [notes/COLLECTION_ARCHITECTURE.md](notes/COLLECTION_ARCHITECTURE.md) | Use `manage_collections.py add-person` |
| Resolve directories and `text_role` | [RESOLVER.md](RESOLVER.md) | Do not infer text identity from directory names |
| Whole-work reading copies | [.fulltext/README.md](.fulltext/README.md) | Version-controlled but **not a source of record**; excluded from GBrain and public export. Verify with `split_longform_markdown.py --check` |
| Source and corpus policy | [notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md) | Authoritative front matter rules |
| Scan digitization | [notes/SCAN_DIGITIZATION_WORKFLOW.md](notes/SCAN_DIGITIZATION_WORKFLOW.md) | OCR only for registered, activated works |
| GBrain / LLM Wiki | [LLM_WIKI.md](LLM_WIKI.md) | Use the wrapper scripts |
| Terminology and proper names | [notes/TERMS.md](notes/TERMS.md) | JSON source records generate Markdown views |
| Article translation review and publishing | [translation_workspace/ARTICLE_REVIEW_WORKFLOW.md](translation_workspace/ARTICLE_REVIEW_WORKFLOW.md) | Fast path for source/translation/suggestion batches; does not create formal review status |
| Terminology review history | [translation_workspace/TERMINOLOGY_CHANGELOG.md](translation_workspace/TERMINOLOGY_CHANGELOG.md) | Generated compact index; query structured batches instead of reading all history |
| Chinese translation plan | [TRANSLATION_PLAN.md](TRANSLATION_PLAN.md) | Translation layer; Ilyenkov remains the priority |
| Translation-to-publication pipeline | [TRANSLATION_PLAN.md](TRANSLATION_PLAN.md) | The end-to-end chain; source acquisition and splitting are out of scope |
| Book typesetting template | [book/template/README.md](book/template/README.md) | The single styling authority for the published series; never copy settings elsewhere |
| Book typesetting pitfalls | [book/template/TYPESETTING.md](book/template/TYPESETTING.md) | Read before changing any layout; typesetting errors mostly fail silently |
| Publishing a finished edition | [GOVERNANCE.md](GOVERNANCE.md) | Project name only; consult the source organizations first |
| Chinese introduction essay on Ilyenkov | [book/ilyenkov-philosophy-texts-research-zh/README.md](book/ilyenkov-philosophy-texts-research-zh/README.md) | Written for human readers; **not a source of record** — never cite it for versions, dates, terms, or text identity |
| Chinese translation workflow and resume | [translation_workspace/HANDOFF.md](translation_workspace/HANDOFF.md) | The assigned auditor owns each review batch and glossary writeback; live status via `check_translations.py --status` |
| Ilyenkov biography, memoirs, and archives | [notes/ILYENKOV_BIOGRAPHY_PROJECT_PLAN.md](notes/ILYENKOV_BIOGRAPHY_PROJECT_PLAN.md), [notes/ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md](notes/ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md) | Research layer; do not mix memoirs into author-original corpus |
| Daily maintenance | [notes/OPERATIONS_CHECKLIST.md](notes/OPERATIONS_CHECKLIST.md) | Short workflows for texts, scans, and public release |
| Public release and rights | [notes/OPERATIONS_CHECKLIST.md](notes/OPERATIONS_CHECKLIST.md), [RIGHTS.md](RIGHTS.md) | Use `publish_public.sh` only |
| Maidansky source attribution | [notes/MAIDANSKY_SOURCE_ATTRIBUTION.md](notes/MAIDANSKY_SOURCE_ATTRIBUTION.md) | Citation host guidance |
| Kedrov collection | [kedrov_markdown/README.md](kedrov_markdown/README.md), [notes/KEDROV_SOURCE_SURVEY.md](notes/KEDROV_SOURCE_SURVEY.md) | Current facts are manifest-based |
| Repository architecture and workflow | [notes/COLLECTION_ARCHITECTURE.md](notes/COLLECTION_ARCHITECTURE.md), [notes/OPERATIONS_CHECKLIST.md](notes/OPERATIONS_CHECKLIST.md) | Use current rules and checklists |

## 4. Common Commands

```bash
# Everything at once. Prefer this over running the individual checks below: it is one
# round trip instead of nine, each check runs in its own subprocess so one failure cannot
# hide the rest, and only failing checks print detail.
python3 scripts/check_all.py
python3 scripts/check_all.py --status   # where the project stands, computed not written down
# CI runs the same suite on every push and pull request (.github/workflows/checks.yml).

# Registry, status, digitization, and translation projects
python3 scripts/manage_collections.py check

# Corpus roles and GBrain metadata
python3 scripts/prepare_gbrain_markdown.py --check

# Source scans and human verification manifests
python3 scripts/verify_corpus_manifests.py

# Terminology source records and generated views
python3 scripts/check_glossaries.py --check
python3 scripts/render_glossaries.py --check

# Chinese translation projects and review gates
python3 scripts/check_translations.py --check

# Article review work package, targeted history, and unified validation
python3 scripts/prepare_article_review.py --help
python3 scripts/query_terminology_reviews.py --help
python3 scripts/check_article_review.py --help

# Project and AI documentation consistency
python3 scripts/check_project_docs.py

# Safe GBrain run; hides dist and digitization isolation directories
scripts/run_gbrain_without_dist.sh gbrain lint .
```

Commands for adding people, syncing status, and initializing digitization projects are documented in
[Collection Architecture](notes/COLLECTION_ARCHITECTURE.md). Digitization initialization records a
project; OCR begins only after the owner activates that work. The experimental
`scripts/digitize_pdf_work.py` helper may organize digitizable-PDF review drafts and promotion
records, but it is unstable and never replaces explicit page-level human verification.

## 5. Daily Maintenance Quick Read

See the full [Operations Checklist](notes/OPERATIONS_CHECKLIST.md). For common tasks, start with
these boundaries:

- Adding corpus Markdown: confirm `text_role`, source format, source URL, rights fields, and corpus
  path; then run `prepare_gbrain_markdown.py --check`.
- Adding source scans: use only registered `source_scans/` paths and manifests; do not read PDF/DjVu
  text layers or start OCR outside an activated digitization project; then run
  `verify_corpus_manifests.py`.
- Translation projects: bind only visible split corpus Markdown read by GBrain, use source block
  ranges when semantic chapters differ from technical splits, and run `check_translations.py --check`.
- Translation terminology review: use `translation_workspace/ARTICLE_REVIEW_WORKFLOW.md`. The agent
  performing the source-to-Chinese audit owns the corresponding glossary review and writeback.
  Record every proposal in a structured audit batch; the project owner retains final review and may
  override a decision, but routine glossary maintenance does not require prior approval.
- Public release: do not publish the working repository; controlled files require exact
  `rights_registry.json` path and SHA-256 matches; publish only through `scripts/publish_public.sh`
  from `dist/public/`.
- Git commits: by default, split commits by logical task or change set; make a combined commit only
  when the owner explicitly asks for one.

## 6. Hard Rules

- Do not run OCR unless the project owner explicitly activates it for a specific registered work.
- Do not read PDF text layers, DjVuTXT, ABBYY, or hOCR as source text.
- Do not mark modern translations, research, AI output, or unverified OCR as `author_original`.
- Source scans may enter only registered scan directories and manifests; a scan is not digital text.
- `llm_wiki_eligible` and `redistribution_approved` are independent fields.
- Do not publish the full working repository or bypass `scripts/publish_public.sh`.
- Do not apply the root `LICENSE` to third-party full text; controlled public files must match
  `metadata/rights_registry.json` by exact path, SHA-256, and rights basis.
- Do not move or rename registered corpus paths without updating `metadata/collections.json`,
  manifests, generated status, and validation tests in the same change.
- Keep root project documentation, code identifiers, and commit messages in English. Chinese is
  allowed only in translation-specific artifacts, including translation plans, workspace records,
  style guidance, translations, terminology data, and terminology review logs.
- Glossary JSON files are the terminology sources of record. Generated Markdown views and the
  terminology changelog must never override them.
- Do not duplicate corpus text into a second wiki or translation-source tree; cite original paths and
  hashes.
- Do not rewrite Git history — no `filter-repo`, no `filter-branch`, no rebasing published
  commits. Every book's version page stamps the commit it was built from, and that stamp is the
  only way to trace a distributed PDF back to its sources; rewriting history orphans every stamp
  in every copy already sent out. This was decided on 2026-07-30 when the superseded body font
  (12.9 MB) was left in history rather than purged: the private repository can afford the space,
  and `export_public.py` already gates fonts out of public releases.
- Published editions carry the project's name only, never an individual's; a final version needs
  project approval, and the organizations connected to the source text must be consulted before
  publication.
- If user or external changes are present, work with them and do not revert them without instruction.

## 7. Machine Status

<!-- AGENTS-AUTO:BEGIN -->
<!-- Generated by scripts/update_agents_guide.py; --check enforces this block. -->

**Repository Size** (why agents should not read the whole repository)

| Tracked files | Markdown | Corpus md | Chapter files | Split works | Branch |
|---:|---:|---:|---:|---:|:--|
| 1457 | 889 | 685 | 361 | 15 | `main` |

<!-- AGENTS-AUTO:END -->

The machine block is maintained by `.githooks/pre-commit` and `scripts/update_agents_guide.py`; it
records stable repository size only. Collection status is generated by
`scripts/manage_collections.py sync`; use `git status` for live Git state. Narrative text changes
only when project policy, navigation, or workflow changes.
