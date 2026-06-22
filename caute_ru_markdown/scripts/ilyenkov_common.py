#!/usr/bin/env python3
"""Shared helpers for converting filorus.ru Ilyenkov HTML pages to Markdown."""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Iterable
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.request import Request, urlopen


TEXTS_URL = "http://filorus.ru/ilyenkov/texts.html"
SITE_ROOT = "http://filorus.ru"
SOURCE_HOSTS = {"filorus.ru", "caute.ru"}
USER_AGENT = "Codex local markdown converter (+https://openai.com/)"


TRANSLIT = {
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


def fetch_text(url: str, *, retries: int = 3, timeout: int = 30, delay: float = 0.2) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=timeout) as response:
                raw = response.read()
            time.sleep(delay)
            return raw.decode("utf-8")
        except Exception as exc:  # noqa: BLE001 - keep retries generic for network failures
            last_error = exc
            if attempt < retries:
                time.sleep(delay * attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def canonical_url(url: str, base_url: str = TEXTS_URL) -> str:
    full = urljoin(base_url, url)
    full, _ = urldefrag(full)
    parsed = urlparse(full)
    return parsed._replace(scheme="http").geturl()


def strip_scripts_and_ads(source: str) -> str:
    source = re.sub(r"<script\b.*?</script>", "", source, flags=re.I | re.S)
    source = re.sub(r"<style\b.*?</style>", "", source, flags=re.I | re.S)
    source = re.sub(r"<div[^>]+class=[\"']ab[\"'][^>]*>.*?</div>", "", source, flags=re.I | re.S)
    source = re.sub(r"<a[^>]+>\s*<img\b.*?</a>", "", source, flags=re.I | re.S)
    source = re.sub(r"<img\b[^>]*>", "", source, flags=re.I | re.S)
    return source


def compact_spaces(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def plain_text(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return compact_spaces(html.unescape(fragment))


def html_title(source: str) -> str:
    match = re.search(r"<title>(.*?)</title>", source, flags=re.I | re.S)
    return plain_text(match.group(1)) if match else ""


def extract_blockquote(source: str) -> str:
    matches = re.findall(r"<blockquote[^>]*>(.*?)</blockquote>", source, flags=re.I | re.S)
    if not matches:
        cleaned = strip_scripts_and_ads(source)
        body = re.search(r"<body\b[^>]*>(.*?)</body>", cleaned, flags=re.I | re.S)
        if body:
            return body.group(1)
        raise ValueError("Could not find readable page body")
    return strip_scripts_and_ads(max(matches, key=len))


def clean_inline(fragment: str, page_key: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(
        r"<a\b[^>]*href=[\"']#b(\d+)[\"'][^>]*>.*?</a>",
        lambda m: f"[^{page_key}-{m.group(1)}]",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"</?i\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?em\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?b\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"</?strong\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"<sup\b[^>]*>(.*?)</sup>", lambda m: "^" + clean_inline(m.group(1), page_key), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<sub\b[^>]*>(.*?)</sub>", lambda m: "_" + clean_inline(m.group(1), page_key), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<a\b[^>]*>(.*?)</a>", r"\1", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return compact_spaces(html.unescape(fragment))


def paragraph_text(fragment: str, page_key: str) -> str:
    text = clean_inline(fragment, page_key)
    return re.sub(r"\s*\n\s*", " ", text).strip()


def heading_text(fragment: str, page_key: str) -> str:
    return clean_inline(fragment, page_key).replace("*", "").strip()


def parse_footnotes(fragment: str, page_key: str) -> list[str]:
    fragment = re.sub(
        r"<a\b[^>]*name=[\"']b(\d+)[\"'][^>]*>(.*?)</a>",
        lambda m: f"\nFOOTNOTE_MARKER:{m.group(1)}\n",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(r"</?i\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?b\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"<a\b[^>]*>(.*?)</a>", r"\1", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    text = compact_spaces(html.unescape(fragment))
    notes: list[str] = []
    parts = re.split(r"\n?FOOTNOTE_MARKER:(\d+)\n?", text)
    for index in range(1, len(parts), 2):
        number = parts[index]
        body = re.sub(r"\n+", " ", parts[index + 1].strip()).strip()
        if body:
            notes.append(f"[^{page_key}-{number}]: {body}")
    return notes


def parse_loose_footnotes(block: str, page_key: str) -> list[str]:
    hr_matches = list(re.finditer(r"<hr\b[^>]*>", block, flags=re.I))
    if not hr_matches:
        return []
    tail = block[hr_matches[-1].end() :]
    tail = re.sub(r"<a[^>]+>\s*<img\b.*?</a>", "", tail, flags=re.I | re.S)
    return parse_footnotes(tail, page_key)


def class_value(attrs: str) -> str:
    match = re.search(r"class\s*=\s*(?:\"([^\"]+)\"|'([^']+)'|([^\s>]+))", attrs, flags=re.I)
    if not match:
        return ""
    return next(group for group in match.groups() if group)


def iter_content_blocks(block: str) -> Iterable[tuple[str, str, str]]:
    token = re.compile(r"<p\b([^>]*)>|<div\b([^>]*)>", flags=re.I)
    matches = list(token.finditer(block))
    for index, match in enumerate(matches):
        attrs = match.group(1) or match.group(2) or ""
        class_name = class_value(attrs)
        if not class_name:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        fragment = block[start:end]
        if class_name == "fn":
            close = re.search(r"</div>", fragment, flags=re.I)
            if close:
                fragment = fragment[: close.start()]
        yield class_name, attrs, fragment


def page_key_from_url(url: str) -> str:
    parsed = urlparse(canonical_url(url))
    parts = [part for part in parsed.path.split("/") if part]
    if parts and parts[-1] == "index.html" and len(parts) >= 2:
        return slugify(parts[-2])
    stem = Path(parts[-1]).stem if parts else "page"
    prefix = parts[-2] if len(parts) >= 2 and parts[-2] not in {"texts", "tra"} else ""
    return slugify(f"{prefix}-{stem}" if prefix else stem)


def markdown_page(html_source: str, url: str, fallback_title: str = "", heading_level: int = 1) -> str:
    page_key = page_key_from_url(url)
    block = extract_blockquote(html_source)
    title = ""
    preface: list[str] = []
    body: list[str] = []
    footnotes: list[str] = []
    seen_text = False

    for class_name, attrs, fragment in iter_content_blocks(block):
        if class_name == "hl" and not title:
            title = heading_text(fragment, page_key)
            continue
        if class_name == "bb" and not seen_text:
            text = heading_text(fragment, page_key)
            if text and not looks_like_navigation(text):
                preface.append(text)
            continue
        if class_name in {"tx", "ls", "ss"}:
            text = paragraph_text(fragment, page_key)
            if text and not looks_like_navigation(text):
                seen_text = True
                body.append(text)
            continue
        if class_name == "fn":
            footnotes.extend(parse_footnotes(fragment, page_key))

    rendered_body = "\n\n".join(body)
    refs = set(re.findall(r"\[\^([^\]]+)\]", rendered_body))
    defs = {note.split("]:", 1)[0][2:] for note in footnotes if note.startswith("[^") and "]:" in note}
    if refs - defs:
        for note in parse_loose_footnotes(block, page_key):
            note_id = note.split("]:", 1)[0][2:] if "]:" in note else ""
            if note_id and note_id not in defs:
                footnotes.append(note)
                defs.add(note_id)

    if not title:
        title = fallback_title or html_title(html_source) or page_key
    lines = [f"{'#' * heading_level} {title}", f"Источник: <{canonical_url(url)}>"]
    for item in preface:
        lines.append(item)
    lines.extend(body)
    if footnotes:
        lines.append(f"{'#' * min(heading_level + 1, 6)} Примечания")
        lines.extend(footnotes)
    return "\n\n".join(line for line in lines if line.strip()).strip() + "\n"


def looks_like_navigation(text: str) -> bool:
    compact = " ".join(text.split())
    nav_words = ["Индекс", "Биография", "Тексты", "Фотогалерея", "Библиография", "Ссылки", "Проект"]
    return sum(1 for word in nav_words if word in compact) >= 3


def extract_links(source: str, base_url: str) -> list[dict[str, str]]:
    source = strip_scripts_and_ads(source)
    links: list[dict[str, str]] = []
    for href, label in re.findall(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", source, flags=re.I | re.S):
        full = canonical_url(href, base_url)
        label_text = plain_text(label)
        if label_text:
            links.append({"url": full, "title": " ".join(label_text.split())})
    return links


def slugify(text: str, fallback: str = "item") -> str:
    text = html.unescape(text).replace("\xa0", " ").lower()
    text = unicodedata.normalize("NFKD", text)
    out = []
    for char in text:
        if char in TRANSLIT:
            out.append(TRANSLIT[char])
        elif char.isascii() and char.isalnum():
            out.append(char)
        else:
            out.append("-")
    slug = re.sub(r"-+", "-", "".join(out)).strip("-")
    return slug[:90] or fallback


def markdown_hash(markdown: str) -> str:
    normalized = re.sub(r"\s+", " ", markdown).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def status(message: str, quiet: bool = False) -> None:
    if not quiet:
        print(message, file=sys.stderr)
