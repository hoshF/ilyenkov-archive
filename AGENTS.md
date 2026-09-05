## Development

This repository is the public identity, website, and publication anchor of the Chinese Ilyenkov
Group. It owns public information architecture, presentation, deployment, and publication records.
Publication authority remains in the private research repository: fix research facts and publication
decisions there; fix routes, rendering, styles, public editorial framing, publication records, and
deployment here.

Website build inputs are generated into ignored `.website-input/` files from the private repository's
publication manifests. Never stage `.website-input/` or replace it with a tracked content directory.
Set `ILYENKOV_ROOT` when the private repository is not the sibling `Ilyenkov` directory. See
[docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md) for the two input channels and
[docs/PUBLICATION.md](docs/PUBLICATION.md) for what may and may not enter the build.

Restricted study texts must never enter the public `dist/` output. A missing download button is not
access control. If web access is later required, use a separate protected deployment and a distinct
publication channel.

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

- `scripts/lib/` — paths, validation, and the write/`--check` shell both syncers use.
- `src/lib/cache.ts` — what a production build caches.
- `tests/helpers/` — page sources (`pages.ts`), the parsed stylesheet (`styles.ts`), and the
  private publication manifest (`publication.ts`).

Tests assert behaviour, not source text: read style declarations through `helpers/styles.ts`,
and state the field contract rather than the current record count. Neither a document nor a
test records how many entries exist today.

The production site is static and should remain compatible with Cloudflare Pages. See `docs/` for
information architecture, publication channels, and deployment boundaries, and
https://docs.astro.build for the framework.
