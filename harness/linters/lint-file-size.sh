#!/usr/bin/env bash
# lint-file-size.sh — Check that files do not exceed size limits.
# Reads harness/rules/file-size-limits.json.
# Exits non-zero if any violations are found.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RULES_FILE="$REPO_ROOT/harness/rules/file-size-limits.json"
ERRORS=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: Rules file not found: $RULES_FILE" >&2
  exit 1
fi

DEFAULT_LIMIT=$(jq -r '.default_limit' "$RULES_FILE")

# Get excluded patterns
readarray -t EXCLUDED < <(jq -r '.excluded_patterns[]' "$RULES_FILE")

is_excluded() {
  local file="$1"
  for pattern in "${EXCLUDED[@]}"; do
    # Simple glob match: convert to bash pattern
    case "$file" in
      $pattern) return 0 ;;
    esac
  done
  return 1
}

get_limit_for_file() {
  local file="$1"
  local rel_file="${file#$REPO_ROOT/}"

  # Check specific rules in order
  while IFS= read -r rule_pattern; do
    case "$rel_file" in
      $rule_pattern)
        jq -r --arg p "$rule_pattern" '.rules[] | select(.pattern == $p) | .limit' "$RULES_FILE"
        return
        ;;
    esac
  done < <(jq -r '.rules[].pattern' "$RULES_FILE")

  echo "$DEFAULT_LIMIT"
}

get_reason_for_file() {
  local file="$1"
  local rel_file="${file#$REPO_ROOT/}"

  while IFS= read -r rule_pattern; do
    case "$rel_file" in
      $rule_pattern)
        jq -r --arg p "$rule_pattern" '.rules[] | select(.pattern == $p) | .reason' "$RULES_FILE"
        return
        ;;
    esac
  done < <(jq -r '.rules[].pattern' "$RULES_FILE")

  echo "Files should be focused and composable."
}

# Find all tracked files (or all files in repo if not a git repo)
if git rev-parse --git-dir &>/dev/null; then
  FILES=$(git ls-files "$REPO_ROOT" 2>/dev/null)
else
  FILES=$(find "$REPO_ROOT" -type f -not -path '*/.git/*')
fi

while IFS= read -r file; do
  [ -f "$file" ] || continue

  rel_file="${file#$REPO_ROOT/}"
  is_excluded "$rel_file" && continue

  # Only check text files
  file --mime-type "$file" 2>/dev/null | grep -q "text/" || continue

  line_count=$(wc -l < "$file")
  limit=$(get_limit_for_file "$file")
  reason=$(get_reason_for_file "$file")

  if [ "$line_count" -gt "$limit" ]; then
    ERRORS=$((ERRORS + 1))
    echo "FILE TOO LARGE: $rel_file"
    echo "  Lines: $line_count (limit: $limit)"
    echo "  Reason: $reason"
    echo "  Fix: Split into focused modules. Each module should have a single clear purpose."
    echo ""
  fi
done <<< "$FILES"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS file(s) exceed size limits."
  exit 1
else
  echo "PASS: All files within size limits."
fi
