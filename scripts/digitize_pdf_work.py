#!/usr/bin/env python3
"""Experimental helper for digitizable PDF review and promotion.

This is a v0 helper for relatively clean PDFs that already have usable
AI/Markdown conversions. It prepares records and review files, but it never
decides that a text is correct. Promotion requires explicit human approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collection_registry import collection_for_path, load_registry
from manage_collections import source_scan_entry


ROOT = Path(__file__).resolve().parents[1]
PROVENANCE = "ocr_initial_then_manual_collation_against_source_images"
FORBIDDEN_PATH_PATTERNS = ("/Users/", ".codex/attachments")


class DigitizationError(ValueError):
    """Raised when the experimental digitization helper refuses unsafe input."""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def q(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def inline_list(values: list[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def assert_repo_relative(path: str, label: str) -> None:
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise DigitizationError(f"{label} must be a repository-relative path")


def assert_no_forbidden_paths(text: str, label: str) -> None:
    for pattern in FORBIDDEN_PATH_PATTERNS:
        if pattern in text:
            raise DigitizationError(f"{label} contains unstable local path marker: {pattern}")


def parse_front_matter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    match = re.search(r"\A---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return {}
    result: dict[str, str] = {}
    for line in match.group(1).splitlines():
        found = re.match(r"^([A-Za-z0-9_]+):\s*(.*?)\s*$", line)
        if not found:
            continue
        value = found.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        result[found.group(1)] = value
    return result


def strip_front_matter(text: str) -> str:
    if not text.startswith("---\n"):
        return text.lstrip("\n")
    match = re.search(r"\A---\r?\n.*?\r?\n---\r?\n", text, re.DOTALL)
    return text[match.end() :].lstrip("\n") if match else text


def strip_html_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->\s*", "", text, flags=re.DOTALL)


def parse_labeled_path(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise DigitizationError("--ai-draft must use LABEL=PATH")
    label, raw_path = value.split("=", 1)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", label):
        raise DigitizationError(f"invalid AI draft label: {label}")
    path = Path(raw_path).expanduser()
    if not path.is_file():
        raise DigitizationError(f"AI draft does not exist: {raw_path}")
    return label, path


def unique_raw_output_path(raw_dir: Path, label: str, source: Path) -> Path:
    suffix = source.suffix if source.suffix.lower() in {".md", ".txt"} else ".txt"
    return raw_dir / f"{label}{suffix}"


def parse_page_ids(value: str) -> list[str]:
    pages: list[str] = []
    for token in value.split(","):
        token = token.strip()
        if not token:
            continue
        if re.fullmatch(r"pdf-page-\d{3}", token):
            pages.append(token)
            continue
        if re.fullmatch(r"\d+", token):
            pages.append(f"pdf-page-{int(token):03d}")
            continue
        match = re.fullmatch(r"(\d+)-(\d+)", token)
        if match:
            start, end = (int(match.group(1)), int(match.group(2)))
            if end < start:
                raise DigitizationError(f"invalid page range: {token}")
            pages.extend(f"pdf-page-{index:03d}" for index in range(start, end + 1))
            continue
        raise DigitizationError(f"invalid page identifier or range: {token}")
    if not pages:
        raise DigitizationError("verified pages cannot be empty")
    return pages


def find_registered_scan(
    root: Path, author_id: str, source_scan: str
) -> tuple[dict[str, Any], dict[str, Any], str]:
    assert_repo_relative(source_scan, "source scan")
    data = load_registry(root)
    source = root / source_scan
    if not source.is_file():
        raise DigitizationError(f"source scan does not exist: {source_scan}")
    for collection in data.get("collections", []):
        if collection.get("person_id") != author_id:
            continue
        if not source_scan.startswith(str(collection.get("root", "")).rstrip("/") + "/"):
            continue
        entry = source_scan_entry(root, collection, source_scan)
        if not entry:
            continue
        actual_sha = sha256(source)
        manifest_sha = entry.get("sha256")
        if not manifest_sha:
            raise DigitizationError(f"registered scan is missing sha256: {source_scan}")
        if manifest_sha != actual_sha:
            raise DigitizationError(f"source scan SHA-256 mismatch: {source_scan}")
        return collection, entry, actual_sha
    raise DigitizationError(f"source scan is not registered for author {author_id}: {source_scan}")


def project_dir_for(root: Path, collection: dict[str, Any], work_id: str) -> Path:
    return root / str(collection["root"]) / "digitization" / work_id


def source_url_from(entry: dict[str, Any]) -> str:
    return str(entry.get("source_url") or entry.get("work_url") or "not_stated")


def prepare_review(root: Path, args: argparse.Namespace) -> Path:
    collection, entry, source_sha = find_registered_scan(root, args.author_id, args.source_scan)
    ai_drafts = [parse_labeled_path(item) for item in args.ai_draft]
    if len(ai_drafts) < 2:
        raise DigitizationError("prepare-review requires at least two --ai-draft entries")
    project_dir = project_dir_for(root, collection, args.work_id)
    raw_dir = project_dir / "raw_ai_conversions"
    raw_dir.mkdir(parents=True, exist_ok=True)

    labels: list[str] = []
    raw_records: list[tuple[str, Path, str]] = []
    for label, source in ai_drafts:
        destination = unique_raw_output_path(raw_dir, label, source)
        shutil.copyfile(source, destination)
        labels.append(label)
        raw_records.append((label, destination, sha256(destination)))

    primary_label, primary_path, primary_sha = raw_records[0]
    secondary = [record[2] for record in raw_records[1:]]
    body = strip_front_matter((raw_dir / primary_path.name).read_text(encoding="utf-8"))
    title = args.title or str(entry.get("title") or args.work_id.replace("-", " ").title())
    author = args.author or str(entry.get("author") or "not_stated")
    source_version = args.source_version or str(entry.get("citation") or entry.get("title") or title)

    front_matter = [
        "---",
        f"title: {q(title)}",
        f"author: {q(author)}",
        f"created: {q(args.date)}",
        'type: "digitization-draft"',
        f"language: {q(args.language)}",
        'text_role: "research"',
        'core_corpus_eligible: "false"',
        'llm_wiki_eligible: "false"',
        f"redistribution_approved: {q(str(entry.get('redistribution_approved', 'false')))}",
        f"rights_review_status: {q(str(entry.get('rights_review_status', 'unreviewed')))}",
        'source_format: "pdf"',
        'text_status: "human_review_draft"',
        f"source_url: {q(source_url_from(entry))}",
        f"source_scan: {q(args.source_scan)}",
        f"source_sha256: {q(source_sha)}",
        f"ai_conversion_sources: {inline_list(labels)}",
        f"primary_ai_conversion_sha256: {q(primary_sha)}",
        f"secondary_ai_conversion_sha256: {inline_list(secondary)}",
        (
            'collation_note: "Experimental digitizable-PDF review draft prepared from '
            'user-supplied AI conversions; not human verified."'
        ),
        f"published_in: {q(source_version)}",
        "---",
        "",
        "<!--",
        "Experimental digitizable-PDF workflow: unstable testing helper.",
        "Human review status: prepared for page-level manual verification; not promoted.",
        "This draft must remain outside corpus paths until explicit human verification.",
        "-->",
        "",
    ]
    draft = project_dir / "human_review_draft.md"
    draft.write_text("\n".join(front_matter) + body.rstrip() + "\n", encoding="utf-8")
    assert_no_forbidden_paths(draft.read_text(encoding="utf-8"), draft.relative_to(root).as_posix())

    if args.render_pages:
        render_pdf_pages(root, args.source_scan, project_dir / "rendered_pages")
    return draft


def render_pdf_pages(root: Path, source_scan: str, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "pdftoppm",
        "-png",
        str(root / source_scan),
        str(output_dir / "page"),
    ]
    subprocess.run(command, check=True)


def target_research_collection(root: Path, target: Path) -> dict[str, Any]:
    collection = collection_for_path(root, target.relative_to(root).as_posix())
    if not collection:
        raise DigitizationError("target corpus path is not in a registered corpus collection")
    if collection.get("default_text_role") != "research":
        raise DigitizationError("experimental promotion only supports registered research corpus paths")
    return collection


def promote_verified(root: Path, args: argparse.Namespace) -> Path:
    if not args.human_verified:
        raise DigitizationError("promotion requires --human-verified")
    collection, entry, source_sha = find_registered_scan(root, args.author_id, args.source_scan)
    target = root / args.target_corpus_path
    assert_repo_relative(args.target_corpus_path, "target corpus path")
    target_collection = target_research_collection(root, target)
    project_dir = project_dir_for(root, collection, args.work_id)
    draft = project_dir / "human_review_draft.md"
    if not draft.is_file():
        raise DigitizationError(f"human review draft is missing: {draft.relative_to(root).as_posix()}")

    draft_text = draft.read_text(encoding="utf-8")
    draft_meta = parse_front_matter(draft_text)
    body = strip_html_comments(strip_front_matter(draft_text)).strip()
    title = args.title or draft_meta.get("title") or str(entry.get("title") or args.work_id)
    author = args.author or draft_meta.get("author") or str(entry.get("author") or "not_stated")
    language = args.language or draft_meta.get("language") or "en"
    published_in = args.published_in or draft_meta.get("published_in") or str(
        entry.get("citation") or entry.get("title") or title
    )
    tags = args.tags or ["research", "secondary-source", args.author_id]
    topics = args.topics or []
    places = args.places or []
    verified_pages = parse_page_ids(args.verified_pages)

    front_matter = [
        "---",
        f"title: {q(title)}",
        f"author: {q(author)}",
        f"created: {q(args.date)}",
        'type: "analysis"',
        f"tags: {inline_list(tags)}",
        f"language: {q(language)}",
    ]
    if topics:
        front_matter.append(f"topics: {inline_list(topics)}")
    if places:
        front_matter.append(f"places: {inline_list(places)}")
    front_matter.extend(
        [
            f"collection: {q(str(target_collection.get('collection_name') or target_collection['id']))}",
            'llm_wiki_eligible: "true"',
            'gbrain_source: "project-markdown"',
            'text_role: "research"',
            'core_corpus_eligible: "false"',
            'source_format: "pdf"',
            f"source_license: {q(str(entry.get('source_license', 'not_stated')))}",
            f"redistribution_approved: {q(str(entry.get('redistribution_approved', 'false')))}",
            f"rights_review_status: {q(str(entry.get('rights_review_status', 'unreviewed')))}",
            'text_status: "ocr_human_verified"',
            f"source_url: {q(source_url_from(entry))}",
            f"source_scan: {q(args.source_scan)}",
            f"source_sha256: {q(source_sha)}",
            f"provenance: {q(PROVENANCE)}",
            'transcription_mode: "normalized_markdown_not_diplomatic"',
            (
                'editorial_note: "Generated by experimental digitizable-PDF helper; '
                'human verification remains the source of authority."'
            ),
            f"digitization_project: {q((project_dir / 'project.json').relative_to(root).as_posix())}",
            f"published_in: {q(published_in)}",
            "---",
            "",
        ]
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(front_matter) + body + "\n", encoding="utf-8")
    assert_no_forbidden_paths(target.read_text(encoding="utf-8"), args.target_corpus_path)

    raw_dir = project_dir / "raw_ai_conversions"
    raw_files = sorted(path for path in raw_dir.iterdir() if path.is_file()) if raw_dir.is_dir() else []
    if len(raw_files) < 2:
        raise DigitizationError("promotion requires at least two raw AI conversion files")

    page_items = [
        {
            "scan_page_id": page_id,
            "pdf_page_index": int(page_id.removeprefix("pdf-page-")),
            "scope": "article",
            "status": "human_verified",
        }
        for page_id in verified_pages
    ]
    write_json(
        project_dir / "page_map.json",
        {
            "schema_version": 1,
            "work_id": args.work_id,
            "source_scan": args.source_scan,
            "page_basis": args.page_basis
            or "Verified pages were provided explicitly during experimental digitizable-PDF promotion.",
            "pages": page_items,
        },
    )

    runs = []
    for raw_file in raw_files:
        runs.append(
            {
                "engine": f"ai-conversion-{raw_file.stem}",
                "version": f"external-{args.date}",
                "run_date": args.date,
                "input_source_scan": args.source_scan,
                "output_path": raw_file.relative_to(root).as_posix(),
                "output_sha256": sha256(raw_file),
            }
        )
    write_json(project_dir / "ocr_runs.json", {"schema_version": 1, "runs": runs})

    reviews = [
        {
            "scan_page_id": page_id,
            "reviewer": args.reviewer,
            "review_date": args.date,
            "decision": "accepted_after_page_by_page_review",
            "notes": "Human reviewer approved this page for the experimental digitizable-PDF workflow.",
        }
        for page_id in verified_pages
    ]
    write_json(project_dir / "ocr_review_log.json", {"schema_version": 1, "reviews": reviews})
    write_json(
        project_dir / "quality_report.json",
        {
            "schema_version": 1,
            "status": "passed",
            "unresolved_issues": [],
            "review_date": args.date,
            "checks": {
                "verified_pages": verified_pages,
                "source_scan_sha256_verified": True,
                "experimental_digitizable_pdf_workflow": True,
            },
            "notes": "Experimental helper generated this report after explicit human verification.",
        },
    )
    write_json(
        project_dir / "project.json",
        {
            "schema_version": 1,
            "author_id": args.author_id,
            "work_id": args.work_id,
            "source_scan": args.source_scan,
            "source_sha256": source_sha,
            "source_version": args.source_version or published_in,
            "status": "human_verified",
            "created": args.date,
            "ocr_activated": True,
            "activation_note": (
                "Experimental digitizable-PDF helper used after project-owner activation and "
                f"explicit human verification on {args.date}."
            ),
            "final_markdown": args.target_corpus_path,
        },
    )
    write_json(
        project_dir / "human_verification_manifest.json",
        {
            "schema_version": 1,
            "work_id": args.work_id,
            "verification_status": "human_verified",
            "verification_date": args.date,
            "reviewer": args.reviewer,
            "final_markdown": args.target_corpus_path,
            "final_markdown_sha256": sha256(target),
            "source_scan": args.source_scan,
            "source_scan_sha256": source_sha,
            "verified_scan_pages": verified_pages,
            "provenance": PROVENANCE,
            "transcription_mode": "normalized_markdown_not_diplomatic",
            "rights_note": "Human verification of text accuracy does not change redistribution approval status.",
        },
    )
    for generated in [
        target,
        project_dir / "project.json",
        project_dir / "page_map.json",
        project_dir / "ocr_runs.json",
        project_dir / "ocr_review_log.json",
        project_dir / "quality_report.json",
        project_dir / "human_verification_manifest.json",
    ]:
        assert_no_forbidden_paths(generated.read_text(encoding="utf-8"), generated.relative_to(root).as_posix())
    return target


def split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT), help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", required=True)

    prepare = sub.add_parser("prepare-review")
    prepare.add_argument("--author-id", required=True)
    prepare.add_argument("--work-id", required=True)
    prepare.add_argument("--source-scan", required=True)
    prepare.add_argument("--ai-draft", action="append", required=True, help="Repeat as LABEL=PATH")
    prepare.add_argument("--title")
    prepare.add_argument("--author")
    prepare.add_argument("--language", default="en")
    prepare.add_argument("--source-version")
    prepare.add_argument("--date", default="2026-07-01")
    prepare.add_argument("--render-pages", action="store_true")

    promote = sub.add_parser("promote-verified")
    promote.add_argument("--author-id", required=True)
    promote.add_argument("--work-id", required=True)
    promote.add_argument("--source-scan", required=True)
    promote.add_argument("--target-corpus-path", required=True)
    promote.add_argument("--verified-pages", required=True)
    promote.add_argument("--reviewer", required=True)
    promote.add_argument("--date", required=True)
    promote.add_argument("--human-verified", action="store_true")
    promote.add_argument("--title")
    promote.add_argument("--author")
    promote.add_argument("--language")
    promote.add_argument("--published-in")
    promote.add_argument("--source-version")
    promote.add_argument("--page-basis")
    promote.add_argument("--tags", type=split_csv)
    promote.add_argument("--topics", type=split_csv)
    promote.add_argument("--places", type=split_csv)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = Path(args.root).resolve()
    try:
        if args.command == "prepare-review":
            path = prepare_review(root, args)
            print(f"prepared review draft: {path.relative_to(root).as_posix()}")
        elif args.command == "promote-verified":
            path = promote_verified(root, args)
            print(f"promoted verified text: {path.relative_to(root).as_posix()}")
    except (DigitizationError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
