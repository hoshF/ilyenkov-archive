#!/usr/bin/env python3
"""Shared helpers for article translation and terminology review batches."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import unquote, urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "translation_workspace/terminology_reviews"
CACHE_DIR = ROOT / "tmp/translation_review_cache"
WORK_DIR = ROOT / "tmp/translation_reviews"
OFFICIAL_STATUSES = {"approved", "provisional", "needs_review"}
OPERATIONS = {"add", "modify", "delete", "status", "reject", "no_formal_glossary"}
ALREADY_REVIEWED_EXIT = 20
REVISION_REQUIRED_EXIT = 21
IDENTITY_CONFLICT_EXIT = 22


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def stable_path(path: Path) -> str:
    resolved = path.resolve()
    for prefix, label in ((ROOT, ""), (ROOT.parent / "blog", "blog:")):
        try:
            relative = resolved.relative_to(prefix.resolve()).as_posix()
        except ValueError:
            continue
        return f"{label}{relative}"
    return f"upload:{resolved.name}"


def input_record(role: str, path: Path) -> dict[str, Any]:
    return {
        "role": role,
        "path": stable_path(path),
        "sha256": sha256_file(path),
        "size": path.stat().st_size,
        "live_path": str(path.resolve()),
    }


def front_matter_metadata(path: Path) -> dict[str, str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    metadata: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        key, separator, value = line.partition(":")
        if not separator:
            continue
        metadata[key.strip()] = value.strip().strip("\"'")
    return metadata


def normalize_doi(value: str | None) -> str | None:
    if not value:
        return None
    decoded = unquote(value).strip().strip("<>()[]{}.,;")
    match = re.search(
        r"(?:https?://(?:dx\.)?doi\.org/|doi\s*:\s*)?(10\.\d{4,9}/[^\s<>\]]+)",
        decoded,
        re.IGNORECASE,
    )
    if not match:
        return None
    return match.group(1).rstrip(".,;:)").casefold()


def normalize_source_url(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"https?://[^\s<>\])]+", unquote(value), re.IGNORECASE)
    if not match:
        return None
    raw = match.group().rstrip(".,;:")
    parts = urlsplit(raw)
    host = (parts.hostname or "").casefold()
    if not host:
        return None
    port = parts.port
    netloc = host if port is None else f"{host}:{port}"
    path = re.sub(r"/+$", "", parts.path) or "/"
    return urlunsplit((parts.scheme.casefold(), netloc, path, parts.query, ""))


def normalize_title(value: str | None) -> str | None:
    if not value:
        return None
    normalized = re.sub(r"[\W_]+", " ", value.casefold(), flags=re.UNICODE).strip()
    return normalized or None


def source_work_identity(
    source: Path,
    *,
    author_id: str,
    work_id: str,
    article_slug: str,
    source_record: dict[str, Any],
) -> dict[str, Any]:
    metadata = front_matter_metadata(source)
    return {
        "primary_author_id": author_id,
        "work_id": work_id,
        "article_slug": article_slug,
        "source_path": source_record["path"],
        "source_sha256": source_record["sha256"],
        "doi": normalize_doi(metadata.get("doi")),
        "source_url": normalize_source_url(metadata.get("source_url")),
        "source_title": metadata.get("title"),
    }


def review_artifacts(review_dir: Path | None = None) -> list[dict[str, Any]]:
    directory = review_dir or REVIEW_DIR
    artifacts: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.json")):
        batch = json.loads(path.read_text(encoding="utf-8"))
        inputs = {item.get("role"): item for item in batch.get("inputs", [])}
        source = inputs.get("source", {})
        translation = inputs.get("translation", {})
        work_identity = batch.get("work_identity", {})
        artifacts.append(
            {
                "target": batch["batch_id"],
                "kind": "batch",
                "batch_id": batch["batch_id"],
                "date": batch.get("date"),
                "owner_status": batch.get("owner_review", {}).get("status"),
                "primary_author_id": batch.get("primary_author_id"),
                "work_id": batch.get("work_id"),
                "article_slug": batch.get("article_slug"),
                "source_path": source.get("path"),
                "source_sha256": source.get("sha256"),
                "translation_sha256": translation.get("sha256"),
                "input_hashes": {
                    role: item.get("sha256")
                    for role, item in inputs.items()
                },
                "doi": normalize_doi(work_identity.get("doi")),
                "source_url": normalize_source_url(work_identity.get("source_url")),
                "source_title": work_identity.get("source_title"),
                "path": path.as_posix(),
            }
        )
    return artifacts


def blog_artifacts(blog_root: Path | None = None) -> list[dict[str, Any]]:
    root = blog_root or ROOT.parent / "blog"
    posts = root / "content/posts"
    artifacts: list[dict[str, Any]] = []
    if not posts.is_dir():
        return artifacts
    for path in sorted(posts.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        metadata = front_matter_metadata(path)
        doi_line = next(
            (line for line in text.splitlines() if re.match(r"^\s*DOI\s*[：:]", line, re.IGNORECASE)),
            "",
        )
        source_line = next(
            (line for line in text.splitlines() if re.match(r"^\s*来源\s*[：:]", line)),
            "",
        )
        slug = path.stem
        artifacts.append(
            {
                "target": f"blog:{slug}",
                "kind": "blog",
                "article_slug": slug,
                "title": metadata.get("title"),
                "translation_sha256": sha256_file(path),
                "doi": normalize_doi(doi_line),
                "source_url": normalize_source_url(source_line),
                "path": f"blog:content/posts/{path.name}",
            }
        )
    return artifacts


def artifact_match_reasons(identity: dict[str, Any], artifact: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    if identity["article_slug"] == artifact.get("article_slug"):
        reasons.append("article_slug")
    if (
        artifact.get("primary_author_id")
        and identity["primary_author_id"] == artifact["primary_author_id"]
        and identity["work_id"] == artifact.get("work_id")
    ):
        reasons.append("author_work")
    source_path = artifact.get("source_path")
    if (
        source_path
        and not str(source_path).startswith("upload:")
        and identity["source_path"] == source_path
    ):
        reasons.append("source_path")
    if identity["source_sha256"] and identity["source_sha256"] == artifact.get("source_sha256"):
        reasons.append("source_sha256")
    if identity.get("doi") and identity["doi"] == artifact.get("doi"):
        reasons.append("doi")
    if identity.get("source_url") and identity["source_url"] == artifact.get("source_url"):
        reasons.append("source_url")
    return reasons


def changed_input_roles(
    current_hashes: dict[str, str],
    artifact: dict[str, Any],
) -> tuple[list[str], list[str]]:
    previous = artifact.get("input_hashes")
    if previous is None:
        previous = {"translation": artifact.get("translation_sha256")}
    changed: list[str] = []
    unknown: list[str] = []
    for role, current_hash in current_hashes.items():
        previous_hash = previous.get(role)
        if previous_hash is None:
            unknown.append(role)
        elif previous_hash != current_hash:
            changed.append(role)
    return changed, unknown


def duplicate_preflight(
    *,
    identity: dict[str, Any],
    inputs: list[dict[str, Any]],
    revision_of: str | None,
    review_dir: Path | None = None,
    blog_root: Path | None = None,
) -> dict[str, Any]:
    current_hashes = {item["role"]: item["sha256"] for item in inputs}
    matches = []
    title_hints = []
    for artifact in [*review_artifacts(review_dir), *blog_artifacts(blog_root)]:
        reasons = artifact_match_reasons(identity, artifact)
        artifact_title = artifact.get("source_title") or artifact.get("title")
        if (
            normalize_title(identity.get("source_title"))
            and normalize_title(identity.get("source_title")) == normalize_title(artifact_title)
        ):
            title_hints.append(
                {
                    "target": artifact["target"],
                    "title": artifact_title,
                }
            )
        if not reasons:
            continue
        changed, unknown = changed_input_roles(current_hashes, artifact)
        matches.append(
            {
                **artifact,
                "match_reasons": reasons,
                "changed_input_roles": changed,
                "unknown_input_roles": unknown,
            }
        )

    matched_slugs = {item.get("article_slug") for item in matches if item.get("article_slug")}
    if len(matched_slugs) > 1:
        return {
            "status": "identity_conflict",
            "matches": matches,
            "title_hints": title_hints,
            "message": "strong identity fields point to different article slugs",
        }

    exact_batches = [
        item
        for item in matches
        if item["kind"] == "batch"
        and not item["changed_input_roles"]
        and not item["unknown_input_roles"]
    ]
    if exact_batches:
        return {
            "status": "already_reviewed",
            "matches": matches,
            "title_hints": title_hints,
            "reuse_target": exact_batches[-1]["target"],
        }

    if matches:
        batch_matches = [item for item in matches if item["kind"] == "batch"]
        if batch_matches:
            latest_batch = max(
                batch_matches,
                key=lambda item: (item.get("date") or "", item["batch_id"]),
            )
            allowed_targets = {latest_batch["target"]}
        else:
            allowed_targets = {item["target"] for item in matches}
        if revision_of is None:
            return {
                "status": "revision_required",
                "matches": matches,
                "title_hints": title_hints,
                "allowed_revision_targets": sorted(allowed_targets),
            }
        if revision_of not in allowed_targets:
            return {
                "status": "identity_conflict",
                "matches": matches,
                "title_hints": title_hints,
                "message": f"--revision-of {revision_of} is not one of the matched artifacts",
                "allowed_revision_targets": sorted(allowed_targets),
            }
        selected = next(item for item in matches if item["target"] == revision_of)
        return {
            "status": "revision_confirmed",
            "matches": matches,
            "title_hints": title_hints,
            "selected": selected,
        }

    if revision_of is not None:
        return {
            "status": "identity_conflict",
            "matches": [],
            "title_hints": title_hints,
            "message": "--revision-of was provided but no existing artifact matches this work",
        }
    return {"status": "new", "matches": [], "title_hints": title_hints}


def next_batch_id(
    *,
    date_value: str,
    slug: str,
    review_mode: str,
    review_dir: Path | None = None,
) -> str:
    directory = review_dir or REVIEW_DIR
    if review_mode == "initial":
        batch_id = f"{date_value}-{slug}"
        if (directory / f"{batch_id}.json").exists():
            raise ValueError(f"initial batch already exists: {batch_id}")
        return batch_id
    pattern = re.compile(rf"^\d{{4}}-\d{{2}}-\d{{2}}-{re.escape(slug)}-r(\d+)$")
    sequence = max(
        (
            int(match.group(1))
            for path in directory.glob(f"*-{slug}-r*.json")
            if (match := pattern.fullmatch(path.stem))
        ),
        default=0,
    )
    return f"{date_value}-{slug}-r{sequence + 1:02d}"


def strip_front_matter(lines: list[str]) -> tuple[list[str], int]:
    if not lines or lines[0].strip() != "---":
        return lines, 1
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return lines[index + 1 :], index + 2
    return lines, 1


def content_blocks(path: Path) -> list[dict[str, Any]]:
    lines, base_line = strip_front_matter(path.read_text(encoding="utf-8").splitlines())
    blocks: list[dict[str, Any]] = []
    current: list[str] = []
    current_start = base_line
    section = ""

    def flush(end_line: int) -> None:
        nonlocal current, current_start, section
        text = "\n".join(current).strip()
        current = []
        if not text or text in {"---", "***", "___"}:
            return
        heading = re.match(r"^#{1,6}\s+(.+)$", text)
        if heading:
            section = heading.group(1).strip()
        blocks.append(
            {
                "id": f"b{len(blocks) + 1:04d}",
                "line_start": current_start,
                "line_end": end_line,
                "section": section,
                "kind": "heading" if heading else "content",
                "sha256": sha256_bytes(text.encode("utf-8")),
                "text": text,
            }
        )

    for offset, line in enumerate(lines):
        line_number = base_line + offset
        if not line.strip():
            if current:
                flush(line_number - 1)
            current_start = line_number + 1
            continue
        if not current:
            current_start = line_number
        current.append(line)
    if current:
        flush(base_line + len(lines) - 1)
    return blocks


def sections(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for block in blocks:
        if block["kind"] == "heading" or current is None:
            current = {
                "index": len(grouped) + 1,
                "title": block["section"] or "(开头)",
                "blocks": [],
            }
            grouped.append(current)
        current["blocks"].append(block)
    return grouped


def structural_alignment(
    source_blocks: list[dict[str, Any]],
    translation_blocks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    source_sections = sections(source_blocks)
    translation_sections = sections(translation_blocks)
    alignment: list[dict[str, Any]] = []
    warnings: list[str] = []
    if len(source_sections) != len(translation_sections):
        warnings.append(
            f"section count differs: source={len(source_sections)} translation={len(translation_sections)}"
        )
    for index in range(max(len(source_sections), len(translation_sections))):
        source = source_sections[index] if index < len(source_sections) else None
        translation = translation_sections[index] if index < len(translation_sections) else None
        source_items = source["blocks"] if source else []
        translation_items = translation["blocks"] if translation else []
        if len(source_items) != len(translation_items):
            warnings.append(
                "section {index} block count differs: source={source_count} translation={translation_count}".format(
                    index=index + 1,
                    source_count=len(source_items),
                    translation_count=len(translation_items),
                )
            )
        pairs = []
        for item_index in range(max(len(source_items), len(translation_items))):
            pairs.append(
                {
                    "source_block": source_items[item_index]["id"] if item_index < len(source_items) else None,
                    "translation_block": (
                        translation_items[item_index]["id"] if item_index < len(translation_items) else None
                    ),
                }
            )
        alignment.append(
            {
                "section_index": index + 1,
                "source_title": source["title"] if source else None,
                "translation_title": translation["title"] if translation else None,
                "pairs": pairs,
            }
        )
    return alignment, warnings


def split_table_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    cells: list[str] = []
    current: list[str] = []
    escaped = False
    for char in stripped:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            current.append(char)
            escaped = True
        elif char == "|":
            cells.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    cells.append("".join(current).strip())
    return cells


def parse_suggestions(path: Path) -> list[dict[str, Any]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    original_aliases = {"原文术语", "原词", "术语", "original", "term"}
    translation_aliases = {"建议统一译法", "建议译法", "中文译法", "translation"}
    for index, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        headers = split_table_row(line)
        original_index = next((i for i, cell in enumerate(headers) if cell in original_aliases), None)
        translation_index = next((i for i, cell in enumerate(headers) if cell in translation_aliases), None)
        if original_index is None or translation_index is None:
            continue
        if index + 1 >= len(lines) or "---" not in lines[index + 1]:
            continue
        suggestions: list[dict[str, Any]] = []
        for row_index, row in enumerate(lines[index + 2 :], start=1):
            if not row.lstrip().startswith("|"):
                break
            cells = split_table_row(row)
            if len(cells) != len(headers):
                raise ValueError(
                    f"{path.name}: suggestion row {row_index} has {len(cells)} cells; expected {len(headers)}"
                )
            values = dict(zip(headers, cells))
            original = cells[original_index]
            translation = cells[translation_index]
            backticks = re.findall(r"`([^`]+)`", original)
            canonical = backticks[0].strip() if backticks else original.strip()
            if not canonical:
                raise ValueError(f"{path.name}: suggestion row {row_index} has an empty original term")
            suggestions.append(
                {
                    "proposal_id": f"p{row_index:03d}",
                    "canonical": canonical,
                    "suggested_zh": re.sub(r"\*\*", "", translation).strip(),
                    "reported_count": parse_first_integer(values.get("出现次数", "")),
                    "source_row": row_index,
                    "columns": values,
                }
            )
        if not suggestions:
            raise ValueError(f"{path.name}: suggestion table has no data rows")
        return suggestions
    raise ValueError(
        f"{path.name}: no suggestion table with original-term and suggested-translation columns"
    )


def parse_first_integer(value: str) -> int | None:
    match = re.search(r"\d+", value)
    return int(match.group()) if match else None


def load_registry() -> dict[str, Any]:
    return json.loads((ROOT / "metadata/collections.json").read_text(encoding="utf-8"))


def registered_glossaries() -> dict[str, tuple[Path, dict[str, Any]]]:
    result: dict[str, tuple[Path, dict[str, Any]]] = {}
    for path in sorted(ROOT.glob("*_markdown/metadata/glossary.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        result[data["author_id"]] = (path, data)
    return result


def resolve_source_author(source: Path, explicit_author_id: str | None = None) -> tuple[str, dict[str, Any]]:
    registry = load_registry()
    people = {person["id"]: person for person in registry.get("people", [])}
    if explicit_author_id:
        if explicit_author_id not in people:
            raise ValueError(f"unknown author id: {explicit_author_id}")
        return explicit_author_id, people[explicit_author_id]
    resolved = source.resolve()
    matches: list[tuple[int, str]] = []
    for collection in registry.get("collections", []):
        for relative in collection.get("corpus_paths", []):
            corpus_path = (ROOT / relative).resolve()
            try:
                resolved.relative_to(corpus_path)
            except ValueError:
                continue
            matches.append((len(corpus_path.parts), collection["person_id"]))
    if not matches:
        raise ValueError("source is outside registered corpus paths; pass --author-id")
    matches.sort(reverse=True)
    author_id = matches[0][1]
    return author_id, people[author_id]


def related_people(text: str, primary_author_id: str) -> list[str]:
    result: list[str] = []
    for person in load_registry().get("people", []):
        person_id = person["id"]
        if person_id == primary_author_id:
            continue
        names = [
            person.get("name_zh", ""),
            person.get("name_original", ""),
            person.get("name_latin", ""),
        ]
        if any(name and name.casefold() in text.casefold() for name in names):
            result.append(person_id)
    return result


def normalize_term(value: str) -> str:
    return re.sub(r"[\W_]+", " ", value.casefold(), flags=re.UNICODE).strip()


def glossary_matches(canonical: str, glossaries: dict[str, tuple[Path, dict[str, Any]]]) -> list[dict[str, Any]]:
    normalized = normalize_term(canonical)
    matches: list[dict[str, Any]] = []
    for author_id, (path, glossary) in glossaries.items():
        for entry in glossary.get("entries", []):
            variants = [entry["canonical"], *entry.get("forms", [])]
            if normalized in {normalize_term(item) for item in variants}:
                matches.append(
                    {
                        "author_id": author_id,
                        "glossary_path": path.relative_to(ROOT).as_posix(),
                        "entry_id": entry["id"],
                        "canonical": entry["canonical"],
                        "forms": entry.get("forms", []),
                        "zh_preferred": entry["zh_preferred"],
                        "status": entry["status"],
                    }
                )
    return matches


def occurrence_pattern(form: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(form)}(?!\w)", re.IGNORECASE | re.UNICODE)


def occurrences_for_forms(blocks: list[dict[str, Any]], forms: Iterable[str]) -> tuple[int, list[dict[str, Any]]]:
    patterns = [(form, occurrence_pattern(form)) for form in dict.fromkeys(forms) if form]
    total = 0
    locations: list[dict[str, Any]] = []
    for block in blocks:
        block_matches = []
        for form, pattern in patterns:
            count = len(pattern.findall(block["text"]))
            if count:
                total += count
                block_matches.append({"form": form, "count": count})
        if block_matches:
            locations.append(
                {
                    "block": block["id"],
                    "section": block["section"],
                    "line_start": block["line_start"],
                    "matches": block_matches,
                }
            )
    return total, locations


def heuristic_forms(canonical: str, blocks: list[dict[str, Any]], confirmed_forms: Iterable[str]) -> list[str]:
    if " " in canonical or "-" in canonical or not re.fullmatch(r"[А-Яа-яЁё]+", canonical):
        return []
    ending = re.compile(
        r"(иями|ями|ами|ого|ему|ому|ыми|ими|ую|юю|ая|яя|ое|ее|ые|ие|ый|ий|ой|а|я|ы|и|у|ю|е|о|ом|ем|ах|ях|ов|ев|ь)$",
        re.IGNORECASE,
    )
    stem = ending.sub("", canonical)
    if len(stem) < 4:
        stem = canonical[: max(4, len(canonical) - 1)]
    tokens = set(re.findall(r"[А-Яа-яЁё]+", "\n".join(block["text"] for block in blocks)))
    confirmed = {item.casefold() for item in confirmed_forms}
    return sorted(
        token
        for token in tokens
        if token.casefold().startswith(stem.casefold()) and token.casefold() not in confirmed
    )


def corpus_paths_for_author(author_id: str) -> list[Path]:
    paths: list[Path] = []
    for collection in load_registry().get("collections", []):
        if collection.get("person_id") != author_id:
            continue
        paths.extend(ROOT / relative for relative in collection.get("corpus_paths", []))
    return paths


def git_corpus_fingerprint(paths: list[Path]) -> str:
    relatives = [path.relative_to(ROOT).as_posix() for path in paths]
    head = run_git(["rev-parse", "HEAD"], check=False).strip()
    status = run_git(["status", "--porcelain=v1", "--", *relatives], check=False)
    dirty_hashes = []
    for line in status.splitlines():
        relative = line[3:]
        path = ROOT / relative
        if path.is_file():
            dirty_hashes.append((relative, sha256_file(path)))
    payload = json.dumps(
        {"head": head, "paths": relatives, "status": status, "dirty": dirty_hashes},
        ensure_ascii=False,
        sort_keys=True,
    )
    return sha256_bytes(payload.encode("utf-8"))


def body_without_references(path: Path) -> str:
    lines, _ = strip_front_matter(path.read_text(encoding="utf-8").splitlines())
    kept: list[str] = []
    for line in lines:
        if re.match(
            r"^#{1,6}\s+(参考文献|文献|References|Bibliography|Литература|Список литературы)\s*$",
            line.strip(),
            re.IGNORECASE,
        ):
            break
        kept.append(line)
    return "\n".join(kept)


def corpus_evidence_batch(
    author_id: str,
    forms_by_proposal: dict[str, list[str]],
) -> tuple[dict[str, dict[str, Any]], bool]:
    paths = corpus_paths_for_author(author_id)
    fingerprint = git_corpus_fingerprint(paths)
    cache_payload = json.dumps(
        {
            "author_id": author_id,
            "forms_by_proposal": {
                key: sorted(value) for key, value in sorted(forms_by_proposal.items())
            },
            "fingerprint": fingerprint,
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    cache_key = sha256_bytes(cache_payload.encode("utf-8"))
    cache_path = CACHE_DIR / f"{cache_key}.json"
    if cache_path.is_file():
        return json.loads(cache_path.read_text(encoding="utf-8")), True

    patterns = {
        proposal_id: [(form, occurrence_pattern(form)) for form in forms]
        for proposal_id, forms in forms_by_proposal.items()
    }
    per_file: dict[str, dict[str, int]] = {
        proposal_id: {} for proposal_id in forms_by_proposal
    }
    representatives: dict[str, list[dict[str, Any]]] = {
        proposal_id: [] for proposal_id in forms_by_proposal
    }
    for root in paths:
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*.md")):
            text = body_without_references(path)
            relative = path.relative_to(ROOT).as_posix()
            for proposal_id, proposal_patterns in patterns.items():
                count = sum(len(pattern.findall(text)) for _, pattern in proposal_patterns)
                if not count:
                    continue
                per_file[proposal_id][relative] = count
                if len(representatives[proposal_id]) < 5:
                    for line_number, line in enumerate(text.splitlines(), start=1):
                        matched = [
                            form for form, pattern in proposal_patterns if pattern.search(line)
                        ]
                        if matched:
                            representatives[proposal_id].append(
                                {
                                    "path": relative,
                                    "line": line_number,
                                    "forms": matched,
                                    "excerpt": re.sub(r"\s+", " ", line).strip()[:280],
                                }
                            )
                            break
    evidence = {
        proposal_id: {
            "author_id": author_id,
            "confirmed_forms": forms_by_proposal[proposal_id],
            "total": sum(per_file[proposal_id].values()),
            "documents": len(per_file[proposal_id]),
            "per_file_counts": per_file[proposal_id],
            "representatives": representatives[proposal_id][:5],
            "corpus_fingerprint": fingerprint,
        }
        for proposal_id in forms_by_proposal
    }
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return evidence, False


def corpus_evidence(author_id: str, forms: list[str]) -> tuple[dict[str, Any], bool]:
    evidence, cache_hit = corpus_evidence_batch(author_id, {"single": forms})
    return evidence["single"], cache_hit


def risk_summary(
    source_blocks: list[dict[str, Any]],
    translation_blocks: list[dict[str, Any]],
) -> dict[str, Any]:
    source = "\n".join(block["text"] for block in source_blocks)
    translation = "\n".join(block["text"] for block in translation_blocks)
    number_pattern = re.compile(r"\b\d+(?:[.,—–-]\d+)*\b")
    source_numbers = number_pattern.findall(source)
    translation_numbers = number_pattern.findall(translation)
    source_footnotes = re.findall(r"\[\^([^\]]+)\]|<!--\s*source-page:", source)
    translation_footnotes = re.findall(r"\[\^([^\]]+)\]", translation)
    source_negation = re.findall(r"\b(?:не|нет|ни|нельзя|невозможно)\b", source, re.IGNORECASE)
    translation_negation = re.findall(r"不|没有|并非|不能|无法|未", translation)
    source_modality = re.findall(
        r"\b(?:должен|следует|может|возможно|необходимо)\w*\b", source, re.IGNORECASE
    )
    translation_modality = re.findall(r"必须|应当|应该|可能|可以|能够|必要", translation)
    proper_names = sorted(
        set(re.findall(r"\b[А-ЯЁ][а-яё]+(?:[-\s][А-ЯЁ][а-яё]+){0,2}\b", source))
    )
    return {
        "numbers": {
            "source": source_numbers,
            "translation": translation_numbers,
            "source_only": sorted(set(source_numbers) - set(translation_numbers)),
            "translation_only": sorted(set(translation_numbers) - set(source_numbers)),
        },
        "footnotes": {
            "source_markers": len(source_footnotes),
            "translation_markers": len(translation_footnotes),
        },
        "negation_counts": {"source": len(source_negation), "translation": len(translation_negation)},
        "modality_counts": {"source": len(source_modality), "translation": len(translation_modality)},
        "source_proper_name_candidates": proper_names,
    }


def git_preflight() -> dict[str, Any]:
    branch = run_git(["branch", "--show-current"], check=False).strip()
    upstream = run_git(["rev-parse", "--abbrev-ref", "@{upstream}"], check=False).strip()
    ahead = None
    behind = None
    if upstream:
        counts = run_git(["rev-list", "--left-right", "--count", f"{upstream}...HEAD"], check=False).split()
        if len(counts) == 2:
            behind, ahead = map(int, counts)
    status = run_git(["status", "--short"], check=False).splitlines()
    return {
        "branch": branch,
        "upstream": upstream or None,
        "ahead": ahead,
        "behind": behind,
        "dirty_paths": status,
    }


def run_git(arguments: list[str], check: bool = True) -> str:
    result = subprocess.run(
        ["git", *arguments],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if check and result.returncode:
        raise RuntimeError(f"git {' '.join(arguments)} failed")
    return result.stdout


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def public_input(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if key != "live_path"}
