#!/bin/sh
# Lint GitHub Actions workflows. Skips quietly when there are none yet.
set -e
[ -d .github/workflows ] || exit 0
if command -v actionlint >/dev/null 2>&1; then
  exec actionlint
fi
echo "lint:actions: actionlint not installed (https://github.com/rhysd/actionlint); skipping" >&2
