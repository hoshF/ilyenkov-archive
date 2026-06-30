#!/usr/bin/env python3
"""Audit Maidansky Markdown conversion coverage for missed same-site HTML links."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import ilyenkov_common as common
import maidansky_bulk_convert as maidansky


ROOT = Path(__file__).resolve().parent
INTERESTING_PREFIXES = (
    "/am/text/",
    "/am/polemica/",
    "/am/plagiat/",
    "/ilyenkov/mater/",
    "/spinoza/meth/",
    "/spinoza/method.html",
)
IGNORE_PATHS = {
    "/am/index.html",
    "/am/libra.html",
    "/am/links.html",
    "/maidansky.html",
    "/maidansky.htm",
    "/spinoza/index.html",
    "/spinoza/studia.html",
    "/spinoza/links.html",
    "/spinoza/gala.html",
    "/spinoza/poiesis.html",
    "/spinoza/project.html",
    "/ilyenkov/index.html",
    "/favicon.ico",
}


def covered_pages(manifest: dict) -> tuple[set[str], list[tuple[str, str]]]:
    covered: set[str] = set()
    pages: list[tuple[str, str]] = []
    for item in manifest.get("items", []):
        if item.get("kind") not in {"single", "directory"}:
            continue
        covered.add(item["url"])
        pages.append((item["id"], item["url"]))
        for child in item.get("children", []):
            covered.add(child["url"])
            pages.append((f"{item['id']}::child", child["url"]))
    return covered, pages


def should_ignore_link(link_url: str, title: str, page_url: str, covered: set[str]) -> bool:
    parsed = urlparse(link_url)
    path = parsed.path
    suffix = Path(path).suffix.lower()
    if parsed.netloc not in common.SOURCE_HOSTS:
        return True
    if link_url == page_url or link_url in covered:
        return True
    if suffix not in maidansky.HTML_EXTENSIONS:
        return True
    if path in IGNORE_PATHS:
        return True
    if not title or title in maidansky.NAVIGATION_LABELS:
        return True
    if re.fullmatch(r"[§\d\sIVXА-ЯA-Z.]+", title):
        return True
    return not path.startswith(INTERESTING_PREFIXES)


def audit(manifest: dict, *, quiet: bool = False) -> list[dict]:
    covered, pages = covered_pages(manifest)
    findings: list[dict] = []
    for owner, page_url in pages:
        common.status(f"audit {page_url}", quiet)
        try:
            source = common.fetch_text(page_url, delay=0.05)
        except Exception as exc:  # noqa: BLE001 - report fetch failures as audit findings
            findings.append({"owner": owner, "from": page_url, "title": "FETCH_FAILED", "url": "", "error": str(exc)})
            continue
        for link in common.extract_links(source, page_url):
            url = common.canonical_url(link["url"], page_url)
            title = " ".join(link["title"].split())
            if should_ignore_link(url, title, page_url, covered):
                continue
            findings.append({"owner": owner, "from": page_url, "title": title, "url": url})
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Maidansky manifest for uncovered same-site HTML links.")
    parser.add_argument("--manifest", type=Path, default=maidansky.MANIFEST_PATH)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    findings = audit(manifest, quiet=args.quiet)
    if not findings:
        print("No uncovered Maidansky HTML links found.")
        return 0
    print("Uncovered Maidansky HTML links:")
    for finding in findings:
        print(f"- owner: {finding['owner']}")
        print(f"  from: {finding['from']}")
        print(f"  title: {finding['title']}")
        print(f"  url: {finding['url']}")
        if finding.get("error"):
            print(f"  error: {finding['error']}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
