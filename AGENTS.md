## Development

This repository is the public identity, website, and publication anchor of the Chinese Ilyenkov
Group: routes, rendering, styles, public editorial framing, publication records, and deployment.
Research facts and publication decisions belong to the private research repository.

Website build inputs are generated into ignored `.website-input/` files from the private
repository's publication manifests. Never stage them or replace them with a tracked content
directory. Set `ILYENKOV_ROOT` when the private repository is not the sibling `Ilyenkov`
directory.

Restricted study texts never enter the public `dist/`.
[docs/PUBLICATION.md](docs/PUBLICATION.md) governs what may enter the build;
[docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md) describes the two input channels.

Commit messages default to English, with an imperative subject line.

Use the npm scripts as the canonical development interface:

```
npm run dev        # background server; dev:status, dev:logs, dev:stop manage it
npm run verify     # type check, tests, build
```

The dev server rereads records and the stylesheet on every request, so changes under
`editorial/` and `src/` appear on `http://localhost:4321` without a restart. Changes in the
private repository need `npm run publication:sync`.

Shared entry points:

- `scripts/lib/` — paths, validation, and the write/`--check` shell both syncers use;
  `research-sync/` holds the research planner and source resolution.
- `src/lib/cache.ts` — what a production build caches.
- `tests/helpers/` — page sources (`pages.ts`), the parsed stylesheet (`styles.ts`), and the
  private publication manifest (`publication.ts`).

Tests assert behaviour, not source text: read style declarations through `helpers/styles.ts`,
and state the field contract rather than the current record count.

The production site is static and should remain compatible with Cloudflare Pages. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for information architecture,
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment boundaries, and
https://docs.astro.build for the framework.
