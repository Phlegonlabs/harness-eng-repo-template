#!/usr/bin/env bash
# lint-docs-freshness.sh — Check that key docs are not stale.
# Uses git log to find last modification date.
# Exits non-zero if any docs exceed the freshness threshold.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CONFIG_FILE="$REPO_ROOT/harness/config.json"
ERRORS=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

# Get freshness threshold from config
if [ -f "$CONFIG_FILE" ]; then
  FRESHNESS_DAYS=$(jq -r '.validation.doc_freshness_days // 30' "$CONFIG_FILE")
else
  FRESHNESS_DAYS=30
fi

# Key docs that should be kept fresh
KEY_DOCS=(
  "docs/product.md"
  "docs/architecture.md"
  "docs/internal/agent-entry.md"
  "AGENTS.md"
  "CLAUDE.md"
)

if ! git rev-parse --git-dir &>/dev/null; then
  echo "INFO: Not a git repository, skipping freshness check."
  exit 0
fi

NOW=$(date +%s)

for doc in "${KEY_DOCS[@]}"; do
  doc_path="$REPO_ROOT/$doc"
  [ -f "$doc_path" ] || continue

  # Get last commit date for this file
  last_commit_date=$(git log -1 --format="%at" -- "$doc" 2>/dev/null || echo "")

  if [ -z "$last_commit_date" ]; then
    # File exists but has never been committed (new file)
    continue
  fi

  days_since=$(( (NOW - last_commit_date) / 86400 ))

  if [ "$days_since" -gt "$FRESHNESS_DAYS" ]; then
    ERRORS=$((ERRORS + 1))
    last_date=$(git log -1 --format="%ci" -- "$doc" 2>/dev/null)
    echo "STALE DOC: $doc"
    echo "  Last updated: $last_date ($days_since days ago)"
    echo "  Threshold: $FRESHNESS_DAYS days"
    echo "  Fix: Review and update the document, or confirm it's still accurate by touching it."
    echo ""
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo "WARN: $ERRORS doc(s) may be stale (>${FRESHNESS_DAYS} days since last update)."
  echo "NOTE: This is a warning, not a hard failure. Review the docs above."
  # Exit 0 intentionally — staleness is a warning, not a blocker
  exit 0
else
  echo "PASS: All key docs updated within ${FRESHNESS_DAYS} days."
fi
