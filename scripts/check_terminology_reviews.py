#!/usr/bin/env python3
"""Validate structured terminology review audit batches."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import render_terminology_reviews
from terminology_review_lib import OFFICIAL_STATUSES, OPERATIONS, REVIEW_DIR, ROOT


SHA256 = re.compile(r"^[0-9a-f]{64}$")
ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def validate_batch(path: Path, batch: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    label = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
    required = {
        "schema_version",
        "audit_only",
        "record_format",
        "batch_id",
        "batch_kind",
        "date",
        "primary_author_id",
        "work_id",
        "article_slug",
        "inputs",
        "review",
        "operation_counts",
        "decisions",
        "owner_review",
    }
    missing = sorted(required - set(batch))
    if missing:
        return [f"{label}: missing fields: {', '.join(missing)}"]
    if batch["schema_version"] != 1:
        errors.append(f"{label}: schema_version must be 1")
    if batch["audit_only"] is not True:
        errors.append(f"{label}: audit_only must be true")
    if batch["record_format"] not in {"native", "legacy_migrated"}:
        errors.append(f"{label}: invalid record_format")
    if batch["batch_kind"] not in {"article_review", "glossary_initialization"}:
        errors.append(f"{label}: invalid batch_kind")
    if not ID.fullmatch(batch["batch_id"]):
        errors.append(f"{label}: invalid batch_id")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", batch["date"]):
        errors.append(f"{label}: invalid date")
    if path.stem != batch["batch_id"]:
        errors.append(f"{label}: filename must equal batch_id")

    inputs = batch["inputs"]
    if not isinstance(inputs, list):
        errors.append(f"{label}: inputs must be a list")
    else:
        roles = set()
        for item in inputs:
            if not isinstance(item, dict) or not {"role", "path", "sha256"} <= set(item):
                errors.append(f"{label}: every input requires role, path and sha256")
                continue
            roles.add(item["role"])
            if item["sha256"] is None:
                if not (
                    batch["record_format"] == "legacy_migrated"
                    and item.get("unavailable_at_migration") is True
                ):
                    errors.append(f"{label}: missing input sha256 for {item['role']}")
            elif not SHA256.fullmatch(item["sha256"]):
                errors.append(f"{label}: invalid input sha256 for {item['role']}")
            if str(item["path"]).startswith("/Users/"):
                errors.append(f"{label}: tracked input paths must be stable labels, not local absolute paths")
        if batch["batch_kind"] == "article_review" and not {"source", "translation"} <= roles:
            errors.append(f"{label}: article_review requires source and translation inputs")

    review = batch["review"]
    for field in ("accuracy", "language", "final_translation_sha256", "blockers"):
        if field not in review:
            errors.append(f"{label}: review missing {field}")
    if review.get("final_translation_sha256") is not None and not SHA256.fullmatch(
        review.get("final_translation_sha256", "")
    ):
        errors.append(f"{label}: invalid final_translation_sha256")
    if not isinstance(review.get("blockers"), list):
        errors.append(f"{label}: review blockers must be a list")
    if batch["owner_review"].get("status") == "approved" and review.get("blockers"):
        errors.append(f"{label}: approved batch cannot have blockers")

    counts = batch["operation_counts"]
    for operation in OPERATIONS:
        value = counts.get(operation, 0)
        if not isinstance(value, int) or value < 0:
            errors.append(f"{label}: invalid operation count for {operation}")

    decisions = batch["decisions"]
    if not isinstance(decisions, list) or not decisions:
        errors.append(f"{label}: decisions must be a non-empty list")
    else:
        proposal_ids = set()
        for index, decision in enumerate(decisions, start=1):
            prefix = f"{label}: decision {index}"
            proposal_id = decision.get("proposal_id")
            if not proposal_id:
                errors.append(f"{prefix}: missing proposal_id")
            elif proposal_id in proposal_ids:
                errors.append(f"{prefix}: duplicate proposal_id {proposal_id}")
            else:
                proposal_ids.add(proposal_id)
            operations = decision.get("operations")
            if not isinstance(operations, list) or not operations:
                errors.append(f"{prefix}: operations must be a non-empty list")
            elif unknown := sorted(set(operations) - OPERATIONS):
                errors.append(f"{prefix}: invalid operations: {', '.join(unknown)}")
            if not decision.get("canonical"):
                errors.append(f"{prefix}: missing canonical")
            final_statuses = decision.get("final_status_by_author", {})
            if not isinstance(final_statuses, dict):
                errors.append(f"{prefix}: final_status_by_author must be an object")
            else:
                for author_id, status in final_statuses.items():
                    if status not in OFFICIAL_STATUSES:
                        errors.append(f"{prefix}: invalid final status {status} for {author_id}")
            for evidence_name in ("article_evidence", "corpus_evidence"):
                evidence = decision.get(evidence_name)
                if not isinstance(evidence, dict) or not evidence.get("summary"):
                    errors.append(f"{prefix}: {evidence_name} requires a summary")
            if "rationale" not in decision or not str(decision["rationale"]).strip():
                errors.append(f"{prefix}: missing rationale")

    owner_status = batch["owner_review"].get("status")
    if owner_status not in {"pending", "approved", "changes_requested"}:
        errors.append(f"{label}: invalid owner_review status")
    if batch["record_format"] == "native":
        expected = batch.get("source_candidate_count")
        if expected is None:
            errors.append(f"{label}: native record requires source_candidate_count")
        elif expected != len(decisions):
            errors.append(
                f"{label}: source_candidate_count={expected} but decisions={len(decisions)}"
            )
        if not review.get("accuracy", {}).get("full_pass"):
            errors.append(f"{label}: native record requires full accuracy pass")
        if not review.get("language", {}).get("full_pass"):
            errors.append(f"{label}: native record requires full language pass")
        if any(decision.get("heuristic_forms_pending") for decision in decisions):
            errors.append(f"{label}: native record has unconfirmed heuristic forms")
        actual_counts = {
            operation: sum(
                operation in decision.get("operations", [])
                for decision in decisions
            )
            for operation in OPERATIONS
        }
        for operation, actual in actual_counts.items():
            if counts.get(operation, 0) != actual:
                errors.append(
                    f"{label}: operation_counts.{operation}={counts.get(operation, 0)} "
                    f"but decisions contain {actual}"
                )
    return errors


def work_package_errors(batch: dict[str, Any], work_dir: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = work_dir / "manifest.json"
    if not manifest_path.is_file():
        return [f"missing work package manifest: {manifest_path}"]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    batch_inputs = {item["role"]: item["sha256"] for item in batch.get("inputs", [])}
    manifest_inputs = {item["role"]: item["sha256"] for item in manifest.get("inputs", [])}
    if batch_inputs != manifest_inputs:
        errors.append("batch input hashes do not match the work package")
    if batch.get("source_candidate_count") != manifest.get("suggestion_count"):
        errors.append("batch decision coverage does not match the suggestion table")
    final_hash = batch.get("review", {}).get("final_translation_sha256")
    translation_hash = manifest_inputs.get("translation")
    if final_hash and final_hash != translation_hash:
        errors.append("final translation hash does not match the prepared translation input")
    return errors


def load_batches(selected: Path | None = None) -> list[tuple[Path, dict[str, Any]]]:
    paths = [selected] if selected else sorted(REVIEW_DIR.glob("*.json"))
    return [(path, json.loads(path.read_text(encoding="utf-8"))) for path in paths]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--batch", type=Path)
    parser.add_argument("--work-package", type=Path)
    args = parser.parse_args()
    errors: list[str] = []
    batches = load_batches(args.batch)
    if not batches:
        errors.append("no terminology review batches found")
    for path, batch in batches:
        errors.extend(validate_batch(path, batch))
        if args.work_package:
            errors.extend(work_package_errors(batch, args.work_package))
    expected = render_terminology_reviews.expected_output()
    output = render_terminology_reviews.OUTPUT
    current = output.read_text(encoding="utf-8") if output.is_file() else ""
    if current != expected:
        errors.append("generated terminology review index is stale")
    for error in errors:
        print(error)
    if not errors:
        print(f"terminology_review_batches={len(batches)} errors=0")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
