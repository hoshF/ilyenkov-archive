#!/usr/bin/env python3
"""
Convert the filorus.ru page "В.И. Ленин и актуальные проблемы диалектической
логики" to Markdown.

This script fetches the original Russian HTML page and writes a single Markdown
file. It is intended for local personal/research use where you have the right to
make such a format-shift.
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path


URL = "http://filorus.ru/ilyenkov/texts/leninact.html"
DEFAULT_OUTPUT = "lenin_and_dialectical_logic_ilyenkov_rosenthal_ru.md"
TITLE = "В.И. Ленин и актуальные проблемы диалектической логики"


def load_dla_helpers():
    helper_path = Path(__file__).with_name("convert_ilyenkov_dla_to_md.py")
    spec = importlib.util.spec_from_file_location("ilyenkov_dla_converter", helper_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load helper script: {helper_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helpers = load_dla_helpers()


def article_markdown(html_source: str) -> str:
    blockquote = helpers.extract_blockquote(html_source)
    body_lines: list[str] = []
    head_blocks: list[str] = []
    footnotes: list[str] = []
    seen_text = False

    for class_name, attrs, fragment in helpers.iter_content_blocks(blockquote):
        if class_name == "bb" and not seen_text:
            text = helpers.heading_text(fragment, "leninacl")
            if text:
                head_blocks.append(text)
            continue

        if class_name == "hl":
            continue

        if class_name == "tx":
            text = helpers.paragraph_text(fragment, "leninacl")
            if not text:
                continue
            seen_text = True
            body_lines.append(text)
            continue

        if class_name == "fn":
            notes = helpers.parse_footnotes(fragment, "leninacl")
            if notes:
                footnotes.extend(notes)

    lines: list[str] = [f"# {TITLE}"]
    if head_blocks:
        author_parts = [part.strip() for part in head_blocks[0].splitlines() if part.strip()]
        lines.append(f"Автор(ы): {'; '.join(author_parts)}")
    lines.append(f"Источник: <{URL}>")
    if len(head_blocks) > 1:
        note = " ".join(block.replace("\n", " ") for block in head_blocks[1:])
        note = " ".join(note.split())
        lines.append(note)

    lines.extend(body_lines)
    if footnotes:
        lines.append("## Примечания")
        lines.extend(footnotes)
    return "\n\n".join(lines).strip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert filorus.ru Ilyenkov/Rosenthal Lenin article to Markdown.")
    parser.add_argument("-o", "--output", default=DEFAULT_OUTPUT, help="Markdown output path")
    parser.add_argument("--url", default=URL, help="Article URL")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress messages")
    args = parser.parse_args()

    if not args.quiet:
        print(f"Fetching {args.url}", file=sys.stderr)
    markdown = article_markdown(helpers.fetch_text(args.url))
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    if not args.quiet:
        print(f"Wrote {output_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
