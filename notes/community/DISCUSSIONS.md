---
title: "Discussions Category Plan And Welcome Post"
created: "2026-06-12"
updated: "2026-06-26"
type: "note"
tags: ["community", "discussions", "recruitment"]
language: "en"
collection: "research-notes"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Discussions Category Plan And Welcome Post

Discussions are enabled in the public `ilyenkov-archive` repository. GitHub does not support creating
discussion categories through the API; create them manually at
`https://github.com/hoshF/ilyenkov-archive/discussions/categories`.

## Category Design

| Category | Format | Purpose |
|---|---|---|
| Announcements | Announcement | Project status, release notes, and workflow updates |
| Texts and Editions | Open-ended discussion | Source texts, editions, variants, missing pages, and bibliography |
| Digitization and Review | Open-ended discussion | Transcription structure, human review, page mapping, and quality issues |
| Philosophy and Concepts | Open-ended discussion | Philosophical discussion, terminology comparison, and intellectual history |
| AI and Digital Humanities | Open-ended discussion | Search, structured corpora, LLM Wiki, and computational research |
| Multilingual Study | Open-ended discussion | Translation, terminology comparison, and cross-language close reading |
| Questions | Q&A | Participation, file locations, and workflow questions |

## Welcome Post

Title:

`Welcome to the Ilyenkov Philosophy Text Archive`

> This project is building a source-traceable philosophy text archive centered on Evald Ilyenkov
> and the thinkers, debates, and traditions connected with his work.
>
> Our primary task is the long-term collection, verification, structuring, and digitization of
> original-language philosophical texts. The archive combines:
>
> - original-language Markdown with provenance metadata;
> - bibliographic records and edition histories;
> - unprocessed source scans kept separate from verified text;
> - related collections on Spinoza and Soviet philosophers;
> - reproducible infrastructure for search, comparison, digital humanities, and LLM-assisted
>   research.
>
> The goal is an **AI-ready source-text digitization and research platform**: auditable texts and
> metadata that can support retrieval, close reading, multilingual study, and future computational
> work. This does not mean that AI output is treated as scholarly authority, or that every file is
> licensed for model training.
>
> The project also maintains a long-term Chinese translation and close-reading program focused on
> Ilyenkov. Related Soviet philosophers are translated selectively where they clarify his work;
> source figures such as Spinoza are primarily developed as original-language collections.
>
> Collaboration is global. We welcome philosophers, historians, librarians, bibliographers,
> language specialists, textual scholars, digitization reviewers, software developers, and
> researchers working with AI or digital humanities.
>
> **How to begin**
>
> - Project overview: [README](https://github.com/hoshF/ilyenkov-archive#readme)
> - Contribution guide: [CONTRIBUTING.md](https://github.com/hoshF/ilyenkov-archive/blob/main/CONTRIBUTING.md)
> - Collection status: [COLLECTION_STATUS.md](https://github.com/hoshF/ilyenkov-archive/blob/main/COLLECTION_STATUS.md)
> - Governance and decisions: [GOVERNANCE.md](https://github.com/hoshF/ilyenkov-archive/blob/main/GOVERNANCE.md)
> - Rights and licensing: [RIGHTS.md](https://github.com/hoshF/ilyenkov-archive/blob/main/RIGHTS.md)
>
> Project infrastructure, original documentation, and auditable factual metadata are open by
> default. Complete texts, translations, scans, media, and content-bearing derivatives are released
> file by file only after an evidence-based rights review tied to the exact checksum.
>
> The public archive already includes a first reviewed group of Spinoza source materials from Latin
> and Dutch Wikisource and DBNL. Their public availability records a redistribution decision, not a
> claim that the texts are critically edited or fully collated.
>
> Introduce yourself by telling us which philosophers, languages, archives, or technical methods you
> work with, and what kind of contribution interests you.

## Good First Issue Drafts

### 1. Check One Work Record

> Choose one person from `COLLECTION_STATUS.md` and verify the original title, publication year,
> publisher, and responsibility statement for one work. Provide a reliable catalogue or library
> source; do not download controlled full text.

### 2. Spot-Check Source Links

> Choose 10 source URLs from an author metadata manifest and record availability, redirects, and
> verifiable alternate entry points. Do not bypass controlled lending or download restrictions.

### 3. Compare Multilingual Terminology

> Choose one passage and compare how a philosophical term is handled in two or more languages.
> Identify the original location and editions used. A single final translation is not required.

### 4. Propose A Digitization Quality Rule

> Read `notes/SCAN_DIGITIZATION_WORKFLOW.md` and propose one automatically testable quality issue
> involving page mapping, footnotes, formulae, or multilingual quotations. This task does not run
> OCR.

### 5. Verify One Public Rights Basis

> Choose one public item from `metadata/rights_registry.json`, check that the source page, license,
> or public-domain statement remains accessible, and confirm that attribution is clear. Do not make
> unreviewed full text public.
