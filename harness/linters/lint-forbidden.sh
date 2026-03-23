#!/usr/bin/env bash
# lint-forbidden.sh — Check for forbidden patterns in code.
# Reads harness/rules/forbidden-patterns.json.
# Exits non-zero if any violations are found.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RULES_FILE="$REPO_ROOT/harness/rules/forbidden-patterns.json"
ERRORS=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: Rules file not found: $RULES_FILE" >&2
  exit 1
fi

RULE_COUNT=$(jq '.rules | length' "$RULES_FILE")

for i in $(seq 0 $((RULE_COUNT - 1))); do
  rule_id=$(jq -r ".rules[$i].id" "$RULES_FILE")
  pattern=$(jq -r ".rules[$i].pattern" "$RULES_FILE")
  description=$(jq -r ".rules[$i].description" "$RULES_FILE")
  message=$(jq -r ".rules[$i].message" "$RULES_FILE")

  # Get apply_to patterns
  readarray -t apply_to < <(jq -r ".rules[$i].apply_to[]" "$RULES_FILE")

  # Get exclude patterns
  readarray -t excludes < <(jq -r ".rules[$i].exclude[]? // empty" "$RULES_FILE")

  for apply_pattern in "${apply_to[@]}"; do
    # Collect files matching the apply pattern
    if git rev-parse --git-dir &>/dev/null; then
      FILES=$(git ls-files "$REPO_ROOT" -- "$apply_pattern" 2>/dev/null || true)
    else
      FILES=$(find "$REPO_ROOT" -type f -path "*/$apply_pattern" -not -path '*/.git/*' 2>/dev/null || true)
    fi

    while IFS= read -r file; do
      [ -f "$file" ] || continue

      rel_file="${file#$REPO_ROOT/}"

      # Check excludes
      excluded=false
      for excl_pattern in "${excludes[@]}"; do
        case "$rel_file" in
          $excl_pattern) excluded=true; break ;;
        esac
      done
      $excluded && continue

      # Search for the forbidden pattern
      matches=$(grep -nP "$pattern" "$file" 2>/dev/null || true)

      if [ -n "$matches" ]; then
        while IFS= read -r match; do
          ERRORS=$((ERRORS + 1))
          line_num="${match%%:*}"
          echo "FORBIDDEN PATTERN [$rule_id]: $rel_file:$line_num"
          echo "  Violation: $description"
          echo "  Fix: $message"
          echo ""
        done <<< "$matches"
      fi
    done <<< "$FILES"
  done
done

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS forbidden pattern(s) found."
  exit 1
else
  echo "PASS: No forbidden patterns found."
fi
