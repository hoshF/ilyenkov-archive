---
title: "Academia.edu 403 Investigation"
created: "2026-07-03"
updated: "2026-07-03"
type: "operations-note"
tags: ["academia", "source-discovery", "cloudflare", "maidansky"]
language: "en"
collection: "project-documentation"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---
# Academia.edu 403 Investigation

## Summary

The current Academia.edu 403 is a Cloudflare browser challenge against non-browser HTTP clients,
not evidence that Maidansky Academia pages are gone or that the work pages are inherently private.

Tests on 2026-07-03:

- `curl` with no cookie: HTTP 403.
- `curl` with a local Netscape cookie file: HTTP 403.
- `curl` with the same cookie file plus a browser-like User-Agent and Accept headers: HTTP 403.
- In-app browser navigation to the same pages: page content loads.

The 403 response contains Cloudflare challenge markers:

- `cf-mitigated: challenge`
- `server: cloudflare`
- body title `Just a moment...`
- text asking to enable JavaScript
- references to `challenges.cloudflare.com`

## Cookie Findings

The local cookie file is readable by MozillaCookieJar and includes Academia session/login cookies.
It does not include `cf_clearance`. The included `__cf_bm` cookie is a Cloudflare bot-management
cookie and is not the same as a challenge-clearance token.

No cookie values should be logged, committed, or copied into repository files.

## Browser Findings

The in-app browser could load these pages without landing on the Cloudflare challenge page:

- `https://www.academia.edu/2161910/The_Russian_Spinozists`
- `https://xn--90aefy5b.academia.edu/AndreyMaidansky`
- `https://www.academia.edu/95704694/Культурно_историческая_психология_Истоки_и_новая_реальность`

The manual-queue work page was visible in the browser as:

- title: `(PDF) Культурно-историческая психология: Истоки и новая реальность`
- visible metadata: `2022`, `1 page`, `2 files`

This does not authorize or imply downloading attachments. It only establishes that the work page is
browser-accessible.

## Cause

The existing `maidansky_markdown/scripts/academia_download.py` workflow uses `urllib` and `curl`.
Those clients can send cookies and browser-like headers, but they do not reproduce the full browser
environment that Cloudflare evaluates, including JavaScript challenge execution, client hints,
browser storage state, and TLS/client fingerprint. Academia's Cloudflare layer therefore serves the
challenge page before Academia application content reaches the script.

## Implications

- Existing local Academia manifests remain useful as registered bibliography/source-scan records.
- CLI-based refresh or download code should expect Cloudflare 403 unless the access path is changed.
- Browser-based HTML inspection can verify public work pages, but should remain read-only unless the
  owner explicitly authorizes a separate attachment acquisition task.
- Do not read PDF text layers, run OCR, or convert Academia attachments into Markdown as part of 403
  investigation.

## Recommended Workflow

Use a human-in-the-loop acquisition workflow instead of trying to bypass Cloudflare from scripts:

1. The agent performs browser-based or manifest-based discovery only.
2. The agent records candidate work pages, visible metadata, relation tags, and acquisition priority.
3. The owner manually downloads or collects files in a normal browser session when needed.
4. The owner places collected files under the appropriate `source_scans/` staging path.
5. The agent registers each supplied file by path, hash, format, size, source URL, and rights-review
   status.

This keeps the automated part focused on search, deduplication, bibliographic matching, and queue
maintenance. File acquisition remains a deliberate owner action, and source scans remain
unprocessed until a separate digitization project is approved.

Suggested queue fields for future Academia candidates:

- `work_url`
- `title`
- `visible_metadata`
- `relation_tags`
- `priority`
- `manual_acquisition_status`
- `owner_supplied_local_path`
- `registration_status`
