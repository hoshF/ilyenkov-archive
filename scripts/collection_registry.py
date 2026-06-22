#!/usr/bin/env python3
"""共享的哲学家集合注册表读取、校验与状态统计。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_REGISTRY = "metadata/collections.json"
FALLBACK_CORPUS_PATHS = (
    "caute_ru_markdown/ilyenkov_md/",
    "caute_ru_markdown/maidansky_md/",
    "spinoza_markdown/spinoza_md/",
    "kedrov_markdown/kedrov_md/",
)
FALLBACK_COLLECTION_ROOTS = (
    "caute_ru_markdown/",
    "spinoza_markdown/",
    "kedrov_markdown/",
    "kopnin_markdown/",
    "oizerman_markdown/",
    "maidansky_markdown/",
)


def load_registry(root: Path) -> dict[str, Any]:
    path = root / DEFAULT_REGISTRY
    if not path.is_file():
        return {
            "schema_version": 0,
            "project": {
                "large_binary_threshold_bytes": 75 * 1024 * 1024,
                "gbrain_extra_roots": [],
                "excluded_directory_names": ["cache", "digitization", "source_scans", "source_pdfs"],
            },
            "people": [],
            "collections": [],
        }
    return json.loads(path.read_text(encoding="utf-8"))


def normalized_dir(value: str) -> str:
    return value.rstrip("/") + "/"


def safe_relative_path(value: str) -> bool:
    path = Path(value)
    return bool(value) and not path.is_absolute() and ".." not in path.parts


def corpus_paths(root: Path) -> tuple[str, ...]:
    data = load_registry(root)
    paths = [
        normalized_dir(path)
        for collection in data.get("collections", [])
        for path in collection.get("corpus_paths", [])
    ]
    return tuple(dict.fromkeys(paths)) or FALLBACK_CORPUS_PATHS


def collection_roots(root: Path) -> tuple[str, ...]:
    data = load_registry(root)
    roots = [
        normalized_dir(collection["root"])
        for collection in data.get("collections", [])
        if collection.get("root")
    ]
    return tuple(dict.fromkeys(roots)) or FALLBACK_COLLECTION_ROOTS


def corpus_asset_paths(root: Path) -> tuple[str, ...]:
    return corpus_paths(root)


def scan_manifest_paths(root: Path) -> list[Path]:
    data = load_registry(root)
    registered = [
        root / collection["scan_manifest"]
        for collection in data.get("collections", [])
        if collection.get("scan_manifest")
    ]
    if registered:
        return sorted(dict.fromkeys(registered))
    return sorted(root.glob("*_markdown/metadata/source_scans_manifest.json"))


def gbrain_roots(root: Path) -> list[str]:
    data = load_registry(root)
    roots = [
        normalized_dir(collection["root"])
        for collection in data.get("collections", [])
        if collection.get("gbrain_tracked")
    ]
    roots.extend(normalized_dir(path) for path in data.get("project", {}).get("gbrain_extra_roots", []))
    return list(dict.fromkeys(roots))


def collection_for_path(root: Path, relative_path: str) -> dict[str, Any] | None:
    data = load_registry(root)
    matches = []
    for collection in data.get("collections", []):
        for prefix in collection.get("corpus_paths", []):
            prefix = normalized_dir(prefix)
            if relative_path.startswith(prefix):
                matches.append((len(prefix), collection))
    return max(matches, default=(0, None), key=lambda item: item[0])[1]


def metadata_item_count(path: Path | None) -> int | None:
    if not path or not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    for key in ("works", "items", "entries"):
        value = data.get(key)
        if isinstance(value, list):
            return len(value)
    return None


def validate_registry(root: Path, *, require_paths: bool = True) -> list[str]:
    data = load_registry(root)
    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("metadata/collections.json: schema_version 必须为 1")

    people = data.get("people", [])
    collections = data.get("collections", [])
    person_ids = [item.get("id") for item in people]
    collection_ids = [item.get("id") for item in collections]
    for label, values in (("人物", person_ids), ("集合", collection_ids)):
        duplicates = sorted({value for value in values if value and values.count(value) > 1})
        if duplicates:
            errors.append(f"{label} ID 重复: {', '.join(duplicates)}")
    known_people = set(person_ids)

    path_fields = ("root", "readme", "scan_manifest", "works_manifest", "source_survey")
    list_path_fields = ("corpus_paths", "scan_paths", "bibliography_paths")
    for collection in collections:
        cid = collection.get("id", "(missing)")
        if collection.get("person_id") not in known_people:
            errors.append(f"{cid}: person_id 未登记")
        if collection.get("layout") not in {"standard", "legacy"}:
            errors.append(f"{cid}: layout 必须为 standard 或 legacy")
        for field in path_fields:
            value = collection.get(field)
            if value is not None and not safe_relative_path(str(value)):
                errors.append(f"{cid}: {field} 不是仓库内相对路径")
            if require_paths and value and not (root / value).exists():
                errors.append(f"{cid}: {field} 路径不存在: {value}")
        for field in list_path_fields:
            for value in collection.get(field, []):
                if not safe_relative_path(str(value)):
                    errors.append(f"{cid}: {field} 包含非法路径")
                elif require_paths and not (root / value).exists():
                    errors.append(f"{cid}: {field} 路径不存在: {value}")

        if collection.get("layout") == "standard":
            author_id = collection.get("person_id")
            expected_root = f"{author_id}_markdown"
            if collection.get("root") != expected_root:
                errors.append(f"{cid}: 标准布局 root 必须为 {expected_root}")
            expected_corpus = f"{expected_root}/{author_id}_md/"
            if collection.get("corpus_paths") != [expected_corpus]:
                errors.append(f"{cid}: 标准布局 corpus_paths 必须为 {expected_corpus}")

    threshold = data.get("project", {}).get("large_binary_threshold_bytes")
    if not isinstance(threshold, int) or threshold <= 0:
        errors.append("project.large_binary_threshold_bytes 必须为正整数")

    registered_manifests = {
        collection["scan_manifest"]
        for collection in collections
        if collection.get("scan_manifest")
    }
    discovered_manifests = {
        path.relative_to(root).as_posix()
        for path in root.glob("*_markdown/metadata/source_scans_manifest.json")
    }
    for manifest in sorted(discovered_manifests - registered_manifests):
        errors.append(f"扫描件 manifest 未登记到中央注册表: {manifest}")
    return errors


def markdown_count(root: Path, paths: list[str]) -> int:
    count = 0
    for relative in paths:
        base = root / relative
        if not base.is_dir():
            continue
        count += sum(
            1
            for path in base.rglob("*.md")
            if path.name.lower() != "readme.md"
            and not {"source", "cache", "digitization"}.intersection(path.relative_to(base).parts)
        )
    return count


def scan_stats(root: Path, manifest: str | None) -> tuple[int, int]:
    if not manifest or not (root / manifest).is_file():
        return 0, 0
    data = json.loads((root / manifest).read_text(encoding="utf-8"))
    items = data.get("items", [])
    return len(items), sum(int(item.get("bytes", 0)) for item in items)


def person_map(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {person["id"]: person for person in data.get("people", [])}
