---
title: "Maidansky Website Source Attribution"
created: "2026-06-17"
updated: "2026-06-22"
type: "project"
tags: ["source-attribution", "maidansky", "ilyenkov", "filorus"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Maidansky Website Source Attribution

On June 17, 2026, Andrey D. Maidansky stated that:

- he no longer owns `caute.ru`;
- citations to texts from his website should use `http://filorus.ru/ilyenkov`;
- the URL should be followed by `(at the website by Andrey Maidansky)`.

Use:

```text
http://filorus.ru/ilyenkov/... (at the website by Andrey Maidansky)
```

Machine-readable fields such as `source_url` contain only the URL. Visible source lines and project
documentation append the attribution phrase.

If a harvested text has no matching body page on the current `filorus.ru` site, retain the actual
accessible historical URL and identify it as a historical exception in the visible source line.

`caute_ru_markdown/` remains unchanged because it is an acquisition-history path used by slugs,
manifests, and existing references. It no longer identifies the recommended citation host.
