#!/usr/bin/env bash
# lint-layers.sh — Check for dependency layer boundary violations.
# Reads harness/rules/dependency-layers.json and scans import statements.
# Exits non-zero if any violations are found.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RULES_FILE="$REPO_ROOT/harness/rules/dependency-layers.json"
ERRORS=0

# Require jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq / apt install jq" >&2
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: Rules file not found: $RULES_FILE" >&2
  exit 1
fi

# Get ordered layer names and their indices
LAYER_NAMES=$(jq -r '.layers[].name' "$RULES_FILE")
LAYER_COUNT=$(echo "$LAYER_NAMES" | wc -l | tr -d ' ')

# Build an associative map of directory patterns to layer index
declare -A DIR_TO_LAYER

while IFS= read -r layer; do
  layer_index=$(jq -r --arg l "$layer" '.layers[] | select(.name == $l) | .index' "$RULES_FILE")
  # Map directories to layer
  while IFS= read -r dir; do
    DIR_TO_LAYER["$dir"]="$layer_index:$layer"
  done < <(jq -r --arg l "$layer" '.layers[] | select(.name == $l) | .directories[]' "$RULES_FILE")
done <<< "$LAYER_NAMES"

get_layer_for_file() {
  local file="$1"
  for dir_pattern in "${!DIR_TO_LAYER[@]}"; do
    if echo "$file" | grep -q "/$dir_pattern/\|^$dir_pattern/"; then
      echo "${DIR_TO_LAYER[$dir_pattern]}"
      return
    fi
  done
  echo ""
}

get_layer_for_import() {
  local import_path="$1"
  get_layer_for_file "$import_path"
}

# Find source files to check
SRC_FILES=$(find "$REPO_ROOT/src" -type f 2>/dev/null || true)

if [ -z "$SRC_FILES" ]; then
  echo "INFO: No src/ directory found, skipping layer lint."
  exit 0
fi

while IFS= read -r file; do
  [ -f "$file" ] || continue

  file_layer_info=$(get_layer_for_file "$file")
  [ -z "$file_layer_info" ] && continue

  file_layer_index="${file_layer_info%%:*}"
  file_layer_name="${file_layer_info##*:}"

  # Extract import paths (handles import/require/from patterns)
  import_paths=$(grep -oP '(?<=from ['"'"'"])[^'"'"'"]+(?=['"'"'"])' "$file" 2>/dev/null || true)
  import_paths+=$'\n'$(grep -oP '(?<=require\(['"'"'"])[^'"'"'"]+(?=['"'"'"])' "$file" 2>/dev/null || true)

  while IFS= read -r imp; do
    [ -z "$imp" ] && continue
    # Skip external packages (no leading ./ or /)
    [[ "$imp" =~ ^\.\.?/ ]] || continue

    import_layer_info=$(get_layer_for_import "$imp")
    [ -z "$import_layer_info" ] && continue

    import_layer_index="${import_layer_info%%:*}"
    import_layer_name="${import_layer_info##*:}"

    if [ "$import_layer_index" -gt "$file_layer_index" ] 2>/dev/null; then
      ERRORS=$((ERRORS + 1))
      allowed=$(jq -r --arg l "$file_layer_name" '.layers[] | select(.name == $l) | .allowed_imports | join(", ")' "$RULES_FILE")
      violation_msg=$(jq -r '.violation_message' "$RULES_FILE")
      echo "LAYER VIOLATION: $file"
      echo "  File layer: $file_layer_name (index: $file_layer_index)"
      echo "  Imports from: $imp (layer: $import_layer_name, index: $import_layer_index)"
      echo "  Allowed imports for '$file_layer_name': $allowed"
      echo "  Fix: Move shared code to a lower layer, or invert the dependency."
      echo ""
    fi
  done <<< "$import_paths"
done <<< "$SRC_FILES"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS layer boundary violation(s) found."
  exit 1
else
  echo "PASS: No layer boundary violations."
fi
