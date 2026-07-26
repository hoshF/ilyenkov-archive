---
title: "Ilyenkov Biography Archive Expansion Plan"
created: "2026-07-09"
updated: "2026-07-10"
type: "analysis"
tags: ["ilyenkov", "biography", "memoirs", "archives", "project-plan"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Ilyenkov Biography Archive Expansion Plan

This is the long-term plan for the Ilyenkov biography, memoir, and archive layer. Agents working on
related tasks should read this file first, then
[`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md) and
[`ilyenkov_markdown/README.md`](../ilyenkov_markdown/README.md).

## Background

The repository primarily preserves Ilyenkov's own writings, related philosophers' texts, and
research corpora. On 2026-07-09, the project confirmed that
`filorus.ru/ilyenkov/biog/rem/` hosts a full web edition of the 2004 volume
*Эвальд Васильевич Ильенков в воспоминаниях*, including the contents page and 24 body texts. This
volume is a key source for studying Ilyenkov's biography, friendships, students, late-life context,
teaching, and reception history.

To avoid mixing categories, biographical and research material does not enter
`ilyenkov_markdown/ilyenkov_md/`, the author-original layer. It belongs in the separate
`ilyenkov-biography` collection. Default rules:

- `text_role: "research"`
- `core_corpus_eligible: "false"`
- `llm_wiki_eligible: "true"`
- `redistribution_approved: "false"`
- `rights_review_status: "unreviewed"`

## Current Status

- [x] ~~Confirm that `filorus.ru/ilyenkov` is the current Maidansky citation root.~~ See
  [`ilyenkov_markdown/README.md`](../ilyenkov_markdown/README.md).
- [x] ~~Confirm that the 2004 memoir landing page, contents page, author page, and 24 body texts
  are reachable.~~
- [x] ~~Add the `ilyenkov-biography` collection.~~ See
  [`metadata/collections.json`](../metadata/collections.json).
- [x] ~~Convert the 24 HTML texts from the 2004 memoir volume to Markdown.~~ Output is under
  `ilyenkov_markdown/ilyenkov_biography_md/memoirs/evald-ilyenkov-v-vospominaniyakh-2004/`.
- [x] ~~Add a reproducible conversion script.~~
  `ilyenkov_markdown/scripts/convert_ilyenkov_memoirs.py`
- [x] ~~Add the biography manifest.~~
  `ilyenkov_markdown/metadata/ilyenkov_biography_manifest.json`
- [x] ~~Add the source survey.~~
  [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md)
- [x] ~~Add the 2024 memoir volume, Mareev, Elena Illesh, and related leads to gap tracking.~~ See
  [`CORPUS_GAPS.md`](CORPUS_GAPS.md).
- [x] ~~Convert the A World to Win HTML page "A philosopher under suspicion" by Sergei Mareyev to
  biography/research Markdown.~~ See `ilyenkov_markdown/metadata/ilyenkov_biography_manifest.json`.
- [x] ~~Create an organization/project entry for International Friends of Ilyenkov.~~
- [x] ~~Preserve owner-provided Ilyenkov, Mareev/Mareeva, Vygotsky, and Maidansky/Oittinen related
  PDF/DjVu files as private unprocessed scans.~~ See
  `ilyenkov_markdown/metadata/source_scans_manifest.json`.
- [x] ~~Run and pass project validation.~~
  `manage_collections.py check`, `prepare_gbrain_markdown.py --check`,
  `check_project_docs.py`, and `verify_corpus_manifests.py`.

## Maintenance Rules

- Before adding a source, classify it as one of: Ilyenkov's own work, memoir, archival material,
  secondary research, image/photo, or bibliography-only information.
- Only Ilyenkov's own texts may be considered for `author_original`. Memoirs, research, editorial
  notes, and afterwords remain `research`.
- HTML body text may be converted. PDF/DjVu/image scans are registered first; do not read embedded
  text layers or run OCR unless the project owner explicitly activates digitization for a specific
  work.
- After adding or modifying body text, update the relevant manifest and run validation.
- Completed items remain in this file with `[x] ~~...~~` and a date or local repository path.
- New unverified leads belong in the verification queue; do not treat them as source facts in the
  manifest.
- Do not record machine-local acquisition paths in project metadata.

## Todo

### P0: Stabilize the 2004 memoir layer

- [x] ~~Sample-review the converted 2004 memoir Markdown, especially page breaks, footnotes,
  emphasis, and initials.~~ First pass recorded in
  `ilyenkov_markdown/metadata/ilyenkov_memoir_annotations.json`; the ch004 footnote conversion
  finding was repaired on 2026-07-10.
- [x] ~~Build an annotated bibliography for the 2004 memoir volume: author identity, relation to
  Ilyenkov, main period, and major events.~~ See
  `ilyenkov_markdown/metadata/ilyenkov_memoir_annotations.json`.
- [x] ~~Add necessary cross-links among memoir texts without changing the original body text.~~ See
  the memoir directory `README.md` and item-level `cross_references` in the annotation file.
- [x] ~~Repair existing backlink placeholders in local footnotes, such as Maidansky references that
  say "read the full text here".~~ The two local Naumenko placeholders now link to ch005 in the
  biography layer.
- [x] ~~Record whether each memoir touches sensitive personal life, death circumstances, family
  members, political sanctions, or academic controversies.~~ Controlled flags are recorded in the
  annotation file.

### P1: Expand biography and research bibliography

- [ ] Verify publication data, contents, ISBN, availability, and rights for the 2024 volume
  *Образ Ильенкова в воспоминаниях*.
  Progress, 2026-07-10: bibliography-level metadata was recorded in
  [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md) and
  [`CORPUS_GAPS.md`](CORPUS_GAPS.md). Verified fields: Москва, `Русская панорама`, 2024;
  editor/compiler Г.В. Лобастов; 448 pages; ISBN `978-5-93165-506-2`; print/library records and
  review records located. A review-based contents sketch and person-name verification queue were
  added. Still open: exact item-level table of contents, complete contributor list, lawful digital
  availability, and redistribution rights.
- [ ] Find and record a lawful source for Мареев С.Н., *Встреча с философом Э. Ильенковым*.
  Progress, 2026-07-10: 1994 and 1997 editions were bibliographically verified in
  [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md). Public PDF/ZIP
  download leads exist through Koob/Klex/Phantastike, but no authorization or redistribution
  license was located. The task remains open until a rights-cleared complete digital source,
  publisher/library source, or explicit digitization decision is available.
- [ ] Verify the original journal citation and translation rights for Sergei Mareyev's A World to
  Win page "A philosopher under suspicion".
  Progress, 2026-07-10: the A World to Win page, International Friends of Ilyenkov tribute, and
  Marxismo Crítico repost were checked. The source chain is now recorded in
  [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md): Russian article
  claimed as `Journal of Moscow State University`, Volume 7, No. 1, 1990; English publication in
  `Socialist Future`, Summer 1996, Vol. 5 No. 1; translation by Angela Landon. Still open: exact
  Russian journal/title verification and translation/reuse rights.
- [ ] Verify external source URLs, publication data, and rights for preserved private PDF/DjVu
  scans; do not read text layers and do not run OCR.
  Progress, 2026-07-10: metadata-only checks were added for two Mareev research scans in
  [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md). `Э. В.
  Ильенков: жить философией` was checked against Labirint and Klex; `Из истории советской
  философии: Лукач, Выготский, Ильенков` was checked against RSL and Klex. Both remain
  owner-provided `source_scan_unprocessed` files with unverified local source URLs and no
  redistribution license. The 2008 and 2015 page-count differences between external records and
  local scan pages are now recorded for later verification.
  Additional progress, 2026-07-10: `Л. С. Выготский: философия, психология, искусство` and
  `Проблема мышления: созерцательный и деятельностный подход` were checked against LiveLib, IPR
  SMART, Labirint, and Klex/Phantastike leads. Both remain unprocessed private scans. The Vygotsky
  scan has unresolved 2017/2020 edition and page-count issues; `Проблема мышления` has a manifest
  year/edition mismatch because external book records point to 2013 while the manifest currently
  records 2020.
  Further progress, 2026-07-10: the five English-language research scans were checked against
  Cambridge, Brill, Historical Materialism, Google Books, and a Marxists.org item-level permission
  lead. `Consciousness and Revolution in Soviet Philosophy`, `Dialectics of the Ideal`,
  `Intelligent Materialism`, `The Heart of the Matter`, and `The Practical Essence of Man` now have
  metadata-only records in [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md).
  All five remain owner-provided `source_scan_unprocessed` files; no open redistribution license
  was located, and `Intelligent Materialism` requires item-by-item comparison rather than a
  full-volume ingest.
- [ ] Find Elena Illesh articles and archive-related materials, distinguishing family archive
  material, articles, interviews, and secondary references.
- [x] ~~Build an item-level discovery table for the International Friends of Ilyenkov document
  archive without overriding repository source records.~~ Main archive items, the 1954 theses lead,
  the archive-discovery Q&A, and the `Finding Evald Ilyenkov` booklet lead are recorded in
  [`ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md`](ILYENKOV_BIOGRAPHY_SOURCE_SURVEY.md). This is a
  discovery table only; it does not admit IFI PDFs or site text to the corpus.
- [ ] Review PsyJournals Ilyenkov/Maidansky/Meshcheryakov items, distinguishing Ilyenkov's own text
  from Maidansky editorial commentary.

### P2: Build biography archive structure

- [ ] Create `ilyenkov_biography_md/bibliography/` or an equivalent bibliography list for records
  without admitted body text.
- [ ] Draft a chronology covering life events, publication events, controversies, important
  relationships, and archive discoveries.
- [ ] Build a people index for students, colleagues, friends, family members, opponents, editors,
  and researchers.
- [ ] Build a themes index for Zagorsk experiment, Spinoza, Hegel, Vygotsky, Mikhailov, and Soviet
  philosophy context.
- [ ] Decide whether a separate photo/image manifest is needed; images should record source and
  rights only and must not be mixed into the text corpus.

### P3: Chinese research and translation preparation

- [ ] Write a Chinese guide to the 2004 memoir volume: structure, author group, research value, and
  cautions for use.
- [ ] Select priority texts for translation, for example Suvorov, Mikhailov, Naumenko, Polishchuk,
  Mareev, and Mezhuev.
- [ ] Add glossary entries for key personal names and run glossary validation.
- [ ] When creating a translation workspace, record source Markdown SHA-256 values and do not copy
  external web pages into a second source tree.

## Verification Queue

| Item | Type | Current note | Next step |
|---|---|---|---|
| `Образ Эвальда Ильенкова в воспоминаниях` (2024) | memoir anthology | Bibliography-level metadata and review-based contents sketch recorded; no admitted full text, no rights license, and no verified item-level TOC | Locate a table of contents, library copy, or publisher record; verify contributors and lawful digital availability |
| Мареев С.Н., `Встреча с философом Э. Ильенковым` | memoir/book | 1994 and 1997 editions bibliographically verified; owner-provided 1997 PDF is preserved as an unprocessed scan; public download leads have unclear rights | Find a rights-cleared complete source, publisher/library source, or make a separate digitization decision |
| Sergei Mareyev, `A philosopher under suspicion` | biography/profile HTML | Converted to biography/research Markdown; 1990/1996 source chain recorded; translation and redistribution rights still unreviewed | Verify exact Russian journal/title and locate translation/reuse permission evidence |
| Owner-provided Ilyenkov research PDFs/DjVu | private source scans | Preserved on 2026-07-10 as `source_scan_unprocessed`; machine-local acquisition paths are not recorded; duplicate Mareev 2012 PDF removed; Mareev 2008, 2015, 2017/2020 Vygotsky, `Проблема мышления`, and the five English-language research scans now have metadata-only checks, but source URLs, rights, page counts, and some edition/year fields remain open | Continue item-level external source, publication data, and rights verification; do not OCR or batch-ingest |
| Иллеш Е.Э. related archive articles | archive/biography | External articles repeatedly mention Elena Illesh archive discoveries | Verify URLs and build item-level queue |
| International Friends of Ilyenkov archive | discovery source | Registered as a contemporary archive and research entry point; main document-archive discovery table added on 2026-07-10 | Continue item-by-item source, version, and rights checks; do not batch-ingest |
| Novokhatko prefaces and biographical notes | secondary biography | Mentioned in secondary literature | Check original publication and accessible versions |

## Update Checks

After related changes, run at least:

```bash
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/check_project_docs.py
```

If source scans or rights records are added, also run:

```bash
python3 scripts/verify_corpus_manifests.py
```
