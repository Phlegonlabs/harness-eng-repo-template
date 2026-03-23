#!/usr/bin/env bash
# scan-all.sh — Run all entropy scans in sequence.
# Entropy scans report warnings but do not block — they require human judgement.
# Exits 0 always (entropy is informational).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_scan() {
  local name="$1"
  local script="$2"

  echo "── $name ──────────────────────────────────"
  bash "$script" || true
  echo ""
}

run_scan "Drift Detection"   "$SCRIPT_DIR/scan-drift.sh"
run_scan "Orphan Detection"  "$SCRIPT_DIR/scan-orphans.sh"
run_scan "Consistency Check" "$SCRIPT_DIR/scan-consistency.sh"

echo "════════════════════════════════════════════"
echo "INFO: Entropy scans complete. Review any warnings above."
echo "NOTE: Entropy warnings do not block CI. Address them in a periodic cleanup pass."
