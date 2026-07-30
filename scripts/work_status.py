#!/usr/bin/env python3
"""Build the derived, work-level digitization status index."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

from collection_registry import load_registry
from prepare_gbrain_markdown import parse_front_matter


WORK_STATUS_PATH = "metadata/work_status.json"
WORK_STATUS_MARKDOWN_PATH = "WORK_STATUS.md"
PROGRESS_VALUES = {
    "bibliographic_only",
    "source_registered",
    "digital_text_unverified",
    "review_in_progress",
    "human_verified",
}
PROJECT_VALUES = {"not_started", "planned", "processing", "human_review", "human_verified"}
VERIFICATION_VALUES = {"unverified", "human_review", "human_verified"}
INVALID_URL_VALUES = {
    "",
    "not_stated",
    "owner_provided_external_source_unverified",
    "source_url_not_recorded",
}
TRUTHY = {"true", "yes", "1"}
TITLE_KEYS = ("title", "title_ru", "page_title", "name")
PATH_KEYS = ("markdown_path", "output_path", "local_path")
URL_KEYS = ("source_url", "url", "work_url")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().casefold() in TRUTHY


def valid_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if normalized.casefold() in INVALID_URL_VALUES:
        return None
    if normalized.startswith(("http://", "https://")):
        return normalized
    return None


def normalize_doi(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().casefold()
    normalized = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", normalized)
    normalized = re.sub(r"^doi:\s*", "", normalized)
    return normalized if normalized.startswith("10.") and "/" in normalized else None


def normalize_title(value: str) -> str:
    return re.sub(r"[\W_]+", "", value.casefold(), flags=re.UNICODE)


def repo_relative(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def collection_relative_path(
    root: Path,
    collection: dict[str, Any],
    value: Any,
) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    path = Path(value.strip())
    if path.is_absolute() or ".." in path.parts:
        return None
    direct = root / path
    nested = root / str(collection.get("root", "")) / path
    if direct.exists() or value.startswith(str(collection.get("root", "")).rstrip("/") + "/"):
        return path.as_posix()
    return repo_relative(root, nested)


def manifest_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("works", "items", "entries", "records"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def nested_manifest_items(items: Iterable[dict[str, Any]]) -> Iterable[dict[str, Any]]:
    for item in items:
        yield item
        for key in ("items", "works"):
            children = item.get(key)
            if isinstance(children, list):
                yield from nested_manifest_items(
                    child for child in children if isinstance(child, dict)
                )


def title_from(item: dict[str, Any], fallback: str = "Untitled work") -> str:
    for key in TITLE_KEYS:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback


def fact(
    kind: str,
    person_id: str,
    collection_id: str | None,
    title: str,
    **values: Any,
) -> dict[str, Any]:
    result = {
        "kind": kind,
        "person_id": person_id,
        "collection_ids": {collection_id} if collection_id else set(),
        "title": title,
        "work_ids": set(),
        "markdown_paths": set(),
        "source_scan_paths": set(),
        "bibliography_refs": set(),
        "project_paths": set(),
        "verification_manifests": set(),
        "dois": set(),
        "source_urls": set(),
        "text_statuses": set(),
        "source_formats": set(),
        "text_roles": set(),
        "core_corpus_eligible": False,
        "llm_wiki_eligible": False,
        "redistribution_approved": False,
        "digital_text_present": False,
        "registered_source_evidence": False,
        "project_status": "not_started",
        "valid_human_verification": False,
        "issues": set(),
    }
    for key, value in values.items():
        if key in result and isinstance(result[key], set):
            if isinstance(value, (set, list, tuple)):
                result[key].update(item for item in value if item not in (None, ""))
            elif value not in (None, ""):
                result[key].add(value)
        else:
            result[key] = value
    return result


def longform_work_ids(root: Path, collection: dict[str, Any]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for corpus_value in collection.get("corpus_paths", []):
        base = root / corpus_value
        if not base.is_dir():
            continue
        for manifest_path in sorted(base.rglob("work_manifest.json")):
            data = load_json(manifest_path)
            work_id = data.get("work_id")
            if not isinstance(work_id, str) or not work_id:
                continue
            source_path = data.get("source_path")
            if isinstance(source_path, str):
                mapping[source_path] = work_id
            for chapter in data.get("chapters", []):
                if not isinstance(chapter, dict) or not isinstance(chapter.get("file"), str):
                    continue
                chapter_path = manifest_path.parent / chapter["file"]
                mapping[repo_relative(root, chapter_path)] = work_id
    return mapping


def corpus_facts(
    root: Path,
    collection: dict[str, Any],
    errors: list[str],
) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    longform_ids = longform_work_ids(root, collection)
    seen: set[str] = set()
    for corpus_value in collection.get("corpus_paths", []):
        base = root / corpus_value
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            relative_parts = path.relative_to(base).parts
            if (
                path.name.casefold() in {"readme.md", "work_manifest.md"}
                or {"source", "cache", "digitization"}.intersection(relative_parts)
            ):
                continue
            relative = repo_relative(root, path)
            if relative in seen:
                continue
            seen.add(relative)
            text = path.read_text(encoding="utf-8")
            metadata = parse_front_matter(text)
            title = metadata.get("title")
            if not title:
                heading = re.search(r"(?m)^#\s+(.+?)\s*$", text)
                title = heading.group(1).strip() if heading else path.stem
            item = fact(
                "markdown",
                collection["person_id"],
                collection["id"],
                title,
                markdown_paths={relative},
                text_statuses={metadata.get("text_status")},
                source_formats={metadata.get("source_format")},
                text_roles={metadata.get("text_role")},
                core_corpus_eligible=as_bool(metadata.get("core_corpus_eligible")),
                llm_wiki_eligible=as_bool(metadata.get("llm_wiki_eligible")),
                redistribution_approved=as_bool(metadata.get("redistribution_approved")),
                digital_text_present=True,
            )
            work_id = metadata.get("work_id") or longform_ids.get(relative)
            if work_id:
                item["work_ids"].add(work_id)
            doi = normalize_doi(metadata.get("doi"))
            if doi:
                item["dois"].add(doi)
            source_url = valid_url(metadata.get("source_url"))
            if source_url:
                item["source_urls"].add(source_url)
            source_scan = metadata.get("source_scan")
            if source_scan:
                scan_relative = collection_relative_path(root, collection, source_scan)
                if scan_relative:
                    item["source_scan_paths"].add(scan_relative)
                    expected_hash = metadata.get("source_scan_sha256")
                    source_path = root / scan_relative
                    if expected_hash and (
                        not source_path.is_file() or sha256(source_path) != expected_hash
                    ):
                        errors.append(f"{relative}: source_scan_sha256 mismatch")
                else:
                    errors.append(f"{relative}: invalid source_scan path")
            facts.append(item)
    return facts


def scan_facts(
    root: Path,
    collection: dict[str, Any],
    errors: list[str],
) -> list[dict[str, Any]]:
    manifest_value = collection.get("scan_manifest")
    if not manifest_value:
        return []
    manifest_path = root / manifest_value
    if not manifest_path.is_file():
        return []
    facts: list[dict[str, Any]] = []
    for index, item in enumerate(manifest_items(load_json(manifest_path)), start=1):
        local_path = collection_relative_path(root, collection, item.get("local_path"))
        label = f"{manifest_value} item {index}"
        if not local_path:
            errors.append(f"{label}: invalid local_path")
            continue
        source_path = root / local_path
        if not source_path.is_file():
            errors.append(f"{label}: registered source file is missing: {local_path}")
        elif item.get("sha256") and sha256(source_path) != item["sha256"]:
            errors.append(f"{label}: source SHA-256 mismatch: {local_path}")
        scan = fact(
            "source_scan",
            collection["person_id"],
            collection["id"],
            title_from(item, Path(local_path).stem),
            source_scan_paths={local_path},
            bibliography_refs={f"{manifest_value}#item-{index}"},
            text_statuses={item.get("text_status")},
            source_formats={item.get("source_format")},
            text_roles={item.get("text_role")},
            core_corpus_eligible=as_bool(item.get("core_corpus_eligible")),
            llm_wiki_eligible=as_bool(item.get("llm_wiki_eligible")),
            redistribution_approved=as_bool(item.get("redistribution_approved")),
            registered_source_evidence=True,
        )
        if item.get("work_id") not in (None, ""):
            scan["work_ids"].add(str(item["work_id"]))
        doi = normalize_doi(item.get("doi"))
        if doi:
            scan["dois"].add(doi)
        for key in URL_KEYS:
            url = valid_url(item.get(key))
            if url:
                scan["source_urls"].add(url)
        facts.append(scan)
    return facts


def work_manifest_facts(
    root: Path,
    collection: dict[str, Any],
) -> list[dict[str, Any]]:
    manifest_value = collection.get("works_manifest")
    if not manifest_value or not (root / manifest_value).is_file():
        return []
    data = load_json(root / manifest_value)
    facts: list[dict[str, Any]] = []
    for index, item in enumerate(nested_manifest_items(manifest_items(data)), start=1):
        work = fact(
            "bibliography",
            collection["person_id"],
            collection["id"],
            title_from(item),
            bibliography_refs={f"{manifest_value}#item-{index}"},
            core_corpus_eligible=as_bool(item.get("core_corpus_eligible")),
            llm_wiki_eligible=as_bool(item.get("llm_wiki_eligible")),
            redistribution_approved=as_bool(item.get("redistribution_approved")),
            text_statuses={item.get("text_status")},
            source_formats={item.get("source_format")},
            text_roles={item.get("text_role")},
        )
        work_id = item.get("work_id", item.get("id"))
        if work_id not in (None, ""):
            work["work_ids"].add(str(work_id))
        for key in PATH_KEYS:
            relative = collection_relative_path(root, collection, item.get(key))
            if relative and relative.endswith(".md"):
                if (root / relative).is_file():
                    work["markdown_paths"].add(relative)
        for path_value in item.get("chapter_files", []):
            relative = collection_relative_path(root, collection, path_value)
            if relative:
                if (root / relative).is_file():
                    work["markdown_paths"].add(relative)
        doi = normalize_doi(item.get("doi"))
        if doi:
            work["dois"].add(doi)
        for key in URL_KEYS:
            url = valid_url(item.get(key))
            if url:
                work["source_urls"].add(url)
        for value in item.get("source_urls", []):
            url = valid_url(value)
            if url:
                work["source_urls"].add(url)
        facts.append(work)
    return facts


def valid_project_verification(
    root: Path,
    project_dir: Path,
    project: dict[str, Any],
) -> tuple[bool, list[str], str | None]:
    errors: list[str] = []
    manifest_path = project_dir / "human_verification_manifest.json"
    if not manifest_path.is_file():
        return False, ["human verification manifest is missing"], None
    verification = load_json(manifest_path)
    final_value = verification.get("final_markdown") or project.get("final_markdown")
    final_path = root / str(final_value or "")
    if verification.get("verification_status") != "human_verified":
        errors.append("verification_status is not human_verified")
    if not final_path.is_file():
        errors.append("final Markdown is missing")
    elif sha256(final_path) != verification.get("final_markdown_sha256"):
        errors.append("final Markdown SHA-256 mismatch")
    if verification.get("source_scan_sha256") != project.get("source_sha256"):
        errors.append("source scan SHA-256 mismatch")
    page_map_path = project_dir / "page_map.json"
    if not page_map_path.is_file():
        errors.append("page map is missing")
    else:
        expected_pages = {
            page.get("scan_page_id")
            for page in load_json(page_map_path).get("pages", [])
            if isinstance(page, dict) and isinstance(page.get("scan_page_id"), str)
        }
        if expected_pages != set(verification.get("verified_scan_pages", [])):
            errors.append("verified page coverage does not match page map")
    quality_path = project_dir / "quality_report.json"
    if not quality_path.is_file():
        errors.append("quality report is missing")
    else:
        quality = load_json(quality_path)
        if quality.get("status") != "passed" or quality.get("unresolved_issues"):
            errors.append("quality report has not passed")
    return not errors, errors, str(final_value) if final_value else None


def project_facts(root: Path, collections: list[dict[str, Any]], errors: list[str]) -> list[dict[str, Any]]:
    collection_by_root = {collection.get("root"): collection for collection in collections}
    facts: list[dict[str, Any]] = []
    for project_path in sorted(root.glob("*_markdown/digitization/*/project.json")):
        project = load_json(project_path)
        collection = collection_by_root.get(project_path.parents[2].name)
        person_id = str(project.get("author_id") or (collection or {}).get("person_id") or "")
        collection_id = (collection or {}).get("id")
        project_relative = repo_relative(root, project_path.parent)
        item = fact(
            "digitization_project",
            person_id,
            collection_id,
            str(project.get("work_id") or project_path.parent.name),
            project_paths={project_relative},
            project_status=project.get("status", "not_started"),
        )
        if project.get("work_id"):
            item["work_ids"].add(str(project["work_id"]))
        for key, target in (
            ("source_scan", "source_scan_paths"),
            ("final_markdown", "markdown_paths"),
        ):
            value = project.get(key)
            if isinstance(value, str) and value:
                item[target].add(value)
        final_value = project.get("final_markdown")
        if isinstance(final_value, str) and (root / final_value).is_file():
            item["digital_text_present"] = True
        source_value = project.get("source_scan")
        source_path = root / str(source_value or "")
        if (
            not source_path.is_file()
            or project.get("source_sha256") != sha256(source_path)
        ):
            errors.append(f"{project_relative}: source scan path or SHA-256 mismatch")
        if project.get("status") == "human_verified":
            valid, verification_errors, final_value = valid_project_verification(
                root, project_path.parent, project
            )
            item["valid_human_verification"] = valid
            manifest_relative = repo_relative(
                root, project_path.parent / "human_verification_manifest.json"
            )
            item["verification_manifests"].add(manifest_relative)
            if final_value:
                item["markdown_paths"].add(final_value)
            for message in verification_errors:
                item["issues"].add(f"invalid_human_verification:{message}")
                errors.append(f"{project_relative}: {message}")
        facts.append(item)
    return facts


def legacy_verification_facts(root: Path, errors: list[str]) -> list[dict[str, Any]]:
    manifest_path = root / "ilyenkov_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json"
    if not manifest_path.is_file():
        return []
    facts: list[dict[str, Any]] = []
    manifest_relative = repo_relative(root, manifest_path)
    for index, item in enumerate(load_json(manifest_path).get("items", []), start=1):
        markdown_value = item.get("markdown_path")
        image_value = item.get("image_path")
        valid = item.get("verification_status") == "human_verified"
        for value, expected, label in (
            (markdown_value, item.get("markdown_sha256"), "Markdown"),
            (image_value, item.get("image_sha256"), "image"),
        ):
            path = root / str(value or "")
            if not path.is_file() or sha256(path) != expected:
                valid = False
                errors.append(f"{manifest_relative} item {index}: {label} hash or path mismatch")
        verification = fact(
            "legacy_verification",
            "ilyenkov",
            "ilyenkov-texts",
            str(item.get("id") or f"newspaper item {index}"),
            markdown_paths={markdown_value},
            source_scan_paths={image_value},
            verification_manifests={manifest_relative},
            valid_human_verification=valid,
            registered_source_evidence=True,
        )
        if item.get("id"):
            verification["work_ids"].add(str(item["id"]))
        facts.append(verification)
    return facts


class DisjointSet:
    def __init__(self, size: int):
        self.parent = list(range(size))

    def find(self, value: int) -> int:
        while self.parent[value] != value:
            self.parent[value] = self.parent[self.parent[value]]
            value = self.parent[value]
        return value

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def merge_by_anchor(
    facts: list[dict[str, Any]],
    disjoint: DisjointSet,
    field: str,
    *,
    person_scoped: bool = True,
) -> None:
    seen: dict[tuple[str, str] | str, int] = {}
    for index, item in enumerate(facts):
        for value in item[field]:
            key: tuple[str, str] | str
            key = (item["person_id"], value) if person_scoped else value
            if key in seen:
                disjoint.union(seen[key], index)
            else:
                seen[key] = index


def merge_fact_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    set_fields = (
        "collection_ids",
        "work_ids",
        "markdown_paths",
        "source_scan_paths",
        "bibliography_refs",
        "project_paths",
        "verification_manifests",
        "dois",
        "source_urls",
        "text_statuses",
        "source_formats",
        "text_roles",
        "issues",
    )
    merged = {field: set() for field in set_fields}
    for item in group:
        for field in set_fields:
            merged[field].update(value for value in item[field] if value not in (None, ""))
    merged["person_id"] = group[0]["person_id"]
    merged["title"] = next(
        (item["title"] for item in group if item["kind"] == "markdown"),
        next((item["title"] for item in group if item["kind"] == "bibliography"), group[0]["title"]),
    )
    merged["core_corpus_eligible"] = any(item["core_corpus_eligible"] for item in group)
    merged["llm_wiki_eligible"] = any(item["llm_wiki_eligible"] for item in group)
    merged["redistribution_approved"] = any(item["redistribution_approved"] for item in group)
    merged["digital_text_present"] = any(item["digital_text_present"] for item in group)
    merged["registered_source_evidence"] = any(
        item["registered_source_evidence"] for item in group
    )
    project_states = [item["project_status"] for item in group if item["project_status"] != "not_started"]
    merged["digitization_project"] = max(
        project_states,
        key=("planned", "processing", "human_review", "human_verified").index,
        default="not_started",
    )
    valid_verified = any(item["valid_human_verification"] for item in group)
    if valid_verified:
        verification = "human_verified"
    elif merged["digitization_project"] == "human_review":
        verification = "human_review"
    else:
        verification = "unverified"
    merged["verification"] = verification
    merged["digital_text"] = "present" if merged["digital_text_present"] else "absent"
    merged["source_evidence"] = (
        "registered" if merged["registered_source_evidence"] else "none"
    )
    if verification == "human_verified":
        progress = "human_verified"
    elif merged["digitization_project"] in {"processing", "human_review"}:
        progress = "review_in_progress"
    elif merged["digital_text"] == "present":
        progress = "digital_text_unverified"
    elif merged["source_evidence"] == "registered":
        progress = "source_registered"
    else:
        progress = "bibliographic_only"
    merged["progress"] = progress
    return merged


def record_id(record: dict[str, Any]) -> str:
    if record["work_ids"]:
        return f"{record['person_id']}:{sorted(record['work_ids'])[0]}"
    if record["markdown_paths"]:
        return f"{record['person_id']}:markdown:{sorted(record['markdown_paths'])[0]}"
    if record["source_scan_paths"]:
        return f"{record['person_id']}:scan:{sorted(record['source_scan_paths'])[0]}"
    reference = sorted(record["bibliography_refs"])[0]
    return f"{record['person_id']}:bibliography:{reference}"


def serialize_record(record: dict[str, Any]) -> dict[str, Any]:
    work_ids = sorted(record["work_ids"])
    return {
        "record_id": record_id(record),
        "person_id": record["person_id"],
        "collection_ids": sorted(record["collection_ids"]),
        "work_id": work_ids[0] if len(work_ids) == 1 else None,
        "work_ids": work_ids,
        "title": record["title"],
        "digital_text": record["digital_text"],
        "verification": record["verification"],
        "source_evidence": record["source_evidence"],
        "digitization_project": record["digitization_project"],
        "progress": record["progress"],
        "markdown_paths": sorted(record["markdown_paths"]),
        "source_scan_paths": sorted(record["source_scan_paths"]),
        "digitization_project_paths": sorted(record["project_paths"]),
        "verification_manifests": sorted(record["verification_manifests"]),
        "bibliography_refs": sorted(record["bibliography_refs"]),
        "text_statuses": sorted(record["text_statuses"]),
        "source_formats": sorted(record["source_formats"]),
        "text_roles": sorted(record["text_roles"]),
        "dois": sorted(record["dois"]),
        "source_urls": sorted(record["source_urls"]),
        "eligibility": {
            "core_corpus": record["core_corpus_eligible"],
            "gbrain": record["llm_wiki_eligible"],
            "redistribution": record["redistribution_approved"],
        },
        "issues": sorted(record["issues"]),
    }


def validate_scholar_gap_manifest(
    root: Path,
    records: list[dict[str, Any]],
) -> list[str]:
    path = root / "maidansky_markdown/metadata/scholar_bibliography_gap_manifest.json"
    if not path.is_file():
        return []
    by_path: dict[str, dict[str, Any]] = {}
    for record in records:
        for value in record["markdown_paths"] + record["source_scan_paths"]:
            by_path[value] = record
    errors: list[str] = []
    for item in manifest_items(load_json(path)):
        matched_records = {
            by_path[match["path"]]["record_id"]
            for match in item.get("local_matches", [])
            if isinstance(match, dict)
            and isinstance(match.get("path"), str)
            and match["path"] in by_path
        }
        missing_paths = [
            match.get("path")
            for match in item.get("local_matches", [])
            if isinstance(match, dict)
            and isinstance(match.get("path"), str)
            and not (root / match["path"]).exists()
        ]
        if missing_paths:
            errors.append(
                f"{path.relative_to(root)}: missing local_matches paths: {missing_paths}"
            )
        if not matched_records:
            continue
        matched = [
            record for record in records if record["record_id"] in matched_records
        ]
        category = item.get("category")
        explicit_markdown = any(
            isinstance(match, dict)
            and (
                match.get("source") == "markdown_corpus"
                or str(match.get("path", "")).endswith(".md")
            )
            for match in item.get("local_matches", [])
        )
        if category == "source_scan" and explicit_markdown:
            errors.append(
                f"{path.relative_to(root)}: source_scan category hides existing Markdown for "
                f"{item.get('title', 'untitled')}"
            )
        if category == "markdown_corpus" and (
            not explicit_markdown
            or not any(record["digital_text"] == "present" for record in matched)
        ):
            errors.append(
                f"{path.relative_to(root)}: markdown_corpus category has no digital text for "
                f"{item.get('title', 'untitled')}"
            )
        target_scan = (
            "maidansky_markdown/source_scans/psyjournals/"
            "e-v-ilyenkov-o-svobode-voli.pdf"
        )
        local_paths = {
            match.get("path")
            for match in item.get("local_matches", [])
            if isinstance(match, dict)
        }
        if target_scan in local_paths:
            target_markdown = (
                "maidansky_markdown/maidansky_md/istoriya-filosofii/"
                "istoriya-filosofii-e-v-ilyenkov-o-svobode-voli.md"
            )
            if category != "markdown_corpus" or target_markdown not in local_paths:
                errors.append(
                    f"{path.relative_to(root)}: freedom-of-will regression record is stale"
                )
    return errors


def build_work_status(root: Path) -> tuple[dict[str, Any], list[str]]:
    registry = load_registry(root)
    collections = registry.get("collections", [])
    errors: list[str] = []
    facts: list[dict[str, Any]] = []
    for collection in collections:
        facts.extend(corpus_facts(root, collection, errors))
        facts.extend(scan_facts(root, collection, errors))
        facts.extend(work_manifest_facts(root, collection))
    facts.extend(project_facts(root, collections, errors))
    facts.extend(legacy_verification_facts(root, errors))
    registered_scan_paths = {
        value
        for item in facts
        if item["kind"] == "source_scan"
        for value in item["source_scan_paths"]
    }
    for item in facts:
        if item["kind"] not in {"markdown", "digitization_project"}:
            continue
        for value in item["source_scan_paths"]:
            if value not in registered_scan_paths:
                errors.append(
                    f"{sorted(item['markdown_paths'] or item['project_paths'])[0]}: "
                    f"source scan is not registered: {value}"
                )

    disjoint = DisjointSet(len(facts))
    for field in ("work_ids", "markdown_paths", "source_scan_paths", "dois", "source_urls"):
        merge_by_anchor(facts, disjoint, field)

    groups: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for index, item in enumerate(facts):
        groups[disjoint.find(index)].append(item)
    merged = [merge_fact_group(group) for group in groups.values()]

    title_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in merged:
        normalized = normalize_title(record["title"])
        if normalized:
            title_groups[(record["person_id"], normalized)].append(record)
    for matches in title_groups.values():
        if len(matches) > 1:
            ids = sorted(record_id(record) for record in matches)
            for record in matches:
                others = [value for value in ids if value != record_id(record)]
                record["issues"].add("ambiguous_title_match:" + ",".join(others))

    records = sorted(
        (serialize_record(record) for record in merged),
        key=lambda item: (item["person_id"], item["title"].casefold(), item["record_id"]),
    )
    errors.extend(validate_scholar_gap_manifest(root, records))
    for item in records:
        if item["progress"] not in PROGRESS_VALUES:
            errors.append(f"{item['record_id']}: invalid progress")
        if item["verification"] not in VERIFICATION_VALUES:
            errors.append(f"{item['record_id']}: invalid verification")
        if item["digitization_project"] not in PROJECT_VALUES:
            errors.append(f"{item['record_id']}: invalid digitization project status")

    counts = Counter(record["progress"] for record in records)
    return {
        "schema_version": 1,
        "generated_at": registry.get("generated_at", "not_stated"),
        "policy": {
            "source_of_truth": "Derived from corpus Markdown, registered manifests, digitization projects, and valid human verification records.",
            "association_order": [
                "explicit_work_id",
                "digitization_project_paths",
                "markdown_source_scan",
                "doi",
                "exact_source_url",
            ],
            "title_matching": "conflict_only",
        },
        "summary": {
            "total": len(records),
            **{value: counts[value] for value in sorted(PROGRESS_VALUES)},
        },
        "works": records,
    }, sorted(set(errors))


def work_status_markdown(data: dict[str, Any], people: dict[str, dict[str, Any]]) -> str:
    lines = [
        "---",
        'title: "Work-Level Digitization Status"',
        'created: "2026-07-27"',
        'type: "project"',
        'tags: ["works", "digitization", "status", "generated"]',
        'language: "en"',
        'collection: "project-documentation"',
        'llm_wiki_eligible: "true"',
        'gbrain_source: "project-markdown"',
        "---",
        "",
        "# Work-Level Digitization Status",
        "",
        "Generated by `python3 scripts/manage_collections.py sync`. The JSON interface is "
        "[`metadata/work_status.json`](metadata/work_status.json). Source records remain authoritative.",
        "",
        "## Summary by Person",
        "",
        "| Person | Human verified | Review in progress | Unverified digital text | Source only | Bibliography only |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    by_person: dict[str, Counter[str]] = defaultdict(Counter)
    for work in data["works"]:
        by_person[work["person_id"]][work["progress"]] += 1
    for person_id in sorted(by_person):
        person = people.get(person_id, {})
        label = person.get("name_latin", person_id)
        counts = by_person[person_id]
        lines.append(
            f"| {label} | {counts['human_verified']} | {counts['review_in_progress']} | "
            f"{counts['digital_text_unverified']} | {counts['source_registered']} | "
            f"{counts['bibliographic_only']} |"
        )
    lines.extend(
        [
            "",
            "## Works",
            "",
            "| Person | Work | Progress | Verification | Digital text | Source evidence | Project |",
            "|---|---|---|---|---|---|---|",
        ]
    )
    for work in data["works"]:
        title = work["title"].replace("|", "\\|").replace("\n", " ")
        lines.append(
            f"| `{work['person_id']}` | {title} | `{work['progress']}` | "
            f"`{work['verification']}` | `{work['digital_text']}` | "
            f"`{work['source_evidence']}` | `{work['digitization_project']}` |"
        )
    lines.append("")
    return "\n".join(lines)


def collection_progress_counts(data: dict[str, Any]) -> dict[str, Counter[str]]:
    result: dict[str, Counter[str]] = defaultdict(Counter)
    for work in data["works"]:
        for collection_id in work["collection_ids"]:
            result[collection_id][work["progress"]] += 1
    return result


def query_work_status(
    data: dict[str, Any],
    *,
    work_id: str | None = None,
    path: str | None = None,
    author_id: str | None = None,
) -> list[dict[str, Any]]:
    normalized_path = Path(path).as_posix() if path else None
    matches = []
    for work in data.get("works", []):
        if work_id and work_id not in work.get("work_ids", []):
            continue
        if normalized_path and normalized_path not in (
            work.get("markdown_paths", [])
            + work.get("source_scan_paths", [])
            + work.get("digitization_project_paths", [])
        ):
            continue
        if author_id and work.get("person_id") != author_id:
            continue
        matches.append(work)
    return matches
