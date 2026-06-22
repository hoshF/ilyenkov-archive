#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo 'usage: scripts/publish_public.sh "commit message"' >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_WORKTREE="$ROOT/dist/public"
PRIVATE_REPO="hoshF/Ilyenkov-cn-private"
PUBLIC_REPO="hoshF/Ilyenkov-cn"

cd "$ROOT"
python3 scripts/manage_collections.py check
python3 scripts/check_project_docs.py
python3 scripts/prepare_gbrain_markdown.py --check
python3 scripts/verify_corpus_manifests.py
python3 scripts/split_longform_markdown.py --check
python3 scripts/update_agents_guide.py --check
python3 -m unittest discover -s tests
python3 scripts/export_public.py
python3 scripts/export_public.py --verify

parent_origin="$(git remote get-url origin)"
if [[ "$parent_origin" != "git@github.com:${PRIVATE_REPO}.git" && "$parent_origin" != "https://github.com/${PRIVATE_REPO}.git" ]]; then
  echo "refusing publish: parent origin is not ${PRIVATE_REPO}: $parent_origin" >&2
  exit 1
fi
if [[ "$(gh repo view "$PRIVATE_REPO" --json isPrivate --jq .isPrivate)" != "true" ]]; then
  echo "refusing publish: parent remote is not private" >&2
  exit 1
fi
if [[ ! -f "$PUBLIC_WORKTREE/.git" ]]; then
  echo "refusing publish: dist/public is not a separate-git-dir worktree" >&2
  exit 1
fi
public_origin="$(git -C "$PUBLIC_WORKTREE" remote get-url origin)"
if [[ "$public_origin" != "git@github.com:${PUBLIC_REPO}.git" && "$public_origin" != "https://github.com/${PUBLIC_REPO}.git" ]]; then
  echo "refusing publish: nested origin is not ${PUBLIC_REPO}: $public_origin" >&2
  exit 1
fi
if [[ "$(gh repo view "$PUBLIC_REPO" --json isPrivate --jq .isPrivate)" != "false" ]]; then
  echo "refusing publish: nested remote is not public" >&2
  exit 1
fi

git -C "$PUBLIC_WORKTREE" add -A
if git -C "$PUBLIC_WORKTREE" diff --cached --quiet; then
  echo "public export has no changes"
else
  git -C "$PUBLIC_WORKTREE" commit -m "$1"
fi
git -C "$PUBLIC_WORKTREE" push origin HEAD:main
git -C "$PUBLIC_WORKTREE" fetch origin main
git -C "$PUBLIC_WORKTREE" diff --exit-code HEAD origin/main
test -z "$(git -C "$PUBLIC_WORKTREE" status --porcelain)"
python3 scripts/export_public.py --verify
echo "public publish verified against origin/main"
