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

`npm run publication:prepare` is the canonical command for creating this input. When the authorized
research checkout is not available at the default location, set `ILYENKOV_RESEARCH_ROOT` before
running commands that prepare content.

Content visible in a built or deployed website may therefore be absent from this repository's Git
history. A `website` approval never authorizes `git_repository` publication.

## Development

```sh
npm ci
npm run publication:prepare
npm run publication:validate
npm run dev
npm run check
npm test
npm run build
```

`npm run dev` prepares publication input and starts Astro in background mode. Inspect or stop it
with `npm run dev:status`, `npm run dev:logs`, and `npm run dev:stop`. Deployment builds must
provision authorized research input outside this public repository.
