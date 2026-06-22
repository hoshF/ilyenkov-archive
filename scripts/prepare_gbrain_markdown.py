#!/usr/bin/env python3
"""Prepare and validate Markdown metadata used by GBrain and public export."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collection_registry import collection_for_path, corpus_paths


ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {
    ".git", ".obsidian", ".codex", ".fulltext", "node_modules", "dist",
    "cache", "digitization", "source_scans", "source_pdfs",
}
METADATA_DATE = "2026-06-11"

TRANSLATION_PREFIXES = ("translation_workspace/drafts/", "translation_workspace/reviewed/")
CORPUS_FIELDS = (
    "text_role",
    "core_corpus_eligible",
    "llm_wiki_eligible",
    "source_format",
    "source_license",
    "redistribution_approved",
    "rights_review_status",
    "text_status",
    "source_url",
)
TEXT_ROLES = {
    "author_original",
    "historical_translation",
    "text_witness",
    "modern_translation",
    "research",
    "ai_reference",
    "source_scan_unprocessed",
    "ocr_unverified",
}
SOURCE_FORMATS = {
    "html",
    "native_epub",
    "pdf",
    "djvu",
    "web_api",
    "tei_xml",
    "image_scan",
    "markdown",
    "ai_generated",
    "not_stated",
}
BOOLEAN_FIELDS = {"core_corpus_eligible", "llm_wiki_eligible", "redistribution_approved"}
NON_CORE_ROLES = TEXT_ROLES - {"author_original"}
LEGACY_OCR_DIR = "caute_ru_markdown/ilyenkov_md/newspaper/"
LEGACY_OCR_MANIFEST = "caute_ru_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json"
HUMAN_COLLATED_OCR_STATUS = "ocr_draft_human_collated"
HUMAN_COLLATED_OCR_PROVENANCE = "ocr_initial_then_manual_collation_against_source_images"
CHAPTER_FIELDS = ("work_id", "chapter_index", "chapter_title")
MAX_CHAPTER_BYTES = 500_000
TEXT_STATUSES = {
    "ai_generated_unverified",
    "complete_historical_dutch_translation_unverified",
    "complete_or_unverified",
    "complete_surviving_dutch_text_unverified",
    "html_conversion_unverified",
    "ocr_draft_human_collated",
    "ocr_human_verified_legacy",
    "partial_or_unverified",
    "partial_web_transcription",
    "source_scan_unprocessed",
    "translation_draft",
    "web_transcription_edition_identified_unverified",
    "web_transcription_unverified",
}


def markdown_files(root: Path = ROOT) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*.md")
        if not SKIP_PARTS.intersection(path.relative_to(root).parts)
    )


def relative_name(path: Path, root: Path = ROOT) -> str:
    return path.relative_to(root).as_posix()


def is_root_readme(path: Path, root: Path = ROOT) -> bool:
    return relative_name(path, root) == "README.md"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def human_collated_ocr_entry(path: Path, root: Path = ROOT) -> dict[str, object] | None:
    manifest_path = root / LEGACY_OCR_MANIFEST
    if not manifest_path.is_file():
        return None
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    rel = relative_name(path, root)
    return next((item for item in data.get("items", []) if item.get("markdown_path") == rel), None)


def is_corpus_markdown(path: Path, root: Path = ROOT) -> bool:
    rel = relative_name(path, root)
    prefixes = corpus_paths(root) + TRANSLATION_PREFIXES
    return rel.startswith(prefixes) and path.name.lower() != "readme.md"


def has_front_matter(text: str) -> bool:
    return text.startswith("---\n") or text.startswith("---\r\n")


def front_matter_bounds(text: str) -> tuple[int, int] | None:
    if not has_front_matter(text):
        return None
    match = re.search(r"\A---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return None
    return match.start(1), match.end(1)


def parse_front_matter(text: str) -> dict[str, str]:
    bounds = front_matter_bounds(text)
    if not bounds:
        return {}
    block = text[bounds[0] : bounds[1]]
    result: dict[str, str] = {}
    for line in block.splitlines():
        match = re.match(r"^([A-Za-z0-9_]+):\s*(.*?)\s*$", line)
        if not match:
            continue
        value = match.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        result[match.group(1)] = value
    return result


def clean_title(value: str) -> str:
    value = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", value)
    return value.replace("`", "").replace("*", "").strip()


def title_for(path: Path, text: str) -> str:
    match = re.search(r"(?m)^#\s+(.+?)\s*$", text)
    if match:
        return clean_title(match.group(1))
    return path.stem.replace("_", " ").replace("-", " ").strip().title()


def contains_cjk(text: str) -> bool:
    return len(re.findall(r"[\u3400-\u9fff]", text[:4000])) >= 8


def base_metadata_for(path: Path, text: str, root: Path = ROOT) -> dict[str, object]:
    rel = relative_name(path, root)
    parts = path.relative_to(root).parts
    registered = collection_for_path(root, rel)
    if registered and registered.get("default_text_role") == "author_original":
        page_type, tags, language, collection = (
            "source",
            [registered["person_id"], "source-text"],
            registered.get("default_language", "not_stated"),
            registered.get("collection_name", registered["id"]),
        )
    elif registered and registered.get("default_text_role") == "research":
        page_type, tags, language, collection = (
            "analysis",
            [registered["person_id"], "research", "secondary-source"],
            registered.get("default_language", "not_stated"),
            registered.get("collection_name", registered["id"]),
        )
    elif rel.startswith(("caute_ru_markdown/metadata/", "spinoza_markdown/metadata/")):
        page_type, tags, language, collection = (
            "analysis", ["source-metadata", "audit"], "zh" if contains_cjk(text) else "en", "corpus-metadata"
        )
    elif rel.startswith("notes/"):
        page_type, tags, language, collection = (
            "note", ["research-note"], "zh" if contains_cjk(text) else "en", "research-notes"
        )
    elif rel.startswith("translation_workspace/"):
        page_type = "writing" if "drafts" in parts or "reviewed" in parts else "project"
        tags, language, collection = ["translation", "workspace"], "zh" if contains_cjk(text) else "en", "translation-workspace"
    else:
        page_type, tags, language, collection = (
            "project", ["project", "documentation"], "zh" if contains_cjk(text) else "en", "project-documentation"
        )
    return {
        "title": title_for(path, text),
        "created": METADATA_DATE,
        "type": page_type,
        "tags": tags,
        "language": language,
        "collection": collection,
        "llm_wiki_eligible": "true",
        "gbrain_source": "project-markdown",
    }


def first_source_url(text: str) -> str:
    body = text
    bounds = front_matter_bounds(text)
    if bounds:
        body = text[bounds[1] :]
    match = re.search(r"https?://[^\s>)]+", body)
    return match.group(0).rstrip(".,;]") if match else "not_stated"


def corpus_defaults(path: Path, text: str, current: dict[str, str], root: Path = ROOT) -> dict[str, str]:
    rel = relative_name(path, root)
    source_url = current.get("source_url") or first_source_url(text)
    status = current.get("text_status") or "html_conversion_unverified"
    role = current.get("text_role", "")

    if role == "ai_reference":
        return {
            "text_role": "ai_reference",
            "core_corpus_eligible": "false",
            "llm_wiki_eligible": current.get("llm_wiki_eligible") or "false",
            "source_format": "ai_generated",
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": current.get("text_status") or "ai_generated_unverified",
            "source_url": current.get("source_url") or "not_stated",
        }

    if rel.startswith(LEGACY_OCR_DIR):
        return {
            "text_role": "author_original",
            "core_corpus_eligible": "true",
            "llm_wiki_eligible": "true",
            "source_format": "image_scan",
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": HUMAN_COLLATED_OCR_STATUS,
            "source_url": source_url,
            "provenance": HUMAN_COLLATED_OCR_PROVENANCE,
        }
    if rel.startswith("caute_ru_markdown/ilyenkov_md/"):
        translated = "/perevody/" in f"/{rel}"
        return {
            "text_role": "modern_translation" if translated else "author_original",
            "core_corpus_eligible": "false" if translated else "true",
            "llm_wiki_eligible": current.get("llm_wiki_eligible") or "true",
            "source_format": "html",
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": status,
            "source_url": source_url,
        }
    if rel.startswith("caute_ru_markdown/maidansky_md/"):
        return {
            "text_role": "research",
            "core_corpus_eligible": "false",
            "llm_wiki_eligible": current.get("llm_wiki_eligible") or "true",
            "source_format": "html",
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": status,
            "source_url": source_url,
        }
    if rel.startswith("spinoza_markdown/spinoza_md/"):
        role_map = {
            "authorial_language_text": "author_original",
            "historical_translation_collection": "historical_translation",
            "surviving_textual_witness": "text_witness",
            "individual_correspondence_language_status_unverified": "text_witness",
            "mixed_correspondence_language_status_unverified": "text_witness",
        }
        mapped_role = role_map.get(role, role if role in TEXT_ROLES else "text_witness")
        source_format = "tei_xml" if "/dutch/" in f"/{rel}" else "web_api"
        return {
            "text_role": mapped_role,
            "core_corpus_eligible": "true" if mapped_role == "author_original" else "false",
            "llm_wiki_eligible": current.get("llm_wiki_eligible") or "true",
            "source_format": current.get("source_format") if current.get("source_format") in SOURCE_FORMATS else source_format,
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": status,
            "source_url": source_url,
        }
    if rel.startswith("kedrov_markdown/kedrov_md/"):
        return {
            "text_role": "author_original",
            "core_corpus_eligible": "true",
            "llm_wiki_eligible": current.get("llm_wiki_eligible") or "true",
            "source_format": "html",
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": status,
            "source_url": source_url,
        }
    registered = collection_for_path(root, rel)
    if registered:
        mapped_role = current.get("text_role") or registered.get("default_text_role", "author_original")
        return {
            "text_role": mapped_role,
            "core_corpus_eligible": "true" if mapped_role == "author_original" else "false",
            "llm_wiki_eligible": current.get("llm_wiki_eligible") or "true",
            "source_format": current.get("source_format") or "not_stated",
            "source_license": current.get("source_license") or "not_stated",
            "redistribution_approved": current.get("redistribution_approved") or "false",
            "rights_review_status": current.get("rights_review_status") or "unreviewed",
            "text_status": status,
            "source_url": source_url,
        }
    return {
        "text_role": "modern_translation",
        "core_corpus_eligible": "false",
        "llm_wiki_eligible": current.get("llm_wiki_eligible") or "true",
        "source_format": current.get("source_format") or "markdown",
        "source_license": current.get("source_license") or "not_stated",
        "redistribution_approved": current.get("redistribution_approved") or "false",
        "rights_review_status": current.get("rights_review_status") or "unreviewed",
        "text_status": current.get("text_status") or "translation_draft",
        "source_url": source_url,
    }


def quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_front_matter(metadata: dict[str, object]) -> str:
    lines = ["---"]
    for key, value in metadata.items():
        if isinstance(value, list):
            rendered = "[" + ", ".join(quote(str(item)) for item in value) + "]"
        else:
            rendered = quote(str(value))
        lines.append(f"{key}: {rendered}")
    lines.extend(["---", ""])
    return "\n".join(lines)


def update_front_matter(text: str, fields: dict[str, str]) -> str:
    bounds = front_matter_bounds(text)
    if not bounds:
        raise ValueError("front matter is missing")
    block = text[bounds[0] : bounds[1]]
    lines = block.splitlines()
    positions: dict[str, int] = {}
    for index, line in enumerate(lines):
        match = re.match(r"^([A-Za-z0-9_]+):", line)
        if match:
            positions[match.group(1)] = index
    for key, value in fields.items():
        rendered = f"{key}: {quote(value)}"
        if key in positions:
            lines[positions[key]] = rendered
        else:
            positions[key] = len(lines)
            lines.append(rendered)
    return text[: bounds[0]] + "\n".join(lines) + text[bounds[1] :]


def validate_file(path: Path, text: str, root: Path = ROOT) -> list[str]:
    rel = relative_name(path, root)
    errors: list[str] = []
    if is_root_readme(path, root):
        return errors
    if not has_front_matter(text) or not front_matter_bounds(text):
        return [f"{rel}: missing or malformed front matter"]
    metadata = parse_front_matter(text)
    if not metadata.get("created"):
        errors.append(f"{rel}: missing created")
    if not is_corpus_markdown(path, root) and "text_role" not in metadata:
        return errors
    for field in CORPUS_FIELDS:
        if not metadata.get(field):
            errors.append(f"{rel}: missing {field}")
    role = metadata.get("text_role")
    if role and role not in TEXT_ROLES:
        errors.append(f"{rel}: invalid text_role={role}")
    source_format = metadata.get("source_format")
    if source_format and source_format not in SOURCE_FORMATS:
        errors.append(f"{rel}: invalid source_format={source_format}")
    for field in BOOLEAN_FIELDS:
        value = metadata.get(field)
        if value and value not in {"true", "false"}:
            errors.append(f"{rel}: invalid {field}={value}")
    rights = metadata.get("rights_review_status")
    if rights and rights not in {"reviewed", "unreviewed"}:
        errors.append(f"{rel}: invalid rights_review_status={rights}")
    text_status = metadata.get("text_status")
    if text_status and text_status not in TEXT_STATUSES:
        errors.append(f"{rel}: invalid text_status={text_status}")
    chapter_values = [metadata.get(field) for field in CHAPTER_FIELDS]
    if any(chapter_values):
        for field, value in zip(CHAPTER_FIELDS, chapter_values):
            if not value:
                errors.append(f"{rel}: chapter file missing {field}")
        chapter_index = metadata.get("chapter_index", "")
        if not re.fullmatch(r"\d{3}", chapter_index):
            errors.append(f"{rel}: chapter_index must be three digits")
        elif not path.name.endswith(f"-ch{chapter_index}.md"):
            errors.append(f"{rel}: chapter filename does not match chapter_index")
        if len(text.encode("utf-8")) >= MAX_CHAPTER_BYTES:
            errors.append(f"{rel}: chapter file must be smaller than {MAX_CHAPTER_BYTES} bytes")
    if metadata.get("core_corpus_eligible") == "true" and role != "author_original":
        errors.append(f"{rel}: core corpus requires text_role=author_original")
    if role in NON_CORE_ROLES and metadata.get("core_corpus_eligible") == "true":
        errors.append(f"{rel}: {role} cannot enter the core corpus")
    if metadata.get("core_corpus_eligible") == "true" and metadata.get("source_format") == "image_scan":
        entry = human_collated_ocr_entry(path, root)
        if metadata.get("text_status") != HUMAN_COLLATED_OCR_STATUS:
            errors.append(f"{rel}: core image scan requires text_status={HUMAN_COLLATED_OCR_STATUS}")
        if metadata.get("provenance") != HUMAN_COLLATED_OCR_PROVENANCE:
            errors.append(f"{rel}: core image scan requires approved OCR provenance")
        if not entry:
            errors.append(f"{rel}: core image scan is missing from the human verification manifest")
        elif entry.get("markdown_sha256") != sha256(path):
            errors.append(f"{rel}: human verification manifest SHA-256 mismatch")
    return errors


def prepare_file(path: Path, text: str, root: Path = ROOT) -> str:
    if is_root_readme(path, root):
        return text
    if not has_front_matter(text):
        text = render_front_matter(base_metadata_for(path, text, root)) + text
    metadata = parse_front_matter(text)
    base_updates: dict[str, str] = {}
    if not metadata.get("created"):
        base_updates["created"] = METADATA_DATE
    if is_corpus_markdown(path, root) or metadata.get("text_role"):
        base_updates.update(corpus_defaults(path, text, metadata, root))
    return update_front_matter(text, base_updates) if base_updates else text


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Add or migrate metadata")
    parser.add_argument("--check", action="store_true", help="Exit non-zero on validation errors")
    args = parser.parse_args()

    files = markdown_files()
    changed: list[Path] = []
    if args.write:
        for path in files:
            text = path.read_text(encoding="utf-8")
            prepared = prepare_file(path, text)
            if prepared != text:
                path.write_text(prepared, encoding="utf-8")
                changed.append(path)

    errors: list[str] = []
    for path in files:
        errors.extend(validate_file(path, path.read_text(encoding="utf-8")))

    print(f"changed={len(changed)} markdown_total={len(files)} errors={len(errors)}")
    for error in errors[:100]:
        print(error)
    if len(errors) > 100:
        print(f"... and {len(errors) - 100} more")
    return 1 if args.check and errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
