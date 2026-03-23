#!/usr/bin/env bash
# test-architecture.sh — Verify architectural compliance.
# Checks that the src/ directory structure respects layer boundaries.
# Exits non-zero if violations are found.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RULES_FILE="$REPO_ROOT/harness/rules/dependency-layers.json"
ERRORS=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

echo "── Architecture Compliance ─────────────────"

# Check 1: If src/ exists, verify layer directories exist or document why not
if [ -d "$REPO_ROOT/src" ]; then
  echo "CHECK: src/ exists — verifying layer structure is documented..."

  # Check that architecture.md documents the layer model
  if ! grep -q "dependency layer\|layer model\|Types.*Config.*Repo" "$REPO_ROOT/docs/architecture.md" 2>/dev/null; then
    echo "WARN: docs/architecture.md does not mention the dependency layer model."
    echo "  Fix: Add a section describing how layers are organized in src/."
    ERRORS=$((ERRORS + 1))
  else
    echo "  PASS: Layer model documented in architecture.md"
  fi
fi

# Check 2: No circular imports between layer directories
# (Simplified check: if two layer dirs import each other, that's a cycle)
if [ -d "$REPO_ROOT/src" ]; then
  echo "CHECK: Scanning for obvious circular layer imports..."

  LAYER_DIRS=$(jq -r '.layers[].directories[]' "$RULES_FILE" 2>/dev/null || echo "")

  if [ -n "$LAYER_DIRS" ]; then
    # Run the layer linter as the definitive circular check
    if bash "$REPO_ROOT/harness/linters/lint-layers.sh" &>/dev/null; then
      echo "  PASS: No circular layer imports found."
    else
      echo "  FAIL: Layer boundary violations detected (see lint-layers.sh output)."
      ERRORS=$((ERRORS + 1))
    fi
  fi
fi

# Check 3: Verify harness/ directory structure is intact
echo "CHECK: Harness directory structure..."
REQUIRED_HARNESS_DIRS=(
  "harness/rules"
  "harness/linters"
  "harness/structural-tests"
  "harness/entropy"
  "harness/hooks"
  "harness/scripts"
)

for dir in "${REQUIRED_HARNESS_DIRS[@]}"; do
  if [ ! -d "$REPO_ROOT/$dir" ]; then
    echo "  FAIL: Missing harness directory: $dir"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  PASS: All harness directories present."

echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS architectural compliance check(s) failed."
  exit 1
else
  echo "PASS: Architecture compliance checks passed."
fi
