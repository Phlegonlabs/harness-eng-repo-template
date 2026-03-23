#!/usr/bin/env bash
# doctor.sh — Harness health check.
# Verifies the harness infrastructure is intact and ready to use.
# Exits non-zero if critical checks fail.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ERRORS=0
WARNINGS=0

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  WARN: $1"; WARNINGS=$((WARNINGS + 1)); }

echo "harness doctor"
echo "══════════════════════════════════════════"

# ── Check 1: Required tools ──────────────────
echo ""
echo "── Tools ───────────────────────────────────"
if command -v jq &>/dev/null; then
  pass "jq is available ($(jq --version))"
else
  fail "jq is not installed. Run: brew install jq  OR  apt install jq"
fi

if command -v git &>/dev/null; then
  pass "git is available ($(git --version | head -1))"
else
  fail "git is not installed."
fi

if command -v bash &>/dev/null; then
  BASH_VERSION_NUM="${BASH_VERSION%%(*}"
  pass "bash is available ($BASH_VERSION_NUM)"
else
  fail "bash is not available."
fi

# ── Check 2: Git repository ──────────────────
echo ""
echo "── Git Repository ───────────────────────────"
if git rev-parse --git-dir &>/dev/null; then
  pass "Git repository initialized"
else
  fail "Not a git repository. Run: git init"
fi

# ── Check 3: Git hooks installed ────────────
echo ""
echo "── Git Hooks ────────────────────────────────"
HOOKS=("pre-commit" "commit-msg" "pre-push")
for hook in "${HOOKS[@]}"; do
  hook_path="$REPO_ROOT/.git/hooks/$hook"
  if [ -f "$hook_path" ] && [ -x "$hook_path" ]; then
    pass "Hook installed: $hook"
  else
    warn "Hook not installed: $hook — run ./harness/scripts/install-hooks.sh"
  fi
done

# ── Check 4: Required harness files ──────────
echo ""
echo "── Harness Files ────────────────────────────"
if [ -f "$REPO_ROOT/harness/config.json" ]; then
  if jq empty "$REPO_ROOT/harness/config.json" 2>/dev/null; then
    pass "harness/config.json is valid JSON"
  else
    fail "harness/config.json is not valid JSON"
  fi
else
  fail "harness/config.json is missing"
fi

RULE_FILES=(
  "harness/rules/dependency-layers.json"
  "harness/rules/file-size-limits.json"
  "harness/rules/naming-conventions.json"
  "harness/rules/forbidden-patterns.json"
)

for rule_file in "${RULE_FILES[@]}"; do
  if [ -f "$REPO_ROOT/$rule_file" ]; then
    if jq empty "$REPO_ROOT/$rule_file" 2>/dev/null; then
      pass "$rule_file is valid JSON"
    else
      fail "$rule_file is not valid JSON"
    fi
  else
    fail "$rule_file is missing"
  fi
done

# ── Check 5: Agent entry files ───────────────
echo ""
echo "── Agent Entry Files ────────────────────────"
for entry_file in AGENTS.md CLAUDE.md; do
  if [ -f "$REPO_ROOT/$entry_file" ]; then
    pass "$entry_file exists"
  else
    warn "$entry_file is missing — agents won't have an entry point"
  fi
done

if [ -f "$REPO_ROOT/docs/internal/agent-entry.md" ]; then
  pass "docs/internal/agent-entry.md exists (canonical rules)"
else
  fail "docs/internal/agent-entry.md is missing — create it from docs/templates/"
fi

# ── Check 6: Bootstrap status ───────────────
echo ""
echo "── Bootstrap Status ─────────────────────────"
if [ -f "$REPO_ROOT/harness/config.json" ]; then
  project_name=$(jq -r '.project_name' "$REPO_ROOT/harness/config.json" 2>/dev/null || echo "")
  if [ "$project_name" = "harness-template" ]; then
    warn "Project name is still 'harness-template'. Run: ./harness/scripts/bootstrap.sh <your-project-name>"
  else
    pass "Project name: $project_name"
  fi
fi

# ── Check 7: Script permissions ─────────────
echo ""
echo "── Script Permissions ───────────────────────"
SCRIPTS=(
  "harness/scripts/validate.sh"
  "harness/scripts/bootstrap.sh"
  "harness/scripts/doctor.sh"
  "harness/scripts/install-hooks.sh"
  "harness/linters/lint-all.sh"
  "harness/structural-tests/test-all.sh"
  "harness/entropy/scan-all.sh"
)
for script in "${SCRIPTS[@]}"; do
  if [ -f "$REPO_ROOT/$script" ]; then
    if [ -x "$REPO_ROOT/$script" ]; then
      pass "$script is executable"
    else
      warn "$script is not executable — run: chmod +x $script"
    fi
  else
    fail "$script is missing"
  fi
done

# ── Summary ──────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL: $ERRORS error(s), $WARNINGS warning(s)"
  echo "Fix errors above before using the harness."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo "PASS with warnings: $WARNINGS warning(s) — review above"
else
  echo "PASS: Harness is healthy."
fi
