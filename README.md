# Ilyenkov Site

This private repository owns the Ilyenkov website application and presentation layer: routes,
templates, components, styles, editorial navigation, adapters, tests, and build configuration.

Canonical research content, translations, source texts, rights evidence, and publication authority
remain in the private Ilyenkov research repository. Website-visible content is not necessarily
tracked in this repository.

## Research input

The build reads only upstream records already approved for the `website` publication channel. Set
`ILYENKOV_RESEARCH_ROOT` to the private research repository. Local development defaults to the
sibling checkout at `../Ilyenkov`:

```sh
export ILYENKOV_RESEARCH_ROOT=../Ilyenkov
```

No research text is copied into Git. Generated or injected content belongs in ignored local build
directories.

## Development

```sh
npm ci
npm run research:validate
npm run check
npm test
npm run build
```

Use `npm run dev` for local development. The same environment variable can point deployment builds
to a separately provisioned, website-eligible upstream input.
