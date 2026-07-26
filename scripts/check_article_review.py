#!/usr/bin/env python3
"""Run the complete deterministic validation gate for an article review batch."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from terminology_review_lib import ROOT


def run(arguments: list[str]) -> int:
    result = subprocess.run([sys.executable, *arguments], cwd=ROOT, check=False)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=Path, required=True)
    parser.add_argument("--work-package", type=Path)
    parser.add_argument("--write-generated", action="store_true")
    args = parser.parse_args()

    if args.write_generated:
        for command in (
            ["scripts/render_glossaries.py", "--write"],
            ["scripts/render_terminology_reviews.py", "--write"],
        ):
            if run(command):
                return 1

    batch_command = ["scripts/check_terminology_reviews.py", "--check", "--batch", str(args.batch)]
    if args.work_package:
        batch_command.extend(["--work-package", str(args.work_package)])
    commands = [
        batch_command,
        ["scripts/check_glossaries.py", "--check"],
        ["scripts/render_glossaries.py", "--check"],
        ["scripts/render_terminology_reviews.py", "--check"],
        ["scripts/render_prompt_template.py", "--check"],
        ["scripts/check_translations.py", "--check"],
        ["scripts/check_project_docs.py"],
    ]
    for command in commands:
        if run(command):
            return 1
    print("article review validation: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
