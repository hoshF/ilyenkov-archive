#!/usr/bin/env python3
"""Analyze and bulk-convert filorus.ru Ilyenkov HTML texts to Markdown."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

import ilyenkov_common as common


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
import split_longform_markdown as longform  # noqa: E402

MANIFEST_PATH = ROOT / "metadata" / "ilyenkov_catalog_manifest.json"
STATE_PATH = ROOT / "metadata" / "ilyenkov_bulk_state.json"
OUTPUT_ROOT = ROOT / "ilyenkov_md"

ALREADY_DONE = {
    "http://filorus.ru/ilyenkov/texts/dmx/index.html": "ilyenkov_md/already-done/dialectics_abstract_concrete_capital_ilyenkov_ru.md",
    "http://filorus.ru/ilyenkov/texts/dla/index.html": "ilyenkov_md/already-done/dialectical_logic_ilyenkov_ru.md",
    "http://filorus.ru/ilyenkov/texts/leninact.html": "ilyenkov_md/already-done/lenin_and_dialectical_logic_ilyenkov_rosenthal_ru.md",
}

EXCLUDED_SECTIONS = {
    "Газетные статьи",
    "Военная публицистика",
    "Фотокопии газетных статей",
    "Копии изданий в формате djvu",
}

EXCLUDED_EXTENSIONS = {".djvu", ".jpg", ".jpeg", ".png", ".gif", ".zip"}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def parse_year(text: str) -> str:
    match = re.search(r"\(([^)]*(?:\d{4}|50-х|60-х)[^)]*)\)", html.unescape(text).replace("\xa0", " "))
    return match.group(1).strip() if match else ""


def parse_texts_catalog(source: str) -> list[dict]:
    source = common.strip_scripts_and_ads(source)
    section_matches = list(re.finditer(r"<(?:p|div)\b[^>]*class=[\"']rr[\"'][^>]*>(.*?)</(?:p|div)>", source, flags=re.I | re.S))
    raw_items: list[dict] = []
    for index, section_match in enumerate(section_matches):
        section = common.plain_text(section_match.group(1))
        body_start = section_match.end()
        body_end = section_matches[index + 1].start() if index + 1 < len(section_matches) else len(source)
        section_body = source[body_start:body_end]
        for link_match in re.finditer(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>(.*?)(?:<br\s*/?>|$)", section_body, flags=re.I | re.S):
            href, label, tail = link_match.groups()
            url = common.canonical_url(href, common.TEXTS_URL)
            title = common.plain_text(label)
            if not title:
                continue
            raw_items.append(
                {
                    "section": section,
                    "title": " ".join(title.split()),
                    "year": parse_year(tail),
                    "url": url,
                }
            )
    return raw_items


def classify_item(item: dict) -> tuple[str, str]:
    url = item["url"]
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if url in ALREADY_DONE:
        return "already_done", f"already converted: {ALREADY_DONE[url]}"
    if item["section"] in EXCLUDED_SECTIONS:
        return "excluded", f"excluded section: {item['section']}"
    if path.startswith("/files/") or path.startswith("/ilyenkov/gra/") or suffix in EXCLUDED_EXTENSIONS:
        return "excluded", "binary/image/djvu/zip resource"
    if suffix != ".html":
        return "excluded", f"non-html resource: {suffix or 'no extension'}"
    if path.endswith("/index.html"):
        return "directory", ""
    return "single", ""


def make_unique_ids(items: list[dict]) -> None:
    seen: Counter[str] = Counter()
    for item in items:
        base = common.slugify(f"{item['section']} {item['title']}")
        seen[base] += 1
        item["id"] = base if seen[base] == 1 else f"{base}-{seen[base]}"


def output_path_for(item: dict) -> str:
    section_slug = common.slugify(item["section"])
    return str((OUTPUT_ROOT / section_slug / f"{item['id']}.md").relative_to(ROOT))


def useful_child_links(index_url: str, index_html: str) -> list[dict[str, str]]:
    base_path = urlparse(index_url).path
    rows: list[dict[str, str]] = []
    by_url: dict[str, dict[str, str]] = {}
    for link in common.extract_links(index_html, index_url):
        url = link["url"]
        path = urlparse(url).path
        if url == index_url or url == common.TEXTS_URL:
            continue
        if url in ALREADY_DONE:
            continue
        if urlparse(url).netloc not in common.SOURCE_HOSTS:
            continue
        if not (path.startswith("/ilyenkov/texts/") or path.startswith("/ilyenkov/tra/") or path.startswith("/am/text/")):
            continue
        if Path(path).suffix.lower() != ".html":
            continue
        title = link["title"]
        if not title or title.isdigit():
            continue
        existing = by_url.get(url)
        if existing is None or (existing["title"].isdigit() and not title.isdigit()):
            by_url[url] = {"url": url, "title": title}
    for link in by_url.values():
        # Keep links in page order while still allowing collection pages to include
        # cross-folder chapters such as phc -> ums.
        if link not in rows:
            rows.append(link)
    if not rows and not base_path.endswith("/index.html"):
        return []
    return rows


def tx_count(source: str) -> int:
    return len(re.findall(r"class\s*=\s*(?:[\"']tx[\"']|tx(?:\s|>))", source, flags=re.I))


def build_manifest(*, rebuild: bool, quiet: bool) -> dict:
    if MANIFEST_PATH.exists() and not rebuild:
        manifest = common.read_json(MANIFEST_PATH, {})
        if manifest:
            return manifest

    common.status("Fetching texts.html for catalog analysis", quiet)
    source = common.fetch_text(common.TEXTS_URL)
    items = parse_texts_catalog(source)
    make_unique_ids(items)

    manifest_items: list[dict] = []
    for item in items:
        kind, reason = classify_item(item)
        record = {
            **item,
            "kind": kind,
            "exclude_reason": reason,
            "output_path": output_path_for(item) if kind in {"single", "directory"} else "",
            "children": [],
            "covered_by": "",
            "duplicate_of": "",
        }
        if kind == "already_done":
            record["output_path"] = ALREADY_DONE[item["url"]]
        manifest_items.append(record)

    directory_by_child: dict[str, str] = {}
    for record in manifest_items:
        if record["kind"] != "directory":
            continue
        common.status(f"Discovering chapters: {record['title']}", quiet)
        try:
            index_html = common.fetch_text(record["url"])
            record["index_has_body"] = tx_count(index_html) > 0
            record["children"] = useful_child_links(record["url"], index_html)
            for child in record["children"]:
                directory_by_child.setdefault(child["url"], record["id"])
        except Exception as exc:  # noqa: BLE001 - keep manifest generation fault-tolerant
            record["kind"] = "failed_discovery"
            record["exclude_reason"] = str(exc)

    for record in manifest_items:
        if record["kind"] == "single" and record["url"] in directory_by_child:
            record["covered_by"] = directory_by_child[record["url"]]
            record["kind"] = "covered"
            record["exclude_reason"] = f"covered by directory item: {record['covered_by']}"
            record["output_path"] = ""

    manifest = {
        "source": common.TEXTS_URL,
        "generated_at": now_iso(),
        "already_done": ALREADY_DONE,
        "excluded_sections": sorted(EXCLUDED_SECTIONS),
        "items": manifest_items,
    }
    common.write_json(MANIFEST_PATH, manifest)
    return manifest


def item_by_id(manifest: dict, item_id: str) -> dict:
    for item in manifest["items"]:
        if item["id"] == item_id:
            return item
    raise KeyError(f"No manifest item with id {item_id}")


def eligible_items(manifest: dict, only: str | None = None) -> list[dict]:
    items = [item for item in manifest["items"] if item["kind"] in {"single", "directory"}]
    if only:
        items = [item_by_id(manifest, only)]
        if items[0]["kind"] not in {"single", "directory"}:
            raise ValueError(f"Item {only} is not convertible: {items[0]['kind']} {items[0]['exclude_reason']}")
    return items


def convert_single(item: dict) -> str:
    source = common.fetch_text(item["url"])
    return common.markdown_page(source, item["url"], fallback_title=item["title"], heading_level=1)


def directory_summary(item: dict) -> str:
    lines = [
        f"# {item['title']}",
        f"Источник: <{item['url']}>",
    ]
    if item.get("year"):
        lines.append(f"Год: {item['year']}")
    if item.get("children"):
        lines.append("## Содержание")
        for child in item["children"]:
            lines.append(f"- {child['title']}")
    return "\n\n".join(lines)


def convert_directory(item: dict) -> str:
    parts = [directory_summary(item)]
    index_html = common.fetch_text(item["url"])
    if item.get("index_has_body"):
        body = common.markdown_page(index_html, item["url"], fallback_title=item["title"], heading_level=2)
        if len(body.split()) > 30:
            parts.append(body)
    for child in item.get("children", []):
        source = common.fetch_text(child["url"])
        parts.append(common.markdown_page(source, child["url"], fallback_title=child["title"], heading_level=2))
    return "\n\n---\n\n".join(part.strip() for part in parts if part.strip()) + "\n"


def state_item_complete(state_item: dict, item: dict) -> bool:
    if state_item.get("status") != "done":
        return False
    output_path = ROOT / item["output_path"]
    if not longform.materialized_output_exists(output_path, root=PROJECT_ROOT):
        return False
    return common.markdown_hash(longform.read_materialized_text(output_path, root=PROJECT_ROOT)) == state_item.get("hash")


def load_existing_hashes(state: dict) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for item_id, state_item in state.get("items", {}).items():
        if state_item.get("status") == "done" and state_item.get("hash"):
            hashes[state_item["hash"]] = item_id
    for url, path in ALREADY_DONE.items():
        full_path = ROOT / path
        if longform.materialized_output_exists(full_path, root=PROJECT_ROOT):
            hashes[common.markdown_hash(longform.read_materialized_text(full_path, root=PROJECT_ROOT))] = f"already_done:{url}"
    return hashes


def mark_manifest_duplicate(item_id: str, duplicate_of: str) -> None:
    manifest = common.read_json(MANIFEST_PATH, {})
    for item in manifest.get("items", []):
        if item.get("id") == item_id:
            item["duplicate_of"] = duplicate_of
            break
    common.write_json(MANIFEST_PATH, manifest)


def convert_items(args: argparse.Namespace, manifest: dict) -> int:
    state = common.read_json(STATE_PATH, {"items": {}})
    state.setdefault("items", {})
    seen_hashes = load_existing_hashes(state)
    items = eligible_items(manifest, args.only)
    if args.limit is not None:
        items = items[: args.limit]

    converted = skipped = failed = 0
    for item in items:
        item_state = state["items"].get(item["id"], {})
        if args.resume and not args.force and state_item_complete(item_state, item):
            skipped += 1
            common.status(f"skip done {item['id']}", args.quiet)
            continue

        common.status(f"convert {item['id']} ({item['kind']})", args.quiet)
        try:
            markdown = convert_directory(item) if item["kind"] == "directory" else convert_single(item)
            digest = common.markdown_hash(markdown)
            duplicate_of = seen_hashes.get(digest)
            if duplicate_of and not args.force:
                state["items"][item["id"]] = {
                    "status": "duplicate",
                    "duplicate_of": duplicate_of,
                    "hash": digest,
                    "updated_at": now_iso(),
                }
                mark_manifest_duplicate(item["id"], duplicate_of)
                skipped += 1
                common.write_json(STATE_PATH, state)
                continue
            output_path = ROOT / item["output_path"]
            longform.write_or_split(output_path, markdown, root=PROJECT_ROOT)
            seen_hashes[digest] = item["id"]
            state["items"][item["id"]] = {
                "status": "done",
                "hash": digest,
                "output_path": item["output_path"],
                "updated_at": now_iso(),
                "bytes": longform.materialized_output_bytes(output_path, root=PROJECT_ROOT),
            }
            converted += 1
        except Exception as exc:  # noqa: BLE001 - record failures and keep going
            failed += 1
            state["items"][item["id"]] = {
                "status": "failed",
                "error": str(exc),
                "updated_at": now_iso(),
            }
        common.write_json(STATE_PATH, state)

    common.status(f"converted={converted} skipped={skipped} failed={failed}", args.quiet)
    return 1 if failed else 0


def print_manifest_summary(manifest: dict) -> None:
    by_kind = Counter(item["kind"] for item in manifest["items"])
    by_section = defaultdict(Counter)
    for item in manifest["items"]:
        by_section[item["section"]][item["kind"]] += 1
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Total items: {len(manifest['items'])}")
    for kind, count in sorted(by_kind.items()):
        print(f"  {kind}: {count}")
    print("Sections:")
    for section, counter in sorted(by_section.items()):
        summary = ", ".join(f"{kind}={count}" for kind, count in sorted(counter.items()))
        print(f"  {section}: {summary}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze and bulk-convert filorus.ru Ilyenkov texts to Markdown.")
    parser.add_argument("--resume", action="store_true", help="Skip completed items whose output hash still matches state")
    parser.add_argument("--force", action="store_true", help="Re-convert even completed or duplicate items")
    parser.add_argument("--only", help="Convert only one manifest item id")
    parser.add_argument("--limit", type=int, help="Convert only the first N eligible items")
    parser.add_argument("--dry-run", action="store_true", help="Build/print manifest but do not convert")
    parser.add_argument("--rebuild-manifest", action="store_true", help="Re-fetch texts.html and rebuild manifest")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress messages")
    args = parser.parse_args()

    manifest = build_manifest(rebuild=args.rebuild_manifest, quiet=args.quiet)
    if args.dry_run:
        print_manifest_summary(manifest)
        return 0
    return convert_items(args, manifest)


if __name__ == "__main__":
    raise SystemExit(main())
