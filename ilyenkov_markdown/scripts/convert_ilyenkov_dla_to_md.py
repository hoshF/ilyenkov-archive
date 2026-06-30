#!/usr/bin/env python3
"""
Convert Evald Ilyenkov's "Диалектическая логика" pages from filorus.ru to Markdown.

This script fetches the original Russian HTML pages and writes a single Markdown
file. It is intended for local personal/research use where you have the right to
make such a format-shift.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
import time
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
import split_longform_markdown as longform  # noqa: E402

BASE_URL = "http://filorus.ru/ilyenkov/texts/dla/"
DEFAULT_OUTPUT = "dialectical_logic_ilyenkov_ru.md"
CHAPTERS = [
    ("intro.html", "Введение"),
    ("01.html", "Очерк первый. О предмете логики"),
    ("02.html", "Очерк второй. Мышление как атрибут субстанции"),
    ("03.html", "Очерк третий. Логика и диалектика"),
    ("04.html", "Очерк четвертый. Принцип построения логики. Дуализм или монизм"),
    ("05.html", "Очерк пятый. Диалектика как логика"),
    ("06.html", "Очерк шестой. Еще раз о принципе построения логики. Идеализм или материализм?"),
    ("07.html", "Очерк седьмой. К вопросу о диалектико-материалистической критике объективного идеализма"),
    ("08.html", "Очерк восьмой. Материалистическое понимание мышления как предмета логики"),
    ("09.html", "Очерк девятый. О совпадении логики с диалектикой и теорией познания материализма"),
    ("10.html", "Очерк десятый. Противоречие как категория диалектической логики"),
    ("11.html", "Очерк одиннадцатый. Проблема всеобщего в диалектике"),
    ("final.html", "Заключение"),
]


def fetch_text(url: str, delay: float = 0.15) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "Codex local markdown converter (+https://openai.com/)",
        },
    )
    with urlopen(request, timeout=30) as response:
        raw = response.read()
    time.sleep(delay)
    return raw.decode("utf-8")


def strip_scripts_and_ads(source: str) -> str:
    source = re.sub(r"<script\b.*?</script>", "", source, flags=re.I | re.S)
    source = re.sub(r"<style\b.*?</style>", "", source, flags=re.I | re.S)
    source = re.sub(r"<div[^>]+class=[\"']ab[\"'][^>]*>.*?</div>", "", source, flags=re.I | re.S)
    source = re.sub(r"<a[^>]+>\s*<img\b.*?</a>", "", source, flags=re.I | re.S)
    source = re.sub(r"<img\b[^>]*>", "", source, flags=re.I | re.S)
    return source


def extract_blockquote(source: str) -> str:
    match = re.search(r"<blockquote[^>]*>(.*?)</blockquote>", source, flags=re.I | re.S)
    if not match:
        raise ValueError("Could not find the main <blockquote> content block")
    return strip_scripts_and_ads(match.group(1))


def compact_spaces(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_inline(fragment: str, chapter_key: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    fragment = re.sub(
        r"<a\b[^>]*href=[\"']#b(\d+)[\"'][^>]*>.*?</a>",
        lambda m: f"[^{chapter_key}-{m.group(1)}]",
        fragment,
        flags=re.I | re.S,
    )
    fragment = re.sub(r"</?i\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?em\b[^>]*>", "*", fragment, flags=re.I)
    fragment = re.sub(r"</?b\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"</?strong\b[^>]*>", "**", fragment, flags=re.I)
    fragment = re.sub(r"<sup\b[^>]*>(.*?)</sup>", lambda m: "^" + clean_inline(m.group(1), chapter_key), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<sub\b[^>]*>(.*?)</sub>", lambda m: "_" + clean_inline(m.group(1), chapter_key), fragment, flags=re.I | re.S)
    fragment = re.sub(r"<a\b[^>]*>(.*?)</a>", r"\1", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return compact_spaces(html.unescape(fragment))


def paragraph_text(fragment: str, chapter_key: str) -> str:
    text = clean_inline(fragment, chapter_key)
    return re.sub(r"\s*\n\s*", " ", text).strip()


def heading_text(fragment: str, chapter_key: str) -> str:
    return clean_inline(fragment, chapter_key).replace("*", "").strip()


def parse_footnotes(fragment: str, chapter_key: str) -> list[str]:
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
        body = parts[index + 1].strip()
        next_marker = re.search(r"\nFOOTNOTE_MARKER:\d+\n", body)
        if next_marker:
            body = body[: next_marker.start()].strip()
        body = re.sub(r"\n+", " ", body).strip()
        if body:
            notes.append(f"[^{chapter_key}-{number}]: {body}")
    return notes


def iter_content_blocks(blockquote: str) -> Iterable[tuple[str, str, str]]:
    token = re.compile(r"<p\b([^>]*)>|<div\b([^>]*)>", flags=re.I)
    matches = list(token.finditer(blockquote))
    for index, match in enumerate(matches):
        attrs = match.group(1) or match.group(2) or ""
        class_match = re.search(r"class=[\"']([^\"']+)[\"']", attrs, flags=re.I)
        if not class_match:
            continue
        class_name = class_match.group(1)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(blockquote)
        fragment = blockquote[start:end]
        if class_name == "fn":
            close = re.search(r"</div>", fragment, flags=re.I)
            if close:
                fragment = fragment[: close.start()]
        yield class_name, attrs, fragment


def chapter_markdown(filename: str, fallback_title: str, html_source: str) -> str:
    chapter_key = Path(filename).stem
    blockquote = extract_blockquote(html_source)
    level = "##" if filename in {"intro.html", "final.html"} else "###"
    lines: list[str] = [f"{level} {fallback_title}"]
    footnotes: list[str] = []

    for class_name, attrs, fragment in iter_content_blocks(blockquote):
        if class_name == "hl":
            continue

        if class_name == "bb":
            continue

        if class_name == "tx":
            text = paragraph_text(fragment, chapter_key)
            if text:
                lines.append(text)
            continue

        if class_name == "fn":
            notes = parse_footnotes(fragment, chapter_key)
            if notes:
                footnotes.extend(notes)

    if footnotes:
        lines.append("### Примечания")
        lines.extend(footnotes)
    return "\n\n".join(lines).strip()


def parse_index_summary(index_html: str) -> str:
    source = strip_scripts_and_ads(index_html)
    title = "Диалектическая логика. Очерки истории и теории"
    rows = []
    for href, label in re.findall(
        r"<a\b[^>]*href=[\"'](/ilyenkov/texts/dla/[^\"']+\.html)[\"'][^>]*>(.*?)</a>",
        source,
        flags=re.I | re.S,
    ):
        label = clean_inline(label, "index")
        label = re.sub(r"\s+", " ", label)
        if label and label not in {row[1] for row in rows}:
            rows.append((href, label))

    lines = [
        f"# {title}",
        "",
        "Автор: Э. В. Ильенков",
        "",
        "Источник: <http://filorus.ru/ilyenkov/texts/dla/index.html>",
        "",
        "Издание: Москва, Политиздат, 1974.",
        "",
        "## Содержание",
    ]
    for href, label in rows:
        stem = Path(href).stem
        if stem in {"index"}:
            continue
        lines.append(f"- {label}")
    return "\n".join(lines)


def slug_for_label(label: str) -> str:
    slug = label.lower()
    slug = re.sub(r"[^\wа-яё]+", "-", slug, flags=re.I)
    return slug.strip("-")


def build_markdown(base_url: str, verbose: bool) -> str:
    index_url = urljoin(base_url, "index.html")
    if verbose:
        print(f"Fetching {index_url}", file=sys.stderr)
    parts = [parse_index_summary(fetch_text(index_url))]

    for filename, title in CHAPTERS:
        if filename == "01.html":
            parts.append("## Часть первая. Из истории диалектики")
        if filename == "07.html":
            parts.append("## Часть вторая. Некоторые вопросы марксистско-ленинской теории диалектики")
        url = urljoin(base_url, filename)
        if verbose:
            print(f"Fetching {url}", file=sys.stderr)
        source = fetch_text(url)
        parts.append(chapter_markdown(filename, title, source))

    return "\n\n---\n\n".join(part for part in parts if part).strip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert filorus.ru Ilyenkov DLA HTML pages to Markdown.")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT, help="Markdown output path")
    parser.add_argument("--base-url", default=BASE_URL, help="Base URL for the DLA pages")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress messages")
    args = parser.parse_args()

    markdown = build_markdown(args.base_url, verbose=not args.quiet)
    output_path = Path(args.output).resolve()
    written_path = longform.write_or_split(output_path, markdown, root=PROJECT_ROOT)
    if not args.quiet:
        print(f"Wrote {written_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
