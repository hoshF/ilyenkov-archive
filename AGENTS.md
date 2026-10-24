# Agent guide

## Boundaries

This repository owns the website, public editorial content, group records, and static deployment.
The private research repository owns canonical facts, texts, source and rights evidence, and
publication decisions. Its `web/publication.json` is the only selection interface for private content.

Consume only approved `website_public` selections. Public prose and references must not expand
publication scope. Generated inputs belong in ignored `.website-input/`; never stage them or
replace them with tracked content. Restricted texts must never enter public `dist/`.

## Read by task

Read the relevant contract before changing its implementation:

| Task | Document |
| --- | --- |
| Routes, layouts, components, content ownership | [Architecture](docs/ARCHITECTURE.md) |
| Publication selections, fields, identities, permissions | [Publication](docs/PUBLICATION.md) |
| Syncers, rendering, relationships, sorting, caching | [Content pipeline](docs/CONTENT_PIPELINE.md) |
| Build environment, hosting, uploads, launch checks | [Deployment](docs/DEPLOYMENT.md) |

## Development

Use npm scripts as the canonical interface:

```sh
npm run dev               # background server; dev:status / dev:logs / dev:stop manage it
npm run publication:sync  # refresh generated inputs after private changes
npm run verify            # sync and type check → static build and search index → tests
```

The private repository defaults to sibling `Ilyenkov/`; set `ILYENKOV_ROOT` for another location.
Development reload and cache behaviour are documented in
[Content pipeline](docs/CONTENT_PIPELINE.md#public-编辑输入与缓存).
Keep Astro output static and compatible with Cloudflare Pages. Framework reference:
https://docs.astro.build.

Shared implementation entry points:

- `scripts/lib/`: paths, validation, shared write/`--check` handling; `research-sync/` contains
  the research planner and source resolution.
- `src/lib/cache.ts`: production-build data caching.
- `tests/helpers/`: page sources (`pages.ts`), stylesheet declarations (`styles.ts`), and
  private publication manifest (`publication.ts`).

Tests assert behaviour, not source text. Use `tests/helpers/styles.ts` for style declarations;
assert field contracts rather than current record counts. Run `npm run verify` before handing off changes.
Commit messages default to English with an imperative subject.
