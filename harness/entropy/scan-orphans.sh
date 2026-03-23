#!/usr/bin/env bash
# scan-orphans.sh — Detect files that are not referenced anywhere in the repo.
# Orphaned files accumulate silently and confuse agents reading the codebase.
# Exits 0 (reports warnings — orphan detection requires human judgement).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WARNINGS=0

echo "── Orphan Detection ─────────────────────────"

# Find markdown files in docs/ that are not referenced by any other markdown file
echo "CHECK: Orphaned documentation files..."

DOC_FILES=$(find "$REPO_ROOT/docs" -name "*.md" -type f 2>/dev/null || true)

while IFS= read -r doc; do
  [ -f "$doc" ] || continue
  rel_doc="${doc#$REPO_ROOT/}"
  basename_doc=$(basename "$doc")

  # Skip template files and the index
  case "$basename_doc" in
    "000-template.md") continue ;;
  esac

  # Check if this file is referenced from any other markdown file
  ref_count=$(grep -rl "$rel_doc\|$basename_doc" "$REPO_ROOT" \
    --include="*.md" \
    --exclude-dir=".git" \
    2>/dev/null | grep -v "^$doc$" | wc -l | tr -d ' ')

  if [ "$ref_count" -eq 0 ]; then
    WARNINGS=$((WARNINGS + 1))
    echo "  ORPHAN: $rel_doc"
    echo "          Not referenced from any other document."
    echo "          Fix: Add a link to it from an appropriate doc, or delete it if unused."
    echo ""
  fi
done <<< "$DOC_FILES"

if [ "$WARNINGS" -eq 0 ]; then
  echo "  PASS: No orphaned documentation files found."
fi

echo ""
echo "CHECK: Harness rule files referenced by linters..."

# Check that all rules/*.json are used by at least one linter
for rule_file in "$REPO_ROOT/harness/rules/"*.json; do
  [ -f "$rule_file" ] || continue
  rule_basename=$(basename "$rule_file")
  rule_name="${rule_basename%.json}"

  ref_count=$(grep -rl "$rule_basename\|$rule_name" "$REPO_ROOT/harness/linters" \
    --include="*.sh" \
    2>/dev/null | wc -l | tr -d ' ')

  if [ "$ref_count" -eq 0 ]; then
    WARNINGS=$((WARNINGS + 1))
    echo "  ORPHAN: harness/rules/$rule_basename"
    echo "          Not referenced by any linter script."
    echo "          Fix: Create a linter for this rule or remove the rule file."
    echo ""
  fi
done

echo ""
if [ "$WARNINGS" -gt 0 ]; then
  echo "WARN: $WARNINGS orphan(s) detected. Review the items above."
  echo "NOTE: Orphan warnings do not block commits. Clean up periodically."
else
  echo "PASS: No orphans detected."
fi
exit 0
