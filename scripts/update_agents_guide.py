#!/usr/bin/env python3
"""Refresh the machine-generated status blocks inside AGENTS.md.

AGENTS.md is the lightweight AI entry point for this repository. Most of the
file is narrative that humans / agents edit by hand. This script rewrites two
fenced regions:

  * STABLE  (between AGENTS-AUTO markers) — repository-size counts. These change
    only when files are added or removed, and they are stable across a commit
    boundary, so ``--check`` enforces them (e.g. in scripts/publish_public.sh).

  * LIVE    (between AGENTS-LIVE markers) — branch / HEAD / worktree / recent
    commits. These change at every commit, and the pre-commit hook captures
    state *before* the commit lands, so they are inherently a little stale right
    afterwards. They are refreshed for reading but deliberately NOT gated by
    ``--check`` (otherwise publish would fail on every clean tree).

Usage:
    python3 scripts/update_agents_guide.py            # rewrite both regions
    python3 scripts/update_agents_guide.py --check     # exit 1 if STABLE is stale
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collection_registry import collection_roots

AUTO_BEGIN = "<!-- AGENTS-AUTO:BEGIN -->"
AUTO_END = "<!-- AGENTS-AUTO:END -->"
LIVE_BEGIN = "<!-- AGENTS-LIVE:BEGIN -->"
LIVE_END = "<!-- AGENTS-LIVE:END -->"

CHAPTER_RE = re.compile(r"-ch\d{3}\.md$")


def git(repo: Path, *args: str) -> str:
    """Run a git command at ``repo`` and return stripped stdout (or "")."""
    try:
        out = subprocess.run(
            ["git", *args],
            cwd=repo,
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""
    return out.stdout.strip()


def repo_root() -> Path:
    top = git(Path.cwd(), "rev-parse", "--show-toplevel")
    if not top:
        sys.exit("error: not inside a git repository")
    return Path(top)


def ahead_behind(repo: Path) -> str:
    upstream = git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if not upstream:
        return "无上游（未设置 tracking 分支）"
    counts = git(repo, "rev-list", "--left-right", "--count", f"{upstream}...HEAD")
    if not counts:
        return f"上游 `{upstream}`（无法比较）"
    behind, ahead = (counts.split() + ["?", "?"])[:2]
    return f"领先 `{upstream}` {ahead} 个提交，落后 {behind} 个"


def worktree_counts(repo: Path) -> tuple[int, int]:
    """Return (changed tracked files, untracked files) from porcelain status."""
    changed = untracked = 0
    for line in git(repo, "status", "--porcelain").splitlines():
        if line.startswith("??"):
            untracked += 1
        elif line.strip():
            changed += 1
    return changed, untracked


def build_stable(repo: Path) -> str:
    """Repo-size facts: stable across a commit boundary, enforced by --check."""
    tracked = [f for f in git(repo, "ls-files").splitlines() if f]
    md = [f for f in tracked if f.endswith(".md")]
    chapters = [f for f in md if CHAPTER_RE.search(f)]
    corpus_md = [f for f in md if f.startswith(collection_roots(repo))]
    work_manifests = [f for f in tracked if f.endswith("work_manifest.json")]
    branch = git(repo, "rev-parse", "--abbrev-ref", "HEAD") or "(detached)"
    return "\n".join(
        [
            AUTO_BEGIN,
            "<!-- 由 scripts/update_agents_guide.py 生成；--check 强校验本块。 -->",
            "",
            "**仓库规模**（说明为什么不要通读）",
            "",
            "| 跟踪文件 | Markdown | 语料 md | 切章文件 | 切章作品 | 分支 |",
            "|---:|---:|---:|---:|---:|:--|",
            f"| {len(tracked)} | {len(md)} | {len(corpus_md)} | "
            f"{len(chapters)} | {len(work_manifests)} | `{branch}` |",
            "",
            AUTO_END,
        ]
    )


def build_live(repo: Path) -> str:
    """Git progress: volatile, refreshed for reading but NOT gated by --check."""
    head = git(repo, "log", "-1", "--format=%h  %s") or "(no commits)"
    recent = git(repo, "log", "-6", "--format=- `%h` %s")
    changed, untracked = worktree_counts(repo)
    return "\n".join(
        [
            LIVE_BEGIN,
            "<!-- 由 scripts/update_agents_guide.py 生成；提交时由钩子刷新，--check 不强校验。 -->",
            "",
            "**Git 进度（提交时刷新，可能滞后一个提交）**",
            "",
            f"- {ahead_behind(repo)}",
            f"- HEAD：{head}",
            f"- 工作区：{changed} 个已改跟踪文件，{untracked} 个未跟踪文件未提交",
            "",
            "**最近提交**",
            "",
            recent or "- （无）",
            "",
            LIVE_END,
        ]
    )


def splice(text: str, begin: str, end: str, block: str, *, required: bool) -> str:
    pattern = re.compile(re.escape(begin) + r".*?" + re.escape(end), re.DOTALL)
    if not pattern.search(text):
        if required:
            sys.exit(
                f"error: markers not found in AGENTS.md\n"
                f"       expected a region between {begin!r} and {end!r}"
            )
        return text
    return pattern.sub(lambda _: block, text, count=1)


def region(text: str, begin: str, end: str) -> str:
    m = re.search(re.escape(begin) + r".*?" + re.escape(end), text, re.DOTALL)
    return m.group(0) if m else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if the STABLE block is stale instead of rewriting",
    )
    args = parser.parse_args()

    repo = repo_root()
    target = repo / "AGENTS.md"
    if not target.exists():
        sys.exit(f"error: {target} does not exist")

    current = target.read_text(encoding="utf-8")
    stable = build_stable(repo)

    if args.check:
        if region(current, AUTO_BEGIN, AUTO_END) != stable:
            print(
                "AGENTS.md size block is stale. "
                "Run: python3 scripts/update_agents_guide.py",
                file=sys.stderr,
            )
            return 1
        print("AGENTS.md size block is up to date.")
        return 0

    updated = splice(current, AUTO_BEGIN, AUTO_END, stable, required=True)
    updated = splice(updated, LIVE_BEGIN, LIVE_END, build_live(repo), required=False)
    if current != updated:
        target.write_text(updated, encoding="utf-8")
        print("AGENTS.md status blocks refreshed.")
    else:
        print("AGENTS.md status blocks already up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
