#!/usr/bin/env bash
# validate.sh — Full validation suite. This is the CI contract.
# Runs: doctor → linters → structural tests → entropy scans
# Exits non-zero if any hard check fails (entropy scans are advisory only).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HARD_ERRORS=0

run_step() {
  local label="$1"
  local script="$2"
  local hard="${3:-true}"  # false = advisory (entropy scans)

  echo ""
  echo "════════════════════════════════════════════"
  echo "  $label"
  echo "════════════════════════════════════════════"

  if bash "$script"; then
    echo ""
    echo "  ✓ $label passed"
  else
    echo ""
    if [ "$hard" = "true" ]; then
      echo "  ✗ $label FAILED (blocking)"
      HARD_ERRORS=$((HARD_ERRORS + 1))
    else
      echo "  ⚠ $label reported warnings (advisory)"
    fi
  fi
}

echo "harness validate"
echo "════════════════════════════════════════════"
echo "Full validation suite — $(date)"

run_step "1. Health Check"        "$REPO_ROOT/harness/scripts/doctor.sh"
run_step "2. Linters"             "$REPO_ROOT/harness/linters/lint-all.sh"
run_step "3. Structural Tests"    "$REPO_ROOT/harness/structural-tests/test-all.sh"
run_step "4. Entropy Scans"       "$REPO_ROOT/harness/entropy/scan-all.sh" "false"

echo ""
echo "════════════════════════════════════════════"
if [ "$HARD_ERRORS" -gt 0 ]; then
  echo "FAIL: $HARD_ERRORS step(s) failed."
  echo ""
  echo "Fix the issues above before opening a PR or handing off."
  exit 1
else
  echo "PASS: All validation checks passed."
  echo "This repo is ready for PR / handoff."
fi
