#!/usr/bin/env python3
"""
Convert Evald Ilyenkov's "Диалектика абстрактного и конкретного..." pages
from filorus.ru to Markdown.

This script fetches the original Russian HTML pages and writes a single Markdown
file. It is intended for local personal/research use where you have the right to
make such a format-shift.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path
from urllib.parse import urljoin


PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
import split_longform_markdown as longform  # noqa: E402

BASE_URL = "http://filorus.ru/ilyenkov/texts/dmx/"
DEFAULT_OUTPUT = "dialectics_abstract_concrete_capital_ilyenkov_ru.md"

CHAPTERS = [
    ("intro.html", "Предисловие [М. М. Розенталь]"),
    ("1a.html", "Определение «конкретного» у Маркса"),
    ("1b.html", "Об отношении представления к понятию"),
    ("1c.html", "Понятие «человек» и некоторые выводы из его анализа"),
    ("1d.html", "Конкретное и диалектика общего и единичного"),
    ("1e.html", "Конкретное единство как единство противоположностей"),
    ("2a.html", "Абстрактное как выражение конкретного"),
    ("2b.html", "Диалектическое и эклектически-эмпирическое понимание всесторонности рассмотрения"),
    ("2c.html", "Спиралевидный характер развития действительности и ее теоретического отражения"),
    ("2d.html", "Научная абстракция (понятие) и практика"),
    ("3a.html", "К постановке вопроса"),
    ("3b.html", "Гегелевское понимание конкретного"),
    ("3c.html", "Взгляд Маркса на процесс развития научного познания"),
    ("3d.html", "Материалистическое обоснование способа восхождения от абстрактного к конкретному у Маркса"),
    ("3e.html", "Индукция Адама Смита и дедукция Давида Рикардо. Точки зрения Локка и Спинозы в политической экономии"),
    ("3f.html", "Дедукция и проблема историзма"),
    ("4a.html", "О различии логического и исторического способов исследования"),
    ("4b.html", "Логическое развитие как выражение конкретного историзма в исследовании"),
    ("4c.html", "Абстрактный и конкретный историзм"),
    ("5a.html", "Конкретная полнота абстракции и анализа как условие теоретического синтеза"),
    ("5b.html", "Противоречие как условие развития науки"),
    ("5c.html", "Противоречия трудовой теории стоимости и их диалектическое разрешение у Маркса"),
    ("5d.html", "Противоречие как принцип развития теории"),
]

GROUP_HEADINGS = {
    "1a.html": "Глава первая. Диалектическое и метафизическое понимание конкретного",
    "2a.html": "Глава вторая. Единство абстрактного и конкретного — закон мышления",
    "3a.html": "Глава третья. Восхождение от абстрактного к конкретному",
    "4a.html": "Глава четвертая. Логическое развитие и конкретный историзм",
    "5a.html": "Глава пятая. Способ восхождения от абстрактного к конкретному в «Капитале» Маркса",
}


def load_dla_helpers():
    helper_path = Path(__file__).with_name("convert_ilyenkov_dla_to_md.py")
    spec = importlib.util.spec_from_file_location("ilyenkov_dla_converter", helper_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load helper script: {helper_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helpers = load_dla_helpers()


def parse_index_summary(index_html: str) -> str:
    source = helpers.strip_scripts_and_ads(index_html)
    rows = []
    for href, label in re.findall(
        r"<a\b[^>]*href=[\"'](/ilyenkov/texts/dmx/[^\"']+\.html)[\"'][^>]*>(.*?)</a>",
        source,
        flags=re.I | re.S,
    ):
        label = helpers.clean_inline(label, "index")
        label = re.sub(r"\s+", " ", label).strip()
        if label and label not in {row[1] for row in rows}:
            rows.append((href, label))

    lines = [
        "# Диалектика абстрактного и конкретного в «Капитале» Маркса",
        "",
        "Автор: Э. В. Ильенков",
        "",
        "Источник: <http://filorus.ru/ilyenkov/texts/dmx/index.html>",
        "",
        "Издание: Москва, Издательство Академии наук СССР, 1960.",
        "",
        "## Содержание",
    ]
    for href, label in rows:
        stem = Path(href).stem
        if stem == "index":
            continue
        lines.append(f"- {label}")
    return "\n".join(lines)


def chapter_markdown(filename: str, title: str, html_source: str) -> str:
    markdown = helpers.chapter_markdown(filename, title, html_source)
    if filename == "intro.html":
        return markdown.replace("### Предисловие", "## Предисловие", 1)
    return markdown


def build_markdown(base_url: str, verbose: bool) -> str:
    index_url = urljoin(base_url, "index.html")
    if verbose:
        print(f"Fetching {index_url}", file=sys.stderr)
    parts = [parse_index_summary(helpers.fetch_text(index_url))]

    for filename, title in CHAPTERS:
        group_heading = GROUP_HEADINGS.get(filename)
        if group_heading:
            parts.append(f"## {group_heading}")
        url = urljoin(base_url, filename)
        if verbose:
            print(f"Fetching {url}", file=sys.stderr)
        source = helpers.fetch_text(url)
        parts.append(chapter_markdown(filename, title, source))

    return "\n\n---\n\n".join(part for part in parts if part).strip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert filorus.ru Ilyenkov DMX HTML pages to Markdown.")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT, help="Markdown output path")
    parser.add_argument("--base-url", default=BASE_URL, help="Base URL for the DMX pages")
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
