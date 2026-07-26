#!/usr/bin/env python3
"""转换 filorus 上的 2004 年《伊里因科夫回忆录》HTML 正文。"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "https://filorus.ru/ilyenkov/biog/rem/"
INDEX_URL = urljoin(BASE_URL, "content.html")
BOOK_URL = urljoin(BASE_URL, "index.html")
AUTHORS_URL = urljoin(BASE_URL, "auctores.html")
WORK_ID = "evald-ilyenkov-v-vospominaniyakh-2004"
OUTPUT_DIR = ROOT / "ilyenkov_markdown/ilyenkov_biography_md/memoirs" / WORK_ID
MANIFEST_PATH = ROOT / "ilyenkov_markdown/metadata/ilyenkov_biography_manifest.json"
CREATED = "2026-07-09"
MANIFEST_GENERATED_AT = "2026-07-10"

BOOK_RECORD = {
    "title": "Эвальд Васильевич Ильенков в воспоминаниях",
    "editor": "Г.В. Лобастов",
    "publication": "М.: РГГУ, 2004",
    "preparing_organization": "Философское общество «Диалектика и культура»",
    "isbn": "5-9290-00573",
    "source_url": BOOK_URL,
    "contents_url": INDEX_URL,
    "authors_url": AUTHORS_URL,
}

CYRILLIC_MAP = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "i",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)


def fetch(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        data = response.read()
    return data.decode("windows-1251", errors="replace")


def clean_inline(value: str) -> str:
    value = re.sub(r"<a\s+[^>]*name=[\"']t(\d+)[\"'][^>]*>.*?</a>", r"[^\1]", value, flags=re.I | re.S)
    value = re.sub(r"<i>(.*?)</i>", r"*\1*", value, flags=re.I | re.S)
    value = re.sub(r"<b>(.*?)</b>", r"**\1**", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value).replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return re.sub(r"\s+([.,;:!?])", r"\1", value)


def clean_plain(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value).replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return re.sub(r"\s+([.,;:!?])", r"\1", value)


def slugify(value: str) -> str:
    value = value.lower().translate(CYRILLIC_MAP)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def markdown_front_matter(item: dict[str, object]) -> str:
    metadata: dict[str, object] = {
        "title": item["title"],
        "created": CREATED,
        "type": "analysis",
        "tags": ["ilyenkov", "memoirs", "biography", "secondary-source"],
        "language": "ru",
        "collection": "ilyenkov-biography",
        "llm_wiki_eligible": "true",
        "gbrain_source": "project-markdown",
        "text_role": "research",
        "core_corpus_eligible": "false",
        "source_format": "html",
        "transcription_mode": "agent_canonical_markdown",
        "source_license": "not_stated",
        "redistribution_approved": "false",
        "rights_review_status": "unreviewed",
        "text_status": "html_conversion_unverified",
        "source_url": item["source_url"],
        "work_id": WORK_ID,
        "chapter_index": f"{item['index']:03d}",
        "chapter_title": item["title"],
    }
    lines = ["---"]
    for key, value in metadata.items():
        if isinstance(value, list):
            rendered = "[" + ", ".join(json.dumps(part, ensure_ascii=False) for part in value) + "]"
        else:
            rendered = json.dumps(str(value), ensure_ascii=False)
        lines.append(f"{key}: {rendered}")
    lines.extend(["---", ""])
    return "\n".join(lines)


def parse_contents(text: str) -> tuple[list[dict[str, object]], int | None]:
    links: list[tuple[str, str]] = []
    for match in re.finditer(r"<a\s+[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", text, re.I | re.S):
        href = match.group(1)
        label = clean_plain(match.group(2))
        links.append((href, label))

    items: list[dict[str, object]] = []
    total_pages: int | None = None
    for href, label in links:
        if href == "auctores.html":
            continue
        if href == "index.html" and label.isdigit():
            total_pages = int(label)
            continue
        if not re.fullmatch(r"\d{2}\.html", href):
            continue
        if label.isdigit():
            if items and items[-1]["href"] == href:
                items[-1]["start_page"] = int(label)
            continue
        if not label:
            continue
        if " – " in label:
            author, title = label.split(" – ", 1)
        else:
            author, title = "", label
        items.append(
            {
                "index": int(href[:2]),
                "href": href,
                "author": author.strip(),
                "title": title.strip(),
                "source_url": urljoin(BASE_URL, href),
            }
        )
    for current, next_item in zip(items, items[1:]):
        if current.get("start_page") and next_item.get("start_page"):
            current["end_page"] = int(next_item["start_page"]) - 1
    if items and total_pages and items[-1].get("start_page"):
        items[-1]["end_page"] = total_pages - 1
    return items, total_pages


def extract_table_cells(text: str) -> list[str]:
    cells: list[str] = []
    table_re = re.compile(
        r"<table\b(?=[^>]*\bclass=[\"'][^\"']*\btb\b[^\"']*[\"'])"
        r"(?=[^>]*\bcellpadding=[\"']20[\"'])[^>]*>(.*?)</table>",
        re.I | re.S,
    )
    for table in table_re.findall(text):
        match = re.search(r"<td(?:\s+[^>]*)?>(.*?)</td>", table, re.I | re.S)
        if match:
            cells.append(match.group(1))
    return cells


def convert_html_fragment(fragment: str) -> str:
    fragment = re.sub(r"\s*\r?\n\s*", " ", fragment)
    fragment = re.sub(
        r"<a\s+[^>]*name=[\"']b(\d+)[\"'][^>]*>.*?</a>\s*(?:&nbsp;)?",
        lambda match: f"\n\n[^{match.group(1)}]: ",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(
        r"<a\s+[^>]*name=[\"']t(\d+)[\"'][^>]*>.*?</a>",
        lambda match: f"[^{match.group(1)}]",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(
        r"<h3[^>]*>(.*?)</h3>",
        lambda match: "\n\n## " + clean_inline(match.group(1)) + "\n\n",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"<h[12][^>]*>.*?</h[12]>", "\n\n", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<p\s+class=\"tx\"\s+style=\"text-indent:0\"[^>]*>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<p\s+class=\"tx\"[^>]*>", "\n\n", fragment, flags=re.I)
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<hr\s*/?>", "\n\n---\n\n", fragment, flags=re.I)
    fragment = re.sub(r"<i>(.*?)</i>", r"*\1*", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<b>(.*?)</b>", r"**\1**", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<a\s+[^>]*>(.*?)</a>", r"\1", fragment, flags=re.I | re.S)
    fragment = re.sub(r"</?(?:span)[^>]*>", "", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = html.unescape(fragment).replace("\xa0", " ")
    fragment = fragment.replace("\r", "")
    fragment = re.sub(r"[ \t]+", " ", fragment)
    fragment = re.sub(r" *\n *", "\n", fragment)
    fragment = re.sub(r"\n{3,}", "\n\n", fragment)

    blocks = []
    for block in fragment.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        if block.startswith("## ") or block == "---":
            blocks.append(block)
        elif block.startswith("[^"):
            blocks.append(re.sub(r"\s*\n\s*", " ", block))
        else:
            blocks.append(re.sub(r"\s*\n\s*", " ", block))
    return "\n\n".join(blocks).strip()


def convert_page(item: dict[str, object]) -> tuple[str, int]:
    text = fetch(str(item["source_url"]))
    body = convert_html_fragment(" ".join(extract_table_cells(text)))
    parts = [
        markdown_front_matter(item),
        f"# {item['title']}",
        "",
        f"Автор: {item['author']}",
        "",
        f"Источник: <{item['source_url']}> (at the website by Andrey Maidansky)",
        "",
        (
            "Книжное издание: *Эвальд Васильевич Ильенков в воспоминаниях*. "
            "М.: РГГУ, 2004. Редактор-составитель Г.В. Лобастов."
        ),
        "",
    ]
    if item.get("start_page"):
        if item.get("end_page"):
            parts.extend([f"Страницы печатного издания: {item['start_page']}-{item['end_page']}", ""])
        else:
            parts.extend([f"Начальная страница печатного издания: {item['start_page']}", ""])
    parts.append(body)
    return "\n".join(parts).rstrip() + "\n", len(text.encode("utf-8"))


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def existing_non_memoir_works() -> list[dict[str, object]]:
    if not MANIFEST_PATH.is_file():
        return []
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return [work for work in manifest.get("works", []) if work.get("id") != WORK_ID]


def main() -> int:
    contents_html = fetch(INDEX_URL)
    items, total_pages = parse_contents(contents_html)
    if len(items) != 24:
        print(f"expected 24 memoir entries, got {len(items)}", file=sys.stderr)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_items = []
    for item in items:
        slug = slugify(f"{item['author']} {item['title']}") or f"item-{item['index']:02d}"
        filename = f"{WORK_ID}-ch{item['index']:03d}.md"
        path = OUTPUT_DIR / filename
        markdown, source_bytes = convert_page(item)
        path.write_text(markdown, encoding="utf-8")
        local_path = path.relative_to(ROOT).as_posix()
        manifest_items.append(
            {
                "id": f"{WORK_ID}-ch{item['index']:03d}",
                "chapter_index": f"{item['index']:03d}",
                "author": item["author"],
                "title": item["title"],
                "slug": slug,
                "source_url": item["source_url"],
                "local_path": local_path,
                "start_page": item.get("start_page"),
                "end_page": item.get("end_page"),
                "source_bytes_utf8": source_bytes,
                "markdown_sha256": sha256(path),
                "text_role": "research",
                "text_status": "html_conversion_unverified",
                "core_corpus_eligible": False,
                "llm_wiki_eligible": True,
            }
        )

    manifest = {
        "schema_version": 1,
        "generated_at": MANIFEST_GENERATED_AT,
        "collection_id": "ilyenkov-biography",
        "policy": (
            "Biography, memoir, and secondary literature are research texts. They do not enter "
            "the Ilyenkov author-original core corpus."
        ),
        "works": [
            {
                "id": WORK_ID,
                **BOOK_RECORD,
                "source_format": "html",
                "source_encoding": "windows-1251",
                "source_site": "filorus.ru",
                "total_pages": total_pages,
                "item_count": len(manifest_items),
                "text_role": "research",
                "core_corpus_eligible": False,
                "llm_wiki_eligible": True,
                "rights_review_status": "unreviewed",
                "redistribution_approved": False,
                "items": manifest_items,
            }
        ],
    }
    manifest["works"].extend(existing_non_memoir_works())
    write_json(MANIFEST_PATH, manifest)
    print(f"converted {len(manifest_items)} memoir entries to {OUTPUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
