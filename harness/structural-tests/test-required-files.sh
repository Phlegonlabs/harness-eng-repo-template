#!/usr/bin/env bash
# test-required-files.sh — Verify all required harness files exist.
# Reads the required_files list from harness/config.json.
# Exits non-zero if any required files are missing.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CONFIG_FILE="$REPO_ROOT/harness/config.json"
ERRORS=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: harness/config.json not found. The harness is not initialized." >&2
  exit 1
fi

echo "── Required Files ──────────────────────────"

while IFS= read -r required_file; do
  if [ -f "$REPO_ROOT/$required_file" ]; then
    echo "  PASS: $required_file"
  else
    echo "  FAIL: Missing required file: $required_file"
    # Suggest a template if one exists
    basename_file=$(basename "$required_file")
    name_without_ext="${basename_file%.*}"
    if [ -f "$REPO_ROOT/docs/templates/${name_without_ext}.md" ]; then
      echo "        Create from template: cp docs/templates/${name_without_ext}.md $required_file"
    fi
    ERRORS=$((ERRORS + 1))
  fi
done < <(jq -r '.required_files[]' "$CONFIG_FILE")

echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS required file(s) missing."
  exit 1
else
  echo "PASS: All required files present."
fi
