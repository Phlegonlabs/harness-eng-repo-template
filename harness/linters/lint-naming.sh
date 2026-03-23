#!/usr/bin/env bash
# lint-naming.sh — Check file naming conventions.
# Reads harness/rules/naming-conventions.json.
# Exits non-zero if any violations are found.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RULES_FILE="$REPO_ROOT/harness/rules/naming-conventions.json"
ERRORS=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: Rules file not found: $RULES_FILE" >&2
  exit 1
fi

is_kebab_case() {
  local name="$1"
  # Allow: lowercase letters, digits, hyphens. Extension handled separately.
  [[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]
}

to_kebab_case() {
  local name="$1"
  # Convert camelCase and PascalCase to kebab-case
  echo "$name" \
    | sed 's/\([a-z0-9]\)\([A-Z]\)/\1-\2/g' \
    | sed 's/_/-/g' \
    | tr '[:upper:]' '[:lower:]'
}

is_excluded() {
  local file="$1"
  while IFS= read -r pattern; do
    case "$file" in
      $pattern) return 0 ;;
    esac
  done < <(jq -r '.excluded_patterns[]' "$RULES_FILE")
  return 1
}

if git rev-parse --git-dir &>/dev/null; then
  FILES=$(git ls-files "$REPO_ROOT" 2>/dev/null)
else
  FILES=$(find "$REPO_ROOT" -type f -not -path '*/.git/*')
fi

while IFS= read -r file; do
  [ -f "$file" ] || continue

  rel_file="${file#$REPO_ROOT/}"
  is_excluded "$rel_file" && continue

  # Get just the filename without extension
  basename_full=$(basename "$file")
  # Handle double extensions like .test.ts
  name_part="${basename_full%%.*}"

  # Check which rule applies to this file's path
  rule_index=0
  matched_case=""
  matched_message=""

  while IFS= read -r rule_path; do
    case "$rel_file" in
      $rule_path)
        matched_case=$(jq -r --argjson i "$rule_index" '.rules[$i].file_case' "$RULES_FILE")
        matched_message=$(jq -r --argjson i "$rule_index" '.rules[$i].violation_message' "$RULES_FILE")
        break
        ;;
    esac
    rule_index=$((rule_index + 1))
  done < <(jq -r '.rules[].path_pattern' "$RULES_FILE")

  [ -z "$matched_case" ] && continue

  case "$matched_case" in
    kebab-case)
      if ! is_kebab_case "$name_part"; then
        suggested=$(to_kebab_case "$name_part")
        ext="${basename_full#$name_part}"
        ERRORS=$((ERRORS + 1))
        echo "NAMING VIOLATION: $rel_file"
        echo "  Expected: kebab-case for the name part"
        echo "  Suggested: ${suggested}${ext}"
        echo "  Message: $matched_message"
        echo ""
      fi
      ;;
  esac
done <<< "$FILES"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS naming convention violation(s) found."
  exit 1
else
  echo "PASS: All file names follow naming conventions."
fi
