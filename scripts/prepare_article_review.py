#!/usr/bin/env python3
"""Prepare an ignored work package for a full article translation review."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from terminology_review_lib import (
    ALREADY_REVIEWED_EXIT,
    IDENTITY_CONFLICT_EXIT,
    ROOT,
    REVISION_REQUIRED_EXIT,
    WORK_DIR,
    duplicate_preflight,
    content_blocks,
    corpus_evidence_batch,
    front_matter_metadata,
    git_preflight,
    glossary_matches,
    heuristic_forms,
    input_record,
    occurrences_for_forms,
    parse_suggestions,
    next_batch_id,
    registered_glossaries,
    related_people,
    resolve_source_author,
    risk_summary,
    source_work_identity,
    structural_alignment,
    write_json,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--translation", type=Path, required=True)
    parser.add_argument("--suggestions", type=Path, required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--author-id")
    parser.add_argument("--work-id")
    parser.add_argument(
        "--revision-of",
        help="Existing batch id or blog:<slug> explicitly approved for revision",
    )
    parser.add_argument(
        "--form-review",
        type=Path,
        help="JSON file confirming or rejecting every heuristic inflected form",
    )
    parser.add_argument(
        "--review-only",
        action="store_true",
        help="Prepare evidence even when the branch has pre-existing unpushed commits",
    )
    args = parser.parse_args()

    for path in (args.source, args.translation, args.suggestions):
        if not path.is_file():
            raise SystemExit(f"missing readable input: {path}")

    preflight = git_preflight()
    author_id, author = resolve_source_author(args.source, args.author_id)
    work_id = args.work_id or front_matter_metadata(args.source).get("work_id") or args.source.stem
    inputs = [
        input_record("source", args.source),
        input_record("translation", args.translation),
        input_record("suggestions", args.suggestions),
    ]
    identity = source_work_identity(
        args.source,
        author_id=author_id,
        work_id=work_id,
        article_slug=args.slug,
        source_record=inputs[0],
    )
    identity_result = duplicate_preflight(
        identity=identity,
        inputs=inputs,
        revision_of=args.revision_of,
    )
    print_identity_preflight(identity_result)
    if identity_result["status"] == "already_reviewed":
        return ALREADY_REVIEWED_EXIT
    if identity_result["status"] == "revision_required":
        return REVISION_REQUIRED_EXIT
    if identity_result["status"] == "identity_conflict":
        return IDENTITY_CONFLICT_EXIT

    if preflight["ahead"] and not args.review_only:
        raise SystemExit(
            f"Ilyenkov branch is ahead of {preflight['upstream']} by {preflight['ahead']} commits; "
            "resolve the release blocker or rerun with --review-only"
        )

    review_mode = "revision" if identity_result["status"] == "revision_confirmed" else "initial"
    batch_id = next_batch_id(
        date_value=date.today().isoformat(),
        slug=args.slug,
        review_mode=review_mode,
    )
    work_dir_name = (
        args.slug
        if review_mode == "initial"
        else batch_id.removeprefix(f"{date.today().isoformat()}-")
    )
    work_dir = WORK_DIR / work_dir_name
    source_blocks = content_blocks(args.source)
    translation_blocks = content_blocks(args.translation)
    alignment, alignment_warnings = structural_alignment(source_blocks, translation_blocks)
    suggestions = parse_suggestions(args.suggestions)
    glossaries = registered_glossaries()
    combined_text = args.source.read_text(encoding="utf-8") + "\n" + args.translation.read_text(encoding="utf-8")
    related_author_ids = related_people(combined_text, author_id)
    glossary_contexts = {
        candidate_id: (
            {
                "formal": True,
                "path": glossaries[candidate_id][0].relative_to(ROOT).as_posix(),
            }
            if candidate_id in glossaries
            else {"formal": False, "path": None}
        )
        for candidate_id in [author_id, *related_author_ids]
    }

    form_review_path = args.form_review or work_dir / "form_review.json"
    form_review = {}
    if form_review_path.is_file():
        form_review = json.loads(form_review_path.read_text(encoding="utf-8"))

    prepared_evidence = []
    form_review_template: dict[str, dict] = {}
    form_review_complete = True
    for suggestion in suggestions:
        matches = glossary_matches(suggestion["canonical"], glossaries)
        seeded_forms = [suggestion["canonical"]]
        for match in matches:
            seeded_forms.extend([match["canonical"], *match["forms"]])
        seeded_forms = list(dict.fromkeys(seeded_forms))
        heuristic = heuristic_forms(suggestion["canonical"], source_blocks, seeded_forms)
        review = form_review.get(suggestion["proposal_id"], {})
        if review:
            confirmed_forms = list(dict.fromkeys(review.get("confirmed_forms", seeded_forms)))
            rejected_forms = set(review.get("rejected_heuristic_forms", []))
            reviewed_forms = {item.casefold() for item in confirmed_forms} | {
                item.casefold() for item in rejected_forms
            }
            pending_forms = [item for item in heuristic if item.casefold() not in reviewed_forms]
            review_status = review.get("status")
            complete = review_status == "confirmed" and not pending_forms
        else:
            confirmed_forms = seeded_forms
            rejected_forms = set()
            pending_forms = heuristic
            review_status = "pending" if heuristic else "confirmed"
            complete = not heuristic
        form_review_complete = form_review_complete and complete
        form_review_template[suggestion["proposal_id"]] = {
            "canonical": suggestion["canonical"],
            "status": review_status,
            "confirmed_forms": confirmed_forms,
            "rejected_heuristic_forms": sorted(rejected_forms),
            "pending_heuristic_forms": pending_forms,
        }
        article_count, article_locations = occurrences_for_forms(source_blocks, confirmed_forms)
        prepared_evidence.append(
            {
                **suggestion,
                "existing_glossary_matches": matches,
                "confirmed_forms": confirmed_forms,
                "heuristic_forms_requiring_confirmation": pending_forms,
                "form_review_status": review_status,
                "article_evidence": {
                    "count": article_count,
                    "locations": article_locations,
                },
            }
        )
    corpus_by_proposal, corpus_cache_hit = corpus_evidence_batch(
        author_id,
        {
            item["proposal_id"]: item["confirmed_forms"]
            for item in prepared_evidence
        },
    )
    evidence = [
        {
            **item,
            "author_corpus_evidence": corpus_by_proposal[item["proposal_id"]],
            "cache_hit": corpus_cache_hit,
        }
        for item in prepared_evidence
    ]
    cache_hits = len(evidence) if corpus_cache_hit else 0

    work_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema_version": 1,
        "batch_id": batch_id,
        "slug": args.slug,
        "review_mode": review_mode,
        "work_identity": identity,
        "identity_preflight": identity_result,
        "primary_author_id": author_id,
        "primary_author": author,
        "related_author_ids": related_author_ids,
        "glossary_contexts": glossary_contexts,
        "inputs": inputs,
        "git_preflight": preflight,
        "source_block_count": len(source_blocks),
        "translation_block_count": len(translation_blocks),
        "suggestion_count": len(suggestions),
        "alignment_warnings": alignment_warnings,
        "cache_hits": cache_hits,
        "form_review_complete": form_review_complete,
    }
    write_json(work_dir / "manifest.json", manifest)
    write_json(work_dir / "source_blocks.json", source_blocks)
    write_json(work_dir / "translation_blocks.json", translation_blocks)
    write_json(work_dir / "alignment.json", alignment)
    write_json(work_dir / "terminology_evidence.json", evidence)
    write_json(work_dir / "risk_summary.json", risk_summary(source_blocks, translation_blocks))
    write_json(work_dir / "form_review.json", form_review_template)
    write_json(
        work_dir / "batch_draft.json",
        batch_draft(
            batch_id=batch_id,
            slug=args.slug,
            work_id=work_id,
            author_id=author_id,
            related_author_ids=related_author_ids,
            inputs=inputs,
            source_blocks=source_blocks,
            translation_blocks=translation_blocks,
            evidence=evidence,
            work_identity=identity,
            identity_result=identity_result,
        ),
    )
    (work_dir / "review_packet.md").write_text(
        render_packet(manifest, source_blocks, translation_blocks, evidence),
        encoding="utf-8",
    )
    print(work_dir.relative_to(ROOT))
    print(
        f"source_blocks={len(source_blocks)} translation_blocks={len(translation_blocks)} "
        f"suggestions={len(suggestions)} cache_hits={cache_hits}"
    )
    if not form_review_complete:
        print(f"warning: confirm or reject heuristic forms in {form_review_path}")
    for warning in alignment_warnings:
        print(f"warning: {warning}")
    return 0


def batch_draft(
    *,
    batch_id: str,
    slug: str,
    work_id: str,
    author_id: str,
    related_author_ids: list[str],
    inputs: list[dict],
    source_blocks: list[dict],
    translation_blocks: list[dict],
    evidence: list[dict],
    work_identity: dict,
    identity_result: dict,
) -> dict:
    today = date.today().isoformat()
    review_mode = "revision" if identity_result["status"] == "revision_confirmed" else "initial"
    selected = identity_result.get("selected", {})
    public_inputs = [
        {key: value for key, value in item.items() if key != "live_path"}
        for item in inputs
    ]
    decisions = []
    for item in evidence:
        article = item["article_evidence"]
        corpus = item["author_corpus_evidence"]
        locations = [
            f"{location['block']}@L{location['line_start']}"
            for location in article["locations"]
        ]
        decisions.append(
            {
                "proposal_id": item["proposal_id"],
                "term_ids": [match["entry_id"] for match in item["existing_glossary_matches"]],
                "target_author_ids": [],
                "canonical": item["canonical"],
                "forms": item["confirmed_forms"],
                "suggested_zh": item["suggested_zh"],
                "operations": [],
                "before": "",
                "after": "",
                "article_evidence": {
                    "count": article["count"],
                    "locations": locations,
                    "summary": f"{article['count']}；{', '.join(locations) or '未命中'}",
                },
                "corpus_evidence": {
                    "count": corpus["total"],
                    "documents": corpus["documents"],
                    "summary": f"{corpus['total']} / {corpus['documents']} 篇",
                    "representative_contexts": corpus["representatives"],
                },
                "rationale": "",
                "final_status_by_author": {},
                "affected_translation_locations": [],
                "affected_translation_summary": "",
                "heuristic_forms_pending": item["heuristic_forms_requiring_confirmation"],
            }
        )
    return {
        "schema_version": 1,
        "audit_only": True,
        "record_format": "native",
        "batch_id": batch_id,
        "batch_kind": "article_review",
        "date": today,
        "review_mode": review_mode,
        "work_identity": work_identity,
        "supersedes_batch_id": (
            selected.get("batch_id") if selected.get("kind") == "batch" else None
        ),
        "supersedes_blog_slug": (
            selected.get("article_slug") if selected.get("kind") == "blog" else None
        ),
        "previous_translation_sha256": selected.get("translation_sha256"),
        "changed_input_roles": selected.get("changed_input_roles", []),
        "unknown_previous_input_roles": selected.get("unknown_input_roles", []),
        "identity_match_reasons": selected.get("match_reasons", []),
        "primary_author_id": author_id,
        "related_author_ids": related_author_ids,
        "work_id": work_id,
        "article_slug": slug,
        "inputs": public_inputs,
        "source_candidate_count": len(decisions),
        "review": {
            "accuracy": {
                "full_pass": False,
                "source_blocks": f"b0001-b{len(source_blocks):04d}",
                "coverage": "",
            },
            "language": {
                "full_pass": False,
                "translation_blocks": f"b0001-b{len(translation_blocks):04d}",
                "coverage": "",
            },
            "final_translation_sha256": next(
                item["sha256"] for item in public_inputs if item["role"] == "translation"
            ),
            "blockers": ["审校未完成"],
        },
        "operation_counts": {
            "add": 0,
            "modify": 0,
            "delete": 0,
            "status": 0,
            "reject": 0,
            "no_formal_glossary": 0,
        },
        "decisions": decisions,
        "owner_review": {
            "status": "pending",
            "reviewer": "hoshF",
            "reviewed_at": None,
            "note": "提交前由项目所有者审核；不表示正式翻译项目 reviewed 状态。",
        },
    }


def print_identity_preflight(result: dict) -> None:
    print(f"identity_preflight={result['status']}")
    if result.get("message"):
        print(f"message={result['message']}")
    if result.get("reuse_target"):
        print(f"reuse_target={result['reuse_target']}")
    for item in result.get("matches", []):
        changed = ",".join(item.get("changed_input_roles", [])) or "-"
        unknown = ",".join(item.get("unknown_input_roles", [])) or "-"
        reasons = ",".join(item.get("match_reasons", []))
        print(
            f"match={item['target']} reasons={reasons} "
            f"changed={changed} unknown={unknown} path={item['path']}"
        )
    for item in result.get("title_hints", []):
        print(f"title_hint={item['target']} title={item['title']}")
    allowed = result.get("allowed_revision_targets", [])
    if allowed:
        print(f"revision_of_required={'|'.join(allowed)}")


def render_packet(
    manifest: dict,
    source_blocks: list[dict],
    translation_blocks: list[dict],
    evidence: list[dict],
) -> str:
    lines = [
        f"# 审校工作包：{manifest['slug']}",
        "",
        "> 本文件位于忽略目录，只用于本批完整通读；结构对齐是风险提示，不是语义裁定。",
        "",
        "## 批次摘要",
        "",
        f"- 主作者：`{manifest['primary_author_id']}`",
        f"- 关联作者：{', '.join(manifest['related_author_ids']) or '无'}",
        "- 正式术语表："
        + "；".join(
            f"`{author_id}`={'有' if context['formal'] else '无'}"
            for author_id, context in manifest["glossary_contexts"].items()
        ),
        f"- 原文块：{len(source_blocks)}",
        f"- 译文块：{len(translation_blocks)}",
        f"- 术语候选：{len(evidence)}",
        "",
        "## 术语证据摘要",
        "",
        "| 候选 | 建议译法 | 本文确认频次 | 作者语料 | 现有词条 | 待确认词形 |",
        "|---|---|---:|---:|---|---|",
    ]
    for item in evidence:
        matches = ", ".join(
            f"{match['author_id']}:{match['entry_id']}" for match in item["existing_glossary_matches"]
        ) or "-"
        heuristic = ", ".join(item["heuristic_forms_requiring_confirmation"]) or "-"
        lines.append(
            f"| `{item['canonical']}` | {item['suggested_zh']} | "
            f"{item['article_evidence']['count']} | {item['author_corpus_evidence']['total']} / "
            f"{item['author_corpus_evidence']['documents']} 篇 | {matches} | {heuristic} |"
        )
    lines.extend(["", "## 原文内容块", ""])
    for block in source_blocks:
        lines.extend(
            [
                f"### source-{block['id']} · L{block['line_start']}–{block['line_end']} · {block['section'] or '开头'}",
                "",
                block["text"],
                "",
            ]
        )
    lines.extend(["## 译文内容块", ""])
    for block in translation_blocks:
        lines.extend(
            [
                f"### translation-{block['id']} · L{block['line_start']}–{block['line_end']} · {block['section'] or '开头'}",
                "",
                block["text"],
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as error:
        raise SystemExit(str(error)) from None
