#!/usr/bin/env bash
# test-all.sh — Run all structural tests in sequence.
# Exits non-zero if any test fails.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0

run_test() {
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

run_test "Required Files"         "$SCRIPT_DIR/test-required-files.sh"
run_test "Architecture Compliance" "$SCRIPT_DIR/test-architecture.sh"
run_test "Document Links"         "$SCRIPT_DIR/test-doc-links.sh"

echo "════════════════════════════════════════════"
if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS structural test(s) failed."
  exit 1
else
  echo "PASS: All structural tests passed."
fi
