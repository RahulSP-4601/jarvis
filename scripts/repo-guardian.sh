#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
staged_files=()
while IFS= read -r file; do
  staged_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [ "${#staged_files[@]}" -eq 0 ]; then
  echo "[Guardian] No staged files."
  exit 0
fi

run_if_present() {
  local label="$1"
  local script_path="$2"

  if [ -x "$script_path" ]; then
    echo "[Guardian] Running $label"
    "$script_path"
  else
    echo "[Guardian] Missing executable: $script_path"
    exit 1
  fi
}

run_if_present "Jarvis quality guardian" "$ROOT/scripts/guardian-quality.sh"
run_if_present "Jarvis behavior guardian" "$ROOT/scripts/guardian-behavior.sh"

echo "[Guardian] All checks passed."
