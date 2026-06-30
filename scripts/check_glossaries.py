#!/usr/bin/env python3
"""Validate philosopher glossary source files and generated terminology views."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_glossaries import GLOSSARY_PATHS, ROOT, expected_outputs


CATEGORIES = {"person", "work", "concept", "institution", "journal"}
STATUSES = {"approved", "provisional", "needs_review"}
REQUIRED_FIELDS = {
    "id",
    "category",
    "canonical",
    "forms",
    "zh_preferred",
    "zh_alternatives",
    "status",
    "notes",
    "evidence",
}


def normalize_form(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def registered_people() -> set[str]:
    data = load_json(ROOT / "metadata/collections.json")
    return {person["id"] for person in data.get("people", [])}


def validate_glossary(path: Path, known_people: set[str]) -> list[str]:
    errors: list[str] = []
    label = path.relative_to(ROOT).as_posix()
    if not path.is_file():
        return [f"{label}: missing glossary file"]
    data = load_json(path)
    author_id = data.get("author_id")
    expected_author = path.relative_to(ROOT).parts[0].removesuffix("_markdown")
    if data.get("schema_version") != 1:
        errors.append(f"{label}: schema_version must be 1")
    if author_id != expected_author:
        errors.append(f"{label}: author_id must be {expected_author}")
    if author_id not in known_people:
        errors.append(f"{label}: author_id is not registered")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(data.get("updated_at", ""))):
        errors.append(f"{label}: updated_at must be YYYY-MM-DD")

    for source in data.get("source_corpus_paths", []):
        if Path(source).is_absolute() or ".." in Path(source).parts:
            errors.append(f"{label}: source_corpus_paths must be repository-relative")
        elif not (ROOT / source).exists():
            errors.append(f"{label}: source corpus path does not exist: {source}")

    entries = data.get("entries", [])
    if not isinstance(entries, list) or not entries:
        errors.append(f"{label}: entries must be a non-empty list")
        return errors

    ids: set[str] = set()
    form_owner: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append(f"{label}: entry must be an object")
            continue
        entry_id = str(entry.get("id", ""))
        missing = sorted(REQUIRED_FIELDS - entry.keys())
        if missing:
            errors.append(f"{label}:{entry_id or '(missing)'}: missing fields {missing}")
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", entry_id):
            errors.append(f"{label}:{entry_id or '(missing)'}: invalid id")
        if entry_id in ids:
            errors.append(f"{label}:{entry_id}: duplicate id")
        ids.add(entry_id)
        if entry.get("category") not in CATEGORIES:
            errors.append(f"{label}:{entry_id}: invalid category")
        if entry.get("status") not in STATUSES:
            errors.append(f"{label}:{entry_id}: invalid status")
        for field in ("canonical", "zh_preferred"):
            if not isinstance(entry.get(field), str) or not entry.get(field):
                errors.append(f"{label}:{entry_id}: {field} must be a non-empty string")
        for field in ("forms", "zh_alternatives"):
            if not isinstance(entry.get(field), list):
                errors.append(f"{label}:{entry_id}: {field} must be a list")
        if not isinstance(entry.get("evidence"), list) or not entry.get("evidence"):
            errors.append(f"{label}:{entry_id}: evidence must be a non-empty list")
        else:
            for item in entry["evidence"]:
                corpus_path = str(item.get("corpus_path", ""))
                note = str(item.get("note", ""))
                if Path(corpus_path).is_absolute() or ".." in Path(corpus_path).parts:
                    errors.append(f"{label}:{entry_id}: evidence path must be repository-relative")
                elif not (ROOT / corpus_path).exists():
                    errors.append(f"{label}:{entry_id}: evidence path does not exist: {corpus_path}")
                if not note:
                    errors.append(f"{label}:{entry_id}: evidence note is required")
        forms = {normalize_form(str(entry.get("canonical", "")))}
        forms.update(normalize_form(str(value)) for value in entry.get("forms", []) if value)
        for form in forms - {""}:
            owner = form_owner.get(form)
            if owner and owner != entry_id:
                errors.append(f"{label}:{entry_id}: duplicate form with {owner}: {form}")
            form_owner[form] = entry_id
    missing_required = sorted(set(data.get("required_entry_ids", [])) - ids)
    for entry_id in missing_required:
        errors.append(f"{label}: missing required entry {entry_id}")
    return errors


def generated_view_errors() -> list[str]:
    errors: list[str] = []
    for path, expected in expected_outputs().items():
        current = path.read_text(encoding="utf-8") if path.is_file() else ""
        if current != expected:
            errors.append(f"{path.relative_to(ROOT).as_posix()}: generated glossary view is stale")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Exit non-zero on validation errors")
    args = parser.parse_args()

    errors: list[str] = []
    known_people = registered_people()
    if not (ROOT / "metadata/schemas/glossary.schema.json").is_file():
        errors.append("metadata/schemas/glossary.schema.json: missing schema")
    for relative in GLOSSARY_PATHS:
        errors.extend(validate_glossary(ROOT / relative, known_people))
    errors.extend(generated_view_errors())

    print(f"glossaries={len(GLOSSARY_PATHS)} errors={len(errors)}")
    for error in errors:
        print(error)
    return 1 if errors and args.check else 0


if __name__ == "__main__":
    sys.exit(main())
