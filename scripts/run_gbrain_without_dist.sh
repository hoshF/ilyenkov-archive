#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: scripts/run_gbrain_without_dist.sh <gbrain command...>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
HIDDEN="$ROOT/.dist-gbrain-hidden"
moved=false
digitization_sources=()
digitization_targets=()

restore_dist() {
  local index
  for ((index=${#digitization_sources[@]}-1; index>=0; index--)); do
    if [[ -d "${digitization_targets[$index]}" ]]; then
      mv "${digitization_targets[$index]}" "${digitization_sources[$index]}"
    fi
  done
  if [[ "$moved" == true && -d "$HIDDEN" ]]; then
    mv "$HIDDEN" "$DIST"
  fi
}
trap restore_dist EXIT INT TERM

if [[ -e "$HIDDEN" ]]; then
  echo "refusing GBrain run: temporary path already exists: $HIDDEN" >&2
  exit 1
fi
if [[ -d "$DIST" ]]; then
  mv "$DIST" "$HIDDEN"
  moved=true
fi

while IFS= read -r relative; do
  [[ -z "$relative" ]] && continue
  source_path="$ROOT/$relative/digitization"
  target_path="$ROOT/$relative/.digitization-gbrain-hidden"
  if [[ -e "$target_path" ]]; then
    echo "refusing GBrain run: temporary path already exists: $target_path" >&2
    exit 1
  fi
  if [[ -d "$source_path" ]]; then
    mv "$source_path" "$target_path"
    digitization_sources+=("$source_path")
    digitization_targets+=("$target_path")
  fi
done < <(
  PYTHONPATH="$ROOT/scripts" python3 - "$ROOT" <<'PY'
from pathlib import Path
import sys
from collection_registry import load_registry

root = Path(sys.argv[1])
seen = set()
for collection in load_registry(root).get("collections", []):
    value = collection.get("root")
    if value and value not in seen:
        seen.add(value)
        print(value)
PY
)

cd "$ROOT"
"$@"
