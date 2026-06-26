---
title: "Contributing"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["project", "documentation", "contributing"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Contributing

The archive values reliable sources, careful review, verifiable metadata, and small changes that
remain traceable through Git history.

Use [Discussions](https://github.com/hoshF/ilyenkov-archive/discussions) for philosophy, editions,
digitization, multilingual study, terminology, and digital-humanities questions. Use issues for
specific defects or bounded tasks.

## Useful Contributions

- Add or verify original-language texts, publication data, holdings, and edition statements.
- Correct source conversion, filenames, directory classification, or structured metadata.
- Contribute bibliography, collation notes, page maps, digitization tests, or reproducible tools.
- Add materials directly relevant to Ilyenkov's sources, debates, and Soviet philosophical context.
- Improve corpus validation, search, LLM Wiki, or digital-humanities workflows.
- Review Ilyenkov Chinese translations, terminology, and close readings.
- Submit small translation corrections traceable to a specific source file and version.

## Adding A Philosopher

Do not copy a historical directory as a template. Read
[Collection Architecture](notes/COLLECTION_ARCHITECTURE.md), then run:

```bash
python3 scripts/manage_collections.py add-person \
  --id <author_id> \
  --name-zh <Chinese name> \
  --name-original <original-language name> \
  --name-latin <Latin-script name> \
  --relation <relationship to the project>
```

Add the works registry, source survey, and scan manifest, then run:

```bash
python3 scripts/manage_collections.py check
```

## Text And Digitization Boundaries

- Do not submit bulk machine translation without human review.
- Do not present an AI draft as a reviewed translation.
- Do not replace an existing PDF, Markdown file, or translation without source and version notes.
- Do not initiate OCR or use DjVuTXT, ABBYY, hOCR, or a PDF text layer to create corpus text.
- Genuine HTML or native structured EPUB may be converted with provenance. Downloadable PDF/DjVu
  files remain unprocessed scans until the digitization workflow is explicitly activated.

AI-assisted Chinese translation belongs under
`translation_workspace/<stage>/<author_id>/<work_id>/`. Keep `translation.json`, source path, URL,
version, SHA-256, generation method, and human-review status.

Read [Source, OCR Admission, and Publication Policy](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md)
before submitting philosophical text.

## Issues

An actionable issue should include:

- the affected path;
- original title or source URL;
- the issue type: source, textual error, terminology, translation, rights, or tooling;
- verifiable evidence such as a page number, catalogue record, screenshot, or comparison text.

## Pull Requests

- Keep one PR focused on one subject.
- Do not mix formatting, translation changes, and large file moves.
- Explain the evidence for translation changes and cite the original-language location.
- Explain the source, purpose, and replacement status of PDFs or images.
- Run the relevant checks described in `AGENTS.md`.

## Contribution Licensing

- Project-authored code, scripts, tests, schemas, and Git hooks are contributed under MIT.
- Project-authored documentation, research notes, and annotations are contributed under
  CC BY-SA 4.0.
- Project-created factual bibliography, provenance, checksums, and status metadata are contributed
  under CC0 1.0.
- Third-party source texts, translations, scans, images, and transcriptions require their own
  source and rights evidence; project licenses do not automatically cover them.
- The project requires neither a CLA nor a DCO. Attribution follows Git history and file records.

See [LICENSE](LICENSE) and [RIGHTS.md](RIGHTS.md).

## Rights And Removal

Infrastructure, original documentation, and factual metadata are open by default. Controlled
third-party content requires file-level rights review and checksum verification. “Available online”
or “for research” is not sufficient evidence of redistribution permission.

Rightsholders, editors, translators, or source providers may open an issue to request review or
removal.
