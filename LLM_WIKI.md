---
title: "Ilyenkov Research LLM Wiki"
created: "2026-06-11"
updated: "2026-06-22"
type: "project"
tags: ["ilyenkov", "spinoza", "llm-wiki", "gbrain"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
llm_wiki_engine: "gbrain"
gbrain_version_tested: "0.42.37.0"
---
# LLM Wiki

The project currently uses **GBrain** for indexing, retrieval, chunking, and derived LLM research
workflows. Markdown and Git are the auditable sources of record. The GBrain database, embeddings,
and extracted relations are reproducible derivatives.

## Corpus Layout

People and collection paths are registered in `metadata/collections.json`; current collection
status is generated in [COLLECTION_STATUS.md](COLLECTION_STATUS.md). The tracked roots in
`gbrain.yml` are synchronized by `scripts/manage_collections.py`.

- `caute_ru_markdown/ilyenkov_md/`: Ilyenkov Russian texts, normally `author_original`.
- `caute_ru_markdown/maidansky_md/`: Maidansky research and related scholarship.
- `spinoza_markdown/spinoza_md/`: authorial-language texts, historical translations, and witnesses.
- `kedrov_markdown/kedrov_md/`: Kedrov Russian texts converted from HTML.
- `notes/`: research notes, terminology, and methods.
- `translation_workspace/`: planned, draft, and reviewed translation work.

Source scans and all `digitization/` workspaces are excluded. Fifteen long works are stored as
losslessly reconstructable chapters; `.md.snapshot` and `.fulltext/` copies do not enter the index.

## Commands

```bash
gbrain doctor --fast
scripts/run_gbrain_without_dist.sh gbrain lint .
scripts/run_gbrain_without_dist.sh gbrain sync \
  --repo /Users/hoshf/Project/Ilyenkov --full --dry-run --no-pull
scripts/run_gbrain_without_dist.sh gbrain sync \
  --repo /Users/hoshf/Project/Ilyenkov --full --no-pull --yes
gbrain search "Spinoza"
gbrain query "How does Ilyenkov understand Spinoza's concept of thought?"
```

When embeddings are unavailable:

```bash
scripts/run_gbrain_without_dist.sh gbrain sync \
  --repo /Users/hoshf/Project/Ilyenkov --full --no-embed --no-extract --no-pull --yes
```

Resume derived processing later:

```bash
scripts/run_gbrain_without_dist.sh gbrain embed --stale
scripts/run_gbrain_without_dist.sh gbrain extract --stale --catch-up
```

Run before synchronization:

```bash
python3 scripts/manage_collections.py check
python3 scripts/prepare_gbrain_markdown.py --check
```

## Operating Principles

- Keep authorial originals, historical and modern translations, research, and AI content distinct.
- Prefer genuine HTML or native structured EPUB. Do not initiate OCR or ingest PDF/DjVu text layers.
- Human-verified OCR may enter the core only through the approved manifest process.
- Cross-language explanation should begin from authorial-language text where available.
- Search results and model answers are research entry points, not critical-edition conclusions.
- AI-ready does not imply model-training permission.
- Do not run bare `gbrain sync .`; the wrapper hides public exports and digitization workspaces.
- Use [RESOLVER.md](RESOLVER.md) for corpus routing.
- Cite Maidansky-hosted Ilyenkov texts through
  `http://filorus.ru/ilyenkov/... (at the website by Andrey Maidansky)`.

See [Source Policy](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md).
