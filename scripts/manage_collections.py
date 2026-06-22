#!/usr/bin/env python3
"""管理哲学家集合、状态页、GBrain 路径和数字化项目。"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collection_registry import (
    DEFAULT_REGISTRY,
    gbrain_roots,
    load_registry,
    markdown_count,
    metadata_item_count,
    person_map,
    scan_stats,
    validate_registry,
)


ROOT = Path(__file__).resolve().parents[1]
GBRAIN_BEGIN = "    # COLLECTIONS-AUTO:BEGIN"
GBRAIN_END = "    # COLLECTIONS-AUTO:END"
DIGITIZATION_STATES = {"planned", "processing", "human_review", "human_verified"}
TRANSLATION_STAGES = {"planned", "drafts", "reviewed"}


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_scan_entry(root: Path, collection: dict[str, Any], source_rel: str) -> dict[str, Any] | None:
    manifest = collection.get("scan_manifest")
    if not manifest or not (root / manifest).is_file():
        return None
    data = json.loads((root / manifest).read_text(encoding="utf-8"))
    author_root = Path(collection["root"])
    for item in data.get("items", []):
        candidate = (author_root / str(item.get("local_path", ""))).as_posix()
        if candidate == source_rel:
            return item
    return None


def generated_gbrain_block(root: Path) -> str:
    lines = [GBRAIN_BEGIN]
    lines.extend(f"    - {path}" for path in gbrain_roots(root))
    lines.append(GBRAIN_END)
    return "\n".join(lines)


def sync_gbrain(root: Path, *, check: bool = False) -> bool:
    path = root / "gbrain.yml"
    text = path.read_text(encoding="utf-8")
    block = generated_gbrain_block(root)
    pattern = re.compile(re.escape(GBRAIN_BEGIN) + r".*?" + re.escape(GBRAIN_END), re.DOTALL)
    if pattern.search(text):
        updated = pattern.sub(block, text, count=1)
    else:
        match = re.search(r"(?m)^  db_tracked:\s*\n(?:    - .*\n)*", text)
        if not match:
            raise ValueError("gbrain.yml 缺少 storage.db_tracked")
        updated = text[: match.start()] + "  db_tracked:\n" + block + "\n" + text[match.end() :]
    if check:
        return updated == text
    if updated != text:
        path.write_text(updated, encoding="utf-8")
    return True


def manifest_updated_at(path: Path | None) -> str:
    if not path or not path.is_file():
        return "-"
    data = json.loads(path.read_text(encoding="utf-8"))
    return str(data.get("generated_at") or data.get("updated_at") or "-")


def status_markdown(root: Path) -> str:
    data = load_registry(root)
    people = person_map(data)
    lines = [
        "---",
        'title: "哲学家文本收藏状态"',
        'created: "2026-06-21"',
        'type: "project"',
        'tags: ["collections", "status", "corpus"]',
        'language: "zh"',
        'collection: "project-documentation"',
        'llm_wiki_eligible: "true"',
        'gbrain_source: "project-markdown"',
        "---",
        "",
        "# 哲学家文本收藏状态",
        "",
        "本页由 `python3 scripts/manage_collections.py sync` 根据 "
        "[`metadata/collections.json`](metadata/collections.json) 和各集合 manifest 生成。",
        "Markdown 与 Git 是事实来源；扫描件数量不代表已有可检索正文。",
        "",
        "| 人物 | 集合 | 阶段 | 正文 Markdown | 扫描件 | 扫描体积 | 作品记录 | 最近更新 |",
        "|---|---|---|---:|---:|---:|---:|---|",
    ]
    for collection in data.get("collections", []):
        person = people[collection["person_id"]]
        scan_count, scan_bytes = scan_stats(root, collection.get("scan_manifest"))
        work_path = root / collection["works_manifest"] if collection.get("works_manifest") else None
        work_count = metadata_item_count(work_path)
        updated = max(
            (
                manifest_updated_at(root / value)
                for value in (collection.get("works_manifest"), collection.get("scan_manifest"))
                if value
            ),
            default="-",
        )
        readme = collection.get("readme")
        collection_label = (
            f"[{collection['id']}]({readme})" if readme else f"`{collection['id']}`"
        )
        lines.append(
            "| {person} | {collection} | `{stage}` | {markdown} | {scans} | {size} | {works} | {updated} |".format(
                person=person["name_zh"],
                collection=collection_label,
                stage=collection["stage"],
                markdown=markdown_count(root, collection.get("corpus_paths", [])),
                scans=scan_count,
                size=format_bytes(scan_bytes),
                works="-" if work_count is None else work_count,
                updated=updated,
            )
        )
    lines.extend(
        [
            "",
            "## 使用说明",
            "",
            "- `markdown_corpus`：已有可检索正文；实际准入以文件 front matter 为准。",
            "- `markdown_and_scans`：同时具有正文与未处理扫描件。",
            "- `source_scans`：当前以书目和扫描件为主，不能视为已数字化正文。",
            "- 历史布局继续保留原路径；新人物使用统一标准目录。",
            "",
        ]
    )
    return "\n".join(lines)


def format_bytes(value: int) -> str:
    if value <= 0:
        return "-"
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            return f"{value:.1f} {unit}" if isinstance(value, float) else f"{value} {unit}"
        value = value / 1024
    return "-"


def sync_status(root: Path, *, check: bool = False) -> bool:
    path = root / "COLLECTION_STATUS.md"
    expected = status_markdown(root)
    current = path.read_text(encoding="utf-8") if path.is_file() else ""
    if check:
        return current == expected
    if current != expected:
        path.write_text(expected, encoding="utf-8")
    return True


def validate_digitization(root: Path) -> list[str]:
    errors: list[str] = []
    data = load_registry(root)
    for collection in data.get("collections", []):
        digitization = root / collection["root"] / "digitization"
        if not digitization.is_dir():
            continue
        for project_path in sorted(digitization.glob("*/project.json")):
            project_dir = project_path.parent
            project = json.loads(project_path.read_text(encoding="utf-8"))
            state = project.get("status")
            label = project_dir.relative_to(root).as_posix()
            if state not in DIGITIZATION_STATES:
                errors.append(f"{label}: 非法数字化状态")
                continue
            required = {
                "schema_version", "author_id", "work_id", "source_scan", "source_sha256",
                "source_version", "status", "created", "ocr_activated",
            }
            missing = sorted(required - project.keys())
            if missing:
                errors.append(f"{label}: project.json 缺少 {missing}")
                continue
            source = root / project["source_scan"]
            if not source.is_file():
                errors.append(f"{label}: 源扫描件不存在")
            elif sha256(source) != project["source_sha256"]:
                errors.append(f"{label}: 源扫描件 SHA-256 不匹配")
            entry = source_scan_entry(root, collection, project["source_scan"])
            if not entry:
                errors.append(f"{label}: 源扫描件未登记到对应 manifest")
            if state != "planned" and project.get("ocr_activated") is not True:
                errors.append(f"{label}: 进入处理阶段前必须明确激活 OCR")
            stage_files = {
                "processing": ("page_map.json", "ocr_runs.json"),
                "human_review": ("page_map.json", "ocr_runs.json", "ocr_review_log.json", "quality_report.json"),
                "human_verified": (
                    "page_map.json",
                    "ocr_runs.json",
                    "ocr_review_log.json",
                    "quality_report.json",
                    "human_verification_manifest.json",
                ),
            }
            for required_state, files in stage_files.items():
                if state in stage_files and list(stage_files).index(state) >= list(stage_files).index(required_state):
                    for name in files:
                        if not (project_dir / name).is_file():
                            errors.append(f"{label}: {state} 状态缺少 {name}")
            if state in {"processing", "human_review", "human_verified"}:
                runs_path = project_dir / "ocr_runs.json"
                if runs_path.is_file():
                    runs = json.loads(runs_path.read_text(encoding="utf-8")).get("runs", [])
                    engines = {(run.get("engine"), run.get("version")) for run in runs}
                    if len(runs) < 2 or len(engines) < 2:
                        errors.append(f"{label}: OCR 处理必须保留两个独立引擎记录")
            if state == "human_verified":
                verification_path = project_dir / "human_verification_manifest.json"
                if verification_path.is_file():
                    verification = json.loads(verification_path.read_text(encoding="utf-8"))
                    final_path = root / str(verification.get("final_markdown", ""))
                    if verification.get("verification_status") != "human_verified":
                        errors.append(f"{label}: 未记录全书人工确认")
                    if not final_path.is_file():
                        errors.append(f"{label}: 最终 Markdown 不存在")
                    elif sha256(final_path) != verification.get("final_markdown_sha256"):
                        errors.append(f"{label}: 最终 Markdown SHA-256 不匹配")
                    if verification.get("source_scan_sha256") != project.get("source_sha256"):
                        errors.append(f"{label}: 人工确认记录的源扫描件哈希不匹配")
                    page_map_path = project_dir / "page_map.json"
                    if page_map_path.is_file():
                        page_map = json.loads(page_map_path.read_text(encoding="utf-8"))
                        expected_pages = {item["scan_page_id"] for item in page_map.get("pages", [])}
                        verified_pages = set(verification.get("verified_scan_pages", []))
                        if expected_pages != verified_pages:
                            errors.append(f"{label}: 人工确认未覆盖 page_map 全部页面")
                    quality_path = project_dir / "quality_report.json"
                    if quality_path.is_file():
                        quality = json.loads(quality_path.read_text(encoding="utf-8"))
                        if quality.get("status") != "passed" or quality.get("unresolved_issues"):
                            errors.append(f"{label}: 质量报告未通过或仍有未解决问题")
    return errors


def validate_translation_projects(root: Path) -> list[str]:
    errors: list[str] = []
    workspace = root / "translation_workspace"
    required = {
        "schema_version", "author_id", "work_id", "source_path", "source_url",
        "source_version", "source_sha256", "target_language", "status",
    }
    registry = load_registry(root)
    known_people = {person["id"] for person in registry.get("people", [])}
    for stage in TRANSLATION_STAGES:
        base = workspace / stage
        if not base.is_dir():
            continue
        for project_path in sorted(base.glob("*/*/translation.json")):
            data = json.loads(project_path.read_text(encoding="utf-8"))
            missing = sorted(required - data.keys())
            label = project_path.relative_to(root).as_posix()
            if missing:
                errors.append(f"{label}: 缺少 {missing}")
                continue
            if data["status"] != stage:
                errors.append(f"{label}: status 必须与目录阶段 {stage} 一致")
            if known_people and data["author_id"] not in known_people:
                errors.append(f"{label}: author_id 未登记到中央注册表")
            source = root / data["source_path"]
            if not source.is_file():
                errors.append(f"{label}: source_path 不存在")
            elif sha256(source) != data["source_sha256"]:
                errors.append(f"{label}: source_sha256 不匹配")
    return errors


def check(root: Path) -> list[str]:
    errors = validate_registry(root)
    if not sync_gbrain(root, check=True):
        errors.append("gbrain.yml 的 COLLECTIONS-AUTO 区块需要同步")
    if not sync_status(root, check=True):
        errors.append("COLLECTION_STATUS.md 需要同步")
    errors.extend(validate_digitization(root))
    errors.extend(validate_translation_projects(root))
    return errors


def scaffold_person(root: Path, args: argparse.Namespace) -> None:
    registry_path = root / DEFAULT_REGISTRY
    data = load_registry(root)
    if any(person["id"] == args.id for person in data["people"]):
        raise ValueError(f"人物 ID 已存在: {args.id}")
    author_root = root / f"{args.id}_markdown"
    if author_root.exists():
        raise ValueError(f"目录已存在: {author_root}")

    corpus = author_root / f"{args.id}_md"
    for path in (
        corpus,
        author_root / "bibliography",
        author_root / "metadata",
        author_root / "source_scans",
        author_root / "scripts",
    ):
        path.mkdir(parents=True, exist_ok=True)
        (path / ".gitkeep").write_text("", encoding="utf-8")

    (author_root / "README.md").write_text(
        f"# {args.name_zh}哲学文本资料库\n\n"
        "本目录使用项目统一人物集合结构。正文、扫描件、书目和元数据必须分层保存。\n",
        encoding="utf-8",
    )
    write_json(
        author_root / "metadata/works_master.json",
        {"schema_version": 1, "generated_at": args.date, "author": args.name_original, "works": []},
    )
    write_json(
        author_root / "metadata/source_scans_manifest.json",
        {
            "schema_version": 1,
            "generated_at": args.date,
            "policy": "Source scans are stored unprocessed and excluded from core corpus and LLM indexing.",
            "items": [],
        },
    )
    data["people"].append(
        {
            "id": args.id,
            "name_zh": args.name_zh,
            "name_original": args.name_original,
            "name_latin": args.name_latin,
            "relation": args.relation,
        }
    )
    root_name = f"{args.id}_markdown"
    data["collections"].append(
        {
            "id": f"{args.id}-texts",
            "person_id": args.id,
            "kind": "author_texts",
            "root": root_name,
            "layout": "standard",
            "stage": "bibliography",
            "readme": f"{root_name}/README.md",
            "corpus_paths": [f"{root_name}/{args.id}_md/"],
            "scan_paths": [f"{root_name}/source_scans/"],
            "scan_manifest": f"{root_name}/metadata/source_scans_manifest.json",
            "works_manifest": f"{root_name}/metadata/works_master.json",
            "bibliography_paths": [f"{root_name}/bibliography/"],
            "source_survey": f"{root_name}/README.md",
            "gbrain_tracked": True,
            "default_text_role": "author_original",
            "default_language": args.language,
            "collection_name": f"{args.id}-original-language",
        }
    )
    data["generated_at"] = args.date
    write_json(registry_path, data)
    sync_gbrain(root)
    sync_status(root)


def init_digitization(root: Path, args: argparse.Namespace) -> None:
    data = load_registry(root)
    collection = next(
        (
            item for item in data["collections"]
            if item["person_id"] == args.author_id
            and args.source_scan.startswith(item["root"].rstrip("/") + "/")
            and source_scan_entry(root, item, args.source_scan)
        ),
        None,
    )
    if not collection:
        raise ValueError("源扫描件未登记到该人物的集合 manifest")
    source = root / args.source_scan
    if not source.is_file():
        raise ValueError(f"扫描件不存在: {args.source_scan}")
    project_dir = root / collection["root"] / "digitization" / args.work_id
    if project_dir.exists():
        raise ValueError(f"数字化项目已存在: {project_dir}")
    project_dir.mkdir(parents=True)
    write_json(
        project_dir / "project.json",
        {
            "schema_version": 1,
            "author_id": args.author_id,
            "work_id": args.work_id,
            "source_scan": args.source_scan,
            "source_sha256": sha256(source),
            "source_version": args.source_version,
            "status": "planned",
            "created": args.date,
            "ocr_activated": False,
        },
    )


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    sub.add_parser("sync")

    add = sub.add_parser("add-person")
    add.add_argument("--id", required=True)
    add.add_argument("--name-zh", required=True)
    add.add_argument("--name-original", required=True)
    add.add_argument("--name-latin", required=True)
    add.add_argument("--relation", required=True)
    add.add_argument("--language", default="ru")
    add.add_argument("--date", default="2026-06-21")

    digitize = sub.add_parser("init-digitization")
    digitize.add_argument("--author-id", required=True)
    digitize.add_argument("--work-id", required=True)
    digitize.add_argument("--source-scan", required=True)
    digitize.add_argument("--source-version", required=True)
    digitize.add_argument("--date", default="2026-06-21")
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        if args.command == "check":
            errors = check(ROOT)
            if errors:
                print("\n".join(f"error: {error}" for error in errors), file=sys.stderr)
                return 1
            print("collections registry, status, GBrain, digitization and translation projects: OK")
        elif args.command == "sync":
            sync_gbrain(ROOT)
            sync_status(ROOT)
            print("gbrain.yml and COLLECTION_STATUS.md synchronized")
        elif args.command == "add-person":
            scaffold_person(ROOT, args)
            print(f"created person collection: {args.id}")
        elif args.command == "init-digitization":
            init_digitization(ROOT, args)
            print(f"initialized digitization project: {args.author_id}/{args.work_id}")
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
