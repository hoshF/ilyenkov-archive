#!/usr/bin/env python3
"""Analyze and bulk-convert A.D. Maidansky filorus.ru HTML works to Markdown."""

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

AM_INDEX_URL = "http://filorus.ru/am/index.html"
MANIFEST_PATH = ROOT / "metadata" / "maidansky_catalog_manifest.json"
STATE_PATH = ROOT / "metadata" / "maidansky_bulk_state.json"
OUTPUT_ROOT = ROOT / "maidansky_md"

PDF_EXTENSIONS = {".pdf"}
HTML_EXTENSIONS = {".html", ".htm"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif"}

NAVIGATION_LABELS = {
    "Домой",
    "Работы",
    "Чтиво",
    "Вебсайты",
    "О себе",
    "начало",
    "тексты",
    "ссылки",
    "галерея",
    "сонеты",
    "проект",
}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def canonical_url(url: str, base_url: str = AM_INDEX_URL) -> str:
    return common.canonical_url(url, base_url)


def html_attr(attrs: str, name: str) -> str:
    match = re.search(rf"{name}\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))", attrs, flags=re.I)
    if not match:
        return ""
    return next((group for group in match.groups() if group is not None), "")


def normalize_title(text: str) -> str:
    text = common.compact_spaces(html.unescape(text).replace("\xa0", " "))
    text = re.sub(r"^А\.Д\.\s*Майданский\s*[—-]\s*", "", text)
    text = re.sub(r"^Читая Спинозу\s*[—-]\s*", "", text)
    return text.strip()


def parse_am_catalog(source: str) -> list[dict]:
    source = common.strip_scripts_and_ads(source)
    current_section = ""
    rows: list[dict] = []

    for line in source.splitlines():
        section_match = re.search(r"<p\b[^>]*class=[\"']hh[\"'][^>]*>(.*?)$", line, flags=re.I | re.S)
        if section_match:
            current_section = common.plain_text(section_match.group(1))
        if not current_section:
            continue
        for link_match in re.finditer(r"<a\b([^>]*href=[\"'][^\"']+[\"'][^>]*)>(.*?)</a>", line, flags=re.I | re.S):
            attrs, label = link_match.groups()
            href = html_attr(attrs, "href")
            if not href or href.startswith("mailto:"):
                continue
            url = canonical_url(href, AM_INDEX_URL)
            path = urlparse(url).path
            if any(part in path for part in ("/am/img/", "/images/")):
                continue
            title = common.plain_text(label) or common.plain_text(html_attr(attrs, "title"))
            if not title or title in NAVIGATION_LABELS:
                continue
            rows.append(
                {
                    "section": current_section,
                    "title": " ".join(title.split()),
                    "url": url,
                }
            )
    return rows


def classify_item(item: dict) -> tuple[str, str]:
    path = urlparse(item["url"]).path
    suffix = Path(path).suffix.lower()
    if suffix in PDF_EXTENSIONS:
        return "excluded_pdf", "PDF resource"
    if suffix not in HTML_EXTENSIONS:
        return "excluded", f"non-html resource: {suffix or 'no extension'}"
    if path.endswith("/index.html") or path == "/spinoza/method.html":
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


def is_probable_content_link(index_url: str, link: dict[str, str]) -> bool:
    url = link["url"]
    title = link["title"].strip()
    parsed = urlparse(url)
    path = parsed.path
    suffix = Path(path).suffix.lower()
    if parsed.netloc not in common.SOURCE_HOSTS:
        return False
    if url == index_url or url == AM_INDEX_URL:
        return False
    if suffix not in HTML_EXTENSIONS:
        return False
    if not title or title in NAVIGATION_LABELS:
        return False

    base_path = urlparse(index_url).path
    if base_path == "/spinoza/method.html":
        return path.startswith("/spinoza/meth/")
    if base_path.endswith("/index.html"):
        base_dir = str(Path(base_path).parent).replace("//", "/")
        if not base_dir.endswith("/"):
            base_dir += "/"
        if path.startswith(base_dir):
            return True
        # The "thinking body" polemic index intentionally links back to two
        # Maidansky articles in /am/text/.
        if base_path == "/am/polemica/index.html" and path.startswith("/am/text/"):
            return True
    return False


def useful_child_links(index_url: str, index_html: str) -> list[dict[str, str]]:
    seen: set[str] = set()
    rows: list[dict[str, str]] = []
    for link in common.extract_links(index_html, index_url):
        url = canonical_url(link["url"], index_url)
        normalized = {**link, "url": url, "title": " ".join(link["title"].split())}
        if not is_probable_content_link(index_url, normalized):
            continue
        if url in seen:
            continue
        seen.add(url)
        rows.append(normalized)
    return rows


def tx_count(source: str) -> int:
    return len(re.findall(r"class\s*=\s*(?:[\"'][^\"']*\btx\b[^\"']*[\"']|\btx\b)", source, flags=re.I))


def build_manifest(*, rebuild: bool, quiet: bool) -> dict:
    if MANIFEST_PATH.exists() and not rebuild:
        manifest = common.read_json(MANIFEST_PATH, {})
        if manifest:
            return manifest

    common.status("Fetching am/index.html for Maidansky catalog analysis", quiet)
    source = common.fetch_text(AM_INDEX_URL)
    items = parse_am_catalog(source)
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
            "duplicate_of": "",
        }
        manifest_items.append(record)

    for record in manifest_items:
        if record["kind"] != "directory":
            continue
        common.status(f"Discovering child pages: {record['title']}", quiet)
        try:
            index_html = common.fetch_text(record["url"])
            record["index_has_body"] = tx_count(index_html) > 0
            record["children"] = useful_child_links(record["url"], index_html)
        except Exception as exc:  # noqa: BLE001 - keep manifest generation fault-tolerant
            record["kind"] = "failed_discovery"
            record["exclude_reason"] = str(exc)

    manifest = {
        "source": AM_INDEX_URL,
        "generated_at": now_iso(),
        "items": manifest_items,
    }
    common.write_json(MANIFEST_PATH, manifest)
    return manifest


def title_from_html(source: str, fallback: str) -> str:
    for pattern in (
        r"<h1\b[^>]*>(.*?)</h1>",
        r"<p\b[^>]*class=[\"'][^\"']*\bhh\b[^\"']*[\"'][^>]*>(.*?)</p>",
    ):
        match = re.search(pattern, source, flags=re.I | re.S)
        if match:
            title = normalize_title(common.plain_text(match.group(1)))
            if title and title not in NAVIGATION_LABELS:
                return title
    return normalize_title(common.html_title(source)) or fallback


def image_links(source: str, base_url: str) -> list[str]:
    rows: list[str] = []
    seen: set[str] = set()
    for href in re.findall(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>\s*<img\b", source, flags=re.I | re.S):
        url = canonical_url(href, base_url)
        if Path(urlparse(url).path).suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if url in seen:
            continue
        seen.add(url)
        rows.append(url)
    return rows


def inline_markdown(fragment: str, page_key: str, base_url: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(
        r"<a\b[^>]*href=[\"']#b(\d+)[\"'][^>]*>.*?</a>",
        lambda m: f"[^{page_key}-{m.group(1)}]",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(
        r"<a\b([^>]*href=[\"'][^\"']+[\"'][^>]*)>\s*<img\b.*?</a>",
        lambda m: f"[Изображение]({canonical_url(html_attr(m.group(1), 'href'), base_url)})",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"<img\b[^>]*alt=[\"']([^\"']+)[\"'][^>]*>", lambda m: html.escape(m.group(1)), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<img\b[^>]*>", "", fragment, flags=re.I | re.S)
    fragment = re.sub(r"</?i\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?em\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?b\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"</?strong\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"<sup\b[^>]*>(.*?)</sup>", lambda m: "^" + inline_markdown(m.group(1), page_key, base_url), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<sub\b[^>]*>(.*?)</sub>", lambda m: "_" + inline_markdown(m.group(1), page_key, base_url), fragment, flags=re.I | re.S)

    def replace_link(match: re.Match[str]) -> str:
        attrs, label = match.groups()
        href = html_attr(attrs, "href")
        text = inline_markdown(label, page_key, base_url)
        if not text:
            return ""
        if href.startswith("#"):
            return text
        url = canonical_url(href, base_url)
        if text in NAVIGATION_LABELS:
            return ""
        return f"[{text}]({url})"

    fragment = re.sub(r"<a\b([^>]*href=[\"'][^\"']+[\"'][^>]*)>(.*?)</a>", replace_link, fragment, flags=re.I | re.S)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return common.compact_spaces(html.unescape(fragment))


def iter_blocks(source: str):
    token = re.compile(r"<(h[1-4]|p|div|li)\b([^>]*)>", flags=re.I)
    matches = list(token.finditer(source))
    for index, match in enumerate(matches):
        tag = match.group(1).lower()
        attrs = match.group(2) or ""
        class_name = common.class_value(attrs)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(source)
        fragment = source[start:end]
        if tag == "div":
            close = re.search(r"</div>", fragment, flags=re.I)
            if close:
                fragment = fragment[: close.start()]
        yield tag, class_name, attrs, fragment


def render_heading(text: str, level: int) -> str:
    text = text.replace("*", "").strip()
    return f"{'#' * min(level, 6)} {text}" if text else ""


def markdown_page(source: str, url: str, fallback_title: str = "", heading_level: int = 1) -> str:
    page_key = common.page_key_from_url(url)
    source = common.strip_scripts_and_ads(source)
    title = title_from_html(source, fallback_title or page_key)
    content_start = 0
    title_match = re.search(r"<h1\b[^>]*>.*?</h1>", source, flags=re.I | re.S)
    if title_match:
        content_start = title_match.start()
    elif re.search(r"class=[\"'][^\"']*\btx\b", source, flags=re.I):
        content_start = max(0, re.search(r"class=[\"'][^\"']*\btx\b", source, flags=re.I).start() - 300)
    work = source[content_start:]

    preface: list[str] = []
    body: list[str] = []
    footnotes: list[str] = []
    seen_text = False

    for tag, class_name, attrs, fragment in iter_blocks(work):
        class_tokens = set(class_name.split())
        text = inline_markdown(fragment, page_key, url)
        if not text or common.looks_like_navigation(text):
            continue
        if text == title:
            continue
        if tag.startswith("h"):
            level = int(tag[1]) + heading_level - 1
            heading = render_heading(text, level)
            if heading:
                body.append(heading)
            continue
        if "fn" in class_tokens:
            footnotes.extend(common.parse_footnotes(fragment, page_key))
            continue
        if "bb" in class_tokens:
            if not seen_text:
                preface.append(text)
            elif len(text) <= 180:
                body.append(render_heading(text, heading_level + 1))
            else:
                body.append(text)
            continue
        if "tx" in class_tokens or "m" in class_tokens or tag == "li" or not class_tokens:
            seen_text = True
            if tag == "li":
                body.append(f"- {text}")
            else:
                body.append(text)

    refs = set(re.findall(r"\[\^([^\]]+)\]", "\n\n".join(body)))
    defs = {note.split("]:", 1)[0][2:] for note in footnotes if note.startswith("[^") and "]:" in note}
    if refs - defs:
        for note in common.parse_loose_footnotes(work, page_key):
            note_id = note.split("]:", 1)[0][2:] if "]:" in note else ""
            if note_id and note_id not in defs:
                footnotes.append(note)
                defs.add(note_id)

    lines = [f"{'#' * heading_level} {title}", f"Источник: <{canonical_url(url, AM_INDEX_URL)}>"]
    lines.extend(preface)
    lines.extend(body)
    images = image_links(source, url)
    if images:
        lines.append(f"{'#' * min(heading_level + 1, 6)} Изображения")
        lines.extend(f"- [Изображение {index}]({image_url})" for index, image_url in enumerate(images, start=1))
    if footnotes:
        lines.append(f"{'#' * min(heading_level + 1, 6)} Примечания")
        lines.extend(footnotes)
    return "\n\n".join(line for line in lines if line and line.strip()).strip() + "\n"


def directory_summary(item: dict) -> str:
    lines = [
        f"# {item['title']}",
        f"Источник: <{item['url']}>",
    ]
    if item.get("children"):
        lines.append("## Содержание")
        for child in item["children"]:
            lines.append(f"- {child['title']}")
    return "\n\n".join(lines)


def convert_single(item: dict) -> str:
    source = common.fetch_text(item["url"])
    return markdown_page(source, item["url"], fallback_title=item["title"], heading_level=1)


def convert_directory(item: dict) -> str:
    parts = [directory_summary(item)]
    index_html = common.fetch_text(item["url"])
    if item.get("index_has_body"):
        body = markdown_page(index_html, item["url"], fallback_title=item["title"], heading_level=2)
        if len(body.split()) > 30:
            parts.append(body)
    elif not item.get("children"):
        body = markdown_page(index_html, item["url"], fallback_title=item["title"], heading_level=2)
        if len(body.split()) > 20:
            parts.append(body)
    for child in item.get("children", []):
        source = common.fetch_text(child["url"])
        parts.append(markdown_page(source, child["url"], fallback_title=child["title"], heading_level=2))
    return "\n\n---\n\n".join(part.strip() for part in parts if part.strip()) + "\n"


def item_by_id(manifest: dict, item_id: str) -> dict:
    for item in manifest["items"]:
        if item["id"] == item_id:
            return item
    raise KeyError(f"No manifest item with id {item_id}")


def eligible_items(manifest: dict, only: str | None = None) -> list[dict]:
    if only:
        item = item_by_id(manifest, only)
        if item["kind"] not in {"single", "directory"}:
            raise ValueError(f"Item {only} is not convertible: {item['kind']} {item['exclude_reason']}")
        return [item]
    return [item for item in manifest["items"] if item["kind"] in {"single", "directory"}]


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
            if duplicate_of and duplicate_of != item["id"] and not args.force:
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
                "child_count": len(item.get("children", [])),
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
    print("Directories:")
    for item in manifest["items"]:
        if item["kind"] == "directory":
            print(f"  {item['id']}: children={len(item.get('children', []))} url={item['url']}")


def validate_outputs(manifest: dict, state: dict) -> int:
    failures: list[str] = []
    for item in eligible_items(manifest):
        state_item = state.get("items", {}).get(item["id"], {})
        if state_item.get("status") == "duplicate":
            continue
        if state_item.get("status") != "done":
            failures.append(f"{item['id']}: status={state_item.get('status')}")
            continue
        path = ROOT / item["output_path"]
        if not longform.materialized_output_exists(path, root=PROJECT_ROOT):
            failures.append(f"{item['id']}: missing output")
            continue
        text = longform.read_materialized_text(path, root=PROJECT_ROOT)
        if "Источник:" not in text:
            failures.append(f"{item['id']}: missing source")
        if "<script" in text.lower() or "yandex" in text.lower():
            failures.append(f"{item['id']}: contains script/ad residue")
        refs = set(re.findall(r"\[\^([^\]]+)\]", text))
        defs = set(re.findall(r"^\[\^([^\]]+)\]:", text, flags=re.M))
        if refs - defs:
            failures.append(f"{item['id']}: missing footnote definitions {sorted(refs - defs)[:5]}")
        if item["kind"] == "directory":
            actual = text.count("\n---\n")
            expected_min = len(item.get("children", []))
            if actual < expected_min:
                failures.append(f"{item['id']}: expected at least {expected_min} section separators, got {actual}")
    if failures:
        print("Validation failures:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("Validation passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze and bulk-convert filorus.ru Maidansky HTML works to Markdown.")
    parser.add_argument("--resume", action="store_true", help="Skip completed items whose output hash still matches state")
    parser.add_argument("--force", action="store_true", help="Re-convert even completed or duplicate items")
    parser.add_argument("--only", help="Convert only one manifest item id")
    parser.add_argument("--limit", type=int, help="Convert only the first N eligible items")
    parser.add_argument("--dry-run", action="store_true", help="Build/print manifest but do not convert")
    parser.add_argument("--rebuild-manifest", action="store_true", help="Re-fetch am/index.html and rebuild manifest")
    parser.add_argument("--validate", action="store_true", help="Validate completed outputs without converting")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress messages")
    args = parser.parse_args()

    manifest = build_manifest(rebuild=args.rebuild_manifest, quiet=args.quiet)
    if args.dry_run:
        print_manifest_summary(manifest)
        return 0
    if args.validate:
        state = common.read_json(STATE_PATH, {"items": {}})
        return validate_outputs(manifest, state)
    return convert_items(args, manifest)


if __name__ == "__main__":
    raise SystemExit(main())
