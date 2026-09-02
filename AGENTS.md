## Development

This repository is the public identity, website, and publication anchor of the Chinese Ilyenkov
Group. It owns public information architecture, presentation, deployment, and publication records.
Publication authority remains in the private research repository.

Website articles are generated into ignored `.website-input/articles/` files. The publication command
reads `translation/publication.json` from the private research repository, selects only entries
explicitly marked `website_public`, and combines the referenced `work.json` metadata with its
Markdown text. Set `ILYENKOV_ROOT` when the private repository is not the sibling `Ilyenkov`
directory. Never stage `.website-input/` or replace it with a tracked content directory. Fix
research facts and publication decisions in the private research system; fix routes, rendering,
styles, public editorial framing, publication records, and deployment here.

Restricted study texts must never enter the public `dist/` output. A missing download button is not
access control. If web access is later required, use a separate protected deployment and a distinct
publication channel.

Commit messages default to English, with an imperative subject line.

Use the npm scripts as the canonical development interface. Start the background server with:

```
npm run dev
```

Manage it with `npm run dev:stop`, `npm run dev:status`, and `npm run dev:logs`.

The production site is static and should remain compatible with Cloudflare Pages. See `docs/` for
information architecture, publication channels, and deployment boundaries.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
