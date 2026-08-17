# Ilyenkov Archive Public

This public repository contains the Ilyenkov Archive website application, presentation layer, and
artifacts explicitly approved for Git-repository publication.

Its GitHub identity is `hoshF/ilyenkov-archive`; the local checkout may remain named
`Ilyenkov-public` to distinguish it from the private sibling research checkout.

Canonical research content, translations, source texts, rights evidence, and publication authority
remain in the private Ilyenkov research repository. Website-visible content is not necessarily
tracked in this repository.

## Publication input

The private publication workflow validates exact `website` approvals and creates a SHA-bound
temporary bundle in `.website-input/`. The directory is ignored and must never be committed. The
frontend validates and reads that bundle; it does not decide publication eligibility or scan the
private research tree.

For local development, set `ILYENKOV_RESEARCH_ROOT` to an authorized private research checkout.
The default is the sibling checkout at `../Ilyenkov`:

```sh
export ILYENKOV_RESEARCH_ROOT=../Ilyenkov
```

Content visible in a built or deployed website may therefore be absent from this repository's Git
history. A `website` approval never authorizes `git_repository` publication.

## Development

```sh
npm ci
npm run publication:prepare
npm run publication:validate
npm run check
npm test
npm run build
```

Use `npm run dev` for local development. The same environment variable can point deployment builds
to a separately provisioned authorized research checkout. CI or deployment must provision that
input outside this public repository.
