#!/usr/bin/env bash
# bootstrap.sh — Initialize the harness template for a specific project.
# Usage: ./harness/scripts/bootstrap.sh <project-name>
#
# Does:
#   1. Validates project name format
#   2. Replaces 'harness-template' placeholder in config files
#   3. Updates LICENSE copyright year
#   4. Initializes git if needed
#   5. Makes all harness scripts executable
#   6. Installs git hooks
#   7. Runs doctor to verify

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if [ $# -eq 0 ]; then
  echo "Usage: ./harness/scripts/bootstrap.sh <project-name>"
  echo ""
  echo "Example: ./harness/scripts/bootstrap.sh my-awesome-service"
  echo ""
  echo "project-name must be: lowercase, kebab-case (e.g., my-project)"
  exit 1
fi

PROJECT_NAME="$1"

# Validate project name format (kebab-case)
if ! echo "$PROJECT_NAME" | grep -qP '^[a-z0-9]+(-[a-z0-9]+)*$'; then
  echo "ERROR: project-name must be lowercase kebab-case (e.g., my-project, auth-service)"
  echo "Got: $PROJECT_NAME"
  exit 1
fi

echo "Bootstrapping harness for project: $PROJECT_NAME"
echo ""

# ── Step 1: Replace placeholder in config ────
echo "── Updating harness/config.json..."
if [ -f "$REPO_ROOT/harness/config.json" ]; then
  # Use a temp file for portability (BSD sed vs GNU sed)
  TMP=$(mktemp)
  jq --arg name "$PROJECT_NAME" '.project_name = $name' "$REPO_ROOT/harness/config.json" > "$TMP"
  mv "$TMP" "$REPO_ROOT/harness/config.json"
  echo "  project_name set to: $PROJECT_NAME"
fi

# ── Step 2: Replace in .env.example ──────────
echo "── Updating .env.example..."
if [ -f "$REPO_ROOT/.env.example" ]; then
  sed -i.bak "s/harness-template/$PROJECT_NAME/g" "$REPO_ROOT/.env.example"
  rm -f "$REPO_ROOT/.env.example.bak"
fi

# ── Step 3: Update README title ──────────────
echo "── Updating README.md..."
if [ -f "$REPO_ROOT/README.md" ]; then
  # Convert kebab-case to Title Case
  TITLE=$(echo "$PROJECT_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2); print}')
  # Only replace first occurrence (the H1 title)
  sed -i.bak "1s/# Harness Engineering Template/# $TITLE/" "$REPO_ROOT/README.md"
  rm -f "$REPO_ROOT/README.md.bak"
fi

# ── Step 4: Update LICENSE copyright ─────────
echo "── Updating LICENSE..."
if [ -f "$REPO_ROOT/LICENSE" ]; then
  CURRENT_YEAR=$(date +%Y)
  sed -i.bak "s/2026/$CURRENT_YEAR/g" "$REPO_ROOT/LICENSE"
  sed -i.bak "s/Harness Engineering Template Contributors/$PROJECT_NAME contributors/g" "$REPO_ROOT/LICENSE"
  rm -f "$REPO_ROOT/LICENSE.bak"
fi

# ── Step 5: Git init if needed ───────────────
echo "── Checking git..."
if ! git rev-parse --git-dir &>/dev/null; then
  echo "  Initializing git repository..."
  git init "$REPO_ROOT"
  git -C "$REPO_ROOT" checkout -b main 2>/dev/null || true
else
  echo "  Git already initialized."
fi

# ── Step 6: Make scripts executable ──────────
echo "── Setting script permissions..."
find "$REPO_ROOT/harness" -name "*.sh" -type f -exec chmod +x {} \;
find "$REPO_ROOT/harness/hooks" -type f -exec chmod +x {} \;
echo "  All harness scripts are now executable."

# ── Step 7: Install hooks ─────────────────────
echo "── Installing git hooks..."
bash "$REPO_ROOT/harness/scripts/install-hooks.sh"

# ── Step 8: Doctor check ─────────────────────
echo ""
echo "── Running doctor..."
if bash "$REPO_ROOT/harness/scripts/doctor.sh"; then
  echo ""
  echo "══════════════════════════════════════════"
  echo "Bootstrap complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Fill in docs/product.md with your project's requirements"
  echo "  2. Fill in docs/architecture.md with your system design"
  echo "  3. Update harness/rules/dependency-layers.json with your src/ layout"
  echo "  4. Run ./harness/scripts/validate.sh before your first commit"
  echo ""
  echo "To verify at any time: ./harness/scripts/doctor.sh"
else
  echo ""
  echo "Bootstrap completed with warnings. Review the doctor output above."
fi
