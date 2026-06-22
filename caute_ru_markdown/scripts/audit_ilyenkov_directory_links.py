#!/usr/bin/env python3
"""Audit directory index pages for HTML links not covered by the manifest."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "ilyenkov_catalog_manifest.json"

NAV_PATHS = {
    "/ilyenkov/texts.html",
    "/ilyenkov/index.html",
    "/ilyenkov/biog.html",
    "/ilyenkov/fgall.html",
    "/ilyenkov/opera.html",
    "/ilyenkov/links.html",
    "/ilyenkov/project.html",
}

NAV_TITLES = {
    "Индекс",
    "Биография",
    "Тексты",
    "Фотогалерея",
    "Библиография",
    "Ссылки",
    "Проект",
    "Далее",
    "Назад",
    "Оглавление",
    "Домой",
}


def load_common():
    spec = importlib.util.spec_from_file_location("ilyenkov_common", ROOT / "ilyenkov_common.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load ilyenkov_common.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


common = load_common()


def is_ignorable_link(title: str, path: str) -> bool:
    if title in NAV_TITLES or title.isdigit():
        return True
    if path in NAV_PATHS:
        return True
    if path.endswith((".jpg", ".jpeg", ".gif", ".png", ".djvu", ".zip", ".ico")):
        return True
    if path.startswith("/files/") or path.startswith("/ilyenkov/gra/"):
        return True
    return False


def audit(manifest: dict) -> list[dict]:
    findings: list[dict] = []
    for item in manifest["items"]:
        if item.get("kind") != "directory":
            continue
        source = common.fetch_text(item["url"], retries=2)
        children = {child["url"] for child in item.get("children", [])}
        ignored = []
        for link in common.extract_links(source, item["url"]):
            url = link["url"]
            title = link["title"]
            parsed = urlparse(url)
            if parsed.netloc not in common.SOURCE_HOSTS:
                continue
            if url == item["url"] or url in children:
                continue
            if is_ignorable_link(title, parsed.path):
                continue
            ignored.append({"title": title, "url": url})
        if ignored:
            findings.append(
                {
                    "id": item["id"],
                    "title": item["title"],
                    "url": item["url"],
                    "ignored_links": ignored,
                }
            )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit directory index pages for missed HTML/content links.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON findings")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    findings = audit(manifest)
    if args.json:
        print(json.dumps(findings, ensure_ascii=False, indent=2))
    else:
        if not findings:
            print("No uncovered directory links found.")
        for finding in findings:
            print(f"{finding['id']}: {finding['title']}")
            for link in finding["ignored_links"]:
                print(f"  - {link['title']} {link['url']}")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
