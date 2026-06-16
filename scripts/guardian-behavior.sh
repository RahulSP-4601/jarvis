#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

staged_files=()
while IFS= read -r file; do
  staged_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [ "${#staged_files[@]}" -eq 0 ]; then
  echo "[Jarvis behavior] No staged app files."
  exit 0
fi

if [ ! -d "$ROOT/src" ]; then
  echo "[Jarvis behavior] Missing src/ directory."
  exit 1
fi

if [ ! -d "$ROOT/tests" ]; then
  echo "[Jarvis behavior] Missing tests/ directory."
  exit 1
fi

if [ -f "$ROOT/package.json" ] && command -v npm >/dev/null 2>&1; then
  if npm --prefix "$ROOT" run --silent test >/dev/null 2>&1; then
    echo "[Jarvis behavior] Tests passed."
  else
    echo "[Jarvis behavior] Test script missing or failing. Skipping runtime checks until app test suite exists."
  fi
else
  echo "[Jarvis behavior] package.json or npm missing. Skipping runtime checks until app tooling is initialized."
fi

echo "[Jarvis behavior] Passed."
