#!/usr/bin/env python3
"""Render human-readable terminology Markdown from philosopher glossary JSON files."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
GLOSSARY_PATHS = (
    "ilyenkov_markdown/metadata/glossary.json",
    "maidansky_markdown/metadata/glossary.json",
    "spinoza_markdown/metadata/glossary.json",
    "kedrov_markdown/metadata/glossary.json",
)
CATEGORY_LABELS = {
    "person": "人物",
    "work": "著作",
    "concept": "概念",
    "institution": "机构",
    "journal": "期刊",
}
STATUS_LABELS = {
    "approved": "已定",
    "provisional": "暂定",
    "needs_review": "待审",
}


def load_registry() -> dict[str, Any]:
    return json.loads((ROOT / "metadata/collections.json").read_text(encoding="utf-8"))


def people_by_id() -> dict[str, dict[str, Any]]:
    data = load_registry()
    return {person["id"]: person for person in data.get("people", [])}


def load_glossary(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def front_matter(title: str) -> str:
    return "\n".join([
        "---",
        f'title: "{title}"',
        'created: "2026-07-01"',
        'updated: "2026-07-01"',
        'type: "note"',
        'tags: ["terminology", "glossary", "research-note"]',
        'language: "zh"',
        'collection: "research-notes"',
        'llm_wiki_eligible: "true"',
        'gbrain_source: "project-markdown"',
        "---",
        "",
    ])


def markdown_table(entries: list[dict[str, Any]]) -> list[str]:
    lines = [
        "| 类别 | 规范形式 | 中文首选 | 其他形式 | 状态 | 说明 |",
        "|---|---|---|---|---|---|",
    ]
    for entry in sorted(entries, key=lambda item: (item["category"], item["id"])):
        forms = "<br>".join(entry.get("forms", [])) or "-"
        notes = entry.get("notes") or "-"
        lines.append(
            "| {category} | {canonical} | {zh} | {forms} | {status} | {notes} |".format(
                category=CATEGORY_LABELS.get(entry["category"], entry["category"]),
                canonical=escape_cell(entry["canonical"]),
                zh=escape_cell(entry["zh_preferred"]),
                forms=escape_cell(forms),
                status=STATUS_LABELS.get(entry["status"], entry["status"]),
                notes=escape_cell(notes),
            )
        )
    return lines


def escape_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", "<br>")


def render_glossary(glossary_path: Path, people: dict[str, dict[str, Any]]) -> str:
    data = load_glossary(glossary_path)
    author_id = data["author_id"]
    person = people.get(author_id, {"name_zh": author_id, "name_latin": author_id})
    title = f"术语表：{person['name_zh']}"
    lines = [
        front_matter(title).rstrip(),
        f"# {title}",
        "",
        f"源数据：`{glossary_path.relative_to(ROOT).as_posix()}`。",
        "本页由 `scripts/render_glossaries.py` 生成；请编辑 JSON 源数据，不要手改本页表格。",
        "",
        f"- 拉丁转写名：{person.get('name_latin', '-')}",
        f"- 原文姓名：{person.get('name_original', '-')}",
        f"- 词条数：{len(data.get('entries', []))}",
        "",
        "## 词条",
        "",
    ]
    lines.extend(markdown_table(data.get("entries", [])))
    lines.append("")
    return "\n".join(lines)


def render_index(glossaries: list[dict[str, Any]], people: dict[str, dict[str, Any]]) -> str:
    title = "术语表系统"
    lines = [
        front_matter(title).rstrip(),
        f"# {title}",
        "",
        "本目录收录按哲学家组织的正式术语与专名视图。JSON 是源记录，Markdown 是生成视图。",
        "",
        "| 哲学家 | 视图 | 源数据 | 词条数 |",
        "|---|---|---|---:|",
    ]
    for data in glossaries:
        author_id = data["author_id"]
        person = people.get(author_id, {"name_zh": author_id})
        view = f"{author_id}.md"
        source = f"../../{author_id}_markdown/metadata/glossary.json"
        lines.append(f"| {person['name_zh']} | [{view}]({view}) | `{source}` | {len(data.get('entries', []))} |")
    lines.extend([
        "",
        "## 状态说明",
        "",
        "- `已定`：已有稳定译名或专名写法。",
        "- `暂定`：当前采用，但仍可根据上下文调整。",
        "- `待审`：已进入正式候选表，尚待人工术语学确认。",
        "",
    ])
    return "\n".join(lines)


def expected_outputs() -> dict[Path, str]:
    people = people_by_id()
    glossaries = [load_glossary(ROOT / path) for path in GLOSSARY_PATHS]
    outputs: dict[Path, str] = {}
    outputs[ROOT / "notes/terminology/README.md"] = render_index(glossaries, people)
    for relative in GLOSSARY_PATHS:
        path = ROOT / relative
        author_id = path.relative_to(ROOT).parts[0].removesuffix("_markdown")
        outputs[ROOT / f"notes/terminology/{author_id}.md"] = render_glossary(path, people)
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Write generated Markdown views")
    parser.add_argument("--check", action="store_true", help="Fail when generated Markdown is stale")
    args = parser.parse_args()
    if not args.write and not args.check:
        args.check = True

    outputs = expected_outputs()
    stale: list[str] = []
    if args.write:
        for path, text in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
    if args.check:
        for path, expected in outputs.items():
            current = path.read_text(encoding="utf-8") if path.is_file() else ""
            if current != expected:
                stale.append(path.relative_to(ROOT).as_posix())
    for path in stale:
        print(f"stale glossary view: {path}")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
