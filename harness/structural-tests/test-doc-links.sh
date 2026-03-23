#!/usr/bin/env bash
# test-doc-links.sh — Verify internal markdown links resolve to real files.
# Parses markdown files in docs/ and checks that [text](path) links exist.
# Exits non-zero if broken links are found.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ERRORS=0

echo "── Document Link Integrity ─────────────────"

# Find all markdown files
MD_FILES=$(find "$REPO_ROOT" -name "*.md" \
  -not -path "*/.git/*" \
  -not -path "*/node_modules/*" \
  -not -path "*/vendor/*" \
  2>/dev/null)

while IFS= read -r md_file; do
  [ -f "$md_file" ] || continue

  rel_file="${md_file#$REPO_ROOT/}"
  dir_of_file=$(dirname "$md_file")

  # Extract internal markdown links: [text](path) — skip http:// and anchors
  while IFS= read -r link; do
    [ -z "$link" ] && continue

    # Skip external URLs
    [[ "$link" =~ ^https?:// ]] && continue
    # Skip pure anchors
    [[ "$link" =~ ^# ]] && continue
    # Strip anchor fragment
    link_path="${link%%#*}"
    [ -z "$link_path" ] && continue

    # Resolve path relative to the markdown file's directory
    if [[ "$link_path" = /* ]]; then
      # Absolute path from repo root
      resolved="$REPO_ROOT$link_path"
    else
      resolved="$dir_of_file/$link_path"
    fi

    # Normalize path (handle ../)
    resolved=$(cd "$(dirname "$resolved")" 2>/dev/null && echo "$(pwd)/$(basename "$resolved")" || echo "$resolved")

    if [ ! -f "$resolved" ] && [ ! -d "$resolved" ]; then
      ERRORS=$((ERRORS + 1))
      echo "BROKEN LINK: $rel_file"
      echo "  Link: $link"
      echo "  Resolved to: ${resolved#$REPO_ROOT/}"
      echo "  Fix: Update the link or create the missing file."
      echo ""
    fi
  done < <(grep -oP '(?<=\()[^)]+(?=\))' "$md_file" 2>/dev/null | grep -v '^http' || true)

done <<< "$MD_FILES"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS broken internal link(s) found."
  exit 1
else
  echo "PASS: All internal document links resolve correctly."
fi
