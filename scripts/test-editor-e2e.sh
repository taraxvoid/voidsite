#!/bin/sh
# Signed-in editor e2e: wipes the local D1 so Emdash's setup wizard runs and
# points the built Worker at the local origin. (Emdash derives the passkey's
# relying-party id from EMDASH_SITE_URL, and `astro preview` uses the vars
# baked into the built config, not .dev.vars, so patch dist directly.)
set -e
PORT=4243
CONFIG=dist/server/wrangler.json
rm -rf .wrangler/state
trap 'rm -rf .wrangler/state' EXIT
aube run build
jq --arg url "http://localhost:$PORT" '.vars.EMDASH_SITE_URL = $url' "$CONFIG" > "$CONFIG.tmp"
mv "$CONFIG.tmp" "$CONFIG"
EDITOR_E2E=1 PLAYWRIGHT_TEST_PORT="$PORT" \
    aube exec playwright test test/e2e/editor-storage.spec.ts --project=desktop-chrome "$@"
