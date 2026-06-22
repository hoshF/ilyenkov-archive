#!/usr/bin/env python3
"""Build a public export tree with metadata-based redistribution gates."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_gbrain_markdown import is_corpus_markdown, parse_front_matter
from collection_registry import corpus_asset_paths, load_registry, scan_manifest_paths
from rights_registry import approved_rights_entries, content_bearing_metadata_paths


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "dist" / "public"
SKIP_PARTS = {
    ".git", ".obsidian", ".codex", ".fulltext", "node_modules", "__pycache__",
    "cache", "digitization", "dist",
}
CONTROLLED_BINARY_SUFFIXES = {".pdf", ".djvu", ".djv", ".epub"}
CONTROLLED_TEXT_SUFFIXES = {".tex", ".txt", ".html", ".htm", ".xhtml", ".fb2", ".rtf"}
CONTROLLED_ASSET_SUFFIXES = {
    ".avif", ".bmp", ".gif", ".heic", ".jpeg", ".jpg", ".png", ".svg", ".tif", ".tiff", ".webp",
    ".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav",
    ".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm",
}
REPOSITORY_METADATA_NAMES = {".DS_Store", "Thumbs.db"}
LOCAL_CONFIGURATION_DIRS = {".claude", ".codex", ".cursor", ".idea", ".obsidian", ".vscode"}
LOCAL_CONFIGURATION_NAMES = {".envrc", ".mcp.json", "settings.local.json"}
def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_scan_approvals(root: Path) -> dict[str, bool]:
    approvals: dict[str, bool] = {}
    threshold = int(load_registry(root).get("project", {}).get(
        "large_binary_threshold_bytes", 75 * 1024 * 1024
    ))
    required = {
        "title", "author", "publication_year", "source_url", "download_date",
        "pages", "bytes", "sha256", "source_format", "source_license",
        "redistribution_approved", "rights_review_status", "text_status", "local_path",
    }
    for manifest_path in scan_manifest_paths(root):
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        author_root = manifest_path.parents[1]
        for item in data.get("items", []):
            missing = sorted(required - item.keys())
            if missing:
                raise ValueError(f"{manifest_path}: source scan entry missing {missing}")
            local_path = item.get("local_path")
            file_path = author_root / local_path
            if not file_path.is_file():
                raise ValueError(f"{manifest_path}: missing source scan {local_path}")
            if file_path.stat().st_size != int(item["bytes"]):
                raise ValueError(f"{manifest_path}: byte count mismatch for {local_path}")
            if sha256(file_path) != str(item["sha256"]):
                raise ValueError(f"{manifest_path}: SHA-256 mismatch for {local_path}")
            if file_path.stat().st_size > threshold:
                review = item.get("large_file_review", {})
                if review.get("reviewed") is not True:
                    raise ValueError(f"{manifest_path}: large file requires explicit review: {local_path}")
                if not review.get("reason") or not review.get("storage_decision"):
                    raise ValueError(f"{manifest_path}: incomplete large file review: {local_path}")
            expected_suffix = "." + str(item["source_format"]).lower()
            if file_path.suffix.lower() != expected_suffix:
                raise ValueError(f"{manifest_path}: source format mismatch for {local_path}")
            if item.get("text_status") != "source_scan_unprocessed":
                raise ValueError(f"{manifest_path}: invalid text_status for {local_path}")
            if str(item.get("core_corpus_eligible", "false")).lower() != "false":
                raise ValueError(f"{manifest_path}: source scan cannot enter core corpus: {local_path}")
            if str(item.get("llm_wiki_eligible", "false")).lower() != "false":
                raise ValueError(f"{manifest_path}: source scan cannot enter GBrain: {local_path}")
            rel_path = file_path.relative_to(root).as_posix()
            approvals[rel_path] = str(item.get("redistribution_approved", "false")).lower() == "true"
    return approvals


def markdown_approval(
    path: Path,
    root: Path,
    rights: dict[str, dict],
) -> tuple[bool, str] | None:
    text = path.read_text(encoding="utf-8")
    metadata = parse_front_matter(text)
    controlled = is_corpus_markdown(path, root) or "text_role" in metadata
    if not controlled:
        return None
    rel = path.relative_to(root).as_posix()
    review = rights.get(rel)
    if review is None:
        return False, "rights_review_not_approved"
    if review["content_category"] not in {"source_text", "translation"}:
        raise ValueError(f"{rel}: Markdown rights entry has incompatible content_category")
    if metadata.get("rights_review_id") != review["id"]:
        raise ValueError(f"{rel}: rights_review_id does not match rights registry")
    if metadata.get("redistribution_approved") != "true":
        raise ValueError(f"{rel}: approved rights entry requires redistribution_approved=true")
    if metadata.get("rights_review_status") != "reviewed":
        raise ValueError(f"{rel}: approved rights entry requires rights_review_status=reviewed")
    return True, "rights_registry_approved"


def is_local_configuration(rel_parts: tuple[str, ...]) -> bool:
    name = rel_parts[-1]
    if LOCAL_CONFIGURATION_DIRS.intersection(rel_parts[:-1]):
        return True
    return name in LOCAL_CONFIGURATION_NAMES or name == ".env" or name.startswith(".env.")


def export_decision(
    path: Path,
    root: Path,
    scan_approvals: dict[str, bool],
    rights: dict[str, dict],
    content_metadata: set[str],
) -> tuple[bool, str]:
    rel = path.relative_to(root).as_posix()
    if path.name in REPOSITORY_METADATA_NAMES:
        return False, "repository_metadata"
    if is_local_configuration(path.relative_to(root).parts):
        return False, "local_configuration"
    if rel in content_metadata:
        approved = rel in rights
        if approved and rights[rel]["content_category"] != "content_bearing_metadata":
            raise ValueError(f"{rel}: content-bearing metadata requires matching rights category")
        return approved, "rights_registry_approved" if approved else "content_metadata_not_approved"
    if path.suffix.lower() == ".md":
        approval = markdown_approval(path, root, rights)
        if approval is not None:
            return approval
        if rel.startswith(corpus_asset_paths(root)):
            return False, "corpus_markdown_without_redistribution_approval"
    if "source_scans" in path.relative_to(root).parts:
        approved = scan_approvals.get(rel, False) and rel in rights
        if approved and rights[rel]["content_category"] != "scan":
            raise ValueError(f"{rel}: source scan requires content_category=scan")
        return approved, "scan_rights_approved" if approved else "source_scan_not_approved"
    if path.suffix.lower() in CONTROLLED_BINARY_SUFFIXES:
        approved = rel in rights
        return approved, "rights_registry_approved" if approved else "binary_without_rights_review"
    if rel.startswith(corpus_asset_paths(root)) and path.suffix.lower() != ".md":
        approved = rel in rights
        return approved, "rights_registry_approved" if approved else "corpus_asset_without_rights_review"
    if path.suffix.lower() in CONTROLLED_TEXT_SUFFIXES:
        approved = rel in rights
        return approved, "rights_registry_approved" if approved else "text_without_rights_review"
    if path.suffix.lower() in CONTROLLED_ASSET_SUFFIXES:
        approved = rel in rights
        if approved and rights[rel]["content_category"] not in {"media", "scan"}:
            raise ValueError(f"{rel}: media asset has incompatible content_category")
        return approved, "rights_registry_approved" if approved else "asset_without_rights_review"
    return True, "project_file"


def source_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and not path.is_symlink()
        and not SKIP_PARTS.intersection(path.relative_to(root).parts)
    )


def build_export(root: Path, output: Path, *, write: bool = True) -> dict:
    scan_approvals = source_scan_approvals(root)
    rights = approved_rights_entries(root)
    content_metadata = content_bearing_metadata_paths(root)
    records: list[dict[str, object]] = []
    staging = output.parent / f".{output.name}-build"
    if write:
        if staging.exists():
            shutil.rmtree(staging)
        staging.mkdir(parents=True)

    for path in source_files(root):
        approved, reason = export_decision(path, root, scan_approvals, rights, content_metadata)
        rel = path.relative_to(root)
        record = {
            "path": rel.as_posix(),
            "included": approved,
            "reason": reason,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        records.append(record)
        if approved and write:
            target = staging / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)

    audit = {
        "schema_version": 2,
        "policy": "Project infrastructure, original documentation, and factual metadata are public by default. Source texts, translations, scans, media, and content-bearing metadata require approval in metadata/rights_registry.json for the exact path and SHA-256. Scans additionally require approval in their source manifest.",
        "audit_convention": "PUBLIC_EXPORT_AUDIT.json is generated together with the export and does not list itself; the export tree and the public git tree must equal the included paths plus this audit file.",
        "included": sum(1 for item in records if item["included"]),
        "excluded": sum(1 for item in records if not item["included"]),
        "files": records,
    }
    if write:
        (staging / "PUBLIC_EXPORT_AUDIT.json").write_text(
            json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        output.mkdir(parents=True, exist_ok=True)
        git_pointer = output / ".git"
        if git_pointer.exists() and not git_pointer.is_file():
            raise ValueError(f"public worktree .git must be a separate-git-dir pointer file: {git_pointer}")
        for child in output.iterdir():
            if child.name == ".git":
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        for child in staging.iterdir():
            target = output / child.name
            if child.is_dir():
                shutil.copytree(child, target)
            else:
                shutil.copy2(child, target)
        shutil.rmtree(staging)
        verify_export_tree(audit, root, output)
    return audit


def verify_export_tree(audit: dict, root: Path, output: Path) -> None:
    expected = {
        item["path"]: item["sha256"]
        for item in audit["files"]
        if item["included"]
    }
    actual = {
        path.relative_to(output).as_posix(): sha256(path)
        for path in output.rglob("*")
        if path.is_file() and path.name != ".git"
    }
    audit_path = output / "PUBLIC_EXPORT_AUDIT.json"
    if not audit_path.is_file():
        raise ValueError("public export audit is missing")
    actual.pop("PUBLIC_EXPORT_AUDIT.json", None)
    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))
        unexpected = sorted(set(actual) - set(expected))
        raise ValueError(f"public export tree mismatch: missing={missing} unexpected={unexpected}")
    mismatched = sorted(path for path, digest in expected.items() if actual[path] != digest)
    if mismatched:
        raise ValueError(f"public export SHA-256 mismatch: {mismatched}")
    forbidden = [
        path for path in actual
        if "/digitization/" in f"/{path}"
        or path.endswith(".snapshot")
        or path.startswith(".fulltext/")
        or is_local_configuration(tuple(path.split("/")))
    ]
    if forbidden:
        raise ValueError(f"forbidden source material in public export: {forbidden}")
    verify_git_publishability(output, sorted(set(actual) | {"PUBLIC_EXPORT_AUDIT.json"}))
    approved_paths = set(approved_rights_entries(root))
    if not approved_paths.issubset(actual):
        raise ValueError(f"rights-approved files missing from public export: {sorted(approved_paths - set(actual))}")


def verify_git_publishability(output: Path, tree_paths: list[str]) -> None:
    """Reject export files that any gitignore (project, local, or machine-global)
    would silently drop from the publish step's `git add -A`."""
    if not (output / ".git").exists():
        return
    probe = subprocess.run(
        ["git", "-C", str(output), "rev-parse", "--git-dir"],
        capture_output=True, text=True,
    )
    if probe.returncode != 0:
        return
    result = subprocess.run(
        ["git", "-C", str(output), "check-ignore", "--stdin"],
        input="".join(f"{path}\n" for path in tree_paths),
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        ignored = sorted(filter(None, result.stdout.splitlines()))
        raise ValueError(f"public export files are git-ignored and would be dropped from publishing: {ignored}")
    if result.returncode != 1:
        raise ValueError(f"git check-ignore failed: {result.stderr.strip()}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Evaluate rules without writing the export tree")
    parser.add_argument("--verify", action="store_true", help="Verify an existing export tree against current policy")
    args = parser.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents and output.relative_to(ROOT).parts[:2] != ("dist", "public"):
        raise SystemExit("Refusing to replace a repository path outside dist/public")
    if args.verify:
        audit_path = output / "PUBLIC_EXPORT_AUDIT.json"
        audit = json.loads(audit_path.read_text(encoding="utf-8"))
        verify_export_tree(audit, ROOT, output)
        print(f"verified={audit['included']} output={output}")
        return 0
    audit = build_export(ROOT, output, write=not args.check)
    print(f"included={audit['included']} excluded={audit['excluded']} output={output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
