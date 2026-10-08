## Development

This public repository owns the website, reader-facing editorial framing, group records,
book publication records, and static deployment. Canonical research facts, source and rights
evidence, and publication decisions belong to the private research repository.

The private repository exposes publication selections through `web/publication.json` only.
The translation syncer reads its `works`; the research syncer reads its `records`. Input file
paths resolve from the private repository root. Syncers consume only `website_public` entries.
Canonical research and translation files remain in their existing locations.

[docs/PUBLICATION.md](docs/PUBLICATION.md) defines publication permissions and field contracts.
Public editorial prose must not bypass those boundaries to expose unpublished private data or
restricted source texts. Generated website inputs live in ignored `.website-input/`; never stage
them or replace them with a tracked content directory. Restricted texts never enter public `dist/`.
Set `ILYENKOV_ROOT` when the private repository is not the sibling `Ilyenkov` directory.

Commit messages default to English, with an imperative subject line.

Use the npm scripts as the canonical development interface:

```
npm run dev        # background server; dev:status, dev:logs, dev:stop manage it
npm run verify     # publication sync and type check → static build → tests
```

The dev server handles source and stylesheet updates. Data loaders using `buildCache` reread
records in development; `src/lib/editorial.ts` parses site and introduction JSON at module load,
so external JSON changes may require a dev-server restart. Private changes need
`npm run publication:sync`. Data flow and caching are documented in
[docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md).

Shared entry points:

- `scripts/lib/` — paths, validation, and the write/`--check` shell both syncers use;
  `research-sync/` holds the research planner and source resolution.
- `src/lib/cache.ts` — production-build data caching.
- `tests/helpers/` — page sources (`pages.ts`), parsed stylesheet (`styles.ts`), and private
  publication manifest (`publication.ts`).

Tests assert behaviour, not source text: read style declarations through `helpers/styles.ts`,
and state the field contract rather than the current record count.

Keep Astro static output compatible with Cloudflare Pages. Route and layout responsibilities
are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); deployment procedures and boundaries are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Framework reference: https://docs.astro.build.
