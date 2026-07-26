#!/usr/bin/env python3
"""管理哲学家集合、状态页、GBrain 路径和数字化项目。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collection_registry import (
    DEFAULT_REGISTRY,
    collection_for_path,
    gbrain_roots,
    load_registry,
    markdown_count,
    metadata_item_count,
    person_map,
    scan_stats,
    validate_registry,
)


ROOT = Path(__file__).resolve().parents[1]
GBRAIN_BEGIN = "    # COLLECTIONS-AUTO:BEGIN"
GBRAIN_END = "    # COLLECTIONS-AUTO:END"
DIGITIZATION_STATES = {"planned", "processing", "human_review", "human_verified"}
CANONICAL_OUTPUT_PROFILE = "agent_canonical_markdown"
BLOCK_ID_RE = re.compile(r"<!--\s*block-id:\s*(b[0-9]{4,})\s*-->")
PAGE_BOUNDARY_RE = re.compile(
    r"<!--\s*(?:source-page|pdf-page|page(?:-boundary)?)\s*:[^>]*-->",
    re.IGNORECASE,
)
FOOTNOTE_DEFINITION_RE = re.compile(r"(?m)^\[\^([^\]]+)\]:")
CANONICAL_BLOCK_KINDS = {
    "heading", "paragraph", "blockquote", "list_item", "footnote", "table", "formula",
}
TEXTUAL_NOTE_CATEGORIES = {
    "source_typo", "source_anomaly", "uncertain_reading", "editorial_expansion",
}


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repository_file(root: Path, value: Any) -> Path | None:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        return None
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def inline_page_boundary_markers(text: str) -> bool:
    for match in PAGE_BOUNDARY_RE.finditer(text):
        line_start = text.rfind("\n", 0, match.start()) + 1
        line_end = text.find("\n", match.end())
        if line_end == -1:
            line_end = len(text)
        if text[line_start:match.start()].strip() or text[match.end():line_end].strip():
            return True
    return False


def duplicate_footnote_ids(text: str) -> set[str]:
    identifiers = FOOTNOTE_DEFINITION_RE.findall(text)
    return {identifier for identifier in identifiers if identifiers.count(identifier) > 1}


def front_matter_value(text: str, field: str) -> str | None:
    match = re.search(r"\A---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return None
    field_match = re.search(
        rf"(?m)^{re.escape(field)}:\s*(.*?)\s*$",
        match.group(1),
    )
    if not field_match:
        return None
    value = field_match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def canonical_line_kind(lines: list[str], index: int) -> str:
    line = lines[index]
    if re.match(r"^#{1,6}\s+", line):
        return "heading"
    if re.match(r"^\[\^[^]]+\]:", line):
        return "footnote"
    if re.match(r"^\s*>", line):
        return "blockquote"
    if re.match(r"^\s*(?:[-+*]|\d+[.)])\s+", line):
        return "list_item"
    if line.strip().startswith(("$$", "\\[")):
        return "formula"
    if "|" in line and index + 1 < len(lines) and re.match(
        r"^\s*\|?\s*:?-{3,}",
        lines[index + 1],
    ):
        return "table"
    return "paragraph"


def canonical_semantic_blocks(text: str) -> tuple[dict[str, str], int, int]:
    front_matter = re.search(r"\A---\r?\n.*?\r?\n---\r?\n", text, re.DOTALL)
    body = text[front_matter.end():] if front_matter else text
    lines = body.splitlines()
    detected: dict[str, str] = {}
    missing_ids = 0
    orphan_ids = 0
    pending_id: str | None = None
    index = 0
    while index < len(lines):
        line = lines[index]
        block_match = re.fullmatch(r"\s*<!--\s*block-id:\s*(b[0-9]{4,})\s*-->\s*", line)
        if block_match:
            if pending_id is not None:
                orphan_ids += 1
            pending_id = block_match.group(1)
            index += 1
            continue
        if not line.strip() or re.fullmatch(r"\s*<!--.*?-->\s*", line) or re.fullmatch(
            r"\s*(?:---+|\*\*\*+|___+)\s*",
            line,
        ):
            index += 1
            continue
        kind = canonical_line_kind(lines, index)
        if pending_id is None:
            missing_ids += 1
        else:
            detected[pending_id] = kind
            pending_id = None
        if kind == "heading":
            index += 1
        elif kind == "blockquote":
            while index < len(lines) and lines[index].lstrip().startswith(">"):
                index += 1
        elif kind == "list_item":
            index += 1
            while (
                index < len(lines)
                and lines[index].strip()
                and not re.match(r"^\s*(?:[-+*]|\d+[.)])\s+", lines[index])
                and not BLOCK_ID_RE.fullmatch(lines[index].strip())
            ):
                index += 1
        elif kind == "footnote":
            index += 1
            while index < len(lines) and (
                not lines[index].strip() or re.match(r"^\s{2,}\S", lines[index])
            ):
                index += 1
        elif kind == "formula":
            opener = lines[index].strip()
            closer = "$$" if opener.startswith("$$") else "\\]"
            index += 1
            if opener == closer:
                while index < len(lines):
                    current = lines[index]
                    index += 1
                    if current.strip().endswith(closer):
                        break
        elif kind == "table":
            while index < len(lines) and lines[index].strip() and "|" in lines[index]:
                index += 1
        else:
            index += 1
            while index < len(lines) and lines[index].strip():
                if BLOCK_ID_RE.fullmatch(lines[index].strip()):
                    break
                if canonical_line_kind(lines, index) != "paragraph":
                    break
                index += 1
    if pending_id is not None:
        orphan_ids += 1
    return detected, missing_ids, orphan_ids


def validate_canonical_text_map(
    root: Path,
    project: dict[str, Any],
    project_dir: Path,
    verification: dict[str, Any],
    page_ids: set[str],
) -> list[str]:
    errors: list[str] = []
    label = project_dir.relative_to(root).as_posix()
    map_path = project_dir / "canonical_text_map.json"
    if not map_path.is_file():
        return [f"{label}: human_verified v2 项目缺少 canonical_text_map.json"]
    canonical_map = json.loads(map_path.read_text(encoding="utf-8"))
    if canonical_map.get("schema_version") != 1:
        errors.append(f"{label}: canonical_text_map.json schema_version 必须为 1")
    if canonical_map.get("work_id") != project.get("work_id"):
        errors.append(f"{label}: canonical_text_map.json work_id 不匹配")

    final_value = canonical_map.get("final_markdown")
    final_path = repository_file(root, final_value)
    if final_value != verification.get("final_markdown"):
        errors.append(f"{label}: canonical_text_map.json 最终 Markdown 路径与人工确认记录不匹配")
    if not final_path or not final_path.is_file():
        errors.append(f"{label}: canonical_text_map.json 指向的最终 Markdown 不存在或路径非法")
        markdown_text = ""
    else:
        markdown_text = final_path.read_text(encoding="utf-8")
        final_hash = sha256(final_path)
        if canonical_map.get("final_markdown_sha256") != final_hash:
            errors.append(f"{label}: canonical_text_map.json 最终 Markdown SHA-256 不匹配")
        if canonical_map.get("final_markdown_sha256") != verification.get("final_markdown_sha256"):
            errors.append(f"{label}: canonical_text_map.json 与人工确认记录的 Markdown 哈希不匹配")
        if front_matter_value(markdown_text, "transcription_mode") != CANONICAL_OUTPUT_PROFILE:
            errors.append(f"{label}: v2 最终 Markdown 缺少 agent_canonical_markdown 转录模式")
        if inline_page_boundary_markers(markdown_text):
            errors.append(f"{label}: 最终 Markdown 含有语义行或单词内部的页界注释")
        if duplicate_footnote_ids(markdown_text):
            errors.append(f"{label}: 最终 Markdown 含有重复脚注 ID")

    markdown_ids = BLOCK_ID_RE.findall(markdown_text)
    if not markdown_ids:
        errors.append(f"{label}: v2 最终 Markdown 没有 block ID")
    if len(markdown_ids) != len(set(markdown_ids)):
        errors.append(f"{label}: 最终 Markdown 含有重复 block ID")
    detected_blocks, missing_ids, orphan_ids = canonical_semantic_blocks(markdown_text)
    if missing_ids:
        errors.append(f"{label}: 最终 Markdown 含有未分配 block ID 的语义块")
    if orphan_ids:
        errors.append(f"{label}: 最终 Markdown 含有未绑定语义块的 block ID")

    mapped_ids: list[str] = []
    blocks = canonical_map.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        errors.append(f"{label}: canonical_text_map.json 缺少 blocks")
        blocks = []
    for block in blocks:
        if not isinstance(block, dict):
            errors.append(f"{label}: canonical_text_map.json block 必须是对象")
            continue
        block_id = block.get("block_id")
        if not isinstance(block_id, str) or not re.fullmatch(r"b[0-9]{4,}", block_id):
            errors.append(f"{label}: canonical_text_map.json 含非法 block ID")
            continue
        mapped_ids.append(block_id)
        if block.get("kind") not in CANONICAL_BLOCK_KINDS:
            errors.append(f"{label}: {block_id} 含非法或缺失的 block kind")
        elif detected_blocks.get(block_id) and block.get("kind") != detected_blocks[block_id]:
            errors.append(f"{label}: {block_id} 的 block kind 与 Markdown 结构不匹配")
        locators = block.get("source_locators")
        if not isinstance(locators, list) or not locators:
            errors.append(f"{label}: {block_id} 缺少来源定位")
            continue
        for locator in locators:
            scan_page_id = locator.get("scan_page_id") if isinstance(locator, dict) else None
            if scan_page_id not in page_ids:
                errors.append(f"{label}: {block_id} 引用了无效 scan_page_id")
    if len(mapped_ids) != len(set(mapped_ids)):
        errors.append(f"{label}: canonical_text_map.json 含重复 block ID")
    if set(markdown_ids) != set(mapped_ids):
        errors.append(f"{label}: Markdown block ID 与 canonical_text_map.json 映射不完整")

    notes = canonical_map.get("textual_notes")
    if not isinstance(notes, list):
        errors.append(f"{label}: canonical_text_map.json textual_notes 必须是数组")
        notes = []
    for note in notes:
        if not isinstance(note, dict):
            errors.append(f"{label}: textual note 必须是对象")
            continue
        if note.get("block_id") not in set(mapped_ids):
            errors.append(f"{label}: textual note 引用了未映射 block ID")
        if note.get("category") not in TEXTUAL_NOTE_CATEGORIES:
            errors.append(f"{label}: textual note 含非法 category")
        for field in ("source_reading", "canonical_reading", "rationale"):
            if not isinstance(note.get(field), str):
                errors.append(f"{label}: textual note 缺少 {field}")
        locators = note.get("source_locators")
        if not isinstance(locators, list) or not locators:
            errors.append(f"{label}: textual note 缺少来源定位")
            continue
        for locator in locators:
            scan_page_id = locator.get("scan_page_id") if isinstance(locator, dict) else None
            if scan_page_id not in page_ids:
                errors.append(f"{label}: textual note 引用了无效 scan_page_id")
    return errors


def source_scan_entry(root: Path, collection: dict[str, Any], source_rel: str) -> dict[str, Any] | None:
    manifest = collection.get("scan_manifest")
    if not manifest or not (root / manifest).is_file():
        return None
    data = json.loads((root / manifest).read_text(encoding="utf-8"))
    author_root = Path(collection["root"])
    for item in data.get("items", []):
        candidate = (author_root / str(item.get("local_path", ""))).as_posix()
        if candidate == source_rel:
            return item
    return None


def generated_gbrain_block(root: Path) -> str:
    lines = [GBRAIN_BEGIN]
    lines.extend(f"    - {path}" for path in gbrain_roots(root))
    lines.append(GBRAIN_END)
    return "\n".join(lines)


def sync_gbrain(root: Path, *, check: bool = False) -> bool:
    path = root / "gbrain.yml"
    text = path.read_text(encoding="utf-8")
    block = generated_gbrain_block(root)
    pattern = re.compile(re.escape(GBRAIN_BEGIN) + r".*?" + re.escape(GBRAIN_END), re.DOTALL)
    if pattern.search(text):
        updated = pattern.sub(block, text, count=1)
    else:
        match = re.search(r"(?m)^  db_tracked:\s*\n(?:    - .*\n)*", text)
        if not match:
            raise ValueError("gbrain.yml 缺少 storage.db_tracked")
        updated = text[: match.start()] + "  db_tracked:\n" + block + "\n" + text[match.end() :]
    if check:
        return updated == text
    if updated != text:
        path.write_text(updated, encoding="utf-8")
    return True


def manifest_updated_at(path: Path | None) -> str:
    if not path or not path.is_file():
        return "-"
    data = json.loads(path.read_text(encoding="utf-8"))
    return str(data.get("generated_at") or data.get("updated_at") or "-")


def status_markdown(root: Path) -> str:
    data = load_registry(root)
    people = person_map(data)
    lines = [
        "---",
        'title: "Philosopher Text Collection Status"',
        'created: "2026-06-21"',
        'type: "project"',
        'tags: ["collections", "status", "corpus"]',
        'language: "en"',
        'collection: "project-documentation"',
        'llm_wiki_eligible: "true"',
        'gbrain_source: "project-markdown"',
        "---",
        "",
        "# Philosopher Text Collection Status",
        "",
        "This page is generated by `python3 scripts/manage_collections.py sync` from "
        "[`metadata/collections.json`](metadata/collections.json) and collection manifests.",
        "Markdown and Git are the sources of record. Scan counts do not imply searchable or "
        "verified digital text.",
        "",
        "| Person | Collection | Stage | Corpus Markdown | Source scans | Scan size | Work records | Metadata updated |",
        "|---|---|---|---:|---:|---:|---:|---|",
    ]
    for collection in data.get("collections", []):
        person = people[collection["person_id"]]
        scan_count, scan_bytes = scan_stats(root, collection.get("scan_manifest"))
        work_path = root / collection["works_manifest"] if collection.get("works_manifest") else None
        work_count = metadata_item_count(work_path)
        updated = max(
            (
                manifest_updated_at(root / value)
                for value in (collection.get("works_manifest"), collection.get("scan_manifest"))
                if value
            ),
            default="-",
        )
        readme = collection.get("readme")
        collection_label = (
            f"[{collection['id']}]({readme})" if readme else f"`{collection['id']}`"
        )
        lines.append(
            "| {person} | {collection} | `{stage}` | {markdown} | {scans} | {size} | {works} | {updated} |".format(
                person=person["name_latin"],
                collection=collection_label,
                stage=collection["stage"],
                markdown=markdown_count(root, collection.get("corpus_paths", [])),
                scans=scan_count,
                size=format_bytes(scan_bytes),
                works="-" if work_count is None else work_count,
                updated=updated,
            )
        )
    lines.extend(
        [
            "",
            "## Stage Notes",
            "",
            "- `markdown_corpus`: searchable Markdown exists; file front matter still controls admission.",
            "- `markdown_and_scans`: the collection contains both Markdown and unprocessed scans.",
            "- `source_scans`: bibliography and scans exist, but verified digital text does not.",
            "- Historical layouts retain their paths; new people use the standard collection layout.",
            "",
        ]
    )
    return "\n".join(lines)


def format_bytes(value: int) -> str:
    if value <= 0:
        return "-"
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            return f"{value:.1f} {unit}" if isinstance(value, float) else f"{value} {unit}"
        value = value / 1024
    return "-"


def sync_status(root: Path, *, check: bool = False) -> bool:
    path = root / "COLLECTION_STATUS.md"
    expected = status_markdown(root)
    current = path.read_text(encoding="utf-8") if path.is_file() else ""
    if check:
        return current == expected
    if current != expected:
        path.write_text(expected, encoding="utf-8")
    return True


def validate_digitization(root: Path) -> list[str]:
    errors: list[str] = []
    data = load_registry(root)
    for collection in data.get("collections", []):
        if not collection.get("scan_manifest"):
            continue
        digitization = root / collection["root"] / "digitization"
        if not digitization.is_dir():
            continue
        for project_path in sorted(digitization.glob("*/project.json")):
            project_dir = project_path.parent
            project = json.loads(project_path.read_text(encoding="utf-8"))
            state = project.get("status")
            label = project_dir.relative_to(root).as_posix()
            if state not in DIGITIZATION_STATES:
                errors.append(f"{label}: 非法数字化状态")
                continue
            required = {
                "schema_version", "author_id", "work_id", "source_scan", "source_sha256",
                "source_version", "status", "created", "ocr_activated",
            }
            missing = sorted(required - project.keys())
            if missing:
                errors.append(f"{label}: project.json 缺少 {missing}")
                continue
            schema_version = project.get("schema_version")
            if schema_version not in {1, 2}:
                errors.append(f"{label}: project.json schema_version 必须为 1 或 2")
                continue
            is_v2 = schema_version == 2
            if is_v2 and project.get("output_profile") != CANONICAL_OUTPUT_PROFILE:
                errors.append(
                    f"{label}: v2 项目 output_profile 必须为 {CANONICAL_OUTPUT_PROFILE}"
                )
            source = root / project["source_scan"]
            if not source.is_file():
                errors.append(f"{label}: 源扫描件不存在")
            elif sha256(source) != project["source_sha256"]:
                errors.append(f"{label}: 源扫描件 SHA-256 不匹配")
            entry = source_scan_entry(root, collection, project["source_scan"])
            if not entry:
                errors.append(f"{label}: 源扫描件未登记到对应 manifest")
            if state != "planned" and project.get("ocr_activated") is not True:
                errors.append(f"{label}: 进入处理阶段前必须明确激活 OCR")
            stage_files = {
                "processing": ("page_map.json", "ocr_runs.json"),
                "human_review": ("page_map.json", "ocr_runs.json", "ocr_review_log.json", "quality_report.json"),
                "human_verified": (
                    "page_map.json",
                    "ocr_runs.json",
                    "ocr_review_log.json",
                    "quality_report.json",
                    "human_verification_manifest.json",
                ),
            }
            if is_v2:
                stage_files["human_review"] += ("canonical_text_map.json",)
                stage_files["human_verified"] += ("canonical_text_map.json",)
            for required_state, files in stage_files.items():
                if state in stage_files and list(stage_files).index(state) >= list(stage_files).index(required_state):
                    for name in files:
                        if not (project_dir / name).is_file():
                            errors.append(f"{label}: {state} 状态缺少 {name}")
            if state in {"processing", "human_review", "human_verified"}:
                runs_path = project_dir / "ocr_runs.json"
                if runs_path.is_file():
                    runs = json.loads(runs_path.read_text(encoding="utf-8")).get("runs", [])
                    engines = {(run.get("engine"), run.get("version")) for run in runs}
                    if len(runs) < 2 or len(engines) < 2:
                        errors.append(f"{label}: OCR 处理必须保留两个独立引擎记录")
            if state == "human_verified":
                verification_path = project_dir / "human_verification_manifest.json"
                if verification_path.is_file():
                    verification = json.loads(verification_path.read_text(encoding="utf-8"))
                    final_path = root / str(verification.get("final_markdown", ""))
                    if verification.get("verification_status") != "human_verified":
                        errors.append(f"{label}: 未记录全书人工确认")
                    if not final_path.is_file():
                        errors.append(f"{label}: 最终 Markdown 不存在")
                    elif sha256(final_path) != verification.get("final_markdown_sha256"):
                        errors.append(f"{label}: 最终 Markdown SHA-256 不匹配")
                    if verification.get("source_scan_sha256") != project.get("source_sha256"):
                        errors.append(f"{label}: 人工确认记录的源扫描件哈希不匹配")
                    page_map_path = project_dir / "page_map.json"
                    expected_pages: set[str] = set()
                    if page_map_path.is_file():
                        page_map = json.loads(page_map_path.read_text(encoding="utf-8"))
                        expected_pages = {
                            item["scan_page_id"]
                            for item in page_map.get("pages", [])
                            if isinstance(item, dict) and isinstance(item.get("scan_page_id"), str)
                        }
                        verified_pages = set(verification.get("verified_scan_pages", []))
                        if expected_pages != verified_pages:
                            errors.append(f"{label}: 人工确认未覆盖 page_map 全部页面")
                    quality_path = project_dir / "quality_report.json"
                    if quality_path.is_file():
                        quality = json.loads(quality_path.read_text(encoding="utf-8"))
                        if quality.get("status") != "passed" or quality.get("unresolved_issues"):
                            errors.append(f"{label}: 质量报告未通过或仍有未解决问题")
                    if is_v2:
                        errors.extend(
                            validate_canonical_text_map(
                                root,
                                project,
                                project_dir,
                                verification,
                                expected_pages,
                            )
                        )
    return errors


def validate_translation_projects(root: Path) -> list[str]:
    from check_translations import validate_repository

    _, errors = validate_repository(root)
    return errors


def init_translation(root: Path, args: argparse.Namespace) -> None:
    from check_translations import (
        ID_RE,
        PLACEHOLDER_VERSIONS,
        markdown_source_blocks,
        validate_source_segment,
        validate_source_unit,
        valid_iso_date,
        visible_corpus_markdown,
    )
    from prepare_gbrain_markdown import parse_front_matter

    registry = load_registry(root)
    known_people = {person["id"] for person in registry.get("people", [])}
    if args.author_id not in known_people:
        raise ValueError("author_id is not registered")
    if not ID_RE.fullmatch(args.author_id) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.work_id):
        raise ValueError("author_id or work_id has an invalid format")
    if args.source_version.strip().casefold() in PLACEHOLDER_VERSIONS:
        raise ValueError("source_version must contain a verified version statement")
    if not valid_iso_date(args.date):
        raise ValueError("date must be a valid YYYY-MM-DD value")

    project_dir = root / "translation_workspace/planned" / args.author_id / args.work_id
    if project_dir.exists():
        raise ValueError(f"translation project already exists: {project_dir}")

    units_by_id: dict[str, dict[str, Any]] = {}
    ranges: dict[str, list[tuple[int, int, str]]] = {}
    for unit_id, source_value, selector in args.source_unit:
        if not ID_RE.fullmatch(unit_id):
            raise ValueError(f"invalid translation unit ID: {unit_id}")

        source_relative = Path(source_value)
        if source_relative.is_absolute() or ".." in source_relative.parts:
            raise ValueError(f"source_path must be repository-relative: {source_value}")
        if not visible_corpus_markdown(source_relative):
            raise ValueError(f"source_path must point to visible corpus Markdown: {source_value}")
        source = root / source_relative
        if not source.is_file():
            raise ValueError(f"source does not exist: {source_value}")
        collection = collection_for_path(root, source_value)
        if not collection or collection.get("person_id") != args.author_id:
            raise ValueError(
                f"source is not registered to the corpus for author {args.author_id}: {source_value}"
            )

        text = source.read_text(encoding="utf-8")
        metadata = parse_front_matter(text)
        blocks = markdown_source_blocks(text)
        if not blocks:
            raise ValueError(f"source has no registerable Markdown blocks: {source_value}")
        if selector == "all":
            block_start, block_end = 1, len(blocks)
        else:
            match = re.fullmatch(r"(\d+)-(\d+)", selector)
            if not match:
                raise ValueError(f"block selector must be all or START-END: {selector}")
            block_start, block_end = (int(match.group(1)), int(match.group(2)))

        segment = {
            "source_path": source_value,
            "source_url": metadata.get("source_url", "not_stated"),
            "source_version": args.source_version,
            "source_sha256": sha256(source),
            "source_block_start": block_start,
            "source_block_end": block_end,
        }
        segment_errors, _ = validate_source_segment(
            segment,
            f"source_unit={unit_id}",
            root,
            args.author_id,
            args.work_id,
        )
        if segment_errors:
            raise ValueError("; ".join(segment_errors))
        for prior_start, prior_end, prior_id in ranges.setdefault(source_value, []):
            if max(block_start, prior_start) <= min(block_end, prior_end):
                raise ValueError(f"translation units {unit_id} and {prior_id} overlap")
        ranges[source_value].append((block_start, block_end, unit_id))
        unit = units_by_id.setdefault(
            unit_id,
            {
                "id": unit_id,
                "status": "planned",
                "source_segments": [],
                "paragraph_count": 0,
                "accuracy_review": {
                    "reviewer": None,
                    "reviewed_at": None,
                    "result": "pending",
                    "scope_sha256": None,
                },
                "language_review": {
                    "reviewer": None,
                    "reviewed_at": None,
                    "result": "pending",
                    "scope_sha256": None,
                },
            },
        )
        unit["source_segments"].append(segment)
        unit["paragraph_count"] += block_end - block_start + 1

    units = list(units_by_id.values())
    for unit in units:
        unit_errors, _ = validate_source_unit(
            unit,
            f"source_unit={unit['id']}",
            root,
            args.author_id,
            args.work_id,
        )
        if unit_errors:
            raise ValueError("; ".join(unit_errors))

    project_dir.mkdir(parents=True)
    write_json(
        project_dir / "translation.json",
        {
            "schema_version": 3,
            "author_id": args.author_id,
            "work_id": args.work_id,
            "created_at": args.date,
            "updated_at": args.date,
            "target_language": "zh",
            "source_units": units,
        },
    )


def check(root: Path) -> list[str]:
    errors = validate_registry(root)
    if not sync_gbrain(root, check=True):
        errors.append("gbrain.yml 的 COLLECTIONS-AUTO 区块需要同步")
    if not sync_status(root, check=True):
        errors.append("COLLECTION_STATUS.md 需要同步")
    errors.extend(validate_digitization(root))
    errors.extend(validate_translation_projects(root))
    return errors


def scaffold_person(root: Path, args: argparse.Namespace) -> None:
    registry_path = root / DEFAULT_REGISTRY
    data = load_registry(root)
    if any(person["id"] == args.id for person in data["people"]):
        raise ValueError(f"人物 ID 已存在: {args.id}")
    author_root = root / f"{args.id}_markdown"
    if author_root.exists():
        raise ValueError(f"目录已存在: {author_root}")

    corpus = author_root / f"{args.id}_md"
    for path in (
        corpus,
        author_root / "bibliography",
        author_root / "metadata",
        author_root / "source_scans",
        author_root / "scripts",
    ):
        path.mkdir(parents=True, exist_ok=True)
        (path / ".gitkeep").write_text("", encoding="utf-8")

    (author_root / "README.md").write_text(
        "---\n"
        f'title: "{args.name_latin} Philosophy Text Archive"\n'
        f'created: "{args.date}"\n'
        f'updated: "{args.date}"\n'
        'type: "project"\n'
        f'tags: ["{args.id}", "philosophy", "source-archive"]\n'
        'language: "en"\n'
        'collection: "project-documentation"\n'
        'llm_wiki_eligible: "true"\n'
        'gbrain_source: "project-markdown"\n'
        "---\n\n"
        f"# {args.name_latin} Philosophy Text Archive\n\n"
        f"This collection preserves original-language texts, bibliography, source scans, and "
        f"provenance metadata for {args.name_latin} ({args.name_original}).\n\n"
        f"Relationship to the project: {args.relation}.\n\n"
        "The directory uses the standard collection layout. Searchable text, unprocessed scans, "
        "bibliography, and metadata must remain separate.\n",
        encoding="utf-8",
    )
    write_json(
        author_root / "metadata/works_master.json",
        {"schema_version": 1, "generated_at": args.date, "author": args.name_original, "works": []},
    )
    write_json(
        author_root / "metadata/source_scans_manifest.json",
        {
            "schema_version": 1,
            "generated_at": args.date,
            "policy": "Source scans are stored unprocessed and excluded from core corpus and LLM indexing.",
            "items": [],
        },
    )
    data["people"].append(
        {
            "id": args.id,
            "name_zh": args.name_zh,
            "name_original": args.name_original,
            "name_latin": args.name_latin,
            "relation": args.relation,
        }
    )
    root_name = f"{args.id}_markdown"
    data["collections"].append(
        {
            "id": f"{args.id}-texts",
            "person_id": args.id,
            "kind": "author_texts",
            "root": root_name,
            "layout": "standard",
            "stage": "bibliography",
            "readme": f"{root_name}/README.md",
            "corpus_paths": [f"{root_name}/{args.id}_md/"],
            "scan_paths": [f"{root_name}/source_scans/"],
            "scan_manifest": f"{root_name}/metadata/source_scans_manifest.json",
            "works_manifest": f"{root_name}/metadata/works_master.json",
            "bibliography_paths": [f"{root_name}/bibliography/"],
            "source_survey": f"{root_name}/README.md",
            "gbrain_tracked": True,
            "default_text_role": "author_original",
            "default_language": args.language,
            "collection_name": f"{args.id}-original-language",
        }
    )
    data["generated_at"] = args.date
    write_json(registry_path, data)
    sync_gbrain(root)
    sync_status(root)


def init_digitization(root: Path, args: argparse.Namespace) -> None:
    data = load_registry(root)
    collection = next(
        (
            item for item in data["collections"]
            if item["person_id"] == args.author_id
            and args.source_scan.startswith(item["root"].rstrip("/") + "/")
            and source_scan_entry(root, item, args.source_scan)
        ),
        None,
    )
    if not collection:
        raise ValueError("源扫描件未登记到该人物的集合 manifest")
    source = root / args.source_scan
    if not source.is_file():
        raise ValueError(f"扫描件不存在: {args.source_scan}")
    project_dir = root / collection["root"] / "digitization" / args.work_id
    if project_dir.exists():
        raise ValueError(f"数字化项目已存在: {project_dir}")
    project_dir.mkdir(parents=True)
    write_json(
        project_dir / "project.json",
        {
            "schema_version": 2,
            "author_id": args.author_id,
            "work_id": args.work_id,
            "source_scan": args.source_scan,
            "source_sha256": sha256(source),
            "source_version": args.source_version,
            "status": "planned",
            "created": args.date,
            "ocr_activated": False,
            "output_profile": CANONICAL_OUTPUT_PROFILE,
        },
    )


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    sub.add_parser("sync")

    add = sub.add_parser("add-person")
    add.add_argument("--id", required=True)
    add.add_argument("--name-zh", required=True)
    add.add_argument("--name-original", required=True)
    add.add_argument("--name-latin", required=True)
    add.add_argument("--relation", required=True)
    add.add_argument("--language", default="ru")
    add.add_argument("--date", default="2026-06-21")

    digitize = sub.add_parser("init-digitization")
    digitize.add_argument("--author-id", required=True)
    digitize.add_argument("--work-id", required=True)
    digitize.add_argument("--source-scan", required=True)
    digitize.add_argument("--source-version", required=True)
    digitize.add_argument("--date", default="2026-06-21")

    translate = sub.add_parser("init-translation")
    translate.add_argument("--author-id", required=True)
    translate.add_argument("--work-id", required=True)
    translate.add_argument("--source-version", required=True)
    translate.add_argument(
        "--source-unit",
        action="append",
        nargs=3,
        required=True,
        metavar=("UNIT_ID", "SOURCE_PATH", "BLOCKS"),
        help=(
            "Repeat for each source segment; reuse UNIT_ID to join ordered split files; "
            "BLOCKS is all or START-END"
        ),
    )
    translate.add_argument("--date", default=date.today().isoformat())
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "check":
            errors = check(ROOT)
            if errors:
                print("\n".join(f"error: {error}" for error in errors), file=sys.stderr)
                return 1
            print("collections registry, status, GBrain, digitization and translation projects: OK")
        elif args.command == "sync":
            sync_gbrain(ROOT)
            sync_status(ROOT)
            print("gbrain.yml and COLLECTION_STATUS.md synchronized")
        elif args.command == "add-person":
            scaffold_person(ROOT, args)
            print(f"created person collection: {args.id}")
        elif args.command == "init-digitization":
            init_digitization(ROOT, args)
            print(f"initialized digitization project: {args.author_id}/{args.work_id}")
        elif args.command == "init-translation":
            init_translation(ROOT, args)
            print(f"initialized translation project: {args.author_id}/{args.work_id}")
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
