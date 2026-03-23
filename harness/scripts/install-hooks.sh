#!/usr/bin/env bash
# install-hooks.sh — Install git hooks from harness/hooks/ into .git/hooks/
# Idempotent: safe to run multiple times.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HOOKS_SRC="$REPO_ROOT/harness/hooks"
HOOKS_DEST="$REPO_ROOT/.git/hooks"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "ERROR: Not a git repository. Run 'git init' first." >&2
  exit 1
fi

mkdir -p "$HOOKS_DEST"

for hook_file in "$HOOKS_SRC"/*; do
  [ -f "$hook_file" ] || continue
  hook_name=$(basename "$hook_file")
  dest="$HOOKS_DEST/$hook_name"

  cp "$hook_file" "$dest"
  chmod +x "$dest"
  echo "  Installed: .git/hooks/$hook_name"
done

echo ""
echo "Hooks installed successfully."
echo "Hooks: pre-commit (linters), commit-msg (format), pre-push (structural tests)"
