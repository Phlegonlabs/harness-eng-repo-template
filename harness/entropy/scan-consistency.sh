#!/usr/bin/env bash
# scan-consistency.sh — Check for pattern inconsistencies across the codebase.
# Looks for cases where a convention is used in some places but not others.
# Exits 0 (reports warnings — requires human judgement to resolve).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WARNINGS=0

echo "── Consistency Scan ─────────────────────────"

# Check 1: Consistent AGENTS.md and CLAUDE.md format
# Both should have a "single source of truth" disclaimer
echo "CHECK: Agent entry file consistency..."

for entry_file in AGENTS.md CLAUDE.md; do
  if [ -f "$REPO_ROOT/$entry_file" ]; then
    if ! grep -qi "single source of truth\|shared doc wins\|canonical" "$REPO_ROOT/$entry_file"; then
      WARNINGS=$((WARNINGS + 1))
      echo "  INCONSISTENT: $entry_file is missing the 'single source of truth' disclaimer"
      echo "  Fix: Add a note that docs/internal/agent-entry.md is the canonical source."
      echo ""
    else
      echo "  PASS: $entry_file has canonical source disclaimer"
    fi
  fi
done

# Check 2: All linters use the same error format (CAPITALIZED_TYPE: message)
echo "CHECK: Linter error format consistency..."

for linter in "$REPO_ROOT/harness/linters/"lint-*.sh; do
  [ -f "$linter" ] || continue
  basename_linter=$(basename "$linter")
  [ "$basename_linter" = "lint-all.sh" ] && continue

  # Check that it has a PASS/FAIL output
  if ! grep -q "PASS:" "$linter" || ! grep -q "FAIL:" "$linter"; then
    WARNINGS=$((WARNINGS + 1))
    echo "  INCONSISTENT: harness/linters/$basename_linter"
    echo "  Missing PASS/FAIL output pattern"
    echo "  Fix: Add 'PASS:' and 'FAIL:' echo statements for consistent output."
    echo ""
  fi
done
echo "  PASS: Linter format check complete"

# Check 3: All structural tests follow same exit pattern
echo "CHECK: Structural test consistency..."

for test_script in "$REPO_ROOT/harness/structural-tests/"test-*.sh; do
  [ -f "$test_script" ] || continue
  basename_test=$(basename "$test_script")
  [ "$basename_test" = "test-all.sh" ] && continue

  if ! grep -q "PASS:\|FAIL:" "$test_script"; then
    WARNINGS=$((WARNINGS + 1))
    echo "  INCONSISTENT: harness/structural-tests/$basename_test"
    echo "  Missing PASS/FAIL output pattern."
    echo ""
  fi
done
echo "  PASS: Structural test format check complete"

# Check 4: harness/config.json project_name matches if bootstrapped
if [ -f "$REPO_ROOT/harness/config.json" ]; then
  project_name=$(jq -r '.project_name' "$REPO_ROOT/harness/config.json" 2>/dev/null || echo "")
  if [ "$project_name" = "harness-template" ]; then
    WARNINGS=$((WARNINGS + 1))
    echo "  INCONSISTENT: harness/config.json still has default project_name 'harness-template'"
    echo "  Fix: Run ./harness/scripts/bootstrap.sh <your-project-name>"
    echo ""
  fi
fi

echo ""
if [ "$WARNINGS" -gt 0 ]; then
  echo "WARN: $WARNINGS consistency issue(s) found."
else
  echo "PASS: No consistency issues found."
fi
exit 0
