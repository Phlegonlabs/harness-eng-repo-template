#!/usr/bin/env bash
# scan-drift.sh — Detect drift between agent entry files and their source of truth.
# AGENTS.md and CLAUDE.md should reflect docs/internal/agent-entry.md.
# Exits 0 (reports warnings, not failures — drift is a signal, not a blocker).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WARNINGS=0

echo "── Drift Detection ─────────────────────────"

# Check 1: AGENTS.md references agent-entry.md
if [ -f "$REPO_ROOT/AGENTS.md" ]; then
  if ! grep -q "agent-entry.md" "$REPO_ROOT/AGENTS.md"; then
    WARNINGS=$((WARNINGS + 1))
    echo "DRIFT: AGENTS.md does not reference docs/internal/agent-entry.md"
    echo "  Fix: Add a pointer to docs/internal/agent-entry.md in AGENTS.md"
    echo "  The shared doc is the single source of truth for agent rules."
    echo ""
  else
    echo "  PASS: AGENTS.md references agent-entry.md"
  fi
fi

# Check 2: CLAUDE.md references agent-entry.md
if [ -f "$REPO_ROOT/CLAUDE.md" ]; then
  if ! grep -q "agent-entry.md" "$REPO_ROOT/CLAUDE.md"; then
    WARNINGS=$((WARNINGS + 1))
    echo "DRIFT: CLAUDE.md does not reference docs/internal/agent-entry.md"
    echo "  Fix: Add a pointer to docs/internal/agent-entry.md in CLAUDE.md"
    echo ""
  else
    echo "  PASS: CLAUDE.md references agent-entry.md"
  fi
fi

# Check 3: harness/rules/ JSON files are all referenced in agent-entry.md
if [ -f "$REPO_ROOT/docs/internal/agent-entry.md" ]; then
  for rule_file in "$REPO_ROOT/harness/rules/"*.json; do
    [ -f "$rule_file" ] || continue
    rule_basename=$(basename "$rule_file")
    if ! grep -q "$rule_basename" "$REPO_ROOT/docs/internal/agent-entry.md"; then
      WARNINGS=$((WARNINGS + 1))
      echo "DRIFT: harness/rules/$rule_basename is not referenced in docs/internal/agent-entry.md"
      echo "  Fix: Add a reference to this rule file in the canonical agent rules doc."
      echo ""
    fi
  done
fi

# Check 4: Layer count consistency — config.json vs dependency-layers.json
if [ -f "$REPO_ROOT/harness/config.json" ] && [ -f "$REPO_ROOT/harness/rules/dependency-layers.json" ]; then
  config_layers=$(jq '.layers | length' "$REPO_ROOT/harness/config.json" 2>/dev/null || echo "0")
  rules_layers=$(jq '.layers | length' "$REPO_ROOT/harness/rules/dependency-layers.json" 2>/dev/null || echo "0")

  if [ "$config_layers" != "$rules_layers" ]; then
    WARNINGS=$((WARNINGS + 1))
    echo "DRIFT: Layer count mismatch"
    echo "  harness/config.json: $config_layers layers"
    echo "  harness/rules/dependency-layers.json: $rules_layers layers"
    echo "  Fix: Keep both files in sync when adding/removing layers."
    echo ""
  else
    echo "  PASS: Layer count consistent between config.json and dependency-layers.json"
  fi
fi

echo ""
if [ "$WARNINGS" -gt 0 ]; then
  echo "WARN: $WARNINGS drift warning(s). Review and reconcile the documents above."
  echo "NOTE: Drift warnings do not block commits but should be resolved regularly."
else
  echo "PASS: No drift detected."
fi
# Always exit 0 — drift is a warning signal, not a hard failure
exit 0
