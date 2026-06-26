---
title: "Project Governance"
created: "2026-06-12"
updated: "2026-06-22"
type: "project"
tags: ["project", "documentation", "governance"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Project Governance

Status: draft v0.3, June 22, 2026. The maintainer administers this charter until a stable core team
exists. Git history records all amendments.

## Mission

The project is centered on Ilyenkov and has two linked purposes:

- build a global, source-traceable digitization and AI-ready research platform for philosophical
  texts;
- sustain Chinese translation, terminology research, and close reading focused first on Ilyenkov.

Reliable source text and edition metadata are prerequisites for translation. Translation and close
reading, in turn, provide sustained scholarly use and correction of the digital corpus.

All work follows three requirements: traceable sources, auditable rights, and reviewable process.

## Roles

- **Maintainer**: final decisions, rights gating, and public release.
- **Core contributors**: invited private-repository collaborators who sustain bibliographic,
  collation, digitization, language, translation, or technical work.
- **Public contributors**: anyone participating through issues, pull requests, or Discussions.

A typical path to core membership is one verifiable public contribution followed by a maintainer
invitation. Repository access exists for research and review; it is not redistribution permission.

## Private And Public Repositories

- `ilyenkov-archive-private` is the complete working repository and may contain materials without public
  redistribution approval.
- `ilyenkov-archive` contains only the rights-gated export produced by `scripts/export_public.py`.

Infrastructure, original documentation, and factual metadata are public by default. Third-party
texts, translations, scans, media, and content-bearing derivatives require exact-path and SHA-256
approval in `metadata/rights_registry.json`.

Hard rules:

1. Public release uses `scripts/publish_public.sh`; do not push the private tree to the public repo.
2. Private controlled materials must not be redistributed outside the project.
3. External publication, printing, or reposting is a governance decision, not a routine edit.

## Decisions

- Routine notes, drafts, and small corrections may be made by the contributor responsible.
- Terminology decisions, structural changes, external publication, and charter amendments should be
  discussed publicly or within the core team.
- When consensus is unavailable, the maintainer decides and records the reason.
- Decisions are not project memory until recorded in an issue, Discussion, or repository file.

## Terminology

1. Propose a term with the original expression, context, and at least one source passage.
2. Allow discussion before adopting a preferred form.
3. Record the result, alternatives, reasoning, and remaining objections in `notes/TERMS.md`.
4. Apply retrospective translation changes in a separate PR.
5. Important terms may retain multiple context-dependent translations.

## Attribution And Licensing

- Contributor notes live under `notes/contributors/<name>/` and retain author attribution.
- Translation changes remain attributable through Git and significant revisions should state their
  evidence.
- Software uses MIT; project-authored documentation uses CC BY-SA 4.0; factual metadata uses CC0.
- Third-party materials retain their own rights.
- Project-authored translations may use CC BY-SA 4.0 only when the underlying work and edition
  permit public redistribution.
- Existing contributions and attribution remain after a contributor leaves.

See [LICENSE](LICENSE) and [RIGHTS.md](RIGHTS.md).

## AI Use

- AI may assist retrieval, comparison, structural checks, research, and translation drafting.
- AI output is neither authorial text nor scholarly authority.
- Draft translations must retain source path, version, URL, SHA-256, generation method, and review
  status.
- Unreviewed bulk translation and unverified OCR are not accepted as reviewed corpus text.
- AI-ready does not mean licensed for model training.

## Communication And Record Keeping

- Informal coordination: Telegram or other member channels.
- Open discussion: public GitHub Discussions.
- Durable decisions: repository files, issues, and pull requests.
- Conclusions must return to the repository: terminology to `notes/TERMS.md`, source findings to
  metadata or surveys, and project progress to the journal.

## Rights Requests And Amendments

Rightsholders, authors, translators, editors, and source providers may request review or removal
through the public issue tracker. Charter amendments are proposed by pull request and follow the
decision process above.
