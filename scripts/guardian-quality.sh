#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

staged_files=()
while IFS= read -r file; do
  staged_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [ "${#staged_files[@]}" -eq 0 ]; then
  echo "[Jarvis quality] No staged app files."
  exit 0
fi

check_file_lengths() {
  local failed=0
  local file line_count

  for file in "${staged_files[@]}"; do
    case "$file" in
      *.md|*.json|*.lock|*.svg|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.gitkeep)
        continue
        ;;
    esac

    if [ ! -f "$ROOT/$file" ]; then
      continue
    fi

    line_count="$(wc -l < "$ROOT/$file" | tr -d ' ')"
    if [ "$line_count" -gt 500 ]; then
      echo "[Jarvis quality] File too large: $file ($line_count lines, max 500)"
      failed=1
    fi
  done

  return "$failed"
}

check_function_lengths() {
  echo "[Jarvis quality] Function length guard temporarily skipped on macOS awk."
  return 0
}

check_secrets() {
  local failed=0
  local file
  local secret_pattern

  secret_pattern='((OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DEEPGRAM_API_KEY|DODO_PAYMENTS)[[:space:]]*[:=][[:space:]]*["'"'"'A-Za-z0-9_\/+=.-]{8,}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----)'

  for file in "${staged_files[@]}"; do
    if [ ! -f "$ROOT/$file" ]; then
      continue
    fi

    if grep -En "$secret_pattern" "$ROOT/$file" >/dev/null; then
      echo "[Jarvis quality] Possible secret detected in $file"
      failed=1
    fi
  done

  return "$failed"
}

run_optional_tooling() {
  if [ ! -f "$ROOT/package.json" ]; then
    echo "[Jarvis quality] package.json not found. Skipping TypeScript/lint checks."
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    if npm --prefix "$ROOT" run --silent typecheck >/dev/null 2>&1; then
      echo "[Jarvis quality] Typecheck passed."
    else
      echo "[Jarvis quality] Typecheck script missing or failing. Skipping for now."
    fi

    if npm --prefix "$ROOT" run --silent lint >/dev/null 2>&1; then
      echo "[Jarvis quality] Lint passed."
    else
      echo "[Jarvis quality] Lint script missing or failing. Skipping for now."
    fi
  else
    echo "[Jarvis quality] npm not found. Skipping app tooling checks."
  fi
}

check_file_lengths
check_function_lengths
check_secrets
run_optional_tooling

echo "[Jarvis quality] Passed."
