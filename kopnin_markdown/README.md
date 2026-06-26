---
title: "Pavel Kopnin Philosophy Text Archive"
created: "2026-06-16"
updated: "2026-06-22"
type: "project"
tags: ["kopnin", "philosophy", "russian", "source-archive"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Pavel Kopnin Philosophy Text Archive

This collection preserves bibliography, provenance metadata, and unprocessed source scans for
Pavel Vasilyevich Kopnin (Павел Васильевич Копнин, 1922-1971), a major Soviet philosopher of
dialectical logic, epistemology, and the logic of science.

See the repository [Source Policy](../notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md) and
[Kopnin Source Survey](../notes/KOPNIN_SOURCE_SURVEY.md).

## Layout

```text
kopnin_markdown/
├── README.md
├── metadata/
│   ├── works_master.json
│   └── source_scans_manifest.json
├── scripts/
│   └── klex_download.py
└── source_scans/klex/
```

## Current Status

Four core Russian works are preserved as unprocessed DjVu/PDF scans:

- `Диалектика, логика, наука` (1973; second collected volume, 29 articles)
- `Философские идеи В.И. Ленина и логика` (1969)
- `Гносеологические и логические основы науки` (1974)
- `Гипотеза и ее роль в познании` (1958)

No scan has been found for `Диалектика как логика и теория познания` (1973). Klex provides only a
`.doc` text, the Twirpx scan requires credits, and the English HTML mirror is unavailable. The work
remains an explicit collection gap.

## Sources And Rights

The original platona.net route was blocked by Cloudflare. The reproducible acquisition path uses
Klex to phantastike for the four stored works. English co-authored translations such as
*Themes in Soviet Marxist Philosophy* (1975) and
*The Fundamentals of Marxist-Leninist Philosophy* (1982) are recorded as secondary bibliographic
leads and were not downloaded.

Kopnin died in 1971 and the works remain protected. All scans default to
`redistribution_approved: "false"` and stay outside GBrain and the public export.
