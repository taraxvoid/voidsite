#!/bin/sh
# Lint GitHub Actions workflows. Skips quietly when there are none yet.
set -e
[ -d .github/workflows ] || exit 0
# `--version`, not `command -v`: a mise shim with no version set is on PATH but fails.
if jactionlint --version >/dev/null 2>&1; then
  exec jactionlint
fi
echo "lint:actions: jactionlint not installed (https://github.com/jdx/jactionlint); skipping" >&2
