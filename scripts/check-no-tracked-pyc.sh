#!/usr/bin/env bash
# Fail CI if bytecode or __pycache__ paths are tracked (should stay gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
bad=$(git ls-files | grep -E '(__pycache__/|\.pyc$)' || true)
if [[ -n "${bad}" ]]; then
  echo "ERROR: tracked Python bytecode or __pycache__ paths:" >&2
  echo "${bad}" >&2
  exit 1
fi
echo "OK: no tracked .pyc or __pycache__ files."
