#!/usr/bin/env python3
"""Render the compact terminology review index from structured audit batches."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from terminology_review_lib import REVIEW_DIR, ROOT


OUTPUT = ROOT / "translation_workspace/TERMINOLOGY_CHANGELOG.md"


def load_batches() -> list[tuple[Path, dict[str, Any]]]:
    batches = []
    if REVIEW_DIR.is_dir():
        for path in sorted(REVIEW_DIR.glob("*.json")):
            batches.append((path, json.loads(path.read_text(encoding="utf-8"))))
    return batches


def render_index(batches: list[tuple[Path, dict[str, Any]]]) -> str:
    lines = [
        "---",
        'title: "术语审核批次索引"',
        'created: "2026-07-27"',
        'updated: "2026-07-27"',
        'type: "project"',
        'tags: ["translation", "terminology", "audit-log"]',
        'language: "zh"',
        'collection: "translation-workspace"',
        'llm_wiki_eligible: "true"',
        'gbrain_source: "project-markdown"',
        "---",
        "",
        "# 术语审核批次索引",
        "",
        "本页由 `scripts/render_terminology_reviews.py` 生成，只提供批次导航和数量摘要。",
        "详细审计记录位于 `translation_workspace/terminology_reviews/*.json`；这些记录和本页",
        "都不是第二份术语表，正式译名始终以各作者的 glossary JSON 为准。",
        "",
        "常规任务使用 `scripts/query_terminology_reviews.py` 定向查询，不读取全部批次记录。",
        "",
        "| 日期 | 作者 / 作品 | 文章 | 新增 | 修改 | 删除 | 状态 | 拒绝 | 无正式表 | 所有者复核 |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for path, batch in sorted(
        batches,
        key=lambda item: (item[1].get("date", ""), item[1].get("article_slug", "")),
        reverse=True,
    ):
        counts = batch.get("operation_counts", {})
        owner = batch.get("owner_review", {}).get("status", "pending")
        author_work = f"`{batch.get('primary_author_id', '-')}` / `{batch.get('work_id', '-')}`"
        try:
            link = path.relative_to(OUTPUT.parent).as_posix()
        except ValueError:
            link = path.as_posix()
        article = f"[`{batch.get('article_slug', '-')}`]({link})"
        lines.append(
            "| {date} | {author_work} | {article} | {add} | {modify} | {delete} | "
            "{status} | {reject} | {no_glossary} | {owner} |".format(
                date=batch.get("date", "-"),
                author_work=author_work,
                article=article,
                add=counts.get("add", 0),
                modify=counts.get("modify", 0),
                delete=counts.get("delete", 0),
                status=counts.get("status", 0),
                reject=counts.get("reject", 0),
                no_glossary=counts.get("no_formal_glossary", 0),
                owner=owner,
            )
        )
    lines.extend(
        [
            "",
            "## 操作说明",
            "",
            "- `add`、`modify`、`delete`、`status`：正式 glossary 的历史操作。",
            "- `reject`：已审核但不建立独立词条。",
            "- `no_formal_glossary`：裁定发生时该作者没有正式 glossary，只保留审计证据。",
            "- `owner_review` 是批次提交许可，不是正式翻译项目的 `reviewed` 状态。",
            "",
        ]
    )
    return "\n".join(lines)


def expected_output() -> str:
    return render_index(load_batches())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if not args.write and not args.check:
        args.check = True
    expected = expected_output()
    if args.write:
        OUTPUT.write_text(expected, encoding="utf-8")
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.is_file() else ""
        if current != expected:
            print(f"stale terminology review index: {OUTPUT.relative_to(ROOT)}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
