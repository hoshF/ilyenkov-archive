#!/usr/bin/env python3
"""Validate translation projects, source bindings, drafts, issues, and review gates."""

from __future__ import annotations

import argparse
import hashlib
import datetime
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collection_registry import collection_for_path
from prepare_gbrain_markdown import parse_front_matter


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = Path("translation_workspace")
STAGES = ("planned", "drafts", "reviewed")
UNIT_STATUSES = {"planned", "drafting", "accuracy_review", "language_review", "reviewed"}
REVIEW_RESULTS = {"pending", "passed", "changes_required"}
ISSUE_TYPES = {"句法", "指代", "术语", "引文", "遗漏", "中文表达"}
REQUIRED_PROJECT_FIELDS = {
    "schema_version",
    "author_id",
    "work_id",
    "created_at",
    "updated_at",
    "target_language",
    "source_units",
}
# Long works are registered unit by unit, so "every registered unit is reviewed"
# does not mean the work is finished. Only this flag declares completion.
OPTIONAL_PROJECT_FIELDS = {"work_complete"}
REQUIRED_UNIT_FIELDS = {
    "id",
    "status",
    "source_segments",
    "paragraph_count",
    "accuracy_review",
    "language_review",
}
REQUIRED_SEGMENT_FIELDS = {
    "source_path",
    "source_url",
    "source_version",
    "source_sha256",
    "source_block_start",
    "source_block_end",
}
REQUIRED_REVIEW_FIELDS = {"reviewer", "reviewed_at", "result", "scope_sha256"}
REQUIRED_ISSUE_FIELDS = {
    "段落",
    "类型",
    "术语条目",
    "阻断",
    "状态",
    "问题",
    "候选",
    "同作者语料证据",
    "最终决定",
    "理由",
}
ITALIC_RE = re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", re.DOTALL)
FOOTNOTE_MARK_RE = re.compile(r"\[\^([A-Za-z0-9._-]+)\](?!:)")
FOOTNOTE_DEF_RE = re.compile(r"(?m)^\[\^([A-Za-z0-9._-]+)\]:")
ASCII_ELLIPSIS_RE = re.compile(r"(?<!\.)\.\.\.(?!\.)")
TRANSLATOR_NOTE_PREFIX = "zh-"
# The author's own parentheses carry his asides, and their position is their
# scope. Translators keep flattening them into dashes or separate sentences:
# ch014 p0031, ch015 p0008, then ch016 in 19 blocks at once — the third time
# with the rule stated verbatim in the drafting prompt. ch016 p0084 shows why
# it matters: a dash and a parenthesis appear in one sentence doing different
# work. Translations may add parentheses (Cyrillic initials get them) but never
# drop them.
OPEN_PAREN_SOURCE = "("
OPEN_PAREN_BODY = ("（", "(")
# Per-block formal features reported by --inspect-source. Every chapter prompt
# quotes these numbers; deriving them by hand has gone wrong three times
# (ch013 declension regex, ch016 italic count, ch019 block count), so the tool
# owns them now. Логика/логика are split because the capital form is a distinct
# term in this book and sentence-initial capitals are not evidence either way.
SOURCE_FEATURE_PATTERNS = {
    "italic": ITALIC_RE,
    "footnote_mark": FOOTNOTE_MARK_RE,
    "footnote_def": FOOTNOTE_DEF_RE,
    "paren": re.compile(r"\("),
    "logika_upper": re.compile(r"Логик\w*"),
    "logika_lower": re.compile(r"(?<![А-Яа-яЁё])логик\w*"),
    "editorial_bracket": re.compile(r"\[[^^\]]+\]"),
}
# Thresholds for the literal/final independence check; see draft_independence_errors.
PROSE_MIN_CHARS = 40
DRAFT_COPY_MIN_BLOCKS = 3
DRAFT_COPY_RATIO = 1 / 3
# See notes/STYLE_GUIDE.md: Chinese body text uses 中文弯引号 and 六点省略号.
FORBIDDEN_BODY_MARKS = (
    ('"', 'ASCII double quote; use 中文弯引号 “ ”'),
    ("«", "Russian guillemet; use 中文弯引号 “ ” for quotations"),
    ("»", "Russian guillemet; use 中文弯引号 “ ” for quotations"),
)
ID_RE = re.compile(r"[a-z][a-z0-9_-]*")
WORK_ID_RE = re.compile(r"[a-z0-9][a-z0-9_-]*")
SHA256_RE = re.compile(r"[0-9a-f]{64}")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
ISSUE_HEADING_RE = re.compile(r"(?m)^## (ISSUE-\d{4})\s*$")
PARAGRAPH_HEADING_RE = re.compile(r"(?m)^## ([a-z][a-z0-9_-]*-p\d{4})\s*$")
ANY_H2_RE = re.compile(r"(?m)^##\s+(.+?)\s*$")
THEMATIC_BREAK_RE = re.compile(r"^(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$")
PLACEHOLDER_VERSIONS = {"", "待核验版本", "unknown", "not_stated"}
FORBIDDEN_SOURCE_PARTS = {
    ".fulltext",
    "cache",
    "digitization",
    "source",
    "source_pdfs",
    "source_scans",
}


def relative_name(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def visible_corpus_markdown(path: Path) -> bool:
    return (
        path.suffix == ".md"
        and not FORBIDDEN_SOURCE_PARTS.intersection(path.parts)
        and not any(part.startswith(".") for part in path.parts)
    )


def valid_iso_date(value: Any) -> bool:
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def markdown_source_blocks(text: str) -> list[str]:
    # Block numbering is a persistence contract: registered source_block ranges,
    # issue records, and review scope hashes reference these indices, so any
    # change to the segmentation rules requires migrating registered projects.
    front_matter = re.match(r"\A---\r?\n.*?\r?\n---\r?\n", text, re.DOTALL)
    body = text[front_matter.end():] if front_matter else text
    blocks: list[str] = []
    current: list[str] = []
    fence: tuple[str, int] | None = None

    def flush() -> None:
        block = "\n".join(current).strip()
        current.clear()
        if block and not THEMATIC_BREAK_RE.fullmatch(block):
            blocks.append(block)

    for line in body.splitlines():
        stripped = line.strip()
        fence_match = re.match(r"^(`{3,}|~{3,})", stripped)
        if fence_match:
            marker = fence_match.group(1)
            if fence is None:
                fence = (marker[0], len(marker))
            elif marker[0] == fence[0] and len(marker) >= fence[1]:
                fence = None
            current.append(line)
            continue
        if not stripped and fence is None:
            flush()
        else:
            current.append(line)
    flush()
    return blocks


def review_scope_sha256(
    project_dir: Path,
    unit: dict[str, Any],
    review_kind: str,
) -> str | None:
    # Review scope is per unit so registering new units never invalidates
    # completed reviews of other units.
    filenames = ("literal.md", "final.md", "issues.md") if review_kind == "accuracy" else ("final.md",)
    digest = hashlib.sha256()
    unit_id = str(unit.get("id", ""))
    if review_kind == "accuracy":
        source_scope = {
            "id": unit.get("id"),
            "paragraph_count": unit.get("paragraph_count"),
            "source_segments": [
                {field: segment.get(field) for field in sorted(REQUIRED_SEGMENT_FIELDS)}
                for segment in unit.get("source_segments", [])
                if isinstance(segment, dict)
            ],
        }
        source_bytes = json.dumps(
            source_scope,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        label = b"source_unit"
        digest.update(len(label).to_bytes(8, "big"))
        digest.update(label)
        digest.update(len(source_bytes).to_bytes(8, "big"))
        digest.update(source_bytes)
    for filename in filenames:
        relative = Path("units") / unit_id / filename
        path = project_dir / relative
        if not path.is_file():
            return None
        relative_bytes = relative.as_posix().encode("utf-8")
        content = path.read_bytes()
        digest.update(len(relative_bytes).to_bytes(8, "big"))
        digest.update(relative_bytes)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def translation_files(root: Path = ROOT) -> list[Path]:
    files: list[Path] = []
    workspace = root / WORKSPACE
    for stage in STAGES:
        stage_root = workspace / stage
        if stage_root.is_dir():
            files.extend(stage_root.rglob("translation.json"))
    return sorted(files)


def registered_people(root: Path) -> set[str]:
    path = root / "metadata/collections.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(person["id"]) for person in data.get("people", [])}


def glossary_entry_ids(root: Path, author_id: str) -> set[str] | None:
    path = root / f"{author_id}_markdown/metadata/glossary.json"
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(entry.get("id", "")) for entry in data.get("entries", [])}


def validate_review(label: str, value: Any) -> tuple[list[str], str | None]:
    errors: list[str] = []
    if not isinstance(value, dict):
        return [f"{label}: must be an object"], None
    missing = sorted(REQUIRED_REVIEW_FIELDS - value.keys())
    unexpected = sorted(value.keys() - REQUIRED_REVIEW_FIELDS)
    if missing:
        errors.append(f"{label}: missing fields {missing}")
    if unexpected:
        errors.append(f"{label}: unexpected fields {unexpected}")
    result = value.get("result")
    if result not in REVIEW_RESULTS:
        errors.append(f"{label}: invalid result={result}")
        return errors, None
    reviewer = value.get("reviewer")
    reviewed_at = value.get("reviewed_at")
    scope_sha256 = value.get("scope_sha256")
    if result == "pending":
        if reviewer is not None or reviewed_at is not None or scope_sha256 is not None:
            errors.append(f"{label}: pending review must not name a reviewer, date, or scope hash")
    else:
        if not isinstance(reviewer, str) or not reviewer.strip():
            errors.append(f"{label}: completed review requires a human reviewer")
        if not valid_iso_date(reviewed_at):
            errors.append(f"{label}: completed review requires reviewed_at=YYYY-MM-DD")
        if not isinstance(scope_sha256, str) or not SHA256_RE.fullmatch(scope_sha256):
            errors.append(f"{label}: completed review requires a valid scope_sha256")
    return errors, str(result)


def validate_source_segment(
    segment: Any,
    label: str,
    root: Path,
    author_id: str,
    work_id: str,
) -> tuple[list[str], dict[str, Any] | None]:
    errors: list[str] = []
    if not isinstance(segment, dict):
        return [f"{label}: source segment must be an object"], None
    missing = sorted(REQUIRED_SEGMENT_FIELDS - segment.keys())
    unexpected = sorted(segment.keys() - REQUIRED_SEGMENT_FIELDS)
    if missing:
        errors.append(f"{label}: missing fields {missing}")
    if unexpected:
        errors.append(f"{label}: unexpected fields {unexpected}")

    source_version = segment.get("source_version")
    if (
        not isinstance(source_version, str)
        or source_version.strip().casefold() in PLACEHOLDER_VERSIONS
    ):
        errors.append(f"{label}: source_version must be verified")

    source_path_value = segment.get("source_path")
    if not isinstance(source_path_value, str) or not source_path_value:
        errors.append(f"{label}: source_path must be a non-empty string")
        return errors, segment
    source_relative = Path(source_path_value)
    if source_relative.is_absolute() or ".." in source_relative.parts:
        errors.append(f"{label}: source_path must be repository-relative")
        return errors, segment
    if not visible_corpus_markdown(source_relative):
        errors.append(f"{label}: source_path must point to visible corpus Markdown")
        return errors, segment
    source_path = root / source_relative
    if not source_path.is_file():
        errors.append(f"{label}: source path does not exist: {source_path_value}")
        return errors, segment

    expected_sha = segment.get("source_sha256")
    if not isinstance(expected_sha, str) or not SHA256_RE.fullmatch(expected_sha):
        errors.append(f"{label}: source_sha256 must be 64 lowercase hexadecimal characters")
    elif sha256(source_path) != expected_sha:
        errors.append(f"{label}: source SHA-256 mismatch: {source_path_value}")

    source_text = source_path.read_text(encoding="utf-8")
    metadata = parse_front_matter(source_text)
    if metadata.get("text_role") != "author_original":
        errors.append(f"{label}: source must use text_role=author_original")
    if metadata.get("core_corpus_eligible") != "true":
        errors.append(f"{label}: source must be admitted to the core corpus")
    if (
        metadata.get("llm_wiki_eligible") != "true"
        or metadata.get("gbrain_source") != "project-markdown"
    ):
        errors.append(f"{label}: source must be GBrain-visible project Markdown")
    collection = collection_for_path(root, source_path_value)
    if not collection or collection.get("person_id") != author_id:
        errors.append(f"{label}: source path is not registered for author_id={author_id}")
    source_identity = metadata.get("work_id") or metadata.get("id") or source_path.stem
    if source_identity != work_id:
        errors.append(
            f"{label}: source identity {source_identity} does not match work_id={work_id}"
        )
    source_url = segment.get("source_url")
    if not isinstance(source_url, str) or not source_url:
        errors.append(f"{label}: source_url must be a non-empty string")
    elif metadata.get("source_url") and source_url != metadata.get("source_url"):
        errors.append(f"{label}: source_url does not match source front matter")

    chapter_index = metadata.get("chapter_index")
    manifest_relative: str | None = None
    if metadata.get("work_id") or chapter_index:
        manifest_path = source_path.parent / "work_manifest.json"
        if not manifest_path.is_file():
            errors.append(f"{label}: split source is missing work_manifest.json")
        else:
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as error:
                errors.append(f"{label}: invalid work_manifest.json: {error}")
            else:
                manifest_relative = relative_name(manifest_path, root)
                if manifest.get("work_id") != metadata.get("work_id"):
                    errors.append(f"{label}: work_manifest work_id does not match source front matter")
                chapter = next(
                    (
                        item for item in manifest.get("chapters", [])
                        if str(item.get("chapter_index")) == str(chapter_index)
                        and item.get("file") == source_path.name
                    ),
                    None,
                )
                if not chapter:
                    errors.append(f"{label}: source chapter is not registered in work_manifest.json")
                elif chapter.get("file_sha256") != sha256(source_path):
                    errors.append(f"{label}: work_manifest chapter SHA-256 mismatch")

    blocks = markdown_source_blocks(source_text)
    block_start = segment.get("source_block_start")
    block_end = segment.get("source_block_end")
    if not isinstance(block_start, int) or isinstance(block_start, bool) or block_start < 1:
        errors.append(f"{label}: source_block_start must be a positive integer")
    if not isinstance(block_end, int) or isinstance(block_end, bool) or block_end < 1:
        errors.append(f"{label}: source_block_end must be a positive integer")
    if (
        isinstance(block_start, int)
        and not isinstance(block_start, bool)
        and isinstance(block_end, int)
        and not isinstance(block_end, bool)
    ):
        if block_start > block_end:
            errors.append(f"{label}: source block range is reversed")
        if block_end > len(blocks):
            errors.append(f"{label}: source_block_end exceeds source block count={len(blocks)}")
    validated = dict(segment)
    validated["_source_block_count"] = len(blocks)
    validated["_manifest_path"] = manifest_relative
    validated["_chapter_index"] = chapter_index
    return errors, validated


def validate_source_unit(
    unit: Any,
    label: str,
    root: Path,
    author_id: str,
    work_id: str,
) -> tuple[list[str], dict[str, Any] | None]:
    errors: list[str] = []
    if not isinstance(unit, dict):
        return [f"{label}: source unit must be an object"], None
    missing = sorted(REQUIRED_UNIT_FIELDS - unit.keys())
    unexpected = sorted(unit.keys() - REQUIRED_UNIT_FIELDS)
    if missing:
        errors.append(f"{label}: missing fields {missing}")
    if unexpected:
        errors.append(f"{label}: unexpected fields {unexpected}")

    unit_id = unit.get("id")
    if not isinstance(unit_id, str) or not ID_RE.fullmatch(unit_id):
        errors.append(f"{label}: invalid id={unit_id}")
    paragraph_count = unit.get("paragraph_count")
    if not isinstance(paragraph_count, int) or isinstance(paragraph_count, bool) or paragraph_count < 1:
        errors.append(f"{label}: paragraph_count must be a positive integer")

    status = unit.get("status")
    if status not in UNIT_STATUSES:
        errors.append(f"{label}: invalid status={status}")
        status = "planned"
    accuracy_errors, accuracy_result = validate_review(
        f"{label}:accuracy_review", unit.get("accuracy_review")
    )
    language_errors, language_result = validate_review(
        f"{label}:language_review", unit.get("language_review")
    )
    errors.extend(accuracy_errors)
    errors.extend(language_errors)
    if status == "planned" and any(
        result not in {None, "pending"} for result in (accuracy_result, language_result)
    ):
        errors.append(f"{label}: planned unit reviews must remain pending")
    if status in {"drafting", "accuracy_review"} and accuracy_result == "passed":
        errors.append(f"{label}: passed accuracy review requires unit status=language_review or reviewed")
    if status in {"planned", "drafting", "accuracy_review"} and language_result not in {None, "pending"}:
        errors.append(f"{label}: language review must remain pending before language_review")
    if status in {"language_review", "reviewed"} and accuracy_result not in {None, "passed"}:
        errors.append(f"{label}: accuracy review must pass before unit status={status}")
    if status == "reviewed" and language_result not in {None, "passed"}:
        errors.append(f"{label}: language review must pass before unit status=reviewed")
    if status == "language_review" and language_result == "passed":
        errors.append(f"{label}: passed language review requires unit status=reviewed")
    accuracy_data = unit.get("accuracy_review") if isinstance(unit.get("accuracy_review"), dict) else {}
    language_data = unit.get("language_review") if isinstance(unit.get("language_review"), dict) else {}
    accuracy_date = accuracy_data.get("reviewed_at")
    language_date = language_data.get("reviewed_at")
    if valid_iso_date(accuracy_date) and valid_iso_date(language_date) and language_date < accuracy_date:
        errors.append(f"{label}: language review cannot predate accuracy review")

    segments = unit.get("source_segments")
    if not isinstance(segments, list) or not segments:
        errors.append(f"{label}: source_segments must be a non-empty list")
        return errors, dict(unit)
    validated_segments: list[dict[str, Any]] = []
    selected_count = 0
    for index, segment in enumerate(segments):
        segment_errors, validated = validate_source_segment(
            segment,
            f"{label}:source_segments[{index}]",
            root,
            author_id,
            work_id,
        )
        errors.extend(segment_errors)
        if not validated:
            continue
        start = validated.get("source_block_start")
        end = validated.get("source_block_end")
        if (
            isinstance(start, int)
            and not isinstance(start, bool)
            and isinstance(end, int)
            and not isinstance(end, bool)
            and start <= end
        ):
            selected_count += end - start + 1
        validated_segments.append(validated)

    if paragraph_count != selected_count:
        errors.append(
            f"{label}: paragraph_count must equal selected source blocks={selected_count}"
        )

    if len(validated_segments) > 1:
        source_paths = [str(segment.get("source_path", "")) for segment in validated_segments]
        manifest_paths = {segment.get("_manifest_path") for segment in validated_segments}
        if len(set(source_paths)) > 1 and (None in manifest_paths or len(manifest_paths) != 1):
            errors.append(
                f"{label}: segments from different files must share one work_manifest.json"
            )
        previous_key: tuple[int, int] | None = None
        for segment in validated_segments:
            chapter_index = segment.get("_chapter_index")
            try:
                chapter_number = int(chapter_index) if chapter_index is not None else 0
            except (TypeError, ValueError):
                errors.append(f"{label}: segment chapter_index must be numeric for ordered mapping")
                previous_key = None
                break
            key = (chapter_number, int(segment.get("source_block_start", 0)))
            if previous_key is not None and key <= previous_key:
                errors.append(f"{label}: source_segments must follow source order")
                break
            previous_key = key

    validated_unit = dict(unit)
    validated_unit["source_segments"] = validated_segments
    validated_unit["_status"] = status
    validated_unit["_accuracy_result"] = accuracy_result
    validated_unit["_language_result"] = language_result
    validated_unit["_review_dates"] = [
        review_date
        for review_date in (accuracy_date, language_date)
        if valid_iso_date(review_date)
    ]
    return errors, validated_unit


def markdown_body(text: str) -> str:
    match = re.match(r"\A---\r?\n.*?\r?\n---\r?\n", text, re.DOTALL)
    return text[match.end():] if match else text


def unit_source_text(unit: dict[str, Any], root: Path) -> str | None:
    """Concatenate exactly the source blocks a unit is registered against."""
    parts: list[str] = []
    for segment in unit.get("source_segments", []):
        if not isinstance(segment, dict):
            return None
        source_path = root / str(segment.get("source_path", ""))
        start = segment.get("source_block_start")
        end = segment.get("source_block_end")
        if not source_path.is_file() or not isinstance(start, int) or not isinstance(end, int):
            return None
        blocks = markdown_source_blocks(source_path.read_text(encoding="utf-8"))
        parts.extend(blocks[start - 1:end])
    return "\n\n".join(parts)


def style_errors(body: str, source_text: str | None, label: str, enforce_parity: bool) -> list[str]:
    errors: list[str] = []
    for mark, description in FORBIDDEN_BODY_MARKS:
        if mark in body:
            errors.append(f"{label}: body must not contain {description}")
    if ASCII_ELLIPSIS_RE.search(body):
        errors.append(f"{label}: use the Chinese ellipsis …… rather than ...")
    if not enforce_parity or source_text is None:
        return errors
    expected = len(ITALIC_RE.findall(source_text))
    actual = len(ITALIC_RE.findall(body))
    if actual != expected:
        errors.append(f"{label}: emphasis spans={actual} but the source has {expected}")
    expected = source_text.count(OPEN_PAREN_SOURCE)
    actual = sum(body.count(mark) for mark in OPEN_PAREN_BODY)
    if actual < expected:
        errors.append(
            f"{label}: parentheses={actual} but the source has {expected};"
            " the author's parentheses must be kept, not flattened into dashes"
            " or separate sentences"
        )
    # Every source footnote must survive; extra ones are allowed only as
    # translator notes, which notes/STYLE_GUIDE.md requires to be zh-prefixed.
    for kind, pattern in (("markers", FOOTNOTE_MARK_RE), ("definitions", FOOTNOTE_DEF_RE)):
        expected = set(pattern.findall(source_text))
        actual = set(pattern.findall(body))
        missing = sorted(expected - actual)
        if missing:
            errors.append(f"{label}: source footnote {kind} are missing: {missing}")
        invented = sorted(
            name for name in actual - expected if not name.startswith(TRANSLATOR_NOTE_PREFIX)
        )
        if invented:
            errors.append(
                f"{label}: footnote {kind} not in the source: {invented}"
                f" (translator notes must use the {TRANSLATOR_NOTE_PREFIX}* prefix)"
            )
    return errors


def paragraph_ids(path: Path, unit_id: str, label: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    if not path.is_file():
        return [], errors
    text = path.read_text(encoding="utf-8")
    headings = list(ANY_H2_RE.finditer(text))
    if headings:
        prefix = text[:headings[0].start()]
        front_matter = re.match(r"\A---\r?\n.*?\r?\n---\r?\n", prefix, re.DOTALL)
        if front_matter:
            prefix = prefix[front_matter.end():]
        prefix = re.sub(r"<!--.*?-->", "", prefix, flags=re.DOTALL)
        leading_lines = [
            line for line in prefix.splitlines()
            if line.strip() and not re.fullmatch(r"#(?!#)\s+.+", line.strip())
        ]
        if leading_lines:
            errors.append(f"{label}: translation content appears before the first paragraph anchor")
    ids: list[str] = []
    for index, heading in enumerate(headings):
        paragraph_id = heading.group(1).strip()
        if not PARAGRAPH_HEADING_RE.fullmatch(f"## {paragraph_id}"):
            errors.append(f"{label}: unexpected level-2 heading: {paragraph_id}")
            continue
        ids.append(paragraph_id)
        if not paragraph_id.startswith(f"{unit_id}-p"):
            errors.append(f"{label}: paragraph id belongs to another unit: {paragraph_id}")
        end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
        content = re.sub(r"<!--.*?-->", "", text[heading.end():end], flags=re.DOTALL).strip()
        if not content:
            errors.append(f"{label}: paragraph has no translation content: {paragraph_id}")
    if len(ids) != len(set(ids)):
        errors.append(f"{label}: duplicate paragraph ids")
    valid_ids = [paragraph_id for paragraph_id in ids if paragraph_id.startswith(f"{unit_id}-p")]
    numbers = [int(paragraph_id.rsplit("p", 1)[1]) for paragraph_id in valid_ids]
    if numbers and numbers != list(range(1, max(numbers) + 1)):
        errors.append(f"{label}: paragraph ids must be consecutive from p0001")
    return ids, errors


def parse_issues(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    label = path.as_posix()
    if not path.is_file():
        return [], []
    text = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf-8"), flags=re.DOTALL)
    matches = list(ISSUE_HEADING_RE.finditer(text))
    issues: list[dict[str, str]] = []
    errors: list[str] = []
    seen: set[str] = set()
    for index, match in enumerate(matches):
        issue_id = match.group(1)
        if issue_id in seen:
            errors.append(f"{label}: duplicate issue id {issue_id}")
        seen.add(issue_id)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():end]
        # 一个 ISSUE 到下一个二级标题为止，而不是到文件末尾：issues.md 在最后一条之后
        # 常有“其余各处小修”“未采纳的建议”等散文小节，其中的 `- 某某：…` 行本是正文，
        # 不是该 ISSUE 的字段。ch020、ch021 都因此误报过。
        next_heading = re.search(r"(?m)^## ", block)
        if next_heading:
            block = block[: next_heading.start()]
        fields: dict[str, str] = {"id": issue_id}
        for line in block.splitlines():
            field_match = re.match(r"^- ([^：:]+)[：:]\s*(.*)$", line.strip())
            if field_match:
                field = field_match.group(1).strip()
                if field in fields:
                    errors.append(f"{label}:{issue_id}: duplicate field {field}")
                elif field not in REQUIRED_ISSUE_FIELDS:
                    errors.append(f"{label}:{issue_id}: unexpected field {field}")
                fields[field] = field_match.group(2).strip().strip("`")
        missing = sorted(REQUIRED_ISSUE_FIELDS - fields.keys())
        if missing:
            errors.append(f"{label}:{issue_id}: missing fields {missing}")
        if fields.get("类型") not in ISSUE_TYPES:
            errors.append(f"{label}:{issue_id}: invalid issue type={fields.get('类型')}")
        if fields.get("阻断") not in {"是", "否"}:
            errors.append(f"{label}:{issue_id}: 阻断 must be 是 or 否")
        if fields.get("状态") not in {"open", "resolved"}:
            errors.append(f"{label}:{issue_id}: 状态 must be open or resolved")
        if fields.get("类型") == "术语" and not fields.get("术语条目"):
            errors.append(f"{label}:{issue_id}: terminology issue requires 术语条目")
        for field in ("问题", "候选", "同作者语料证据"):
            if not fields.get(field):
                errors.append(f"{label}:{issue_id}: {field} must be recorded")
        if fields.get("状态") == "resolved":
            if not fields.get("最终决定"):
                errors.append(f"{label}:{issue_id}: resolved issue requires 最终决定")
            if not fields.get("理由"):
                errors.append(f"{label}:{issue_id}: resolved issue requires 理由")
        issues.append(fields)
    return issues, errors


def paragraph_texts(path: Path, unit_id: str) -> dict[str, str]:
    if not path.is_file():
        return {}
    pattern = re.compile(rf"## ({unit_id}-p\d{{4}})\n\n(.+?)(?=\n\n## |\Z)", re.DOTALL)
    return {m.group(1): m.group(2).strip() for m in pattern.finditer(path.read_text(encoding="utf-8"))}


def draft_independence_errors(
    artifact_paths: dict[str, Path],
    unit_id: str,
    root: Path,
) -> list[str]:
    """final.md must be re-formed against the source, not copied from literal.md.

    Headings, the provenance line and footnote definitions are legitimately
    identical, so only substantial prose is compared. Across ch001-ch013 exactly
    one prose block per unit matched; a unit where most of them match means the
    second drafting layer never happened.
    """
    literal = paragraph_texts(artifact_paths["literal"], unit_id)
    final = paragraph_texts(artifact_paths["final"], unit_id)
    if not literal or not final:
        return []
    prose = [
        key for key, text in literal.items()
        if len(text) > PROSE_MIN_CHARS and not text.startswith("[^")
    ]
    if not prose:
        return []
    identical = [key for key in prose if literal[key] == final.get(key)]
    if len(identical) > DRAFT_COPY_MIN_BLOCKS and len(identical) / len(prose) > DRAFT_COPY_RATIO:
        return [
            f"{relative_name(artifact_paths['final'], root)}: {len(identical)} of {len(prose)}"
            " prose paragraphs are identical to literal.md; the final draft must be"
            " re-formed against the source rather than copied"
        ]
    return []


def validate_unit_artifacts(
    project_dir: Path,
    unit: dict[str, Any],
    root: Path,
    glossary_ids: set[str] | None,
) -> list[str]:
    errors: list[str] = []
    unit_id = str(unit.get("id", ""))
    if not ID_RE.fullmatch(unit_id):
        return errors
    count = unit.get("paragraph_count")
    if not isinstance(count, int) or isinstance(count, bool) or count < 1:
        return errors
    status = str(unit.get("_status", "planned"))
    accuracy_passed = unit.get("_accuracy_result") == "passed"
    unit_dir = project_dir / "units" / unit_id
    artifact_paths = {
        "literal": unit_dir / "literal.md",
        "final": unit_dir / "final.md",
        "issues": unit_dir / "issues.md",
    }
    if status == "planned" and not unit_dir.exists():
        return errors
    required = {"literal", "issues"}
    if status in {"accuracy_review", "language_review", "reviewed"}:
        required.add("final")
    for name in required:
        if not artifact_paths[name].is_file():
            errors.append(f"{relative_name(artifact_paths[name], root)}: required for status={status}")

    source_text = unit_source_text(unit, root)
    enforce_parity = status in {"accuracy_review", "language_review", "reviewed"}
    ids_by_artifact: dict[str, list[str]] = {}
    for name in ("literal", "final"):
        path = artifact_paths[name]
        if not path.is_file():
            continue
        label = relative_name(path, root)
        errors.extend(style_errors(
            markdown_body(path.read_text(encoding="utf-8")),
            source_text,
            label,
            enforce_parity,
        ))
        ids, paragraph_errors = paragraph_ids(path, unit_id, label)
        errors.extend(paragraph_errors)
        ids_by_artifact[name] = ids
        if not ids:
            errors.append(f"{label}: no paragraph headings found")
        if len(ids) > count:
            errors.append(f"{label}: paragraph headings exceed paragraph_count={count}")

    # 两稿一旦都在，就查“定稿是不是照抄初译”——不要等到 accuracy_review。
    # 这道检查本是为 ch014 那种失效加的，却一直被挡在状态门后：单元要到审计**之后**
    # 才会被推进到 accuracy_review，而它恰恰应当在审计**之前**告诉审计方这稿不必细读。
    # ch025 的重做稿 39/76 个正文块逐字照抄初译，`--check` 却是绿的，就是因为它还是 planned。
    errors.extend(draft_independence_errors(artifact_paths, unit_id, root))

    if status in {"accuracy_review", "language_review", "reviewed"}:
        expected = [f"{unit_id}-p{number:04d}" for number in range(1, count + 1)]
        for name in ("literal", "final"):
            if ids_by_artifact.get(name) != expected:
                errors.append(
                    f"{relative_name(artifact_paths[name], root)}: must contain all {count} registered paragraphs"
                )
        if ids_by_artifact.get("literal") != ids_by_artifact.get("final"):
            errors.append(f"{relative_name(unit_dir, root)}: literal and final paragraph ids differ")

    issues, issue_errors = parse_issues(artifact_paths["issues"])
    errors.extend(issue_errors)
    valid_paragraphs = {f"{unit_id}-p{number:04d}" for number in range(1, count + 1)}
    for issue in issues:
        issue_label = f"{relative_name(artifact_paths['issues'], root)}:{issue.get('id')}"
        if issue.get("段落") not in valid_paragraphs:
            errors.append(f"{issue_label}: unknown paragraph id={issue.get('段落')}")
        if issue.get("类型") == "术语":
            term_id = issue.get("术语条目", "")
            if glossary_ids is None:
                errors.append(f"{issue_label}: author glossary is missing")
            elif term_id not in glossary_ids:
                errors.append(f"{issue_label}: unknown glossary entry={term_id}")
        if (
            (status in {"language_review", "reviewed"} or accuracy_passed)
            and issue.get("阻断") == "是"
            and issue.get("状态") == "open"
        ):
            errors.append(f"{issue_label}: open blocking issue is not allowed after accuracy review")
    return errors


def validate_project(path: Path, root: Path, people: set[str]) -> list[str]:
    errors: list[str] = []
    label = relative_name(path, root)
    relative_parts = path.relative_to(root / WORKSPACE).parts
    if len(relative_parts) != 4 or relative_parts[-1] != "translation.json":
        return [f"{label}: expected <stage>/<author_id>/<work_id>/translation.json"]
    stage, path_author, path_work, _ = relative_parts
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"{label}: invalid JSON: {error}"]
    if not isinstance(data, dict):
        return [f"{label}: project metadata must be an object"]

    missing = sorted(REQUIRED_PROJECT_FIELDS - data.keys())
    unexpected = sorted(data.keys() - REQUIRED_PROJECT_FIELDS - OPTIONAL_PROJECT_FIELDS)
    work_complete = data.get("work_complete", False)
    if not isinstance(work_complete, bool):
        errors.append(f"{label}: work_complete must be a boolean")
        work_complete = False
    if missing:
        errors.append(f"{label}: missing fields {missing}")
    if unexpected:
        errors.append(f"{label}: unexpected fields {unexpected}")
    if data.get("schema_version") != 3:
        errors.append(f"{label}: schema_version must be 3")

    author_id = data.get("author_id")
    work_id = data.get("work_id")
    if not isinstance(author_id, str) or not ID_RE.fullmatch(author_id):
        errors.append(f"{label}: invalid author_id={author_id}")
        author_id = path_author
    if author_id not in people:
        errors.append(f"{label}: author_id is not registered: {author_id}")
    if author_id != path_author:
        errors.append(f"{label}: author_id must match directory {path_author}")
    if not isinstance(work_id, str) or not WORK_ID_RE.fullmatch(work_id):
        errors.append(f"{label}: invalid work_id={work_id}")
        work_id = path_work
    if work_id != path_work:
        errors.append(f"{label}: work_id must match directory {path_work}")
    if data.get("target_language") != "zh":
        errors.append(f"{label}: target_language must be zh")
    created_at = data.get("created_at")
    updated_at = data.get("updated_at")
    if not valid_iso_date(created_at):
        errors.append(f"{label}: created_at must be a valid YYYY-MM-DD date")
    if not valid_iso_date(updated_at):
        errors.append(f"{label}: updated_at must be a valid YYYY-MM-DD date")
    if valid_iso_date(created_at) and valid_iso_date(updated_at) and updated_at < created_at:
        errors.append(f"{label}: updated_at cannot be earlier than created_at")

    units = data.get("source_units")
    if not isinstance(units, list) or not units:
        errors.append(f"{label}: source_units must be a non-empty list")
        return errors
    valid_units: list[dict[str, Any]] = []
    unit_ids: set[str] = set()
    source_ranges: dict[str, list[tuple[int, int, str]]] = {}
    for index, unit in enumerate(units):
        unit_label = f"{label}:source_units[{index}]"
        unit_errors, valid_unit = validate_source_unit(unit, unit_label, root, author_id, work_id)
        errors.extend(unit_errors)
        if not valid_unit:
            continue
        unit_id = str(valid_unit.get("id", ""))
        if unit_id in unit_ids:
            errors.append(f"{unit_label}: duplicate unit id={unit_id}")
        unit_ids.add(unit_id)
        for segment in valid_unit.get("source_segments", []):
            source_path = str(segment.get("source_path", ""))
            start = segment.get("source_block_start")
            end = segment.get("source_block_end")
            if (
                isinstance(start, int)
                and not isinstance(start, bool)
                and isinstance(end, int)
                and not isinstance(end, bool)
            ):
                for prior_start, prior_end, prior_id in source_ranges.setdefault(source_path, []):
                    if max(start, prior_start) <= min(end, prior_end):
                        errors.append(
                            f"{unit_label}: source block range overlaps unit {prior_id}"
                        )
                source_ranges[source_path].append((start, end, unit_id))
        valid_units.append(valid_unit)

    unit_statuses = [str(unit.get("_status", "planned")) for unit in valid_units]
    if unit_statuses:
        if stage == "planned" and any(status != "planned" for status in unit_statuses):
            errors.append(f"{label}: planned/ requires every unit status=planned")
        if stage == "reviewed":
            if any(status != "reviewed" for status in unit_statuses):
                errors.append(f"{label}: reviewed/ requires every unit status=reviewed")
            if not work_complete:
                errors.append(f"{label}: reviewed/ requires work_complete=true")
        if stage == "drafts":
            if all(status == "planned" for status in unit_statuses):
                errors.append(f"{label}: fully planned project belongs under planned/")
            if work_complete and all(status == "reviewed" for status in unit_statuses):
                errors.append(f"{label}: completed project belongs under reviewed/")
    if valid_iso_date(updated_at):
        for unit in valid_units:
            if any(updated_at < review_date for review_date in unit.get("_review_dates", [])):
                errors.append(f"{label}: updated_at cannot predate recorded unit reviews")
                break

    project_dir = path.parent
    units_dir = project_dir / "units"
    if units_dir.is_dir():
        actual_units = {entry.name for entry in units_dir.iterdir() if entry.is_dir()}
        for extra in sorted(actual_units - unit_ids):
            errors.append(f"{relative_name(units_dir / extra, root)}: unit is not registered in translation.json")
    glossary_ids = glossary_entry_ids(root, author_id)
    for unit in valid_units:
        errors.extend(validate_unit_artifacts(project_dir, unit, root, glossary_ids))

    for unit in valid_units:
        unit_label = f"{label}:{unit.get('id')}"
        for review_kind, review_field in (
            ("accuracy", "accuracy_review"),
            ("language", "language_review"),
        ):
            review = unit.get(review_field)
            if not isinstance(review, dict) or review.get("result") == "pending":
                continue
            current_scope = review_scope_sha256(project_dir, unit, review_kind)
            if current_scope is None:
                errors.append(f"{unit_label}:{review_field}: review scope files are incomplete")
            elif review.get("scope_sha256") != current_scope:
                errors.append(f"{unit_label}:{review_field}: scope_sha256 does not match current artifacts")
    return errors


def validate_repository(root: Path = ROOT) -> tuple[int, list[str]]:
    errors: list[str] = []
    schema_path = root / "metadata/schemas/translation_project.schema.json"
    if not schema_path.is_file():
        errors.append("metadata/schemas/translation_project.schema.json: missing schema")
    try:
        people = registered_people(root)
    except (OSError, KeyError, json.JSONDecodeError) as error:
        return 0, [f"metadata/collections.json: cannot load registered people: {error}"]
    files = translation_files(root)
    known_files = set(files)
    for stage in STAGES:
        stage_root = root / WORKSPACE / stage
        if not stage_root.is_dir():
            continue
        for author_dir in sorted(path for path in stage_root.iterdir() if path.is_dir()):
            for project_dir in sorted(path for path in author_dir.iterdir() if path.is_dir()):
                metadata_path = project_dir / "translation.json"
                if metadata_path not in known_files:
                    errors.append(f"{relative_name(metadata_path, root)}: missing project metadata")
    for path in files:
        errors.extend(validate_project(path, root, people))
    return len(files), errors


def print_status(root: Path = ROOT) -> int:
    files = translation_files(root)
    if not files:
        print("no translation projects registered")
        return 0
    totals: dict[str, int] = {}
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"{relative_name(path, root)}: cannot read ({error})")
            continue
        rel = path.parent.relative_to(root / WORKSPACE).as_posix()
        units = data.get("source_units", []) if isinstance(data.get("source_units"), list) else []
        print(f"{rel}  ({len(units)} units)")
        counts: dict[str, int] = {}
        blocks_total = 0
        for unit in units:
            if not isinstance(unit, dict):
                continue
            status = str(unit.get("status", "?"))
            counts[status] = counts.get(status, 0) + 1
            totals[status] = totals.get(status, 0) + 1
            accuracy = (unit.get("accuracy_review") or {}).get("result", "?")
            language = (unit.get("language_review") or {}).get("result", "?")
            blocks = unit.get("paragraph_count")
            if isinstance(blocks, int) and not isinstance(blocks, bool):
                blocks_total += blocks
            print(
                f"    {str(unit.get('id', '')):<8} {status:<16} "
                f"{str(blocks) + ' 块':>7}  accuracy={accuracy:<10} language={language}"
            )
        summary = "  ".join(f"{name}={count}" for name, count in sorted(counts.items()))
        print(f"    -- {summary}  blocks={blocks_total}")
    print(f"total: {'  '.join(f'{name}={count}' for name, count in sorted(totals.items()))}")
    return 0


def resolve_repository_path(value: str) -> Path:
    path = Path(value)
    resolved = path.resolve() if path.is_absolute() else (ROOT / path).resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError as error:
        raise ValueError("path must stay inside the repository") from error
    return resolved


def print_source_inspection(value: str) -> int:
    path = resolve_repository_path(value)
    if not path.is_file():
        raise ValueError(f"source file does not exist: {value}")
    relative = path.relative_to(ROOT)
    if not visible_corpus_markdown(relative):
        raise ValueError("source inspection accepts only visible corpus Markdown")
    text = path.read_text(encoding="utf-8")
    metadata = parse_front_matter(text)
    if (
        metadata.get("text_role") != "author_original"
        or metadata.get("core_corpus_eligible") != "true"
        or metadata.get("llm_wiki_eligible") != "true"
        or metadata.get("gbrain_source") != "project-markdown"
    ):
        raise ValueError("source inspection accepts only GBrain-visible author-original corpus Markdown")
    blocks = markdown_source_blocks(text)
    print(f"source_path={relative_name(path, ROOT)}")
    print(f"source_sha256={sha256(path)}")
    print(f"source_blocks={len(blocks)}")
    totals: dict[str, int] = {key: 0 for key in SOURCE_FEATURE_PATTERNS}
    totals["multiline"] = 0
    flagged: list[str] = []
    for index, block in enumerate(blocks, start=1):
        counts = {
            key: len(pattern.findall(block)) for key, pattern in SOURCE_FEATURE_PATTERNS.items()
        }
        if "\n" in block:
            counts["multiline"] = 1
        for key, value in counts.items():
            totals[key] = totals.get(key, 0) + value
        marks = " ".join(f"{key}={value}" for key, value in counts.items() if value)
        if marks:
            flagged.append(f"{index:04d}\t{marks}")
        first_line = re.sub(r"\s+", " ", block.splitlines()[0]).strip()
        preview = first_line[:100] + ("…" if len(first_line) > 100 else "")
        print(f"{index:04d}\t{preview}")
    # Prompt-writing facts must come from here, not from hand-rolled extraction:
    # counting by line reported ch019 as 53 blocks (it has 52, one holds a hard
    # line break) and ch016 as 8 italic spans (it has 9). See STYLE_GUIDE 七/26, 28.
    print("features\t" + " ".join(f"{key}={value}" for key, value in totals.items()))
    for line in flagged:
        print(f"feature\t{line}")
    return 0


def print_review_hashes(value: str) -> int:
    project_dir = resolve_repository_path(value)
    metadata_path = project_dir / "translation.json"
    if not metadata_path.is_file():
        raise ValueError(f"translation.json does not exist under: {value}")
    data = json.loads(metadata_path.read_text(encoding="utf-8"))
    units = data.get("source_units")
    if not isinstance(units, list) or not units:
        raise ValueError("translation.json has no source_units")
    complete = 0
    for unit in units:
        if not isinstance(unit, dict):
            continue
        unit_id = str(unit.get("id", ""))
        accuracy = review_scope_sha256(project_dir, unit, "accuracy")
        language = review_scope_sha256(project_dir, unit, "language")
        if accuracy is None or language is None:
            print(f"{unit_id}: incomplete; literal.md, final.md, and issues.md are required")
            continue
        print(f"{unit_id} accuracy_scope_sha256={accuracy}")
        print(f"{unit_id} language_scope_sha256={language}")
        complete += 1
    if not complete:
        raise ValueError("no unit has a complete review scope")
    return 0


PENDING_REVIEW = {"reviewer": None, "reviewed_at": None, "result": "pending", "scope_sha256": None}


def load_project(project_dir: Path) -> tuple[Path, Path, dict[str, Any]]:
    metadata_path = project_dir / "translation.json"
    if not metadata_path.is_file():
        raise ValueError(f"translation.json does not exist under: {project_dir}")
    return project_dir, metadata_path, json.loads(metadata_path.read_text(encoding="utf-8"))


def find_unit(data: dict[str, Any], unit_id: str) -> dict[str, Any]:
    for unit in data.get("source_units", []):
        if isinstance(unit, dict) and str(unit.get("id")) == unit_id:
            return unit
    raise ValueError(f"no unit {unit_id} in this project")


def write_project(metadata_path: Path, data: dict[str, Any]) -> None:
    metadata_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def revise_unit(project: Path, unit_id: str) -> int:
    """Reopen one unit for revision: both reviews back to pending, status back a stage.

    Hand-editing translation.json for this is where the mistakes happen — the field names
    must be exact (`reviewed_at`/`scope_sha256`, not `date`/`hash`), and `updated_at` has to
    move too. On 2026-07-30 three revisions went through by hand and two of them tripped the
    validator on precisely those points. The validator caught them, but it was catching
    mistakes that should not have been possible to make.
    """
    project_dir, metadata_path, data = load_project(project)
    unit = find_unit(data, unit_id)
    unit["status"] = "accuracy_review"
    for kind in ("accuracy_review", "language_review"):
        unit[kind] = dict(PENDING_REVIEW)
    write_project(metadata_path, data)
    print(f"{unit_id}: reopened for revision (status=accuracy_review, both reviews pending)")
    print(f"  1. 改 {project_dir.name}/units/{unit_id}/final.md")
    print(f"  2. 在 units/{unit_id}/issues.md 补一节 `## 补记（日期　缘由）`——"
          "单元自己的记录，与全书的 REVIEW_LOG 各记各的")
    print("  3. 请所有者审阅；认可后跑 --sign 归档")
    print("  提醒：本项目在 reviewed/ 下，此刻 --check 会报「requires every unit "
          "status=reviewed」——那是过渡态，签字填回即通，不要为此搬动目录")
    return 0


def sign_unit(project: Path, unit_id: str, reviewer: str, today: str) -> int:
    """Record both reviews as passed, binding them to the current artifacts."""
    project_dir, metadata_path, data = load_project(project)
    unit = find_unit(data, unit_id)
    accuracy = review_scope_sha256(project_dir, unit, "accuracy")
    language = review_scope_sha256(project_dir, unit, "language")
    if accuracy is None or language is None:
        raise ValueError(f"{unit_id}: incomplete review scope; literal.md, final.md and issues.md are required")
    for kind, digest in (("accuracy_review", accuracy), ("language_review", language)):
        unit[kind] = {"reviewer": reviewer, "reviewed_at": today,
                      "result": "passed", "scope_sha256": digest}
    unit["status"] = "reviewed"
    # updated_at must not predate the reviews it records; forgetting this is the other
    # mistake the hand-edited path kept producing.
    if str(data.get("updated_at", "")) < today:
        data["updated_at"] = today
    write_project(metadata_path, data)
    print(f"{unit_id}: signed (accuracy+language passed, {today}, reviewer={reviewer})")
    print(f"  accuracy_scope_sha256={accuracy}")
    print(f"  language_scope_sha256={language}")
    print("  **此为代填：签字的效力来自所有者的审阅，不来自填写动作本身。**")
    print("  下一步：build_merged_translation.py 重生成合并本；全批改完再 build_book.py")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Exit non-zero on validation errors")
    parser.add_argument("--inspect-source", metavar="PATH", help="Show deterministic source block numbers")
    parser.add_argument("--review-hashes", metavar="PROJECT", help="Print hashes for completed review scopes")
    parser.add_argument("--status", action="store_true", help="Print per-unit progress for every project")
    parser.add_argument("--revise", nargs=2, metavar=("PROJECT", "UNIT"),
                        help="Reopen one unit for revision (both reviews back to pending)")
    parser.add_argument("--sign", nargs=2, metavar=("PROJECT", "UNIT"),
                        help="Record both reviews as passed, bound to the current artifacts")
    parser.add_argument("--reviewer", default="hoshF", help="Reviewer recorded by --sign")
    args = parser.parse_args()

    try:
        if args.status:
            return print_status()
        if args.inspect_source:
            return print_source_inspection(args.inspect_source)
        if args.review_hashes:
            return print_review_hashes(args.review_hashes)
        if args.revise:
            project, unit_id = args.revise
            return revise_unit(resolve_repository_path(project), unit_id)
        if args.sign:
            project, unit_id = args.sign
            return sign_unit(resolve_repository_path(project), unit_id,
                             reviewer=args.reviewer, today=datetime.date.today().isoformat())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    project_count, errors = validate_repository()
    print(f"translation_projects={project_count} errors={len(errors)}")
    for error in errors:
        print(error)
    return 1 if errors and args.check else 0


if __name__ == "__main__":
    raise SystemExit(main())
