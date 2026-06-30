#!/usr/bin/env python3
"""Split registered long Markdown works at real headings with lossless reconstruction."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "metadata/longform_split_registry.json"
DEFAULT_MAX_BYTES = 500_000
IGNORED_BOUNDARY_TITLES = (
    "содержание",
    "contents",
    "примечания",
    "adnotationes",
    "notes",
)


@dataclass(frozen=True)
class Heading:
    offset: int
    level: int
    title: str


@dataclass(frozen=True)
class Segment:
    start: int
    end: int
    title: str


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_registry(root: Path = ROOT) -> tuple[int, list[dict[str, object]]]:
    data = json.loads((root / "metadata/longform_split_registry.json").read_text(encoding="utf-8"))
    return int(data.get("max_chapter_bytes", DEFAULT_MAX_BYTES)), list(data.get("works", []))


def registry_map(root: Path = ROOT) -> dict[str, dict[str, object]]:
    _, works = load_registry(root)
    return {str(item["source_path"]): item for item in works}


def relative_source(path: Path, root: Path = ROOT) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def registered_spec(path: Path, root: Path = ROOT) -> dict[str, object] | None:
    return registry_map(root).get(relative_source(path, root))


def output_dir_for(source_path: Path) -> Path:
    return source_path.with_suffix("")


def manifest_path_for(source_path: Path) -> Path:
    return output_dir_for(source_path) / "work_manifest.json"


def snapshot_path_for(source_path: Path) -> Path:
    return output_dir_for(source_path) / "source" / f"{source_path.stem}.md.snapshot"


def split_front_matter(data: bytes) -> tuple[bytes, bytes]:
    match = re.match(rb"\A---\r?\n.*?\r?\n---\r?\n", data, flags=re.DOTALL)
    if not match:
        raise ValueError("registered longform Markdown requires valid front matter")
    return data[: match.end()], data[match.end() :]


def parse_simple_front_matter(prefix: bytes) -> dict[str, str]:
    text = prefix.decode("utf-8")
    result: dict[str, str] = {}
    for line in text.splitlines()[1:-1]:
        match = re.match(r"^([A-Za-z0-9_]+):\s*(.*?)\s*$", line)
        if not match:
            continue
        value = match.group(2)
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        result[match.group(1)] = value
    return result


def normalize_heading_title(title: str) -> str:
    title = re.sub(r"\s+#+\s*$", "", title).strip()
    return re.sub(r"\s+", " ", title)


def ignored_boundary(title: str) -> bool:
    normalized = normalize_heading_title(title).casefold().rstrip(".:")
    return any(normalized == value or normalized.startswith(value + " ") for value in IGNORED_BOUNDARY_TITLES)


def headings(body: bytes) -> list[Heading]:
    text = body.decode("utf-8")
    result: list[Heading] = []
    offset = 0
    in_fence = False
    for line in text.splitlines(keepends=True):
        stripped = line.rstrip("\r\n")
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
        if not in_fence:
            match = re.match(r"^(#{1,6})[ \t]+(.+?)\s*$", stripped)
            if match:
                result.append(Heading(offset, len(match.group(1)), normalize_heading_title(match.group(2))))
        offset += len(line.encode("utf-8"))
    return result


def boundary_headings(all_headings: list[Heading], level: int, start: int, end: int) -> list[Heading]:
    return [
        heading for heading in all_headings
        if heading.level == level and start <= heading.offset < end and not ignored_boundary(heading.title)
    ]


def top_level_segments(body: bytes, all_headings: list[Heading], level: int) -> list[Segment]:
    boundaries = boundary_headings(all_headings, level, 0, len(body))
    if not boundaries:
        raise ValueError(f"no usable H{level} boundaries")
    result: list[Segment] = []
    if boundaries[0].offset > 0:
        result.append(Segment(0, boundaries[0].offset, "Front matter and contents"))
    for index, heading in enumerate(boundaries):
        end = boundaries[index + 1].offset if index + 1 < len(boundaries) else len(body)
        result.append(Segment(heading.offset, end, heading.title))
    return result


def split_parent_at_leaf(parent: Segment, all_headings: list[Heading], leaf_level: int) -> list[Segment]:
    leaves = boundary_headings(all_headings, leaf_level, parent.start, parent.end)
    if not leaves:
        return [parent]
    starts = [parent.start] + [heading.offset for heading in leaves[1:]]
    titles = [f"{parent.title} — {leaves[0].title}"] + [heading.title for heading in leaves[1:]]
    return [
        Segment(start, starts[index + 1] if index + 1 < len(starts) else parent.end, titles[index])
        for index, start in enumerate(starts)
    ]


def chapter_front_matter(original_prefix: bytes, work_id: str, index: int, title: str) -> bytes:
    lines = original_prefix.decode("utf-8").splitlines()
    fields = {
        "id": f"{work_id}-ch{index:03d}",
        "work_id": work_id,
        "chapter_index": f"{index:03d}",
        "chapter_title": title,
    }
    positions: dict[str, int] = {}
    for line_index, line in enumerate(lines):
        match = re.match(r"^([A-Za-z0-9_]+):", line)
        if match:
            positions[match.group(1)] = line_index
    closing = len(lines) - 1
    for key, value in fields.items():
        rendered = f"{key}: {json.dumps(value, ensure_ascii=False)}"
        if key in positions:
            lines[positions[key]] = rendered
        else:
            lines.insert(closing, rendered)
            closing += 1
    return ("\n".join(lines) + "\n").encode("utf-8")


def expand_oversized(
    segments: list[Segment], body: bytes, all_headings: list[Heading], levels: list[int],
    original_prefix: bytes, work_id: str, max_bytes: int,
) -> list[Segment]:
    current = segments
    for level in levels[1:]:
        expanded: list[Segment] = []
        changed = False
        for segment in current:
            projected = len(chapter_front_matter(original_prefix, work_id, 0, segment.title)) + segment.end - segment.start
            if projected < max_bytes:
                expanded.append(segment)
                continue
            nested = split_parent_at_leaf(segment, all_headings, level)
            if len(nested) == 1:
                expanded.append(segment)
            else:
                expanded.extend(nested)
                changed = True
        current = expanded
        if not changed and all(
            len(chapter_front_matter(original_prefix, work_id, 0, item.title)) + item.end - item.start < max_bytes
            for item in current
        ):
            break
    return current


def planned_segments(data: bytes, spec: dict[str, object], max_bytes: int) -> tuple[bytes, bytes, list[Segment]]:
    original_prefix, body = split_front_matter(data)
    all_headings = headings(body)
    levels = [int(value) for value in spec["levels"]]
    segments = top_level_segments(body, all_headings, levels[0])
    mode = str(spec.get("mode", "level"))
    if mode == "leaf" and len(levels) > 1:
        first = segments[:1] if segments and segments[0].start == 0 and segments[0].title == "Front matter and contents" else []
        parents = segments[len(first) :]
        segments = first + [child for parent in parents for child in split_parent_at_leaf(parent, all_headings, levels[-1])]
    elif mode == "oversized_recursive":
        work_id = str(spec.get("work_id") or Path(str(spec["source_path"])).stem)
        segments = expand_oversized(segments, body, all_headings, levels, original_prefix, work_id, max_bytes)
    elif mode != "level":
        raise ValueError(f"unsupported split mode: {mode}")
    return original_prefix, body, segments


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        handle.write(data)
        temporary = Path(handle.name)
    temporary.replace(path)


def render_readme(metadata: dict[str, str], work_id: str, chapter_records: list[dict[str, object]]) -> bytes:
    title = metadata.get("title", work_id)
    lines = [
        "---",
        f"title: {json.dumps(title, ensure_ascii=False)}",
        'created: "2026-06-11"',
        'type: "source-index"',
        'tags: ["longform", "chapter-index"]',
        f"language: {json.dumps(metadata.get('language', 'not_stated'), ensure_ascii=False)}",
        'collection: "longform-work-index"',
        'llm_wiki_eligible: "true"',
        "---",
        "",
        f"# {title}",
        "",
        "This work is stored as losslessly reconstructable chapter files. See `work_manifest.json` for source and hash data.",
        "",
    ]
    for record in chapter_records:
        lines.append(f"- [{record['chapter_title']}]({record['file']})")
    return ("\n".join(lines) + "\n").encode("utf-8")


def split_bytes(
    data: bytes, source_path: Path, spec: dict[str, object], *, root: Path = ROOT, max_bytes: int | None = None,
) -> Path:
    registry_max, _ = load_registry(root)
    limit = max_bytes or registry_max
    work_id = str(spec.get("work_id") or source_path.stem)
    original_prefix, body, segments = planned_segments(data, spec, limit)
    output_dir = output_dir_for(source_path)
    temporary_dir = output_dir.with_name(output_dir.name + ".split-tmp")
    if temporary_dir.exists():
        shutil.rmtree(temporary_dir)
    temporary_dir.mkdir(parents=True)
    snapshot = temporary_dir / "source" / f"{source_path.stem}.md.snapshot"
    atomic_write(snapshot, data)
    metadata = parse_simple_front_matter(original_prefix)
    chapter_records: list[dict[str, object]] = []
    for index, segment in enumerate(segments):
        payload = body[segment.start : segment.end]
        prefix = chapter_front_matter(original_prefix, work_id, index, segment.title)
        chapter_data = prefix + payload
        if len(chapter_data) >= limit:
            raise ValueError(
                f"{source_path}: chapter {index:03d} remains {len(chapter_data)} bytes; no approved heading boundary can split it"
            )
        filename = f"{work_id}-ch{index:03d}.md"
        chapter_path = temporary_dir / filename
        atomic_write(chapter_path, chapter_data)
        chapter_records.append({
            "chapter_index": f"{index:03d}",
            "chapter_title": segment.title,
            "file": filename,
            "start_byte": segment.start,
            "end_byte": segment.end,
            "payload_bytes": len(payload),
            "payload_sha256": sha256_bytes(payload),
            "file_bytes": len(chapter_data),
            "file_sha256": sha256_bytes(chapter_data),
        })
    manifest = {
        "schema_version": 1,
        "work_id": work_id,
        "source_path": relative_source(source_path, root),
        "source_snapshot": f"source/{source_path.stem}.md.snapshot",
        "original_bytes": len(data),
        "original_sha256": sha256_bytes(data),
        "original_front_matter": original_prefix.decode("utf-8"),
        "body_bytes": len(body),
        "split_mode": spec.get("mode", "level"),
        "heading_levels": spec["levels"],
        "max_chapter_bytes": limit,
        "chapters": chapter_records,
    }
    atomic_write(temporary_dir / "work_manifest.json", (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    atomic_write(temporary_dir / "README.md", render_readme(metadata, work_id, chapter_records))
    if output_dir.exists():
        shutil.rmtree(output_dir)
    temporary_dir.replace(output_dir)
    if source_path.exists():
        source_path.unlink()
    verify_work(source_path, root=root)
    return output_dir / "work_manifest.json"


def reconstruct(source_path: Path) -> bytes:
    manifest = json.loads(manifest_path_for(source_path).read_text(encoding="utf-8"))
    output_dir = output_dir_for(source_path)
    payloads: list[bytes] = []
    for chapter in manifest["chapters"]:
        chapter_data = (output_dir / chapter["file"]).read_bytes()
        _, payload = split_front_matter(chapter_data)
        if sha256_bytes(payload) != chapter["payload_sha256"]:
            raise ValueError(f"payload SHA-256 mismatch: {chapter['file']}")
        payloads.append(payload)
    return manifest["original_front_matter"].encode("utf-8") + b"".join(payloads)


def verify_work(source_path: Path, *, root: Path = ROOT) -> dict[str, object]:
    manifest_path = manifest_path_for(source_path)
    if not manifest_path.is_file():
        raise ValueError(f"missing work manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    snapshot = output_dir_for(source_path) / manifest["source_snapshot"]
    reconstructed = reconstruct(source_path)
    if reconstructed != snapshot.read_bytes():
        raise ValueError(f"lossless reconstruction failed: {source_path}")
    if sha256_bytes(reconstructed) != manifest["original_sha256"]:
        raise ValueError(f"original SHA-256 mismatch: {source_path}")
    for chapter in manifest["chapters"]:
        chapter_path = output_dir_for(source_path) / chapter["file"]
        if chapter_path.stat().st_size >= int(manifest["max_chapter_bytes"]):
            raise ValueError(f"oversized chapter: {chapter_path}")
        if sha256_file(chapter_path) != chapter["file_sha256"]:
            raise ValueError(f"chapter SHA-256 mismatch: {chapter_path}")
    return manifest


FULLTEXT_DIRNAME = ".fulltext"


def fulltext_path_for(source_path: Path, root: Path = ROOT) -> Path:
    """Mirror the original source path under a dot-directory GBrain never walks."""
    return root / FULLTEXT_DIRNAME / relative_source(source_path, root)


def materialize_fulltext(source_path: Path, *, root: Path = ROOT) -> Path:
    """Write the full reconstructed work to .fulltext/, byte-identical to its snapshot."""
    manifest = verify_work(source_path, root=root)
    data = reconstruct(source_path)
    if sha256_bytes(data) != manifest["original_sha256"]:
        raise ValueError(f"full-text reconstruction hash mismatch: {source_path}")
    target = fulltext_path_for(source_path, root)
    atomic_write(target, data)
    return target


def check_fulltext(source_path: Path, *, root: Path = ROOT) -> None:
    """Fail if the committed full-text copy is missing or out of sync with the chapters."""
    manifest = json.loads(manifest_path_for(source_path).read_text(encoding="utf-8"))
    target = fulltext_path_for(source_path, root)
    if not target.is_file():
        raise ValueError(f"missing full-text reconstruction (run --materialize): {target}")
    data = target.read_bytes()
    if sha256_bytes(data) != manifest["original_sha256"]:
        raise ValueError(f"full-text reconstruction is stale (run --materialize): {target}")
    if data != reconstruct(source_path):
        raise ValueError(f"full-text reconstruction does not match chapters: {target}")


def materialized_output_exists(source_path: Path, *, root: Path = ROOT) -> bool:
    return manifest_path_for(source_path).is_file() if registered_spec(source_path, root) else source_path.is_file()


def materialized_output_hash(source_path: Path, *, root: Path = ROOT) -> str | None:
    if registered_spec(source_path, root):
        manifest_path = manifest_path_for(source_path)
        if not manifest_path.is_file():
            return None
        return str(json.loads(manifest_path.read_text(encoding="utf-8"))["original_sha256"])
    return sha256_file(source_path) if source_path.is_file() else None


def read_materialized_text(source_path: Path, *, root: Path = ROOT) -> str:
    if registered_spec(source_path, root):
        return reconstruct(source_path).decode("utf-8")
    return source_path.read_text(encoding="utf-8")


def materialized_output_bytes(source_path: Path, *, root: Path = ROOT) -> int:
    if registered_spec(source_path, root):
        return int(json.loads(manifest_path_for(source_path).read_text(encoding="utf-8"))["original_bytes"])
    return source_path.stat().st_size


def write_or_split(source_path: Path, text: str, *, root: Path = ROOT) -> Path:
    spec = registered_spec(source_path, root)
    if spec:
        return split_bytes(text.encode("utf-8"), source_path, spec, root=root)
    atomic_write(source_path, text.encode("utf-8"))
    return source_path


def check_generated_text(source_path: Path, text: str, *, root: Path = ROOT) -> None:
    spec = registered_spec(source_path, root)
    if not spec:
        if source_path.read_text(encoding="utf-8") != text:
            raise ValueError(f"generated Markdown differs: {source_path}")
        return
    manifest = verify_work(source_path, root=root)
    if sha256_bytes(text.encode("utf-8")) != manifest["original_sha256"]:
        raise ValueError(f"generated Markdown differs from split snapshot: {source_path}")


def refresh_metadata_references(*, root: Path = ROOT) -> int:
    _, works = load_registry(root)
    changed_files = 0
    metadata_roots = [
        root / "ilyenkov_markdown" / "metadata",
        root / "maidansky_markdown" / "metadata",
        root / "kedrov_markdown" / "metadata",
        root / "spinoza_markdown" / "metadata",
    ]
    references: list[dict[str, object]] = []
    for spec in works:
        source_path = root / str(spec["source_path"])
        manifest_path = manifest_path_for(source_path)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        project_root = root / Path(str(spec["source_path"])).parts[0]
        source_relative = source_path.relative_to(project_root).as_posix()
        aliases = {source_relative, str(spec["source_path"])}
        if "/already-done/" in source_relative:
            aliases.add(f"outputs/{source_path.name}")
        references.append({
            "aliases": aliases,
            "source_relative": source_relative,
            "manifest_relative": manifest_path.relative_to(project_root).as_posix(),
            "chapter_files": [
                (manifest_path.parent / chapter["file"]).relative_to(project_root).as_posix()
                for chapter in manifest["chapters"]
            ],
        })

    def update_record(value: object) -> bool:
        changed = False
        if isinstance(value, list):
            for item in value:
                changed = update_record(item) or changed
            return changed
        if not isinstance(value, dict):
            return False
        for child in value.values():
            changed = update_record(child) or changed
        for reference in references:
            aliases = reference["aliases"]
            matched_key = next(
                (
                    key for key in ("output_path", "output_file", "preferred_markdown")
                    if value.get(key) in aliases
                ),
                None,
            )
            manifest_matches = value.get("work_manifest") == reference["manifest_relative"] or value.get(
                "preferred_work_manifest"
            ) == reference["manifest_relative"]
            if not matched_key and not manifest_matches:
                continue
            if matched_key and value[matched_key] != reference["source_relative"] and matched_key != "preferred_markdown":
                value[matched_key] = reference["source_relative"]
                changed = True
            manifest_key = "preferred_work_manifest" if matched_key == "preferred_markdown" or "preferred_work_manifest" in value else "work_manifest"
            if value.get(manifest_key) != reference["manifest_relative"]:
                value[manifest_key] = reference["manifest_relative"]
                changed = True
            if matched_key == "preferred_markdown" and value.get("preferred_markdown") != "":
                value["preferred_markdown"] = ""
                changed = True
            chapter_files = reference["chapter_files"]
            if value.get("chapter_count") != len(chapter_files):
                value["chapter_count"] = len(chapter_files)
                changed = True
            if value.get("chapter_files") != chapter_files:
                value["chapter_files"] = chapter_files
                changed = True
            break
        return changed

    for metadata_root in metadata_roots:
        for path in sorted(metadata_root.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            if update_record(data):
                atomic_write(path, (json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"))
                changed_files += 1
    return changed_files


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Split every registered source that still exists")
    parser.add_argument("--check", action="store_true", help="Verify every registered work, reconstruction, and full-text copy")
    parser.add_argument("--materialize", action="store_true", help="Write/refresh full-text reconstructions under .fulltext/")
    parser.add_argument("--path", type=Path, help="Split or check one registered source path")
    parser.add_argument("--refresh-metadata", action="store_true", help="Update JSON source/state references to split works")
    args = parser.parse_args()
    _, works = load_registry()
    selected = works
    if args.path:
        rel = relative_source(args.path if args.path.is_absolute() else ROOT / args.path)
        selected = [item for item in works if item["source_path"] == rel]
        if not selected:
            raise SystemExit(f"not registered: {rel}")
    if not args.all and not args.check and not args.path and not args.refresh_metadata and not args.materialize:
        parser.error("choose --all, --check, --materialize, --refresh-metadata, or --path")
    if args.refresh_metadata:
        print(f"metadata_files_refreshed={refresh_metadata_references()}")
        if not args.all and not args.check and not args.path and not args.materialize:
            return 0
    verified = 0
    split = 0
    materialized = 0
    for spec in selected:
        source_path = ROOT / str(spec["source_path"])
        if args.materialize:
            materialize_fulltext(source_path)
            materialized += 1
        elif args.check:
            verify_work(source_path)
            check_fulltext(source_path)
            verified += 1
        elif source_path.is_file():
            split_bytes(source_path.read_bytes(), source_path, spec)
            materialize_fulltext(source_path)
            split += 1
            materialized += 1
        else:
            verify_work(source_path)
            check_fulltext(source_path)
            verified += 1
    print(f"longform_split={split} longform_verified={verified} longform_materialized={materialized} registered={len(selected)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
