#!/usr/bin/env bash
# evals/run.sh — deterministic eval runner for the harness template
#
# Usage:
#   EVAL_AGENT_CMD='codex exec --prompt-file {{PROMPT_FILE}}' ./evals/run.sh add-api-health-module
#   EVAL_AGENT_CMD='claude --print --file {{PROMPT_FILE}}' ./evals/run.sh fix-layer-violation
#   ./evals/run.sh --skip-agent add-api-health-module

set -euo pipefail

if [[ "${1:-}" == "--skip-agent" ]]; then
  SKIP_AGENT=1
  shift
else
  SKIP_AGENT=0
fi

TASK_NAME="${1:?Usage: ./evals/run.sh [--skip-agent] <task-name>}"
TASK_FILE="evals/tasks/${TASK_NAME}.md"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "Task file not found: $TASK_FILE"
  exit 1
fi

extract_block() {
  local heading="$1"
  python - "$TASK_FILE" "$heading" <<'PY'
import re
import sys
from pathlib import Path

task_file = Path(sys.argv[1])
heading = sys.argv[2]
text = task_file.read_text(encoding="utf-8")
pattern = re.compile(
    rf"^## {re.escape(heading)}\s*$.*?```bash\n(.*?)```",
    re.MULTILINE | re.DOTALL,
)
match = pattern.search(text)
if match:
    print(match.group(1).rstrip())
PY
}

extract_prompt() {
  python - "$TASK_FILE" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r"^## Task Prompt\s*$([\s\S]*?)(?:^## |\Z)", text, re.MULTILINE)
if not match:
    sys.exit(1)
lines = []
for raw in match.group(1).splitlines():
    if raw.startswith("> "):
        lines.append(raw[2:])
prompt = "\n".join(lines).strip()
if prompt:
    print(prompt)
PY
}

PROMPT="$(extract_prompt)"
SETUP_SCRIPT="$(extract_block "Setup")"
GRADING_SCRIPT="$(extract_block "Grading Script")"

if [[ -z "$PROMPT" ]]; then
  echo "Task prompt missing in $TASK_FILE"
  exit 1
fi

if [[ -z "$GRADING_SCRIPT" ]]; then
  echo "Grading script missing in $TASK_FILE"
  exit 1
fi

ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BRANCH="eval/${TASK_NAME}-$(date +%s)"
PROMPT_FILE="$(mktemp)"
trap 'rm -f "$PROMPT_FILE"' EXIT
printf '%s\n' "$PROMPT" > "$PROMPT_FILE"

echo "Eval task: $TASK_NAME"
echo "Prompt:"
echo "$PROMPT"
echo ""

git checkout -b "$BRANCH" >/dev/null
echo "Branch: $BRANCH"

if [[ -n "$SETUP_SCRIPT" ]]; then
  echo ""
  echo "Running setup..."
  bash -lc "$SETUP_SCRIPT"
fi

if [[ "$SKIP_AGENT" -eq 0 ]]; then
  if [[ -z "${EVAL_AGENT_CMD:-}" ]]; then
    echo ""
    echo "EVAL_AGENT_CMD is required unless --skip-agent is used."
    echo "Use {{PROMPT}} or {{PROMPT_FILE}} placeholders in the command string."
    exit 1
  fi
  AGENT_CMD="${EVAL_AGENT_CMD//'{{PROMPT_FILE}}'/$PROMPT_FILE}"
  AGENT_CMD="${AGENT_CMD//'{{PROMPT}}'/$PROMPT}"
  echo ""
  echo "Running agent command..."
  bash -lc "$AGENT_CMD"
fi

echo ""
echo "Running grading script..."
bash -lc "$GRADING_SCRIPT"

echo ""
echo "Eval complete."
echo "Cleanup:"
echo "  git checkout $ORIGINAL_BRANCH"
echo "  git branch -D $BRANCH"
