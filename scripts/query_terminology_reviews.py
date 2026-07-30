#!/usr/bin/env python3
"""Query only terminology review batches relevant to the current task."""

from __future__ import annotations

import argparse
import json
import sys

from check_terminology_reviews import load_batches
from terminology_review_lib import normalize_doi


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--author")
    parser.add_argument("--slug")
    parser.add_argument("--work-id")
    parser.add_argument("--source-path")
    parser.add_argument("--doi")
    parser.add_argument("--term")
    parser.add_argument("--operation", choices=[
        "add", "modify", "delete", "status", "reject", "no_formal_glossary"
    ])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    requested_doi = normalize_doi(args.doi)
    if args.doi and requested_doi is None:
        raise SystemExit(f"invalid DOI: {args.doi}")
    needle = (args.term or "").casefold()
    results = []
    for path, batch in load_batches():
        if args.author and args.author not in {
            batch.get("primary_author_id"),
            *batch.get("related_author_ids", []),
        }:
            continue
        if args.slug and args.slug != batch.get("article_slug"):
            continue
        if args.work_id and args.work_id != batch.get("work_id"):
            continue
        source_path = next(
            (
                item.get("path")
                for item in batch.get("inputs", [])
                if item.get("role") == "source"
            ),
            None,
        )
        if args.source_path and args.source_path != source_path:
            continue
        batch_doi = normalize_doi(batch.get("work_identity", {}).get("doi"))
        if requested_doi and requested_doi != batch_doi:
            continue
        decisions = []
        for decision in batch.get("decisions", []):
            haystack = " ".join(
                [
                    str(decision.get("canonical", "")),
                    " ".join(decision.get("term_ids", [])),
                    " ".join(decision.get("forms", [])),
                    str(decision.get("rationale", "")),
                ]
            ).casefold()
            if needle and needle not in haystack:
                continue
            if args.operation and args.operation not in decision.get("operations", []):
                continue
            decisions.append(decision)
        if (needle or args.operation) and not decisions:
            continue
        results.append(
            {
                "path": path.as_posix(),
                "batch_id": batch["batch_id"],
                "date": batch["date"],
                "author_id": batch["primary_author_id"],
                "work_id": batch["work_id"],
                "article_slug": batch["article_slug"],
                "review_mode": batch.get("review_mode", "legacy"),
                "source_path": source_path,
                "doi": batch_doi,
                "decisions": decisions,
            }
        )
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for result in results:
            print(
                f"{result['date']} {result['author_id']}/{result['work_id']} "
                f"{result['article_slug']} [{result['review_mode']}] "
                f"({len(result['decisions'])} decisions)"
            )
            for decision in result["decisions"]:
                print(
                    f"  {decision['proposal_id']}: {decision['canonical']} "
                    f"[{', '.join(decision['operations'])}]"
                )
    return 0


if __name__ == "__main__":
    sys.exit(main())
