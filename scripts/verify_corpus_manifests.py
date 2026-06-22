#!/usr/bin/env python3
"""Verify source-scan and legacy OCR manifests against repository files."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from export_public import source_scan_approvals
from prepare_gbrain_markdown import parse_front_matter
from rights_registry import rights_entries


ROOT = Path(__file__).resolve().parents[1]
OCR_MANIFEST = ROOT / "caute_ru_markdown/metadata/ilyenkov_newspaper_human_verification_manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_legacy_ocr() -> int:
    data = json.loads(OCR_MANIFEST.read_text(encoding="utf-8"))
    items = data.get("items", [])
    if len(items) != 13:
        raise ValueError(f"expected 13 legacy OCR entries, found {len(items)}")
    for item in items:
        markdown = ROOT / item["markdown_path"]
        image = ROOT / item["image_path"]
        if not markdown.is_file() or not image.is_file():
            raise ValueError(f"missing OCR pair for {item['id']}")
        if sha256(markdown) != item["markdown_sha256"]:
            raise ValueError(f"Markdown SHA-256 mismatch for {item['id']}")
        if sha256(image) != item["image_sha256"]:
            raise ValueError(f"image SHA-256 mismatch for {item['id']}")
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
                raise ValueError(f"{item['id']}: expected {key}={value}")
        if item.get("verification_status") != "human_verified":
            raise ValueError(f"{item['id']}: missing human verification status")
        if item.get("provenance") != "ocr_initial_then_manual_collation_against_source_images":
            raise ValueError(f"{item['id']}: missing OCR provenance")
    return len(items)


def main() -> int:
    ocr_count = verify_legacy_ocr()
    scan_count = len(source_scan_approvals(ROOT))
    rights_count = len(rights_entries(ROOT))
    print(
        f"legacy_ocr_verified={ocr_count} source_scans_verified={scan_count} "
        f"rights_entries_verified={rights_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
