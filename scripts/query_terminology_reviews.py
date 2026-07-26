#!/usr/bin/env python3
"""Query only terminology review batches relevant to the current task."""

from __future__ import annotations

import argparse
import json
import sys

from check_terminology_reviews import load_batches


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--author")
    parser.add_argument("--slug")
    parser.add_argument("--term")
    parser.add_argument("--operation", choices=[
        "add", "modify", "delete", "status", "reject", "no_formal_glossary"
    ])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
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
                "decisions": decisions,
            }
        )
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for result in results:
            print(
                f"{result['date']} {result['author_id']}/{result['work_id']} "
                f"{result['article_slug']} ({len(result['decisions'])} decisions)"
            )
            for decision in result["decisions"]:
                print(
                    f"  {decision['proposal_id']}: {decision['canonical']} "
                    f"[{', '.join(decision['operations'])}]"
                )
    return 0


if __name__ == "__main__":
    sys.exit(main())
