#!/usr/bin/env bash
# lint-all.sh — Run all linters in sequence.
# Exits non-zero if any linter fails.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0
WARNINGS=0

run_linter() {
  local name="$1"
  local script="$2"

  echo "── $name ──────────────────────────────────"
  if bash "$script"; then
    echo ""
  else
    ERRORS=$((ERRORS + 1))
    echo ""
  fi
}

run_linter "Layer Boundaries" "$SCRIPT_DIR/lint-layers.sh"
run_linter "File Sizes"       "$SCRIPT_DIR/lint-file-size.sh"
run_linter "Naming Conventions" "$SCRIPT_DIR/lint-naming.sh"
run_linter "Forbidden Patterns" "$SCRIPT_DIR/lint-forbidden.sh"
run_linter "Doc Freshness"    "$SCRIPT_DIR/lint-docs-freshness.sh"

echo "════════════════════════════════════════════"
if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS linter(s) reported errors."
  exit 1
else
  echo "PASS: All linters passed."
fi
