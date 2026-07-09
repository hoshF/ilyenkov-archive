---
title: "Andrey Maidansky Text And Source Archive"
created: "2026-06-17"
updated: "2026-07-03"
type: "project"
tags: ["maidansky", "philosophy", "research", "source-archive", "academia"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Andrey Maidansky Text And Source Archive

This philosopher root contains two registered Maidansky layers: a searchable research corpus and an
Academia.edu source archive. The layers share metadata infrastructure but keep corpus Markdown,
source scans, digitization projects, and rights decisions distinct.

Source profile: <https://белгу.academia.edu/AndreyMaidansky>

Current Maidansky-site citation root: <https://filorus.ru/maidansky.html>

## Layout

```text
maidansky_markdown/
├── README.md
├── maidansky_md/
├── metadata/
│   ├── academia_manifest.json
│   ├── academia_manual_acquisition_queue.json
│   ├── maidansky_catalog_manifest.json
│   ├── academia_manual_queue.json
│   └── source_scans_manifest.json
├── scripts/
│   └── academia_download.py
└── source_scans/academia/
```

## Research Corpus

`maidansky_md/` contains A. D. Maidansky research and related philosophical texts. These files are
registered as `text_role: "research"` and remain outside the core authorial corpus. Current
Maidansky-site citations follow [Maidansky Source Attribution](../notes/MAIDANSKY_SOURCE_ATTRIBUTION.md).

## Network Discovery Round, 2026-07-03

The PsyJournals author page, <https://psyjournals.ru/authors/8305>, is the primary HTML-based
Maidansky relationship index for this repository. The local
`metadata/psyjournals_manifest.json` records HTML-derived research entries around Vygotsky,
Ilyenkov, Meshcheryakov, F. T. Mikhailov, Spinoza, and cultural-historical psychology. New
PsyJournals conversions require item-level comparison against the existing Markdown records.

The Academia profile remains a source-scan and bibliography lead layer only. It includes useful
network leads for Vygotsky, Ilyenkov, Spinoza, activity theory, and Soviet psychology, but its PDF
attachments are registered as unprocessed scans. Do not download attachments, read PDF text layers,
run OCR, or convert these files to Markdown without explicit item-level approval.
Anonymous and cookie-backed `curl` checks on 2026-07-03 returned Cloudflare HTTP 403 for the
profile, a registered work page, and the manual-queue work page, but the same pages loaded in a
real browser. See [Academia.edu 403 Investigation](../notes/ACADEMIA_403_INVESTIGATION.md).
For new Academia leads, use a human-in-the-loop workflow: the agent performs discovery,
bibliographic matching, deduplication, and queue updates; the owner manually collects files when
needed; the agent then registers supplied files as unprocessed source scans.

`metadata/academia_manual_acquisition_queue.json` is the current owner-facing queue. It currently
contains three book-type Academia leads whose body text is not yet available:
`Бенедикт Спиноза. Могущество разума`, where the registered local file has 9 pages against a
320-page bibliographic record;
`Культурно-историческая психология: Истоки и новая реальность`, where the owner-retrieved file is
only the book cover, and `Выготский Л.С. Педология школьного возраста. Лекции по психологии
развития`, where the registered local file has 37 pages against a 320-page bibliographic record.
The full texts remain unavailable and unreviewed.

## Academia Source Archive Rules

- Preserve the original PDF or attachment supplied by Academia.edu.
- Do not run OCR, read PDF text layers, or generate Markdown body text.
- Source files default to `source_license: "not_stated"`,
  `rights_review_status: "unreviewed"`, and `redistribution_approved: "false"`.
- Files remain outside the core corpus and GBrain:
  `core_corpus_eligible: "false"` and `llm_wiki_eligible: "false"`.

## Current Status

The June 17, 2026 collection run recorded 57 Academia uploads and registered 56 downloaded entries.
Two work URLs resolve to the same local file,
`spinoza-in-cultural-historical-psychology.pdf`, so the directory contains 55 distinct files.

`metadata/academia_manual_queue.json` retains unresolved or partial Academia book-type items:
`Бенедикт Спиноза Могущество разума`, `Культурно историческая психология Истоки и новая
реальность`, and `Выготский Л С Педология школьного возраста Лекции по психологии развития`.
`metadata/academia_manual_acquisition_queue.json` supersedes it as the active human-in-the-loop
queue and records the July 3, 2026 browser-page check and cover-only owner report.

## Reproduction

```bash
ACADEMIA_COOKIE_FILE=/Users/hoshf/Project/Ilyenkov/academia_cookie.txt \
python3 maidansky_markdown/scripts/academia_download.py --dry-run

ACADEMIA_COOKIE_FILE=/Users/hoshf/Project/Ilyenkov/academia_cookie.txt \
python3 maidansky_markdown/scripts/academia_download.py
```

`academia_cookie.txt` is a temporary local credential. It is excluded from the repository and
should be deleted after use.
