#!/usr/bin/env python3
"""Verify source-scan and human-verified OCR manifests against repository files.

This is a *reporting* entry point, so it must survey everything before it returns: raising
on the first bad item would let one failure hide every later one. That is not hypothetical —
split_longform_markdown.py had exactly this shape, and after one work was deliberately
corrected its check aborted at work 6 of 15, leaving nine works unverified while the output
looked like a single failure.

The two gate functions it borrows, ``source_scan_approvals`` and ``rights_entries``, keep
their fail-fast behaviour on purpose: ``export_public.py`` uses them to decide what may be
published, and there the first problem must stop everything. Only the survey aggregates.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from export_public import source_scan_approvals
from prepare_gbrain_markdown import parse_front_matter
from rights_registry import rights_entries


ROOT = Path(__file__).resolve().parents[1]
HISTORICAL_OCR_MANIFEST = ROOT / "ilyenkov_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_historical_ocr_batch(errors: list[str]) -> int:
    data = json.loads(HISTORICAL_OCR_MANIFEST.read_text(encoding="utf-8"))
    items = data.get("items", [])
    if len(items) != 13:
        errors.append(f"expected 13 historical newspaper OCR entries, found {len(items)}")
    checked = 0
    for item in items:
        item_errors: list[str] = []
        try:
            check_historical_ocr_item(item, item_errors)
        except (KeyError, OSError) as error:
            item_errors.append(f"{item.get('id', '?')}: {type(error).__name__}: {error}")
        errors.extend(item_errors)
        if not item_errors:
            checked += 1
    return checked


def check_historical_ocr_item(item: dict, errors: list[str]) -> None:
    markdown = ROOT / item["markdown_path"]
    image = ROOT / item["image_path"]
    if not markdown.is_file() or not image.is_file():
        errors.append(f"missing OCR pair for {item['id']}")
        return
    if sha256(markdown) != item["markdown_sha256"]:
        errors.append(f"Markdown SHA-256 mismatch for {item['id']}")
    if sha256(image) != item["image_sha256"]:
        errors.append(f"image SHA-256 mismatch for {item['id']}")
    metadata = parse_front_matter(markdown.read_text(encoding="utf-8"))
    expected = {
        "text_role": "author_original",
        "text_status": "ocr_draft_human_collated",
        "core_corpus_eligible": "true",
        "llm_wiki_eligible": "true",
        "provenance": "ocr_initial_then_manual_collation_against_source_images",
    }
    for key, value in expected.items():
        if metadata.get(key) != value:
            errors.append(f"{item['id']}: expected {key}={value}")
    if item.get("verification_status") != "human_verified":
        errors.append(f"{item['id']}: missing human verification status")
    if item.get("provenance") != "ocr_initial_then_manual_collation_against_source_images":
        errors.append(f"{item['id']}: missing OCR provenance")


def verify_digitization_ocr(errors: list[str]) -> int:
    count = 0
    for manifest_path in sorted(ROOT.glob("*_markdown/digitization/*/human_verification_manifest.json")):
        before = len(errors)
        try:
            check_digitization_project(manifest_path, errors)
        except (KeyError, OSError, json.JSONDecodeError) as error:
            label = manifest_path.relative_to(ROOT).as_posix()
            errors.append(f"{label}: {type(error).__name__}: {error}")
        if len(errors) == before:
            count += 1
    return count


def check_digitization_project(manifest_path: Path, errors: list[str]) -> None:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    label = manifest_path.relative_to(ROOT).as_posix()
    project_path = manifest_path.parent / "project.json"
    if not project_path.is_file():
        errors.append(f"{label}: missing digitization project record")
        return
    project = json.loads(project_path.read_text(encoding="utf-8"))
    if project.get("status") != "human_verified" or project.get("ocr_activated") is not True:
        errors.append(f"{label}: digitization project must be activated and human_verified")
    if data.get("verification_status") != "human_verified":
        errors.append(f"{label}: missing human verification status")
    final = ROOT / str(data.get("final_markdown", ""))
    if not final.is_file():
        errors.append(f"{label}: final Markdown is missing")
        return
    if sha256(final) != data.get("final_markdown_sha256"):
        errors.append(f"{label}: final Markdown SHA-256 mismatch")
    metadata = parse_front_matter(final.read_text(encoding="utf-8"))
    if metadata.get("text_status") != "ocr_human_verified":
        errors.append(f"{label}: final Markdown must use text_status=ocr_human_verified")
    if metadata.get("provenance") != "ocr_initial_then_manual_collation_against_source_images":
        errors.append(f"{label}: final Markdown is missing OCR provenance")


def main(printer=print) -> int:
    # Each survey is isolated: one failing area must not hide the state of the others.
    # source_scan_approvals and rights_entries stay fail-fast internally because
    # export_public.py gates publication on them; here we only stop them from aborting
    # the survey as a whole.
    errors: list[str] = []
    ocr_count = verify_historical_ocr_batch(errors) + verify_digitization_ocr(errors)
    scan_count = rights_count = 0
    try:
        scan_count = len(source_scan_approvals(ROOT))
    except (ValueError, OSError) as error:
        errors.append(f"source scans: {error}")
    try:
        rights_count = len(rights_entries(ROOT))
    except (ValueError, OSError) as error:
        errors.append(f"rights registry: {error}")
    for message in errors:
        printer(message)
    printer(
        f"human_verified_ocr={ocr_count} source_scans_verified={scan_count} "
        f"rights_entries_verified={rights_count} errors={len(errors)}"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
