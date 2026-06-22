#!/usr/bin/env python3
"""Load and validate the exact-file rights review registry."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = Path("metadata/licensing_policy.json")
REGISTRY_PATH = Path("metadata/rights_registry.json")
APPROVABLE_BASES = {"public_domain", "open_license", "permission", "project_owned"}
RIGHTS_BASES = APPROVABLE_BASES | {"restricted", "unknown"}
CONTENT_CATEGORIES = {
    "source_text",
    "translation",
    "scan",
    "media",
    "content_bearing_metadata",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_licensing_policy(root: Path = ROOT) -> dict:
    path = root / POLICY_PATH
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        raise ValueError(f"{path}: unsupported schema_version")
    controlled = set(data.get("controlled_categories", []))
    if controlled != CONTENT_CATEGORIES:
        raise ValueError(f"{path}: controlled_categories do not match policy")
    return data


def content_bearing_metadata_paths(root: Path = ROOT) -> set[str]:
    policy = load_licensing_policy(root)
    return set(policy.get("content_bearing_metadata_paths", []))


def load_rights_registry(root: Path = ROOT) -> dict:
    path = root / REGISTRY_PATH
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        raise ValueError(f"{path}: unsupported schema_version")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(data.get("generated_at", ""))):
        raise ValueError(f"{path}: invalid generated_at")
    return data


def rights_entries(root: Path = ROOT) -> dict[str, dict]:
    data = load_rights_registry(root)
    by_path: dict[str, dict] = {}
    ids: set[str] = set()
    required = {
        "id",
        "path",
        "sha256",
        "content_category",
        "rights_basis",
        "license_expression",
        "source_rights_statement",
        "evidence_urls",
        "attribution",
        "reviewed_by",
        "reviewed_date",
        "redistribution_approved",
    }
    for item in data.get("items", []):
        missing = sorted(required - item.keys())
        if missing:
            raise ValueError(f"{REGISTRY_PATH}: rights entry missing {missing}")
        review_id = str(item["id"])
        rel = str(item["path"])
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", review_id):
            raise ValueError(f"{REGISTRY_PATH}: invalid rights id: {review_id}")
        if review_id in ids:
            raise ValueError(f"{REGISTRY_PATH}: duplicate rights id: {review_id}")
        ids.add(review_id)
        candidate = Path(rel)
        if candidate.is_absolute() or ".." in candidate.parts or candidate.as_posix() != rel:
            raise ValueError(f"{REGISTRY_PATH}: unsafe path: {rel}")
        if rel in by_path:
            raise ValueError(f"{REGISTRY_PATH}: duplicate path: {rel}")
        if item["content_category"] not in CONTENT_CATEGORIES:
            raise ValueError(f"{REGISTRY_PATH}: invalid content_category for {rel}")
        if item["rights_basis"] not in RIGHTS_BASES:
            raise ValueError(f"{REGISTRY_PATH}: invalid rights_basis for {rel}")
        approved = item["redistribution_approved"]
        if not isinstance(approved, bool):
            raise ValueError(f"{REGISTRY_PATH}: redistribution_approved must be boolean for {rel}")
        if approved and item["rights_basis"] not in APPROVABLE_BASES:
            raise ValueError(f"{REGISTRY_PATH}: non-approvable rights basis for {rel}")
        evidence = item["evidence_urls"]
        if not isinstance(evidence, list) or not evidence or not all(evidence):
            raise ValueError(f"{REGISTRY_PATH}: missing evidence URLs for {rel}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(item["reviewed_date"])):
            raise ValueError(f"{REGISTRY_PATH}: invalid reviewed_date for {rel}")
        file_path = root / rel
        if not file_path.is_file():
            raise ValueError(f"{REGISTRY_PATH}: missing reviewed file: {rel}")
        digest = sha256(file_path)
        if digest != item["sha256"]:
            raise ValueError(f"{REGISTRY_PATH}: SHA-256 mismatch for {rel}")
        by_path[rel] = item
    return by_path


def approved_rights_entries(root: Path = ROOT) -> dict[str, dict]:
    return {
        path: item
        for path, item in rights_entries(root).items()
        if item["redistribution_approved"]
    }
