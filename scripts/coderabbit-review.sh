#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

commit_sha="$(git rev-parse HEAD)"

if [ -n "${CODERABBIT_CMD:-}" ]; then
  echo "[CodeRabbit] Running custom command for $commit_sha"
  eval "$CODERABBIT_CMD \"$commit_sha\""
  exit 0
fi

if command -v coderabbit >/dev/null 2>&1; then
  echo "[CodeRabbit] Reviewing commit $commit_sha"
  coderabbit review "$commit_sha"
  exit 0
fi

if command -v cr >/dev/null 2>&1; then
  echo "[CodeRabbit] Reviewing commit $commit_sha"
  cr review "$commit_sha"
  exit 0
fi

echo "[CodeRabbit] CLI not found. Install it or set CODERABBIT_CMD."
exit 0
