## Development

This repository owns public presentation and explicitly published Git-safe artifacts. It does not
create publication authority. Do not copy canonical private research content into this repository
unless the private publication workflow explicitly authorizes `git_repository` publication for the
exact revision.

Website-only content is generated into ignored `.website-input/` by `npm run publication:prepare`.
Never stage that directory or replace it with a tracked content directory. Fix research facts and
publication decisions in the private research system; fix routes, rendering, styles, and editorial
presentation here.

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
